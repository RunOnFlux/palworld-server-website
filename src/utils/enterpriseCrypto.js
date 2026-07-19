/**
 * Enterprise Encryption Utilities for v8 Flux App Specs
 * Mirrors FluxOS frontend enterpriseCrypto.js
 * When isAutoEnterprise is true, contacts + compose are encrypted
 * into the enterprise field using RSA-OAEP + AES-GCM.
 */

// Read at module scope, so it must tolerate there being no window: this module is
// pulled into the SSR prerender bundle via the deployment dialog. Every consumer
// already guards on cryptoApi?.subtle being present.
const cryptoApi = typeof window === 'undefined' ? undefined : window.crypto;

export function isWebCryptoAvailable() {
  return !!(cryptoApi && cryptoApi.subtle);
}

function checkWebCryptoAvailability() {
  if (!cryptoApi || !cryptoApi.subtle) {
    const isHttps = window.location.protocol === 'https:';
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let msg = 'WebCrypto API is not available. ';
    if (!isHttps && !isLocalhost) {
      msg += 'Enterprise features require HTTPS.';
    } else {
      msg += 'This feature requires a modern browser with WebCrypto support.';
    }
    throw new Error(msg);
  }
}

function base64ToUint8Array(base64) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str);
}

export async function importRsaPublicKey(base64SpkiDer) {
  checkWebCryptoAvailability();
  const spkiDer = base64ToUint8Array(base64SpkiDer);
  return cryptoApi.subtle.importKey(
    'spki',
    spkiDer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );
}

export async function encryptAesKeyWithRsaKey(aesKey, rsaPubKey) {
  checkWebCryptoAvailability();
  const base64AesKey = arrayBufferToBase64(aesKey);
  const encrypted = await cryptoApi.subtle.encrypt(
    { name: 'RSA-OAEP' },
    rsaPubKey,
    new TextEncoder().encode(base64AesKey),
  );
  return arrayBufferToBase64(encrypted);
}

export async function encryptEnterpriseWithAes(plainText, aesKey, base64RsaEncryptedAesKey) {
  checkWebCryptoAvailability();
  const nonce = cryptoApi.getRandomValues(new Uint8Array(12));
  const plaintextEncoded = new TextEncoder().encode(plainText);
  const rsaEncryptedAesKey = base64ToUint8Array(base64RsaEncryptedAesKey);

  const aesCryptoKey = await cryptoApi.subtle.importKey(
    'raw',
    aesKey,
    'AES-GCM',
    true,
    ['encrypt', 'decrypt'],
  );

  const ciphertextTagBuf = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesCryptoKey,
    plaintextEncoded,
  );

  const ciphertextTag = new Uint8Array(ciphertextTagBuf);
  const combined = new Uint8Array(
    rsaEncryptedAesKey.length + nonce.length + ciphertextTag.length,
  );

  combined.set(rsaEncryptedAesKey);
  combined.set(nonce, rsaEncryptedAesKey.byteLength);
  combined.set(ciphertextTag, rsaEncryptedAesKey.byteLength + nonce.length);

  return arrayBufferToBase64(combined.buffer);
}

export async function decryptEnterpriseWithAes(base64nonceCiphertextTag, aesKey) {
  checkWebCryptoAvailability();
  const nonceCiphertextTag = base64ToUint8Array(base64nonceCiphertextTag);
  const nonce = nonceCiphertextTag.slice(0, 12);
  const ciphertextTag = nonceCiphertextTag.slice(12);

  const aesCryptoKey = await cryptoApi.subtle.importKey(
    'raw',
    aesKey,
    'AES-GCM',
    true,
    ['encrypt', 'decrypt'],
  );

  const plainTextBuf = await cryptoApi.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    aesCryptoKey,
    ciphertextTag,
  );

  return new TextDecoder().decode(plainTextBuf);
}

/**
 * Decrypt enterprise app spec.
 * Uses the same flow as FluxOS frontend manage page:
 * 1. GET /apps/apporiginalowner/{name} → owner
 * 2. POST /apps/getpublickey with {name, owner} → RSA pub key
 * 3. Generate AES key, encrypt with RSA
 * 4. GET /apps/appspecifications/{name}/true with enterprise-key header
 * 5. Decrypt with AES key
 *
 * All calls go through the Flux API (same as FluxOS ApiClient sticky backend).
 */
export async function fetchDecryptedEnterpriseSpec(appName, fluxApiBase, zelidauth) {
  if (!isWebCryptoAvailable()) return null;

  try {
    // FluxOS sends zelidauth as URL-encoded (qs.stringify), not JSON
    let authHeader;
    if (typeof zelidauth === 'string') {
      authHeader = zelidauth;
    } else {
      authHeader = `zelid=${encodeURIComponent(zelidauth.zelid)}&signature=${encodeURIComponent(zelidauth.signature)}&loginPhrase=${encodeURIComponent(zelidauth.loginPhrase)}`;
    }

    // 1. Get original owner
    const ownerRes = await fetch(`${fluxApiBase}/apps/apporiginalowner/${appName}`);
    const ownerData = await ownerRes.json();
    if (ownerData.status !== 'success') {
      console.warn('Enterprise: failed to get owner');
      return null;
    }
    const owner = ownerData.data;

    // 2. Get RSA public key (no Content-Type header — matches FluxOS axios behavior: sends JSON.stringify as text/plain)
    const pubKeyRes = await fetch(`${fluxApiBase}/apps/getpublickey`, {
      method: 'POST',
      headers: {
        zelidauth: authHeader,
      },
      body: JSON.stringify({ name: appName, owner }),
    });
    const pubKeyData = await pubKeyRes.json();
    if (pubKeyData.status !== 'success') {
      console.warn('Enterprise: failed to get public key');
      return null;
    }

    const pubKeyB64 = pubKeyData.data.trim().replace(/\s+/g, '');
    const rsaPubKey = await importRsaPublicKey(pubKeyB64);

    // 3. Generate AES key and encrypt it with RSA
    const aesKey = cryptoApi.getRandomValues(new Uint8Array(32));
    const encryptedEnterpriseKey = await encryptAesKeyWithRsaKey(aesKey, rsaPubKey);

    // 4. Fetch encrypted spec
    const specRes = await fetch(`${fluxApiBase}/apps/appspecifications/${appName}/true`, {
      headers: {
        zelidauth: authHeader,
        'enterprise-key': encryptedEnterpriseKey,
      },
    });
    const specData = await specRes.json();
    if (specData.status !== 'success' || !specData.data?.enterprise) {
      console.warn('Enterprise: failed to get encrypted spec');
      return null;
    }

    // 5. Decrypt enterprise field
    const decrypted = await decryptEnterpriseWithAes(specData.data.enterprise, aesKey);
    const parsed = JSON.parse(decrypted);

    return {
      contacts: parsed.contacts || [],
      compose: parsed.compose || [],
    };
  } catch (err) {
    console.warn('Enterprise decryption failed:', err.message);
    return null;
  }
}
