import { lazy } from 'react';

/**
 * The route table, kept out of App.jsx so that file only exports components
 * (a module mixing components with helpers breaks React Fast Refresh in dev).
 *
 * `lazyPage` adds a preload() step on top of React.lazy. It matters because
 * renderToString() is synchronous: a plain React.lazy component would suspend and
 * the SSR prerender would emit the <Suspense> fallback instead of the page. Once
 * preload() has resolved, the wrapper renders the module synchronously — so the
 * server emits real markup, and the client (which preloads the same route before
 * hydrating) produces an identical first render. See src/entry-server.jsx.
 */
const lazyPage = (factory) => {
  const Lazy = lazy(factory);
  let Loaded = null;
  const Page = (props) => (Loaded ? <Loaded {...props} /> : <Lazy {...props} />);
  Page.preload = () => Promise.resolve(factory()).then((m) => { Loaded = m.default; });
  Page.displayName = 'LazyPage';
  return Page;
};

/**
 * Which page component serves each path. Used both to render the <Route> list and
 * to preload exactly the one route being rendered (server) or hydrated (client) —
 * never the whole app. One table, so the two can't drift apart.
 *
 * The '*' entry is the catch-all; React Router ranks by specificity, not by order.
 */
export const ROUTE_PAGES = {
  '/': lazyPage(() => import('./pages/Home')),
  '/dashboard': lazyPage(() => import('./pages/Dashboard')),
  '/success': lazyPage(() => import('./pages/Success')),
  '/cancel': lazyPage(() => import('./pages/Cancel')),
  '/support': lazyPage(() => import('./pages/Support')),
  '/rent-palworld-server': lazyPage(() => import('./pages/RentServer')),
  '/setup-guide': lazyPage(() => import('./pages/SetupGuide')),
  '/server-requirements': lazyPage(() => import('./pages/ServerRequirements')),
  '/pricing': lazyPage(() => import('./pages/Pricing')),
  '/guides/join-server': lazyPage(() => import('./pages/GuideJoinServer')),
  '/guides/server-settings': lazyPage(() => import('./pages/GuideServerSettings')),
  '/decentralized-palworld-hosting': lazyPage(() => import('./pages/Comparison')),
  '/nitrado-alternative': lazyPage(() => import('./pages/NitradoAlternative')),
  '/gportal-alternative': lazyPage(() => import('./pages/GportalAlternative')),
  '*': lazyPage(() => import('./pages/NotFound')),
};

/** Load the chunk for `pathname` (falling back to NotFound) before render/hydrate. */
export const preloadRoute = (pathname) => {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const Page = ROUTE_PAGES[clean] || ROUTE_PAGES['*'];
  return Page.preload();
};
