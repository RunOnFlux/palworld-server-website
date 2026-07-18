// Palworld Server hosting plans configuration
// Plans are fetched dynamically from Flux Marketplace API
// No static/fallback plans - all data comes from the API

// This file is kept for Palworld-specific plan transformation/mapping functions

/**
 * Palworld Player Slot Mappings
 * Based on official Palworld dedicated server requirements
 * Keys: RAM in GB, Values: Recommended max players (max 32)
 */
const PALWORLD_PLAYER_MAPPINGS = {
  5: 4,     // Starter — small co-op
  8: 8,     // Small group
  12: 16,   // Medium group
  16: 32,   // Full server (max players)
};

/**
 * Get player count based on RAM for Palworld
 * @param {number} ramGB - RAM in GB
 * @returns {number} Recommended player count
 */
function getPalworldPlayerCount(ramGB) {
  const ramTiers = Object.keys(PALWORLD_PLAYER_MAPPINGS).map(Number).sort((a, b) => a - b);
  let closest = ramTiers[0];

  for (const tier of ramTiers) {
    if (ramGB >= tier) {
      closest = tier;
    }
  }

  return PALWORLD_PLAYER_MAPPINGS[closest] || 8;
}

// Helper function to transform API plan data to Palworld server format
export const transformPlanData = (apiPlan) => {
  const compose = apiPlan.compose && apiPlan.compose[0] ? apiPlan.compose[0] : {};
  const ramValue = compose.ram || compose.rambasic || 0;
  const ramGB = ramValue / 1000;
  const estimatedPlayers = ramValue > 0 ? getPalworldPlayerCount(ramGB) : 32;
  const cpuValue = compose.cpu || compose.cpubasic || 0;
  const hddValue = compose.hdd || compose.hddbasic || 0;

  return {
    id: apiPlan.name || apiPlan.uuid,
    name: apiPlan.displayName || apiPlan.name || "Palworld Server",
    description: apiPlan.description || "Palworld dedicated server hosting on Flux decentralized cloud",
    popular: false,
    badge: null,
    price: {
      monthly: apiPlan.price || 0,
      currency: "USD",
      displayPrice: apiPlan.price ? apiPlan.price.toFixed(2) : "Free"
    },
    stripeProductId: apiPlan.stripeProductId,
    stripePriceId: apiPlan.stripePriceId,
    specs: {
      players: `Up to ${estimatedPlayers} players`,
      ram: ramValue ? `${parseFloat((ramValue / 1000).toFixed(1))} GB` : "N/A",
      storage: hddValue ? `${hddValue} GB SSD/NVMe` : "N/A",
      cpu: cpuValue ? `${parseFloat(cpuValue.toFixed(1))} ${cpuValue > 1 ? 'vCores' : 'vCore'}` : "N/A",
      bandwidth: "Unlimited"
    },
    contactRequired: apiPlan.contactRequired || false,
    gameVersion: "Latest (Auto-Update)",
    serverType: "Dedicated Server",
    worldSize: hddValue ? `${hddValue} GB` : "Unlimited",
    instances: apiPlan.instances || 1
  };
};

export const getPlanById = (plans, planId) => {
  return plans.find(plan => plan.id === planId);
};

export const getPopularPlan = (plans) => {
  return plans.find(plan => plan.popular) || plans[0];
};

export const getAffordablePlans = (plans) => {
  return plans.filter(plan => plan.price !== null && plan.price.monthly < 3000);
};
