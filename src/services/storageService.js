import axios from 'axios';

/**
 * Storage Service for interacting with Flux Storage API
 * Handles email contacts and environment variables upload
 */
class StorageService {
  constructor() {
    this.baseURL = 'https://storage.runonflux.io';
    this.apiVersion = '1';
  }

  /**
   * Get axios instance configured for Flux Storage
   */
  getStorageClient() {
    return axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
      },
    });
  }

  /**
   * Upload environment variables to Flux Storage
   * @param {Object} data - Environment data
   * @param {string} data.envid - Unique ID for the environment entry
   * @param {Array<string>} data.env - Array of environment variables
   * @returns {Promise<Object>} Upload response
   */
  async uploadEnv(data) {
    try {
      console.log('🔐 Uploading environment variables to Flux Storage:', { envid: data.envid, envCount: data.env.length });

      const client = this.getStorageClient();
      const response = await client.post(`/v${this.apiVersion}/env`, data);

      if (response.status === 200 || response.status === 201) {
        console.log('✅ Environment variables uploaded successfully to Flux Storage');
        return response.data;
      }

      throw new Error(`Storage upload failed with status: ${response.status}`);
    } catch (error) {
      console.error('❌ Failed to upload environment variables to Flux Storage:', error);

      if (error.response) {
        throw new Error(`Storage API error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Storage API request failed - no response received');
      } else {
        throw new Error(`Storage upload error: ${error.message}`);
      }
    }
  }

  /**
   * Upload contacts (email addresses) to Flux Storage
   * @param {Object} data - Contact data
   * @param {string} data.contactsid - Unique ID for the contacts entry
   * @param {Array<string>} data.contacts - Array of email addresses
   * @returns {Promise<Object>} Upload response
   */
  async uploadContacts(data) {
    try {
      console.log('📧 Uploading contacts to Flux Storage:', data);

      const client = this.getStorageClient();
      const response = await client.post(`/v${this.apiVersion}/contacts`, data);

      if (response.status === 200 || response.status === 201) {
        console.log('✅ Contacts uploaded successfully to Flux Storage');
        return response.data;
      }

      throw new Error(`Storage upload failed with status: ${response.status}`);
    } catch (error) {
      console.error('❌ Failed to upload contacts to Flux Storage:', error);

      if (error.response) {
        throw new Error(`Storage API error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Storage API request failed - no response received');
      } else {
        throw new Error(`Storage upload error: ${error.message}`);
      }
    }
  }

  /**
   * Generate a random environment ID (matching FluxCloud's implementation)
   * @returns {string} Random environment ID
   */
  generateEnvId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000) + 1000;
    return `${timestamp}${random}`;
  }

  /**
   * Generate a random contacts ID (matching FluxCloud's implementation)
   * @returns {string} Random contacts ID
   */
  generateContactsId() {
    // FluxCloud uses: (math.Random().nextDouble() * 999999999999999).floor().toString()
    return Math.floor(Math.random() * 999999999999999).toString();
  }

  /**
   * Create storage reference URL for environment variables
   * @param {string} envId - The environment ID
   * @returns {string} Storage reference URL
   */
  getEnvStorageReference(envId) {
    return `F_S_ENV=https://storage.runonflux.io/v${this.apiVersion}/env/${envId}`;
  }

  /**
   * Create storage reference URL for contacts
   * @param {string} contactsId - The contacts ID
   * @returns {string} Storage reference URL
   */
  getContactsStorageReference(contactsId) {
    return `F_S_CONTACTS=https://storage.runonflux.io/v${this.apiVersion}/contacts/${contactsId}`;
  }
}

// Create singleton instance
const storageService = new StorageService();

export default storageService;
