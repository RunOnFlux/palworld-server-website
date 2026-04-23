import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CONSENT_KEY = 'ga_consent';

/**
 * Cookie Settings Dialog
 * Allows users to view and change their GA consent choice
 */
const CookieSettingsDialog = ({ isOpen, onClose }) => {
  const [consent, setConsent] = useState(null);

  // Sync state with localStorage when dialog opens
  useEffect(() => {
    if (isOpen) {
      const currentConsent = localStorage.getItem(CONSENT_KEY);
      setConsent(currentConsent);
    }
  }, [isOpen]);

  const handleSave = () => {
    const currentConsent = localStorage.getItem(CONSENT_KEY);
    if (consent !== currentConsent) {
      localStorage.setItem(CONSENT_KEY, consent);

      // If user just accepted, load GA without reload
      if (consent === 'accepted') {
        const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
        const enableAnalytics = import.meta.env.VITE_ENABLE_ANALYTICS === 'true';

        if (enableAnalytics && gaMeasurementId && !import.meta.env.DEV) {
          if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)) {
            const gaScript = document.createElement('script');
            gaScript.async = true;
            gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`;
            document.head.appendChild(gaScript);

            window.dataLayer = window.dataLayer || [];
            function gtag() { window.dataLayer.push(arguments); }
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', gaMeasurementId);
          }
        }
      }
      // Note: If user denied, GA won't load. Refresh won't help anyway.
      onClose();
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Dialog */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-700 rounded-2xl shadow-2xl p-6 max-w-md w-full"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Cookie Settings</h2>
              <p className="text-sm text-gray-400">Manage your tracking preferences</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4 mb-6">
            {/* Essential Cookies */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">Essential Cookies</h3>
                  <p className="text-sm text-gray-400">
                    Required for authentication and core functionality. Always enabled.
                  </p>
                </div>
                <div className="ml-3 flex items-center gap-2 text-sm text-blue-400">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Always On
                </div>
              </div>
            </div>

            {/* Analytics */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">Analytics</h3>
                  <p className="text-sm text-gray-400">
                    Helps us understand how visitors use our site to improve our service.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => setConsent('accepted')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    consent === 'accepted'
                      ? 'bg-blue-600 text-white border-2 border-blue-500'
                      : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                  }`}
                >
                  Allow
                </button>
                <button
                  onClick={() => setConsent('denied')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    consent === 'denied'
                      ? 'bg-red-600 text-white border-2 border-red-500'
                      : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                  }`}
                >
                  Deny
                </button>
              </div>
            </div>

            {/* Current Status */}
            <div className="text-center text-sm text-gray-400">
              Current: <span className={consent === 'accepted' ? 'text-blue-400' : 'text-red-400'}>
                {consent === 'accepted' ? 'Analytics Enabled' : consent === 'denied' ? 'Analytics Disabled' : 'Not Set'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors border border-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium rounded-lg transition-all shadow-lg shadow-blue-900/30"
            >
              Save Changes
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CookieSettingsDialog;
