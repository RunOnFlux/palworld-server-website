import { Helmet } from 'react-helmet-async';
import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { gameConfig } from '../../config/gameConfig';
import { hasGAConsent } from './CookieConsent';

/**
 * Comprehensive SEO Component using react-helmet-async
 * Following Google, Bing, and social media best practices
 * Properly integrated with HelmetProvider for SSR/CSR compatibility
 */
const SEO = ({
  title,
  description,
  keywords,
  image,
  url,
  type = 'website',
  noIndex = false,
  article = null,
  product = null,
  breadcrumbs = null,
  schemas = null,
}) => {
  const siteUrl = import.meta.env.VITE_APP_URL || 'http://localhost:5173';
  const siteName = gameConfig.serverName;
  const game = gameConfig.gameName;
  const defaultKeywords = [
    `${game} server hosting`,
    `${game} dedicated server`,
    `rent ${game} server`,
    `${game} server rental`,
    `host ${game} server`,
    `cheap ${game} server hosting`,
    `${game} multiplayer hosting`,
    `${game} dedicated server hosting`,
    `${game} private server`,
    `${game} hosting`,
    `best ${game} server hosting`,
    `${game} server provider`,
    `DDoS protected ${game} server`,
    `${game} 32 player server`,
    'decentralized game server hosting',
    'Flux cloud hosting',
  ].join(', ');

  // Build SEO values — lead with the highest-intent keyword on the homepage.
  // Kept ≤60 chars (title) / ≤160 chars (description) so Google never truncates
  // the snippet. Must stay in sync with the static tags in index.html.
  const defaultHomeTitle = `${game} 1.0 Server Hosting — Deploy from $2.61/mo | Flux`;
  const defaultHomeDescription = `Rent a dedicated ${game} server updated for 1.0 on the decentralized Flux cloud. Up to 32 players, crossplay, DDoS protection — deploy in 30s from $2.61/mo.`;
  const seoTitle = title ? `${title} | ${siteName}` : defaultHomeTitle;
  const seoDescription = description || defaultHomeDescription;
  const seoImage = image ? `${siteUrl}${image}` : `${siteUrl}${gameConfig.assets.banner}`;
  const seoUrl = url ? `${siteUrl}${url}` : siteUrl;
  const seoKeywords = keywords || defaultKeywords;

  // Disable SEO tracking in development
  const isDevelopment = import.meta.env.DEV;
  const robotsContent = (noIndex || isDevelopment)
    ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  // Google Analytics page tracking (GA initialization happens in App.jsx)
  useEffect(() => {
    const enableAnalytics = import.meta.env.VITE_ENABLE_ANALYTICS === 'true' && !isDevelopment;
    const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    const userConsented = hasGAConsent();

    // Only track page views if GA is initialized and user consented
    if (enableAnalytics && gaMeasurementId && userConsented && window.gtag) {
      window.gtag('config', gaMeasurementId, {
        page_title: seoTitle,
        page_path: url || '/',
      });
    }
  }, [seoTitle, url, isDevelopment]);

  // Build structured data schemas.
  //
  // Organization, WebSite, Service and the homepage FAQPage are emitted statically
  // in index.html / by the prerender, so non-JS crawlers and AI engines see them
  // immediately. Emitting them again here would create duplicate entities in
  // Google's rich results report. React owns only the per-page schemas: the
  // BreadcrumbList below, an optional Product schema, and whatever the page passes
  // in `schemas` (HowTo, FAQPage, Product/AggregateOffer). Since the prerender now
  // server-renders this component, all of it ships in the static HTML too.
  const breadcrumbItems = breadcrumbs && breadcrumbs.length
    ? breadcrumbs.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: `${siteUrl}${b.url === '/' ? '' : b.url}`,
      }))
    : [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: siteUrl,
        },
        ...(url && url !== '/' ? [{
          '@type': 'ListItem',
          position: 2,
          name: title,
          item: seoUrl,
        }] : []),
      ];

  // A one-item "Home" trail (i.e. the homepage) is not a breadcrumb — emitting it
  // would only add a meaningless BreadcrumbList entity to the front page.
  const breadcrumbSchema = breadcrumbItems.length > 1
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
      }
    : null;

  const productSchema = product ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: `${siteUrl}${product.image}`,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: seoUrl,
    },
    ...(product.rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating,
        reviewCount: product.reviewCount,
      },
    }),
  } : null;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{seoTitle}</title>
      <meta name="title" content={seoTitle} />
      <meta name="description" content={seoDescription} />
      <meta name="keywords" content={seoKeywords} />
      <meta name="author" content={siteName} />

      {/* Robots & Crawling */}
      <meta name="robots" content={robotsContent} />
      {!noIndex && !isDevelopment && (
        <>
          <meta name="googlebot" content="index, follow" />
          <meta name="bingbot" content="index, follow" />
        </>
      )}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={seoUrl} />
      <meta property="og:title" content={seoTitle} />
      <meta property="og:description" content={seoDescription} />
      <meta property="og:image" content={seoImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={seoTitle} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="en_US" />

      {/* Article-specific OG tags */}
      {article && (
        <>
          <meta property="article:published_time" content={article.publishedTime} />
          <meta property="article:modified_time" content={article.modifiedTime} />
          <meta property="article:author" content={article.author} />
        </>
      )}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={seoUrl} />
      <meta name="twitter:title" content={seoTitle} />
      <meta name="twitter:description" content={seoDescription} />
      <meta name="twitter:image" content={seoImage} />
      <meta name="twitter:image:alt" content={seoTitle} />
      {gameConfig.social.twitter && (
        <meta name="twitter:site" content={gameConfig.social.twitter} />
      )}

      {/* Canonical URL */}
      <link rel="canonical" href={seoUrl} />

      {/* Performance Hints */}
      <link rel="preconnect" href="https://api.runonflux.io" />
      <link rel="preconnect" href="https://jetpackbridge.runonflux.io" />
      <link rel="dns-prefetch" href="https://api.runonflux.io" />
      <link rel="dns-prefetch" href="https://jetpackbridge.runonflux.io" />

      {/* Structured Data (JSON-LD).
          Organization, WebSite, Service and the homepage FAQPage live in the
          <head> (index.html + the prerender) so non-JS crawlers see them. Only
          the per-page entities are emitted here, to avoid duplicates. */}
      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}
      {productSchema && (
        <script type="application/ld+json">
          {JSON.stringify(productSchema)}
        </script>
      )}
      {/* Extra per-page schemas (HowTo, FAQPage, Product/AggregateOffer) */}
      {schemas && schemas.map((schema, i) => (
        <script type="application/ld+json" key={i}>
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
};

SEO.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  keywords: PropTypes.string,
  image: PropTypes.string,
  url: PropTypes.string,
  type: PropTypes.oneOf(['website', 'article', 'product', 'faq']),
  noIndex: PropTypes.bool,
  article: PropTypes.shape({
    publishedTime: PropTypes.string,
    modifiedTime: PropTypes.string,
    author: PropTypes.string,
  }),
  product: PropTypes.shape({
    name: PropTypes.string,
    description: PropTypes.string,
    image: PropTypes.string,
    price: PropTypes.number,
    rating: PropTypes.number,
    reviewCount: PropTypes.number,
  }),
  breadcrumbs: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string,
    url: PropTypes.string,
  })),
  schemas: PropTypes.arrayOf(PropTypes.object),
};

export default SEO;
