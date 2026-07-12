import { lazy, Suspense, useEffect } from 'react';
import PropTypes from 'prop-types';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CookieConsent, hasGAConsent, ErrorBoundary } from './components/common';
import ScrollToTop from './components/ScrollToTop';

// Lazy load pages for code splitting.
//
// `lazyPage` adds a preload() step on top of React.lazy. It matters because
// renderToString() is synchronous: a plain React.lazy component would suspend and
// the SSR prerender would emit the <Suspense> fallback instead of the page. Once
// preload() has resolved, the wrapper renders the module synchronously — so the
// server emits real markup, and the client (which preloads the same route before
// hydrating) produces an identical first render. See src/entry-server.jsx.
const lazyPage = (factory) => {
  const Lazy = lazy(factory);
  let Loaded = null;
  const Page = (props) => (Loaded ? <Loaded {...props} /> : <Lazy {...props} />);
  Page.preload = () => Promise.resolve(factory()).then((m) => { Loaded = m.default; });
  Page.displayName = 'LazyPage';
  return Page;
};

const Home = lazyPage(() => import('./pages/Home'));
const Dashboard = lazyPage(() => import('./pages/Dashboard'));
const Success = lazyPage(() => import('./pages/Success'));
const Cancel = lazyPage(() => import('./pages/Cancel'));
const NotFound = lazyPage(() => import('./pages/NotFound'));
const Support = lazyPage(() => import('./pages/Support'));
const SetupGuide = lazyPage(() => import('./pages/SetupGuide'));
const ServerRequirements = lazyPage(() => import('./pages/ServerRequirements'));
const Pricing = lazyPage(() => import('./pages/Pricing'));
const GuideJoinServer = lazyPage(() => import('./pages/GuideJoinServer'));
const GuideServerSettings = lazyPage(() => import('./pages/GuideServerSettings'));
const Comparison = lazyPage(() => import('./pages/Comparison'));
const NitradoAlternative = lazyPage(() => import('./pages/NitradoAlternative'));
const GportalAlternative = lazyPage(() => import('./pages/GportalAlternative'));

// Which page component serves each path. Used to preload exactly the one route
// being rendered (server) or hydrated (client) — never the whole app.
const ROUTE_PAGES = {
  '/': Home,
  '/dashboard': Dashboard,
  '/success': Success,
  '/cancel': Cancel,
  '/support': Support,
  '/setup-guide': SetupGuide,
  '/server-requirements': ServerRequirements,
  '/pricing': Pricing,
  '/guides/join-server': GuideJoinServer,
  '/guides/server-settings': GuideServerSettings,
  '/decentralized-palworld-hosting': Comparison,
  '/nitrado-alternative': NitradoAlternative,
  '/gportal-alternative': GportalAlternative,
};

/** Load the chunk for `pathname` (falling back to NotFound) before render/hydrate. */
export const preloadRoute = (pathname) => {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const Page = ROUTE_PAGES[clean] || NotFound;
  return Page.preload();
};

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
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/success" element={<Success />} />
            <Route path="/cancel" element={<Cancel />} />
            <Route path="/support" element={<Support />} />
            <Route path="/setup-guide" element={<SetupGuide />} />
            <Route path="/server-requirements" element={<ServerRequirements />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/guides/join-server" element={<GuideJoinServer />} />
            <Route path="/guides/server-settings" element={<GuideServerSettings />} />
            <Route path="/decentralized-palworld-hosting" element={<Comparison />} />
            <Route path="/nitrado-alternative" element={<NitradoAlternative />} />
            <Route path="/gportal-alternative" element={<GportalAlternative />} />
            <Route path="*" element={<NotFound />} />
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
