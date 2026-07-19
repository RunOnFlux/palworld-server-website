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
