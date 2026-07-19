import apiService from './apiService';

/**
 * Stripe Service
 * Uses backend bridge for Stripe payments (like fluxos)
 * Frontend never touches Stripe directly for security
 */
class StripeService {
  constructor() {
    // Backend bridge URL for Stripe operations (matches FluxOS fiatGateways.js)
    // Hardcoded to match FluxOS exactly
    this.stripeBridgeUrl = 'https://fiatpaymentsbridge.runonflux.io';
  }

  /**
   * Create Stripe checkout session for a plan
   * Returns session ID to redirect to Stripe Checkout
   * @param {string} planId - Plan identifier
   * @param {string} successUrl - URL to redirect after successful payment
   * @param {string} cancelUrl - URL to redirect if payment is cancelled
   * @param {string} paymentHash - Payment hash from app registration (FluxOS pattern)
   * @param {number} price - Calculated price for the subscription
   * @param {string} productName - Product name for Stripe
   */
  async createCheckoutSession(planId, successUrl, cancelUrl, paymentHash = null, price = 0, productName = '', description = '') {
    try {
      const auth = await apiService.getStoredAuth();
      if (!auth) {
        throw new Error('Authentication required');
      }

      console.log('💳 Creating Stripe checkout with payment hash...');
      console.log('Payment hash:', paymentHash);
      console.log('Price (original):', price);
      console.log('Price (formatted):', parseFloat(price).toFixed(2));
      console.log('Product:', productName);

      // Build request payload matching FluxOS InstallDialog.vue exactly
      const payload = {
        zelid: auth.zelid,
        signature: auth.signature,
        loginPhrase: auth.loginPhrase,
        details: {
          name: planId,
          description: description,
          price: parseFloat(parseFloat(price).toFixed(2)),
          productName: productName,
          success_url: successUrl || `${window.location.origin}/success`, // Underscore!
          cancel_url: cancelUrl || `${window.location.origin}/cancel`, // Underscore!
          kpi: {
            origin: 'Palworld Website',
            marketplace: false,
            registration: true,
          }
        }
      };

      // Add payment hash if provided (links payment to app registration)
      if (paymentHash) {
        payload.details.hash = paymentHash;
        console.log('✅ Payment hash added to checkout session');
      } else {
        console.warn('⚠️ No payment hash provided - payment will not be linked to app registration');
      }

      console.log('📤 Sending payload to Stripe bridge:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.stripeBridgeUrl}/api/v1/stripe/checkout/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Stripe checkout failed:', error);
        throw new Error(error.message || 'Failed to create checkout session');
      }

      const data = await response.json();
      console.log('✅ Stripe session created:', data);
      // FluxOS extracts data.data (response format: {status: 'success', data: 'sessionId'})
      return data.data;
    } catch (error) {
      console.error('❌ Checkout session creation failed:', error);
      throw error;
    }
  }

  /**
   * Create Stripe subscription session for auto-renewal
   * Same as checkout but with period param, hits /subscription/create endpoint
   * @param {string} planId - Plan identifier
   * @param {string} successUrl - URL to redirect after successful payment
   * @param {string} cancelUrl - URL to redirect if payment is cancelled
   * @param {string} paymentHash - Payment hash from app registration
   * @param {number} price - Calculated price
   * @param {string} productName - Product name for Stripe
   * @param {number} period - Subscription period in months (1, 3, 6, 12)
   */
  async createSubscriptionSession(planId, successUrl, cancelUrl, paymentHash = null, price = 0, productName = '', period = 1, description = '', trialDays = 0) {
    try {
      const auth = await apiService.getStoredAuth();
      if (!auth) {
        throw new Error('Authentication required');
      }

      console.log('💳 Creating Stripe subscription with auto-renewal...');
      console.log('Period:', period, 'months');

      // Match FluxOS InstallDialog.vue payload exactly
      const payload = {
        zelid: auth.zelid,
        signature: auth.signature,
        loginPhrase: auth.loginPhrase,
        details: {
          name: planId,
          description: description,
          hash: paymentHash,
          price: parseFloat(parseFloat(price).toFixed(2)),
          productName: productName,
          period,
          success_url: successUrl || `${window.location.origin}/success`,
          cancel_url: cancelUrl || `${window.location.origin}/cancel`,
          kpi: {
            origin: 'Palworld Website',
            marketplace: true,
            registration: true,
          },
          ...(trialDays > 0 ? { trialDays } : {}),
        }
      };

      console.log('📤 Sending subscription payload to Stripe bridge:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.stripeBridgeUrl}/api/v1/stripe/subscription/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      // Bridge may return 200 with {status: 'error'} (axios pattern)
      if (!response.ok || data.status === 'error') {
        console.error('❌ Stripe subscription failed:', data);
        throw new Error(data.message || data.data || 'Failed to create subscription session');
      }

      console.log('✅ Stripe subscription session created:', data);
      return data.data;
    } catch (error) {
      console.error('❌ Subscription session creation failed:', error);
      throw error;
    }
  }

  /**
   * Redirect to Stripe Checkout
   */
  async redirectToCheckout(planId) {
    try {
      const sessionId = await this.createCheckoutSession(planId);

      // Redirect to Stripe Checkout page
      const stripeCheckoutUrl = `https://checkout.stripe.com/c/pay/${sessionId}`;
      window.location.href = stripeCheckoutUrl;
    } catch (error) {
      console.error('Redirect to checkout failed:', error);
      throw error;
    }
  }

  /**
   * Get customer portal URL for subscription management
   */
  async openBillingPortal() {
    try {
      const auth = await apiService.getStoredAuth();
      if (!auth) {
        throw new Error('Authentication required');
      }

      const payload = {
        zelid: auth.zelid,
        signature: auth.signature,
        loginPhrase: auth.loginPhrase,
        return_url: window.location.href,
      };

      const response = await fetch(`${this.stripeBridgeUrl}/api/v1/stripe/portal/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || data.status === 'error') {
        const msg = data.message || data.data || 'Failed to open billing portal';
        throw new Error(msg);
      }

      if (data.status === 'success' && data.data) {
        window.open(data.data, '_blank');
        return data.data;
      }

      throw new Error('No portal URL returned');
    } catch (error) {
      console.error('Billing portal error:', error);
      throw error;
    }
  }

  /**
   * Get subscription status for a specific app
   * Matches FluxOS [appName].vue fetchSubscriptionStatus()
   * @param {string} appName - App name to check
   * @returns {Promise<Object|null>} Subscription object or null
   */
  async chargeSubscriptionUpdate({ appName, hash, price, description = '' }) {
    const auth = await apiService.getStoredAuth();
    if (!auth) throw new Error('Authentication required');
    const payload = {
      zelid: auth.zelid,
      signature: auth.signature,
      loginPhrase: auth.loginPhrase,
      details: {
        name: appName,
        description,
        hash,
        price: parseFloat(parseFloat(price).toFixed(2)),
        productName: appName,
        kpi: { origin: 'Palworld Website', marketplace: true, registration: false },
      },
    };
    const response = await fetch(`${this.stripeBridgeUrl}/api/v1/stripe/subscription/charge-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || data.status === 'error') {
      throw new Error(data.message || data.data || 'Failed to charge subscription update');
    }
    return data.data;
  }

  async updateSubscriptionPrice(appName, newPrice) {
    const auth = await apiService.getStoredAuth();
    if (!auth) throw new Error('Authentication required');
    const response = await fetch(`${this.stripeBridgeUrl}/api/v1/stripe/subscription/update-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zelid: auth.zelid,
        signature: auth.signature,
        loginPhrase: auth.loginPhrase,
        appName,
        newPrice: parseFloat(parseFloat(newPrice).toFixed(2)),
      }),
    });
    const data = await response.json();
    if (!response.ok || data.status === 'error') {
      throw new Error(data.message || data.data || 'Failed to update subscription price');
    }
    return data.data;
  }

  async getSubscriptionStatus(appName) {
    try {
      const auth = await apiService.getStoredAuth();
      if (!auth) return null;

      const response = await fetch(`${this.stripeBridgeUrl}/api/v1/stripe/subscription/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zelid: auth.zelid,
          signature: auth.signature,
          loginPhrase: auth.loginPhrase,
          appName,
        }),
      });

      const data = await response.json();
      if (data.status === 'success' && data.data) {
        const sub = data.data;
        if (sub.status === 'active' || sub.status === 'past_due') {
          return sub;
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to fetch subscription status:', error.message);
      return null;
    }
  }

  /**
   * Cancel Stripe subscription for an app
   * Matches FluxOS SubscriptionManager.vue cancel flow
   * @param {string} appName - App name to cancel subscription for
   */
  async cancelSubscription(appName) {
    try {
      const auth = await apiService.getStoredAuth();
      if (!auth) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${this.stripeBridgeUrl}/api/v1/stripe/subscription/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zelid: auth.zelid,
          signature: auth.signature,
          loginPhrase: auth.loginPhrase,
          appName,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.status === 'error') {
        throw new Error(data.message || data.data || 'Failed to cancel subscription');
      }
      return data;
    } catch (error) {
      console.error('Subscription cancellation failed:', error);
      throw error;
    }
  }
}

export default new StripeService();
