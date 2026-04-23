import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import apiService from '../../services/apiService';
import secureStorage from '../../utils/secureStorage';
import qs from 'qs';

/**
 * ZelCore Login Button Component
 * Handles ZelCore wallet authentication following FluxOS pattern
 */
const ZelCoreLoginButton = ({ onSuccess, disabled }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [loginPhrase, setLoginPhrase] = useState('');

  // Refs for cleanup
  const wsRef = useRef(null);
  const timeoutRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  /**
   * Get login phrase from Flux backend
   * Returns { phrase, backendUrl } where backendUrl is the sticky backend to use
   */
  const getLoginPhrase = async () => {
    try {
      const response = await apiService.getLoginPhrase();
      if (response.status === 'success' && response.data) {
        // Get sticky backend from apiService (captured from response headers)
        const stickyBackend = apiService.getStickyBackend();
        console.log('🔗 Sticky backend for login:', stickyBackend);

        return {
          phrase: response.data,
          backendUrl: stickyBackend || apiService.fluxClient.defaults.baseURL,
        };
      }
      throw new Error('Failed to get login phrase');
    } catch (error) {
      console.error('❌ Failed to get login phrase:', error);
      // Try emergency phrase as fallback
      try {
        const emergencyResponse = await apiService.getEmergencyLoginPhrase();
        if (emergencyResponse.status === 'success' && emergencyResponse.data) {
          const stickyBackend = apiService.getStickyBackend();
          return {
            phrase: emergencyResponse.data,
            backendUrl: stickyBackend || apiService.fluxClient.defaults.baseURL,
          };
        }
      } catch (emergencyError) {
        console.error('❌ Emergency phrase also failed:', emergencyError);
      }
      throw error;
    }
  };

  /**
   * Initialize ZelCore protocol for message signing
   * Opens ZelCore wallet to sign the login phrase
   */
  const initZelCore = (phrase, backendUrl) => {
    // Use pre-encoded icon URL (FluxOS pattern)
    const icon = 'https%3A%2F%2Fcdn.runonflux.io%2Fimg%2Ffluxlogo_color.svg';

    // Callback should be /id/verifylogin endpoint (FluxOS pattern), NOT the WebSocket URL
    // The backend will relay the signed message through the WebSocket
    const callbackUrl = `${backendUrl}/id/verifylogin`;

    // Build ZelCore protocol URL (FluxOS pattern - don't encode message, use encodeURI for callback)
    const protocolUrl = `zel:?action=sign&message=${phrase}&icon=${icon}&callback=${encodeURI(callbackUrl)}`;

    console.log('🔐 Opening ZelCore for signing...');

    // Method 1: Try ZelCore extension if available
    if (window.zelcore && typeof window.zelcore.protocol === 'function') {
      window.zelcore.protocol(protocolUrl);
      return;
    }

    // Method 2: Create hidden link and trigger click (for desktop ZelCore)
    const hiddenLink = document.createElement('a');
    hiddenLink.href = protocolUrl;
    hiddenLink.style.display = 'none';
    document.body.appendChild(hiddenLink);
    hiddenLink.click();

    // Clean up after a short delay
    setTimeout(() => {
      document.body.removeChild(hiddenLink);
    }, 100);
  };

  /**
   * Handle WebSocket connection to receive signed message from ZelCore
   */
  const connectWebSocket = (phrase, wsUrl) => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws; // Store for cleanup
      let timeoutId;

      ws.onopen = () => {
        console.log('✅ WebSocket connected, waiting for ZelCore response...');

        // Set 2-minute timeout for user to sign in ZelCore
        timeoutId = setTimeout(() => {
          ws.close();
          reject(new Error('ZelCore signing timed out. Please try again.'));
        }, 120000); // 2 minutes
        timeoutRef.current = timeoutId; // Store for cleanup
      };

      ws.onmessage = (event) => {
        clearTimeout(timeoutId);
        timeoutRef.current = null; // Clear ref since timeout was cleared
        console.log('📨 Received message from ZelCore');

        try {
          const data = qs.parse(event.data);

          if (data.status === 'success' && data.data) {
            const signedData = data.data;

            // Verify we have all required fields
            if (signedData.zelid && signedData.signature && signedData.loginPhrase) {
              resolve({
                zelid: signedData.zelid,
                signature: signedData.signature,
                loginPhrase: signedData.loginPhrase,
                privilege: data.data.privilage || 'user', // Note: FluxOS typo "privilage"
              });
            } else {
              reject(new Error('Invalid response from ZelCore'));
            }
          } else {
            reject(new Error(data.data?.message || 'ZelCore signing failed'));
          }
        } catch (error) {
          console.error('ZelCore response parse error:', error);
          reject(new Error('Failed to parse ZelCore response'));
        } finally {
          ws.close();
          wsRef.current = null; // Clear ref since WS was closed
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeoutId);
        timeoutRef.current = null; // Clear ref since timeout was cleared
        console.error('❌ WebSocket error:', error);
        reject(new Error('WebSocket connection failed'));
      };

      ws.onclose = () => {
        clearTimeout(timeoutId);
        timeoutRef.current = null; // Clear ref since timeout was cleared
        wsRef.current = null; // Clear ref since WS was closed
      };
    });
  };

  /**
   * Main login flow
   */
  const handleZelCoreLogin = async () => {
    if (isConnecting) return;

    setIsConnecting(true);

    try {
      // Step 1: Get login phrase from backend (returns phrase + sticky backend URL)
      const { phrase, backendUrl } = await getLoginPhrase();
      setLoginPhrase(phrase);

      console.log('🔗 Using backend:', backendUrl);

      // Step 2: Set up WebSocket connection using sticky backend
      const wsUrl = `${backendUrl.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/id/${phrase}`;

      // Step 3: Open ZelCore for signing (pass backendUrl, not wsUrl)
      initZelCore(phrase, backendUrl);

      // Step 4: Wait for signed response via WebSocket
      const signedData = await connectWebSocket(phrase, wsUrl);

      console.log('✅ ZelCore login successful:', {
        zelid: signedData.zelid,
        privilege: signedData.privilege,
      });

      // Step 5: Store zelidauth
      const zelidauth = {
        zelid: signedData.zelid,
        signature: signedData.signature,
        loginPhrase: signedData.loginPhrase,
      };

      console.log('💾 Storing auth credentials in encrypted storage');
      await secureStorage.setItem('zelidauth', zelidauth);
      localStorage.setItem('loginType', 'zelcore');
      console.log('💾 Auth credentials stored');

      // Call success callback
      console.log('📞 Calling onSuccess callback');
      if (onSuccess) {
        onSuccess({
          zelid: signedData.zelid,
          privilege: signedData.privilege,
          loginType: 'zelcore',
        });
        console.log('✅ onSuccess callback completed');
      } else {
        console.warn('⚠️ No onSuccess callback provided');
      }
    } catch (error) {
      console.error('❌ ZelCore login failed:', error);
    } finally {
      setIsConnecting(false);
      setLoginPhrase('');
    }
  };

  return (
    <button
      type="button"
      onClick={handleZelCoreLogin}
      disabled={isConnecting || disabled}
      className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {/* ZelCore Icon */}
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.86-1.03-7-5.08-7-9V8.3l7-3.5 7 3.5V11c0 3.92-3.14 7.97-7 9z"/>
      </svg>

      <span>{isConnecting ? 'Connecting...' : 'Continue with ZelCore'}</span>
    </button>
  );
};

ZelCoreLoginButton.propTypes = {
  onSuccess: PropTypes.func,
  disabled: PropTypes.bool,
};

export default ZelCoreLoginButton;
