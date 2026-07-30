import { Suspense, useEffect } from 'react';
import PropTypes from 'prop-types';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CookieConsent, hasGAConsent, ErrorBoundary } from './components/common';
import ScrollToTop from './components/ScrollToTop';
import { ROUTE_PAGES } from './routes';

// Loading component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-text-muted">Loading...</p>
    </div>
  </div>
);

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Toast configuration (outside component to prevent recreation)
const toastOptions = {
  duration: 4000,
  style: {
    background: '#1f1f1f',
    color: '#ffffff',
    border: '1px solid #2a2a2a',
  },
  success: {
    iconTheme: {
      primary: '#4A9B4A',
      secondary: '#ffffff',
    },
  },
  error: {
    iconTheme: {
      primary: '#ef4444',
      secondary: '#ffffff',
    },
  },
};

/**
 * Everything that must live *inside* a Router. The server wraps this in
 * StaticRouter and the client in BrowserRouter; both produce the same markup, so
 * hydration matches.
 */
export function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <div className="min-h-screen bg-background text-text">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {Object.keys(ROUTE_PAGES).map((path) => {
              const Page = ROUTE_PAGES[path];
              return <Route key={path} path={path} element={<Page />} />;
            })}
          </Routes>
        </Suspense>

        {/* Toast Notifications */}
        <Toaster
          position="top-center"
          toastOptions={toastOptions}
        />

        {/* Cookie Consent Banner for GA. Renders null until its effect runs, so it
            is absent from the SSR markup and from the client's first render. */}
        <CookieConsent />
      </div>
    </>
  );
}

/** Router-agnostic providers. Shared by the client and the SSR prerender. */
export function AppProviders({ children }) {
  // Initialize Google Analytics once on app mount
  useEffect(() => {
    const isDevelopment = import.meta.env.DEV;
    const enableAnalytics = import.meta.env.VITE_ENABLE_ANALYTICS === 'true' && !isDevelopment;
    const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    const userConsented = hasGAConsent();

    if (enableAnalytics && gaMeasurementId && userConsented) {
      // Only load GA script once - check if not already loaded
      if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)) {
        const gaScript = document.createElement('script');
        gaScript.async = true;
        gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`;
        document.head.appendChild(gaScript);

        // Initialize GA dataLayer
        window.dataLayer = window.dataLayer || [];
        function gtag() { window.dataLayer.push(arguments); }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', gaMeasurementId);
      }
    }
  }, []); // Run once on mount

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

AppProviders.propTypes = {
  children: PropTypes.node,
};

/** Client entry tree. The SSR equivalent lives in src/entry-server.jsx. */
function App() {
  return (
    <AppProviders>
      <Router>
        <AppRoutes />
      </Router>
    </AppProviders>
  );
}

export default App;
