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
}) => {
  const siteUrl = import.meta.env.VITE_APP_URL || 'http://localhost:5173';
  const siteName = gameConfig.serverName;
  const defaultKeywords = `${gameConfig.gameName} server hosting, game server hosting, decentralized hosting, Flux cloud, ${gameConfig.gameName} hosting, web3 hosting`;

  // Build SEO values
  const seoTitle = title ? `${title} | ${siteName}` : `${siteName} - ${gameConfig.tagline}`;
  const seoDescription = description || gameConfig.description;
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

  // Build structured data schemas
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}${gameConfig.assets.logo}`,
    },
    description: seoDescription,
    sameAs: Object.values(gameConfig.social).filter(Boolean),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      availableLanguage: 'en',
    },
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: siteUrl,
    description: seoDescription,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
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
    ],
  };

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

  const faqSchema = (type === 'faq' && gameConfig.faq) ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: gameConfig.faq.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
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

      {/* Structured Data (JSON-LD) */}
      <script type="application/ld+json">
        {JSON.stringify(organizationSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(websiteSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>
      {productSchema && (
        <script type="application/ld+json">
          {JSON.stringify(productSchema)}
        </script>
      )}
      {faqSchema && (
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      )}
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
};

export default SEO;
