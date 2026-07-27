import apiService from './apiService';
import { apiConfig } from '../config/apiConfig';

class MarketplaceService {
  constructor() {
    this.gameCategory = apiConfig.gameCategories.games;
    this.appsCache = null;
    this.appsCacheTime = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get all marketplace apps with visibility filtering (cached)
   */
  async getAllApps() {
    try {
      // Check cache
      const now = Date.now();
      if (this.appsCache && this.appsCacheTime && (now - this.appsCacheTime) < this.CACHE_DURATION) {
        console.log('✅ Using cached marketplace apps');
        return this.appsCache;
      }

      console.log('📥 Fetching marketplace apps from API...');
      const response = await apiService.get(
        apiConfig.bridgeApi.endpoints.marketplaceApps,
        { useBridge: true }
      );

      if (response.status === 'success') {
        let apps = response.data || [];
        // Filter to only visible and enabled apps
        apps = apps.filter(app => app.visible !== false && app.enabled !== false);

        // Cache the result
        this.appsCache = apps;
        this.appsCacheTime = now;
        console.log('✅ Marketplace apps cached:', apps.length);

        return apps;
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch marketplace apps:', error);
      return [];
    }
  }

  /**
   * Get game server apps (filtered by game category)
   */
  async getGameApps() {
    try {
      const allApps = await this.getAllApps();

      // Filter to only game category apps
      const gameApps = allApps.filter(app =>
        app.category === this.gameCategory ||
        app.category === apiConfig.gameCategories.newGames
      );

      return gameApps;
    } catch (error) {
      console.error('Failed to fetch game apps:', error);
      return [];
    }
  }

  /**
   * Get trending/featured games (used as server plans)
   */
  async getTrendingGames() {
    try {
      const response = await apiService.get(
        apiConfig.bridgeApi.endpoints.marketplaceTrending,
        { useBridge: true }
      );

      if (response.status === 'success') {
        const gameUuids = response.data.data || [];

        // Get full app data for these UUIDs
        const allApps = await this.getAllApps();
        const trendingGames = gameUuids
          .map(uuid => allApps.find(app => app.uuid === uuid))
          .filter(app => app !== undefined);

        return trendingGames;
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch trending games:', error);
      return [];
    }
  }

  /**
   * Get server hosting plans from marketplace app configurations
   * Uses the Palworld useConfig app with configs for each plan
   */
  async getServerPlans() {
    try {
      console.log('[MarketplaceService] getServerPlans called');
      const allGameApps = await this.getAllApps();
      console.log(`[MarketplaceService] Total apps fetched: ${allGameApps.length}`);

      const appName = 'PalWorld';
      console.log(`[MarketplaceService] Looking for app: "${appName}"`);

      const palworldApp = allGameApps.find(app =>
        app.name === appName &&
        app.useConfig &&
        app.configs &&
        app.configs.length > 0
      );

      if (!palworldApp) {
        console.error(`[MarketplaceService] ${appName} app not found or has no configs`);
        const matches = allGameApps.filter(a => a.name.toLowerCase().includes('palworld'));
        console.log('[MarketplaceService] Palworld apps in response:', matches.map(a => ({ name: a.name, useConfig: a.useConfig, configs: a.configs?.length })));
        return [];
      }

      console.log(`[MarketplaceService] Found "${appName}" with ${palworldApp.configs.length} configs`);

      // Palworld player tiers by RAM (MB) - sized for Palworld 1.0 (max 32 players)
      const palworldPlayerTiers = [
        [16000, 32], [12000, 16], [8000, 8], [5000, 4],
      ];

      function getPlayerCount(ramMb) {
        for (const [threshold, count] of palworldPlayerTiers) {
          if (ramMb >= threshold) return count;
        }
        return 4;
      }

      const plans = palworldApp.configs.map((config, index) => {
        const component = config.components && config.components[0] ? config.components[0] : {};

        const cpu = component.cpu || component.cpubasic || 0;
        const ram = component.ram || component.rambasic || 0;
        const hdd = component.hdd || component.hddbasic || 0;

        const players = getPlayerCount(ram);
        const planName = config.name || `Server Plan ${index + 1}`;

        return {
          id: config.id || `config-${index}`,
          name: planName,
          description: config.description || palworldApp.description || 'Palworld dedicated server hosting',
          popular: false,
          price: config.price ? {
            monthly: config.price * 100,
            currency: 'USD',
            displayPrice: `$${config.price.toFixed(2)}`
          } : null,
          playerLimit: players,
          specs: {
            players: `~${players} players`,
            ram: ram ? `${parseFloat((ram / 1000).toFixed(1))} GB` : 'N/A',
            storage: hdd ? `${hdd} GB SSD/NVMe` : 'N/A',
            cpu: cpu ? `${parseFloat(cpu.toFixed(1))} ${cpu > 1 ? 'vCores' : 'vCore'}` : 'N/A',
            bandwidth: 'Unlimited'
          },
          _config: config,
          _app: palworldApp
        };
      });

      // Sort by price
      plans.sort((a, b) => {
        if (!a.price) return 1;
        if (!b.price) return -1;
        return a.price.monthly - b.price.monthly;
      });

      // Mark middle plan as popular (FluxOS pattern)
      if (plans.length > 0) {
        const popularIndex = Math.floor(plans.length / 2);
        plans[popularIndex].popular = true;
      }

      return plans;
    } catch (error) {
      console.error('Failed to fetch server plans:', error);
      return [];
    }
  }

  /**
   * Get specific app by ID or name
   */
  async getAppById(appId) {
    try {
      const allApps = await this.getAllApps();
      const app = allApps.find(a =>
        a.name === appId ||
        a.uuid === appId ||
        a.name?.toLowerCase() === appId?.toLowerCase()
      );

      return app || null;
    } catch (error) {
      console.error('Failed to fetch app details:', error);
      return null;
    }
  }

  /**
   * Deploy/purchase a game server
   */
  async deployServer(appName, config = {}) {
    try {
      const zelidauth = await apiService.getStoredAuth();
      if (!zelidauth) {
        throw new Error('Authentication required');
      }

      const response = await apiService.post(
        `/api/v1/marketplace/deploy/${appName}`,
        config,
        { useBridge: true }
      );

      if (response.status === 'success') {
        return response.data;
      }

      throw new Error('Deployment failed');
    } catch (error) {
      console.error('Failed to deploy server:', error);
      throw error;
    }
  }

  /**
   * Get user's deployed servers
   */
  async getUserServers() {
    try {
      const zelidauth = await apiService.getStoredAuth();
      if (!zelidauth) {
        return [];
      }

      const response = await apiService.get(
        `/api/v1/marketplace/apps/${zelidauth.zelid}`,
        { useBridge: true }
      );

      if (response.status === 'success') {
        return response.data || [];
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch user servers:', error);
      return [];
    }
  }

  /**
   * Get marketplace categories
   */
  async getCategories() {
    try {
      const response = await apiService.get(
        apiConfig.bridgeApi.endpoints.marketplaceCategories,
        { useBridge: true }
      );

      if (response.status === 'success') {
        return response.data || [];
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      return [];
    }
  }
}

export default new MarketplaceService();
