// API Configuration
// SAME FOR ALL GAMES - connects to Flux infrastructure

export const apiConfig = {
  // Flux Network APIs
  fluxApi: {
    baseUrl: "https://api.runonflux.io",
    endpoints: {
      loginPhrase: "/id/loginphrase",
      apps: "/apps",
      appSpecifications: "/apps/appspecifications",
      location: "/apps/location",
      fluxInfo: "/daemon/getinfo",
    }
  },

  // JetpackBridge API (for marketplace, subscriptions, payments)
  bridgeApi: {
    baseUrl: "https://jetpackbridge.runonflux.io",
    endpoints: {
      // Marketplace endpoints
      marketplaceApps: "/api/v1/marketplace/apps",
      marketplaceCategories: "/api/v1/marketplace/categories",
      marketplaceFeatured: "/api/v1/marketplace/featured",
      marketplaceTrending: "/api/v1/marketplace/trending",
      marketplaceGames: "/api/v1/marketplace/trending",  // Games are in trending

      // Subscription endpoints
      subscriptions: "/api/v1/subscriptions.php",
      storage: "/api/v1/storage.php",

      // Payment endpoints (if using Flux payments)
      fluxpay: "/api/v1/fluxpay.php",
      cryptocom: "/api/v1/cryptocom.php",
    }
  },

  // Stripe Configuration (for payments)
  stripe: {
    publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
  },

  // Google OAuth Configuration
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  },

  // Game Categories (UUIDs from Flux Marketplace)
  gameCategories: {
    games: "53542105-d2c4-41a7-9fe5-2cf0c6a60018",
    newGames: "7ce5a03c-b808-478b-94a1-2a1b3eaaeb36",
  },

  // API Settings
  settings: {
    timeout: 10000,  // 10 seconds
    retryAttempts: 3,
    retryDelay: 1000,  // 1 second
  }
};

// Helper function to build full API URLs
export const buildApiUrl = (service, endpoint, params = {}) => {
  const config = service === 'flux' ? apiConfig.fluxApi : apiConfig.bridgeApi;
  let url = `${config.baseUrl}${endpoint}`;

  // Add query parameters if provided
  const queryString = new URLSearchParams(params).toString();
  if (queryString) {
    url += `?${queryString}`;
  }

  return url;
};

export default apiConfig;
