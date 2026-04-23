import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CookieConsent, hasGAConsent, ErrorBoundary } from './components/common';

// Lazy load pages for code splitting
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Success = lazy(() => import('./pages/Success'));
const Cancel = lazy(() => import('./pages/Cancel'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Support = lazy(() => import('./pages/Support'));

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

function App() {
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
          <Router>
            <div className="min-h-screen bg-background text-text">
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/success" element={<Success />} />
                  <Route path="/cancel" element={<Cancel />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>

              {/* Toast Notifications */}
              <Toaster
                position="top-center"
                toastOptions={toastOptions}
              />

              {/* Cookie Consent Banner for GA */}
              <CookieConsent />
            </div>
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
