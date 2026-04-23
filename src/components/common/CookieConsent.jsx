import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CONSENT_KEY = 'ga_consent';

/**
 * Google Analytics Cookie Consent Banner
 * Simple Accept/Deny for GA tracking only
 */
const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user already made a choice
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent === null) {
      // No choice made yet, show banner after short delay
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setShowBanner(false);

    // Load GA dynamically without page reload
    const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    const enableAnalytics = import.meta.env.VITE_ENABLE_ANALYTICS === 'true';

    if (enableAnalytics && gaMeasurementId && !import.meta.env.DEV) {
      // Check if GA script already exists
      if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)) {
        const gaScript = document.createElement('script');
        gaScript.async = true;
        gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`;
        document.head.appendChild(gaScript);

        // Initialize GA
        window.dataLayer = window.dataLayer || [];
        function gtag() { window.dataLayer.push(arguments); }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', gaMeasurementId);
      }
    }
  };

  const handleDeny = () => {
    localStorage.setItem(CONSENT_KEY, 'denied');
    setShowBanner(false);
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4"
        >
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-700 rounded-2xl shadow-2xl p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Analytics Tracking
                </h3>
                <p className="text-sm text-gray-300">
                  We use analytics to understand how visitors use our site and improve our service.
                  You can change this later via "Cookie Settings" in the footer.
                </p>
              </div>

              <div className="flex gap-3 flex-shrink-0">
                <button
                  onClick={handleDeny}
                  className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors duration-200 border border-gray-600"
                >
                  Deny
                </button>
                <button
                  onClick={handleAccept}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium rounded-lg transition-all duration-200 shadow-lg shadow-blue-900/30"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Helper function to check consent status
// eslint-disable-next-line react-refresh/only-export-components
export const hasGAConsent = () => {
  const consent = localStorage.getItem(CONSENT_KEY);
  return consent === 'accepted';
};

export default CookieConsent;
