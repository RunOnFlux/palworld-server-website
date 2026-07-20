/**
 * Shared helpers for building + encrypting Flux v8 app specs.
 * Used by both the deploy flow (DeploymentDialog) and the manage-panel
 * Environment editor so env handling stays identical.
 */
import apiService from '../services/apiService';
import {
  isWebCryptoAvailable,
  importRsaPublicKey,
  encryptAesKeyWithRsaKey,
  encryptEnterpriseWithAes,
} from './enterpriseCrypto';

// ---------------------------------------------------------------------------
// Port randomization — co-location on one Flux IP
// ---------------------------------------------------------------------------
// To run the same game multiple times on the same physical Flux node/IP, each
// deploy must expose DIFFERENT external ports (the node's public IP is shared,
// up to 8 apps per IP). The container-internal (bind) ports stay FIXED at the
// image defaults — containers have separate network namespaces, so binding
// 8211 inside N containers never collides. Only the EXTERNAL `ports` are
// randomized, into the Flux-allowed high range 35000–65535 (verified clean of
// bannedPorts/enterprisePorts). Index alignment is preserved: ports[i] maps to
// containerPorts[i], so ports[0]=game(UDP 8211), ports[1]=query(UDP 27015),
// ports[2]=REST(TCP 8212).

/** Palworld container (bind) ports — never randomized. */
export const PALWORLD_CONTAINER_PORTS = [8211, 27015, 8212];

const EXTERNAL_PORT_MIN = 35000;
const EXTERNAL_PORT_MAX = 65535;

/** `count` distinct random ports in [35000, 65535]. */
export const generateExternalPorts = (count) => {
  const span = EXTERNAL_PORT_MAX - EXTERNAL_PORT_MIN + 1;
  const set = new Set();
  while (set.size < count) {
    set.add(EXTERNAL_PORT_MIN + Math.floor(Math.random() * span));
  }
  return [...set];
};

/** A component is the Palworld game component if it binds the game port (8211). */
const isPalworldGameComponent = (containerPorts) =>
  Array.isArray(containerPorts) && containerPorts.map(Number).includes(8211);

/**
 * For a NEW deploy: randomize the EXTERNAL ports of the Palworld game component
 * (keeping containerPorts as the fixed bind ports), so the app can co-locate on
 * a shared IP. Non-game components pass through untouched. Field order within
 * each component object is preserved (spread keeps `ports` in place) — required
 * for FluxOS signature verification.
 */
export const applyRandomExternalPorts = (compose) =>
  (compose || []).map((c) => {
    const containerPorts = Array.isArray(c?.containerPorts) ? c.containerPorts : [];
    if (!isPalworldGameComponent(containerPorts)) return c;
    return { ...c, ports: generateExternalPorts(containerPorts.length) };
  });

/**
 * Register an app spec, retrying with freshly re-rolled external ports if the
 * daemon rejects the registration for a port-related reason. The large random
 * range makes collisions extremely rare; this is defensive belt-and-suspenders.
 */
export const registerAppSpecWithPortRetry = async (appSpec, { maxAttempts = 3 } = {}) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await apiService.registerAppSpec(appSpec);
    } catch (err) {
      const msg = String(err?.message || err || '').toLowerCase();
      if (attempt >= maxAttempts || !msg.includes('port')) throw err;
      console.error(`registerAppSpec attempt ${attempt} failed (possible port conflict) — rerolling external ports`, err);
      // Mutate in place so the caller's appSpec reflects the ports actually registered.
      appSpec.compose = applyRandomExternalPorts(appSpec.compose);
    }
  }
};

/**
 * The external game port (index 0 of the Palworld game component) of an app spec
 * or compose array — the port players connect to. Undefined if not present.
 */
