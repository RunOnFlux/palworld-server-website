import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
// React Router 7 dropped the `react-router-dom/server` entrypoint; StaticRouter
// now lives in the `react-router` package.
import { StaticRouter } from 'react-router';
import { HelmetProvider } from 'react-helmet-async';
import { AppProviders, AppRoutes } from './App.jsx';
import { preloadRoute } from './routes.jsx';
import './index.css';

/**
 * Render one route to HTML at build time (see scripts/prerender.mjs).
 *
 * The markup returned here is what ships in <div id="root">, and the client
 * hydrates it rather than throwing it away — which is what removes the visible
 * "flash of prerendered content, then reload".
 *
 * The route's chunk is preloaded first because renderToString is synchronous:
 * an unresolved React.lazy would suspend and emit the fallback spinner instead
 * of the page. The client preloads the same route before hydrating, so both
 * sides produce identical markup.
 */
export async function render(url) {
  await preloadRoute(url);

  const helmetContext = {};

  const html = renderToString(
    <StrictMode>
      <HelmetProvider context={helmetContext}>
        <AppProviders>
          <StaticRouter location={url}>
            <AppRoutes />
          </StaticRouter>
        </AppProviders>
      </HelmetProvider>
    </StrictMode>,
  );

  return { html, helmet: helmetContext.helmet };
}
