import axios from 'axios';
import { apiConfig } from '../config/apiConfig';
import secureStorage from '../utils/secureStorage';
import storageService from './storageService';
import { getUser } from '../utils/firebase';
import qs from 'qs';

/**
 * Endpoints that REQUIRE sticky backend (session state on a specific node).
 * Only login/auth and signing need to hit the same node.
 * Everything else uses round-robin api.runonflux.io.
 */
const STICKY_BACKEND_ENDPOINTS = [
  '/id/loginphrase',
  '/id/emergencyphrase',
  '/id/verifylogin',
  '/apps/sign',
];

function requiresStickyBackend(url) {
  if (!url) return false;
  return STICKY_BACKEND_ENDPOINTS.some(pattern => url.includes(pattern));
}

class ApiService {
  constructor() {
    // Create Flux API client (matches FluxOS ApiClient.js configuration)
    // DON'T set default Content-Type - FluxOS sends JSON.stringify(data) without explicit Content-Type
    // Only specific endpoints (like pricing calculator) use Content-Type: application/x-www-form-urlencoded
    this.fluxClient = axios.create({
      baseURL: apiConfig.fluxApi.baseUrl,
      timeout: apiConfig.settings.timeout,
    });

    // Create Bridge API client
    this.bridgeClient = axios.create({
      baseURL: apiConfig.bridgeApi.baseUrl,
      timeout: apiConfig.settings.timeout,
    });

    // Setup interceptors
    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor - add auth headers and sticky backend
    const requestInterceptor = async (config) => {
      // Add zelidauth if available
      // CRITICAL: FluxOS only sends ONE header: zelidauth (URL-encoded with qs.stringify)
      // FluxOS: localStorage.setItem("zelidauth", qs.stringify(zelidauth))
      const zelidauth = await this.getStoredAuth();
      if (zelidauth) {
        config.headers['zelidauth'] = qs.stringify(zelidauth);
        // DO NOT add individual zelid/signature/loginPhrase headers - only zelidauth!
      }

      // Only use sticky backend for endpoints that need session state (login/signing)
      const stickyBackend = this.getStickyBackend();
      const needsSticky = requiresStickyBackend(config.url);
      const isBridgeApi = config.baseURL === apiConfig.bridgeApi.baseUrl;

      if (!isBridgeApi && needsSticky && stickyBackend) {
        config.baseURL = stickyBackend;
      }

      return config;
    };

    // Response interceptor - capture sticky backend
    const responseInterceptor = (response) => {
      // Capture backend node from loginphrase response
      if (response.config.url?.includes('/loginphrase') && response.headers) {
        this.captureStickyBackend(response);
      }
      return response;
    };

    // Error interceptor
    const errorInterceptor = (error) => {
      // Handle common errors
      if (error.response?.status === 401) {
        // Unauthorized - clear auth
        this.clearAuth();
      }
      return Promise.reject(error);
    };

    // Apply to both clients
    [this.fluxClient, this.bridgeClient].forEach(client => {
      client.interceptors.request.use(requestInterceptor, errorInterceptor);
      client.interceptors.response.use(responseInterceptor, errorInterceptor);
    });
  }

  // Sticky backend management
  captureStickyBackend(response) {
    try {
      // Extract node info from Flux API headers
      // Flux API uses 'fluxnode' header format: "server78_65.109.86.26"
      const fluxNode = response.headers['fluxnode'] || response.headers['x-node-ip'] || response.headers['x-forwarded-for'];

      console.log('🔍 Checking for sticky backend, fluxnode header:', fluxNode);

      if (fluxNode) {
        let dnsName;

        // Parse fluxnode header format: "serverX_IP" -> extract IP
        if (fluxNode.includes('_')) {
          const ip = fluxNode.split('_')[1]; // Extract IP from "server78_65.109.86.26"
          dnsName = this.convertIpToDns(ip);
        } else {
          // Direct IP format
          dnsName = this.convertIpToDns(fluxNode);
        }

        sessionStorage.setItem('stickyBackendDNS', dnsName);
        console.log('✅ Sticky backend captured:', dnsName, 'from fluxnode:', fluxNode);
      } else {
        console.warn('⚠️ No fluxnode header found in response');
      }
    } catch (error) {
      console.warn('Failed to capture sticky backend:', error);
    }
  }