export const palworldGamePort = (appSpecOrCompose) => {
  const compose = Array.isArray(appSpecOrCompose) ? appSpecOrCompose : appSpecOrCompose?.compose;
  const game = (compose || []).find(
    (c) => Array.isArray(c?.containerPorts) && c.containerPorts.map(Number).includes(8211),
  );
  return game?.ports?.[0];
};

/**
 * Merge the marketplace fixed env (["KEY=value"]) with a user/default env object
 * (user wins), dedup by key, and return an inline ["KEY=value"] array. Secrets go
 * inline into the compose (which is then enterprise-encrypted) — not Flux Storage.
 */
export const mergeInlineEnv = (fixedEnvArray, envObj) => {
  const merged = {};
  (fixedEnvArray || []).forEach((pair) => {
    const i = String(pair).indexOf('=');
    if (i > 0) merged[String(pair).slice(0, i)] = String(pair).slice(i + 1);
  });
  Object.entries(envObj || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') merged[k] = v;
  });
  return Object.entries(merged).map(([k, v]) => `${k}=${v}`);
};

/**
 * Compute the `expire` value for a spec-only appupdate so the subscription window
 * is PRESERVED (not extended). appupdate re-registers at the current height, and
 * `expire` counts from there — so we set it to the blocks remaining until the app's
 * on-chain expiration. Keeping the original `expire` would silently extend the sub
 * (turning a free spec change into a paid extension / rejection).
 *
 * @param {object} spec          on-chain spec (has height + expire)
 * @param {number} currentHeight current daemon block height
 * @returns {number} remaining blocks (>= 1)
 */
export const computeRemainingExpire = (spec, currentHeight) => {
  const height = Number(spec?.height) || 0;
  const expire = Number(spec?.expire) || 0;
  if (!height || !expire || !currentHeight) return expire || 1;
  const remaining = (height + expire) - Number(currentHeight);
  return Math.max(1, Math.floor(remaining));
};

/** Parse an inline ["KEY=value"] env array into a { KEY: value } object. */
export const parseEnvArray = (envArray) => {
  const obj = {};
  (envArray || []).forEach((pair) => {
    const i = String(pair).indexOf('=');
    if (i > 0) obj[String(pair).slice(0, i)] = String(pair).slice(i + 1);
  });
  return obj;
};

/**
 * Apply v8 enterprise encryption to an app spec. Encrypts { contacts, compose }
 * (which includes the inline environmentParameters + secrets) into the `enterprise`
 * field with RSA-OAEP + AES-GCM, then empties contacts/compose on the outer spec.
 *
 * @param {object} appSpec       the plaintext v8 spec (with real compose/contacts)
 * @param {boolean} isEnterprise whether to encrypt (marketplace isAutoEnterprise
 *                               on deploy, or the existing app already being enterprise)
 */
export const encryptAppSpec = async (appSpec, isEnterprise) => {
  if (appSpec.version < 8 || !isEnterprise) return appSpec;

  if (!isWebCryptoAvailable()) {
    throw new Error('Enterprise features require HTTPS or localhost.');
  }

  const pubKeyResponse = await apiService.getAppPublicKey(appSpec.name, appSpec.owner);
  if (pubKeyResponse.status !== 'success') {
    throw new Error('Failed to get public key for enterprise encryption');
  }

  const pubKeyB64 = pubKeyResponse.data.trim().replace(/\s+/g, '');
  const rsaPubKey = await importRsaPublicKey(pubKeyB64);
  const aesKey = window.crypto.getRandomValues(new Uint8Array(32));
  const encryptedAesKey = await encryptAesKeyWithRsaKey(aesKey, rsaPubKey);

  const enterpriseSpecs = {
    contacts: appSpec.contacts,
    compose: appSpec.compose,
  };

  const encryptedEnterprise = await encryptEnterpriseWithAes(
    JSON.stringify(enterpriseSpecs),
    aesKey,
    encryptedAesKey,
  );

  return {
    ...appSpec,
    enterprise: encryptedEnterprise,
    contacts: [],
    compose: [],
  };
};
