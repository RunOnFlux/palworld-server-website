/**
 * Wallet Service - SSP & ZelCore payment utilities
 *
 * SSP: Returns txid directly from window.ssp.request('pay', data)
 * ZelCore: Uses Flux backend payment system:
 *   1. GET /payment/paymentrequest → paymentId
 *   2. Open WebSocket ws/payment/{paymentId} to listen for txid
 *   3. Open ZelCore wallet via zel: protocol (includes callback URL)
 *   4. ZelCore POSTs txid to /payment/verifypayment
 *   5. WebSocket receives txid → resolves promise
 */

import qs from 'qs';

// ===== Availability Checks =====

export function isSSPAvailable() {
  return typeof window !== 'undefined' && !!window.ssp;
}

export function isZelcoreAvailable() {
  return typeof window !== 'undefined' && (!!window.zelcore || !!window.zel);
}

// ===== SSP Payment =====

/**
 * Pay with SSP wallet - returns txid directly
 * @param {{ message: string, amount: string, address: string, chain: string }} data
 * @returns {Promise<{ txid: string }>} SSP response with txid
 */
export async function payWithSSP(data) {
  if (!isSSPAvailable()) {
    throw new Error('SSP Wallet not found. Please install the SSP browser extension.');
  }

  const response = await window.ssp.request('pay', data);

  if (response.status === 'ERROR') {
    throw new Error(response.data || response.result || 'SSP payment failed');
  }

  // response.txid contains the transaction ID
  return response;
}

// ===== ZelCore Payment =====

/**
 * Get a Flux node URL for payment endpoints.
 * Uses sticky backend if available, otherwise falls back to api.runonflux.io
 */
function getFluxNodeUrl() {
  const sticky = sessionStorage.getItem('stickyBackendDNS');
  return sticky || 'https://api.runonflux.io';
}

/**
 * Request a payment ID from the Flux backend
 * GET /payment/paymentrequest → { status: 'success', data: { paymentId: '...' } }
 * @returns {Promise<string>} paymentId
 */
async function requestPaymentId() {
  const nodeUrl = getFluxNodeUrl();
  const response = await fetch(`${nodeUrl}/payment/paymentrequest`);
  const result = await response.json();

  if (result.status === 'success' && result.data?.paymentId) {
    return result.data.paymentId;
  }

  throw new Error(result.data?.message || 'Failed to create payment request');
}

/**
 * Open WebSocket to listen for ZelCore payment confirmation.
 * Backend polls completedPayments every 500ms, sends result when found.
 * WS response: qs.stringify({ status: 'success', data: { txid, paymentId, coin, amount, ... } })
 *
 * @param {string} paymentId
 * @param {AbortSignal} signal - AbortSignal for cancellation
 * @param {number} timeout - Max wait time in ms (default 65 min, matching backend)
 * @returns {Promise<{ txid: string, paymentId: string, coin: string, amount: string }>}
 */
function listenForPayment(paymentId, signal, timeout = 65 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const nodeUrl = getFluxNodeUrl();
    const wsUrl = nodeUrl.replace(/^https?:\/\//, 'wss://') + `/ws/payment/${paymentId}`;

    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch (error) {
      reject(new Error(`Failed to connect WebSocket: ${error.message}`));
      return;
    }

    const cleanup = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      cleanup();
      ws.close();
      reject(new Error('Payment cancelled'));
    };

    signal?.addEventListener('abort', onAbort);

    const timeoutId = setTimeout(() => {
      cleanup();
      ws.close();
      reject(new Error('Payment confirmation timed out'));
    }, timeout);

    ws.onmessage = (event) => {
      try {
        const parsed = qs.parse(event.data);

        if (parsed.status === 'error') {
          cleanup();
          ws.close();
          reject(new Error(parsed.data?.message || 'Payment verification failed'));
          return;
        }

        if (parsed.status === 'success' && parsed.data?.txid) {
          cleanup();
          ws.close();
          resolve(parsed.data);
        }
      } catch {
        // Non-parseable message, ignore
      }
    };

    ws.onerror = () => {
      cleanup();
      reject(new Error('WebSocket connection error'));
    };

    ws.onclose = (event) => {
      cleanup();
      // 4012 = payment received (backend success close), 1000 = normal close
      if (event.code !== 4012 && event.code !== 1000) {
        reject(new Error('WebSocket closed unexpectedly'));
      }
    };
  });
}

/**
 * Pay with ZelCore wallet - uses backend payment system to get txid via WebSocket
 *
 * Flow:
 * 1. Request paymentId from backend
 * 2. Open WebSocket listener for txid
 * 3. Open ZelCore wallet with callback URL
 * 4. Returns when ZelCore confirms payment (txid received via WS)
 *
 * @param {{ address: string, amount: string, message: string, coin?: string, signal?: AbortSignal }} params
 * @returns {Promise<{ txid: string, paymentId: string, coin: string, amount: string }>}
 */
export async function payWithZelcore({ address, amount, message, coin = 'zelcash', signal }) {
  // Step 1: Get payment ID from backend
  const paymentId = await requestPaymentId();
  const nodeUrl = getFluxNodeUrl();
  const callbackUrl = encodeURIComponent(`${nodeUrl}/payment/verifypayment?paymentid=${paymentId}`);

  // Step 2: Start WebSocket listener (before opening wallet)
  const paymentPromise = listenForPayment(paymentId, signal);

  // Step 3: Open ZelCore wallet with callback
  try {
    const protocol = `zel:?action=pay&coin=${coin}&address=${address}&amount=${amount}&message=${message}&icon=https%3A%2F%2Fraw.githubusercontent.com%2Frunonflux%2Fflux%2Fmaster%2FZelFront%2Fsrc%2Fassets%2Fimg%2FfluxDarkBlue.svg&callback=${callbackUrl}`;

    if (window.zelcore && typeof window.zelcore.protocol === 'function') {
      window.zelcore.protocol(protocol);
    } else {
      const a = document.createElement('a');
      a.href = protocol;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (error) {
    throw new Error(`Failed to open ZelCore: ${error.message}`);
  }

  // Step 4: Wait for payment confirmation via WebSocket
  return paymentPromise;
}