  convertIpToDns(ip) {
    // Convert IP:PORT to Flux DNS format
    // Example: 185.209.30.228:16127 -> https://185-209-30-228-16127.node.api.runonflux.io
    const [ipAddress, port] = ip.split(':');
    const dnsFormatted = ipAddress.replace(/\./g, '-');
    return `https://${dnsFormatted}-${port || '16127'}.node.api.runonflux.io`;
  }

  getStickyBackend() {
    return sessionStorage.getItem('stickyBackendDNS');
  }

  clearStickyBackend() {
    sessionStorage.removeItem('stickyBackendDNS');
  }

  // Auth storage (using secure encrypted binary storage)
  async getStoredAuth() {
    return await secureStorage.getItem('zelidauth');
  }

  async storeAuth(zelidauth) {
    return await secureStorage.setItem('zelidauth', zelidauth);
  }

  clearAuth() {
    secureStorage.removeItem('zelidauth');
    this.clearStickyBackend();
  }

  async isAuthenticated() {
    const auth = await this.getStoredAuth();
    return auth !== null;
  }

  // API Methods
  async get(endpoint, options = {}) {
    const client = options.useBridge ? this.bridgeClient : this.fluxClient;
    const response = await client.get(endpoint, options);
    return response.data;
  }

  async post(endpoint, data, options = {}) {
    const client = options.useBridge ? this.bridgeClient : this.fluxClient;
    // CRITICAL: Stringify data like FluxOS does (AppsService.js)
    // FluxOS: Api().post('/apps/appregister', JSON.stringify(data))
    const stringifiedData = typeof data === 'object' ? JSON.stringify(data) : data;

    // Pass options as-is, let axios and interceptors handle headers
    const response = await client.post(endpoint, stringifiedData, options);
    return response.data;
  }

  async put(endpoint, data, options = {}) {
    const client = options.useBridge ? this.bridgeClient : this.fluxClient;
    // Stringify data like POST
    const stringifiedData = typeof data === 'object' ? JSON.stringify(data) : data;
    const response = await client.put(endpoint, stringifiedData, options);
    return response.data;
  }

  async delete(endpoint, options = {}) {
    const client = options.useBridge ? this.bridgeClient : this.fluxClient;
    const response = await client.delete(endpoint, options);
    return response.data;
  }

  // ========== App Management Methods ==========

  /**
   * Get all apps deployed by a specific user (Zelid)
   * Uses server-side filtering with ?owner= query parameter
   * @param {string} zelid - User's Zelid
   * @returns {Promise<Array>} List of user's apps
   */
  async getUserApps(zelid) {
    try {
      // Use server-side filtering by owner (much more efficient than client-side filtering)
      const response = await this.get(`/apps/globalappsspecifications?owner=${zelid}`, {
        headers: {
          'x-apicache-bypass': true,
        },
      });
      const apps = response.data || response || [];
      return Array.isArray(apps) ? apps : [];
    } catch (error) {
      console.error('Failed to fetch user apps:', error);
      return [];
    }
  }

