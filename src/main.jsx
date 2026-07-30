import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'
import { preloadRoute } from './routes.jsx'

const container = document.getElementById('root')

const tree = (
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>
)

const normalize = (p) => p.replace(/\/+$/, '') || '/'

// Prerendered routes (see scripts/prerender.mjs) ship real server-rendered markup
// inside #root, tagged with the route it was rendered for. Hydrate it rather than
// calling createRoot(), which would wipe the DOM and re-render from scratch — that
// wipe is the visible "load, then reload".
//
// The markup has to be for *this* route: server.js serves dist/index.html (the
// homepage body) for /dashboard too, and hydrating the homepage as the dashboard is
// a mismatch — React throws the markup away and re-renders anyway, minus a console
// error. In that case, and in dev where #root is empty, just mount normally.
//
// The route's chunk also has to be loaded before hydrating: an unresolved React.lazy
// would render the Suspense fallback on the client's first pass, which does not
// match the server markup.
const ssrPath = container.dataset.ssrPath
const canHydrate =
  container.hasChildNodes() &&
  (ssrPath === '*' || (ssrPath && normalize(ssrPath) === normalize(window.location.pathname)))

if (canHydrate) {
  preloadRoute(window.location.pathname).then(() => {
    hydrateRoot(container, tree)
  })
} else {
  createRoot(container).render(tree)
}
