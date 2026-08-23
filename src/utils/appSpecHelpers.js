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
  fetchDecryptedEnterpriseSpec,
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

/** Shown when a renewal for this app is still confirming. Exported so callers can match on it. */
export const PENDING_UPDATE_ERROR = 'This server has a renewal still being confirmed on-chain. Please wait a couple of minutes and try again — saving now would wipe out the time you just bought.';

/**
 * Read the app's current on-chain spec immediately before an appupdate is built.
 *
 * MUST be used by every path that writes a spec. An appupdate re-registers the WHOLE
 * spec, and `expire` is recomputed from whatever copy the caller holds — so building on
 * a spec cached when a tab mounted writes that copy's expiry back, silently reverting
 * any extension bought since. That is how a paid renewal was erased 65 seconds after it
 * was signed (palworld1784493548530: block 2864625 extended to 2963116, block 2864631
 * put it back to 2875120 and the server died a month early).
 *
 * Freshness needs both halves, and neither is sufficient alone:
 *  - the confirmed spec, re-read now rather than at mount — closes the stale-tab case,
 *    which is the wide one (a tab left open across a renewal reverts it hours later);
 *  - a check for an update still awaiting confirmation, because the confirmed spec
 *    cannot show one — closes the in-flight case, which is what actually happened here.
 *
 * Only a pending update that EXTENDS past the confirmed expiry blocks the save. A pending
 * settings change carries the same expiry, so superseding it costs the customer nothing —
 * that is the ordinary last-write-wins they get by saving twice, and refusing it would
 * mean a typo could not be corrected for minutes.
 *
 * @param {string} appName
 * @returns {Promise<{outer: object, compose: array, contacts: array, isEnterprise: boolean}>}
 * @throws {Error} if a renewal is in flight, or the spec cannot be read
 */
export const fetchLatestAppSpec = async (appName) => {
  // Read BEFORE the spec, so a message that confirms between the two calls is picked up by
  // the spec read rather than missed by both.
  const pending = await apiService.getPendingAppUpdate(appName);

  const outer = await apiService.getAppSpecs(appName);
  if (!outer || !outer.name) throw new Error('Could not load the current server spec. Please try again in a moment.');

  if (pending) {
    const pendingSpec = pending.appSpecifications || pending.zelAppSpecifications || {};
    const currentHeight = await apiService.getBlockHeight();
    const confirmedExpiryBlock = (Number(outer.height) || 0) + (Number(outer.expire) || 0);
    // A pending message has no height yet — it re-registers wherever it lands, which is
    // within a few blocks of now. Tolerance mirrors the 11 blocks FluxOS itself allows a
    // free update to drift, so ordinary rounding never reads as an extension.
    const pendingExpiryBlock = (Number(currentHeight) || 0) + (Number(pendingSpec.expire) || 0);
    if (currentHeight && confirmedExpiryBlock && pendingExpiryBlock > confirmedExpiryBlock + 11) {
      throw new Error(PENDING_UPDATE_ERROR);
    }
  }

  // Enterprise iff it carries an encrypted `enterprise` blob (v8+); its compose and
  // contacts only exist decrypted.
  const isEnterprise = !!outer.enterprise;
  let compose = outer.compose;
  let contacts = outer.contacts || [];
  if (isEnterprise && (!compose || compose.length === 0)) {
    const zelidauth = await apiService.getStoredAuth();
    const fluxApiBase = sessionStorage.getItem('stickyBackendDNS') || 'https://api.runonflux.io';
    const decrypted = await fetchDecryptedEnterpriseSpec(appName, fluxApiBase, zelidauth);
    if (!decrypted?.compose?.length) throw new Error('Could not decrypt the current spec. Try again in a moment.');
    compose = decrypted.compose;
    contacts = decrypted.contacts || contacts;
  }

  return { outer, compose, contacts, isEnterprise };
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