  /**
   * Get specifications for a specific app
   * @param {string} appName - App name
   * @returns {Promise<Object|null>} App specifications or null if not found
   */
  async getAppSpecs(appName) {
    const response = await this.get(`/apps/appspecifications/${appName}`, {
      headers: {
        'x-apicache-bypass': true,
      },
    });
    // Check status before returning data
    if (response.status === 'success' && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Deploy a new app
   * @param {Object} appConfig - App configuration
   * @returns {Promise<Object>} Deployment response
   */
  async deployApp(appConfig) {
    const response = await this.post('/apps/appregister', appConfig);
    return response.data || response;
  }

  /**
   * Start an app
   * @param {string} appName - App name
   * @returns {Promise<Object>} Response
   */
  async startApp(appName) {
    const response = await this.post(`/apps/appstart/${appName}`);
    return response.data || response;
  }

  /**
   * Stop an app
   * @param {string} appName - App name
   * @returns {Promise<Object>} Response
   */
  async stopApp(appName) {
    const response = await this.post(`/apps/appstop/${appName}`);
    return response.data || response;
  }

  /**
   * Restart an app
   * @param {string} appName - App name
   * @returns {Promise<Object>} Response
   */
  async restartApp(appName) {
    const response = await this.post(`/apps/apprestart/${appName}`);
    return response.data || response;
  }

  /**
   * Remove/delete an app
   * @param {string} appName - App name
   * @returns {Promise<Object>} Response
   */
  async removeApp(appName) {
    const response = await this.post(`/apps/appremove/${appName}`);
    return response.data || response;
  }

  /**
   * Get app locations (where it's deployed)
   * @param {string} appName - App name
   * @returns {Promise<Array>} List of node locations (empty array if not found)
   */
  async getAppLocations(appName) {
    const response = await this.get(`/apps/location/${appName}`, {
      headers: {
        'x-apicache-bypass': true,
      },
    });
    // Always return array, even if error
    if (response.status === 'success' && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }

  /**
   * Get app running instances
   * @param {string} appName - App name
   * @returns {Promise<Array>} List of running instances
   */
  async getAppInstances(appName) {
    const response = await this.get(`/apps/appinstances/${appName}`);
    return response.data || response;
  }

  /**
   * Get deployment information (payment address, etc.)
   * Same as FluxOS AppsService.appsDeploymentInformation()
   * @returns {Promise<Object>} Deployment info with address field
   */
  async getDeploymentInfo() {
    const response = await this.get('/apps/deploymentinformation');
    if (response.status === 'success' && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get app installing locations (nodes currently installing the app)
   * Used for crypto payment monitoring phase 2, and by the placement diagnosis, where a
   * claimed IP is the difference between a deploy in progress and one with nowhere to go.
   * Entries expire on their own after 15 minutes.
   * @param {string} appName - App name
   * @returns {Promise<Array>} List of installing locations
   */
  async getAppInstallingLocations(appName) {
    const response = await this.get(`/apps/installinglocation/${appName}`, {
      headers: { 'x-apicache-bypass': true },
    });
    if (response.status === 'success' && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }

  /**
   * Check if user is eligible for free first month deployment.
   * Per-customer rule: eligible only for brand-new Flux customers — any app the
   * owner has ever registered on Flux disqualifies them (not per app or repotag).
   * @param {string} ownerZelid - The app owner's zelid
   * @returns {Promise<boolean>} true if eligible for free first month
   */
  async checkFreeFirstMonthEligibility(ownerZelid) {
    try {
      const response = await fetch(
        `https://api.runonflux.io/apps/permanentmessages?owner=${ownerZelid}`,
        { signal: AbortSignal.timeout(30000) }
      );
      const data = await response.json();

      if (data.status !== 'success' || !Array.isArray(data.data)) {
        // Fail open — allow free month if check fails
        return true;
      }

      const registerMessages = data.data.filter(m => m.type === 'fluxappregister');

      // Per-customer rule: any app the owner has ever registered on Flux disqualifies
      // the free first month — the offer is one per Flux Cloud account, not per app.
      if (registerMessages.length > 0) {
        console.log(`[FreeMonth] Owner already has ${registerMessages.length} app(s) on Flux — not a new customer`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[FreeMonth] Eligibility check failed:', error.message);
      // Fail open
      return true;
    }
  }

  /**
   * Register app specification with FluxOS to get payment hash
   * This should be called BEFORE creating Stripe checkout
   * Follows SSO signing flow from FluxOS InstallDialog
   * @param {Object} appSpec - Complete app specification
   * @returns {Promise<string>} Payment hash for linking payment to app registration
   */
  async registerAppSpec(appSpec) {
    try {
      const zelidauth = await this.getStoredAuth();
      if (!zelidauth) {
        throw new Error('Authentication required');
      }

      console.log('📝 Starting app registration with FluxOS...');
      console.log('Initial app spec:', JSON.stringify(appSpec, null, 2));

      // Step 1: VERIFY appSpec with FluxOS backend first (like FluxOS frontend does)
      console.log('🔍 Verifying app specification with FluxOS...');
      let verifiedAppSpec;

      try {
        const verificationResponse = await this.post('/apps/verifyappregistrationspecifications', appSpec, {
          timeout: 60000 // 60 seconds - verification checks Docker images which can be slow
        });

        console.log('🔍 Verification response:', JSON.stringify(verificationResponse, null, 2));

        if (verificationResponse.status === 'error') {
          const errorMsg = verificationResponse.data?.message || verificationResponse.data || 'App specification verification failed';
          console.error('❌ Verification failed:', errorMsg);
          throw new Error(errorMsg);
        }

        // Use the VERIFIED spec from FluxOS backend
        verifiedAppSpec = verificationResponse.data || appSpec;
        console.log('✅ App specification verified');
      } catch (verifyError) {
        console.error('❌ Verification request failed:', verifyError);
        console.log('⚠️ Skipping verification, using original appSpec');
        // Use original appSpec if verification fails
        verifiedAppSpec = appSpec;
      }

      // Step 2: Create timestamp (reuse same timestamp for signing and registration)
      const timestamp = Date.now();
      const registrationType = 'fluxappregister';
      const version = '1';

      // Step 3: Build message with VERIFIED spec
      const appSpecJson = JSON.stringify(verifiedAppSpec);
      const message = `${registrationType}${version}${appSpecJson}${timestamp}`;

      console.log('📝 Message to sign created, timestamp:', timestamp);

      // Step 4: Sign the message using FluxCore SSO signing service
      console.log('🔐 Signing message with FluxCore service...');
      const signature = await this.signMessageWithSSO(message);
      console.log('✅ Message signed successfully');

      // Step 5: Build registration data (FluxOS format) with VERIFIED spec
      const registrationData = {
        type: registrationType,
        version: parseInt(version),
        appSpecification: verifiedAppSpec,
        timestamp: timestamp,
        signature: signature,
      };

      console.log('📤 Sending registration to FluxOS...');
      console.log('📦 Full registration payload:');
      console.log(JSON.stringify(registrationData, null, 2));

      // Validate compose components before sending
      console.log('🔍 Validating compose components...');
      registrationData.appSpecification.compose.forEach((comp, idx) => {
        console.log(`Component ${idx + 1}:`, {
          name: comp.name,
          repotag: comp.repotag,
          hasAllFields: !!(comp.name && comp.repotag && comp.ports && comp.containerPorts)
        });

        if (!comp.repotag || comp.repotag === '') {
          console.error(`❌ Component ${comp.name} has empty repotag!`);
        }
      });

      // Step 4: Send registration request with extended timeout
      // zelidauth header is automatically added by request interceptor
      console.log('🔐 Sending registration to FluxOS API...');
      const response = await this.post('/apps/appregister', registrationData, {
        timeout: 120000, // 2 minutes
      });

      console.log('✅ App registration response:', JSON.stringify(response, null, 2));

      // Check if response is an error
      if (response.status === 'error' || response.data?.code === 401 || response.data?.name === 'Unauthorized') {
        const errorMsg = response.data?.message || response.data || response.message || 'App registration failed';
        console.error('❌ App registration returned error:', errorMsg);
        throw new Error(errorMsg);
      }

      // Extract payment hash from response
      // Response format: {status: 'success', data: 'paymenthashstring'}
      const paymentHash = response.data;

      if (!paymentHash || typeof paymentHash !== 'string') {
        console.error('❌ No valid payment hash in registration response:', response);
        throw new Error('Failed to get payment hash from registration');
      }

      console.log('✅ Payment hash received:', paymentHash);
      return paymentHash;
    } catch (error) {
      console.error('❌ App registration failed:', error);
      throw error;
    }
  }

  /**
   * Sign a message using FluxCore SSO signing service
   * Matches FluxOS InstallDialog SSO flow
   * @param {string} message - Message to sign
   * @returns {Promise<string>} Signature
   */
  /** App owner's RSA public key for enterprise (v8) encryption. */
  async getAppPublicKey(name, owner) {
    return this.post('/apps/getpublickey', { name, owner });
  }

  /** Current daemon block height (used to keep spec-only updates free). */
  async getBlockHeight() {
    try {
      const response = await this.get('/daemon/getinfo');
      if (response.status === 'success' && response.data?.blocks) {
        return response.data.blocks;
      }
    } catch (error) {
      console.error('Failed to fetch block height:', error);
    }
    return null;
  }

  /** App's permanent on-chain messages (registration + updates) with block height + type. */
  async getAppUpdateMessages(appName) {
    try {
      const res = await this.get(`/apps/permanentmessages?appname=${encodeURIComponent(appName)}`);
      return res.status === 'success' && Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }

  /**
   * Push a spec-only appupdate on-chain: verify -> sign (SSO) -> appupdate. Returns the
   * new spec's payment/message hash. Works for enterprise and non-enterprise specs.
   */
  async updateAppSpecification(spec) {
    const updatedSpec = { ...spec };
    delete updatedSpec.hash;
    delete updatedSpec.height;

    let finalSpec = updatedSpec;
    try {
      const verifyResponse = await this.post('/apps/verifyappupdatespecifications', updatedSpec, { timeout: 30000 });
      if (verifyResponse.status === 'success' && verifyResponse.data) {
        finalSpec = verifyResponse.data;
        if (updatedSpec.enterprise) finalSpec.enterprise = updatedSpec.enterprise;
        if (updatedSpec.expire) finalSpec.expire = updatedSpec.expire;
      }
    } catch (e) {
      console.warn('verifyappupdatespecifications failed, using local spec:', e.message);
    }

    const timestamp = Date.now();
    const updateType = 'fluxappupdate';
    const version = '1';
    const message = `${updateType}${version}${JSON.stringify(finalSpec)}${timestamp}`;
    const signature = await this.signMessageWithSSO(message);

    const response = await this.post('/apps/appupdate', {
      type: updateType,
      version: parseInt(version),
      appSpecification: finalSpec,
      timestamp,
      signature,
    }, { timeout: 120000 });

    if (response.status === 'error' || response.data?.code === 401) {
      throw new Error(response.data?.message || response.data || response.message || 'App update failed');
    }
    const paymentHash = response.data;
    if (!paymentHash || typeof paymentHash !== 'string') {
      throw new Error('Failed to get payment hash from update');
    }
    return paymentHash;
  }

  /** Fiat + FLUX price for a spec (used to price a hardware change delta). */
  async calculateAppPrice(spec) {
    const response = await this.post('/apps/calculatefiatandfluxprice', spec, { timeout: 30000 });
    if (response.status === 'success' && response.data) {
      return {
        usd: parseFloat(response.data.usd) || 0,
        flux: parseFloat(response.data.flux) || 0,
        fluxDiscount: parseFloat(response.data.fluxDiscount) || 0,
      };
    }
    throw new Error(response.data?.message || response.data || 'Failed to calculate price');
  }

  async signMessageWithSSO(message) {
    try {
      // Get Firebase user and token
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        throw new Error('SSO authentication required. Please log in.');
      }

      // Get Firebase ID token
      const token = await firebaseUser.getIdToken();
      if (!token) {
        throw new Error('Unable to get Firebase authentication token');
      }

      console.log('✅ Firebase token obtained for SSO signing');

      // Call FluxCore signing service (same as FluxOS)
      const response = await fetch('https://service.fluxcore.ai/api/signMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to sign message');
      }

      const result = await response.json();

      if (result.status !== 'success' || !result.signature) {
        throw new Error(result.message || 'Failed to sign application message');
      }

      console.log('✅ SSO signature obtained');
      return result.signature;
    } catch (error) {
      console.error('❌ SSO Signing failed:', error);
      throw new Error(`SSO signing failed: ${error.message}`);
    }
  }

  /**
   * Update/renew app subscription (extends expire time)
   * Signs the update with SSO and registers with FluxOS
   * Returns payment hash for Stripe checkout
   * @param {string} appName - App name to renew
   * @param {number} newExpireBlocks - New expire block height
   * @returns {Promise<string>} Payment hash for linking payment to renewal
   */
  async renewAppSubscription(appName, newExpireBlocks) {
    try {
      const zelidauth = await this.getStoredAuth();
      if (!zelidauth) {
        throw new Error('Authentication required');
      }

      console.log('🔄 Starting app subscription renewal...');
      console.log('App:', appName);
      console.log('New expire blocks:', newExpireBlocks);

      // Validate newExpireBlocks
      if (!newExpireBlocks || typeof newExpireBlocks !== 'number' || newExpireBlocks <= 0 || isNaN(newExpireBlocks)) {
        throw new Error(`Invalid expire blocks value: ${newExpireBlocks}`);
      }

      // Step 1: Get current app specification
      console.log('📥 Fetching current app specification...');
      const currentSpec = await this.getAppSpecs(appName);

      if (!currentSpec || !currentSpec.name) {
        throw new Error('Failed to fetch app specification');
      }

      console.log('✅ Current app spec retrieved:', JSON.stringify(currentSpec, null, 2));

      // Step 2: Update expire field and remove blockchain metadata
      const updatedSpec = { ...currentSpec };
      delete updatedSpec.hash;
      delete updatedSpec.height;
      updatedSpec.expire = Math.floor(newExpireBlocks);

      // Backfill contacts for legacy apps registered with an empty contacts array.
      // The old "free first month" deploy path skipped the F_S_CONTACTS upload, so
      // many apps went on-chain with contacts: [] or ['']. On any renewal/extension,
      // if the current spec has no real contact, upload the logged-in user's email
      // now so the renewed spec carries a proper F_S_CONTACTS reference.
      const hasContact = Array.isArray(updatedSpec.contacts)
        && updatedSpec.contacts.some((c) => typeof c === 'string' && c.trim() !== '');
      if (!hasContact) {
        const contactEmail = getUser()?.email;
        if (contactEmail) {
          try {
            const contactsId = storageService.generateContactsId();
            await storageService.uploadContacts({ contactsid: contactsId, contacts: [contactEmail] });
            updatedSpec.contacts = [storageService.getContactsStorageReference(contactsId)];
            console.log('📧 Backfilled missing contacts with logged-in email:', contactEmail);
          } catch (err) {
            console.warn('⚠️ Contacts backfill failed, renewing without contact:', err.message);
          }
        } else {
          console.warn('⚠️ No logged-in email available to backfill contacts; renewing as-is');
        }
      }

      console.log('📝 Updated app spec with new expire:', updatedSpec.expire);

      // Step 3: Verify spec with backend (same as FluxOS — returns cleaned/formatted spec)
      console.log('📤 Verifying app spec with backend...');
      const verifyResponse = await this.post('/apps/verifyappupdatespecifications', updatedSpec, {
        timeout: 30000,
      });

      let finalSpec;
      if (verifyResponse.status === 'success' && verifyResponse.data) {
        finalSpec = verifyResponse.data;
        // Re-apply our expire — verify endpoint may reset it to the on-chain value
        finalSpec.expire = Math.floor(newExpireBlocks);
        console.log('✅ Backend returned formatted spec, expire set to:', finalSpec.expire);
      } else {
        console.warn('⚠️ Verify endpoint failed, using local spec:', verifyResponse.data?.message);
        finalSpec = updatedSpec;
      }

      console.log('📝 Final spec to sign (expire=' + finalSpec.expire + '):', JSON.stringify(finalSpec, null, 2));

      // Step 4: Create timestamp
      const timestamp = Date.now();
      const updateType = 'fluxappupdate';
      const version = '1';

      // Step 5: Build message to sign
      const appSpecJson = JSON.stringify(finalSpec);
      const message = `${updateType}${version}${appSpecJson}${timestamp}`;

      console.log('📝 Message to sign created, timestamp:', timestamp);

      // Step 5: Sign the message using FluxCore SSO
      console.log('🔐 Signing update message...');
      const signature = await this.signMessageWithSSO(message);
      console.log('✅ Message signed successfully');

      // Step 6: Build update data (FluxOS format)
      const updateData = {
        type: updateType,
        version: parseInt(version),
        appSpecification: finalSpec,
        timestamp: timestamp,
        signature: signature,
      };

      console.log('📤 Sending app update to FluxOS...');

      // Step 7: Send update request
      const response = await this.post('/apps/appupdate', updateData, {
        timeout: 120000, // 2 minutes
      });

      console.log('✅ App update response:', JSON.stringify(response, null, 2));

      // Check for errors
      if (response.status === 'error' || response.data?.code === 401) {
        const errorMsg = response.data?.message || response.data || response.message || 'App update failed';
        console.error('❌ App update returned error:', errorMsg);
        throw new Error(errorMsg);
      }

      // Extract payment hash
      const paymentHash = response.data;

      if (!paymentHash || typeof paymentHash !== 'string') {
        console.error('❌ No valid payment hash in update response:', response);
        throw new Error('Failed to get payment hash from update');
      }

      console.log('✅ Payment hash received:', paymentHash);
      return paymentHash;
    } catch (error) {
      console.error('❌ App renewal failed:', error);
      throw error;
    }
  }

  // ========== ZelCore Authentication Methods ==========

  /**
   * Get login phrase for ZelCore authentication
   * @returns {Promise<Object>} Login phrase response
   */
  async getLoginPhrase() {
    try {
      const response = await this.get('/id/loginphrase');
      return response;
    } catch (error) {
      console.error('Failed to get login phrase:', error);
      throw error;
    }
  }

  /**
   * Get emergency login phrase (fallback)
   * @returns {Promise<Object>} Emergency phrase response
   */
  async getEmergencyLoginPhrase() {
    try {
      const response = await this.get('/id/emergencyphrase');
      return response;
    } catch (error) {
      console.error('Failed to get emergency phrase:', error);
      throw error;
    }
  }

  /**
   * Verify ZelCore login with signed message
   * @param {Object} loginData - Login data with zelid, signature, and loginPhrase
   * @returns {Promise<Object>} Verification response with privilege level
   */
  async verifyZelCoreLogin(loginData) {
    try {
      const response = await this.post('/id/verifylogin', loginData);
      return response;
    } catch (error) {
      console.error('Failed to verify ZelCore login:', error);
      throw error;
    }
  }

  /**
   * Check user privilege level
   * @param {string} zelid - User's zelid
   * @param {string} signature - Login signature
   * @param {string} loginPhrase - Login phrase that was signed
   * @returns {Promise<Object>} User privilege response
   */
  async checkUserPrivilege(zelid, signature, loginPhrase) {
    try {
      const response = await this.post('/id/checkprivilege', {
        zelid,
        signature,
        loginPhrase,
      });
      return response;
    } catch (error) {
      console.error('Failed to check user privilege:', error);
      throw error;
    }
  }
}

export function parseAddress(address) {
  const parts = address.split(':');
  if (parts.length === 2) {
    return { host: parts[0], port: parts[1] };
  }
  return { host: address, port: null };
}

export default new ApiService();
