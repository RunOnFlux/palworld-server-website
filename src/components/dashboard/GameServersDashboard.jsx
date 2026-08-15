import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
 
import { motion, AnimatePresence } from 'framer-motion';
import { Server, Activity, Copy, Check, Globe, Settings, Users, Package, Clock, DatabaseBackup, AlertTriangle, Sparkles, ChevronRight } from 'lucide-react';
import { MdMemory, MdSpeed, MdStorage } from 'react-icons/md';
import ServerManagementPanel from './ServerManagementPanel';
import ClientLatencyValue from './ClientLatency';
import apiService, { parseAddress } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import secureStorage from '../../utils/secureStorage';
import { recoverPendingRestores } from '../../utils/appPower';
import { diagnosePlacement } from '../../utils/nodeCapacity';
import { LATENCY_TOOLTIP } from '../../utils/clientLatency';
import { pendingStandardUpdates } from '../../config/serverMaintenance';
import { reconcilePalworldIni } from '../../utils/palworldIni';
import toast from 'react-hot-toast';

// How often a stuck server is re-diagnosed for a placement problem. Node capacity moves
// on the scale of hours, and the check costs one request per candidate node.
const PLACEMENT_RECHECK_MS = 5 * 60 * 1000;
// Read the clock outside the component: react-hooks/purity cannot prove an async helper
// defined in the body is never reached during render, and flags a bare Date.now() there.
const nowMs = () => Date.now();

// Flux blockchain fork constants (from FluxOS)
const FORK_BLOCK_HEIGHT = 2_020_000; // Block where time changed from 2min to 0.5min
const BLOCK_TIME_PRE_FORK = 2; // minutes per block before fork
const BLOCK_TIME_POST_FORK = 0.5; // minutes per block after fork
const DEFAULT_EXPIRE_PRE_FORK = 22_000; // blocks
const DEFAULT_EXPIRE_POST_FORK = 88_000; // blocks

// External game port (index 0) from the app spec — a randomized deploy exposes a
// high port (35000–65535); legacy servers fall back to the default 8211.
const gamePortOf = (server) => server?.ports?.[0] || server?.compose?.[0]?.ports?.[0] || 8211;
// The address players enter in Palworld's "Join via IP" field: domain:port.
// The domain is synced when FDM's healthy instances and the domain's A records OVERLAP.
// Both sides are sets: FDM lists every healthy instance (22 for `explorer` today) and these
// domains hand out rotating A records — 1.1.1.1 and 8.8.8.8 answer with different IPs for the
// same name. Comparing the first of each turns a working domain into a coin flip.
const domainMatchesFdm = (fdmIps, dnsData) => {
  const dns = new Set([...(dnsData?.ips || []), dnsData?.ip].filter(Boolean));
  return (fdmIps || []).some((ip) => dns.has(ip));
};

// Whether players can reach a server through its domain.
//
// Comparing the DNS record to FDM's master looks obvious but is not reliable on its own:
// sampling one server every 9s for three minutes gave 4 mismatches out of 20 (twice in a
// row) while FDM never moved and the domain kept answering the game port in ~160ms. The
// record legitimately rotates. So a mismatch is not a verdict — it is a reason to ask the
// domain directly, which is the thing we actually care about.
//
// Returns null when nothing can be concluded, and the caller then leaves the flag alone.
const checkDomainReady = async (server, gamePort) => {
  const domain = `${server.name.toLowerCase()}.app.runonflux.io`;
  try {
    const fdmData = await (await fetch(`/api/fdm/appips/${server.name}`)).json();
    if (fdmData.status !== 'success' || !fdmData.data?.ips?.length) return null;

    const dnsData = await (await fetch(`/api/dns-resolve/${domain}`)).json();
    if (dnsData.status !== 'success') return null;
    if (domainMatchesFdm(fdmData.data.ips, dnsData.data)) return true;

    // Mismatch — only now spend a probe, and let the answer decide.
    const probe = await fetch(`/api/palworld-status/${domain}?port=${gamePort}`);
    if (!probe.ok) return null;
    const data = await probe.json();
    return data.online === true ? true : false;
  } catch {
    return null;
  }
};

// Deploys randomize the external ports, and a queued deployment has no on-chain spec yet — so
// its port is genuinely unknown. Showing the 8211 fallback there hands the player an address
// that is wrong for almost every server.
const gamePortKnown = (server) => Boolean(server?.ports?.[0] || server?.compose?.[0]?.ports?.[0]);

const gameAddressOf = (server) => `${server.name.toLowerCase()}.app.runonflux.io:${gamePortOf(server)}`;

/**
 * "Server update available", for a server that predates settings we now ship by default.
 *
 * Until this existed the only sign was a dot on the Deployment Settings tab — inside the
 * manage panel, on a tab a customer has no reason to open, so servers stayed on defaults
 * we had already stopped selling. Both surfaces below open that tab directly: an
 * indicator nobody can act on from where they are is just decoration.
 *
 * Blue, like the panel it leads to, but filled rather than tinted — it is the only badge
 * in the row that asks the customer to decide something, and it has to win against the
 * status pills sitting beside it.
 */
const UpdateAvailableBadge = ({ server, onOpen }) => {
  const count = pendingStandardUpdates(server);
  if (!count) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(server, 'environment'); }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 border border-blue-400/50 rounded-md w-fit hover:bg-blue-500/30 transition-colors"
      title={`${count} recommended ${count === 1 ? 'setting' : 'settings'} — click to review and apply`}
    >
      <span className="relative flex w-1.5 h-1.5 flex-shrink-0">
        <span className="absolute inset-0 rounded-full bg-blue-300 animate-ping opacity-75" />
        <span className="relative w-1.5 h-1.5 rounded-full bg-blue-300" />
      </span>
      <Sparkles className="w-3 h-3 text-blue-200 flex-shrink-0" />
      <span className="text-xs font-semibold text-blue-100 whitespace-nowrap">Server update available</span>
      <ChevronRight className="w-3 h-3 text-blue-300/70 flex-shrink-0" />
    </button>
  );
};

/** The same offer on the mobile card, as a full-width tap target like its sibling banners. */
const UpdateAvailableBanner = ({ server, onOpen }) => {
  const count = pendingStandardUpdates(server);
  if (!count) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(server, 'environment'); }}
      className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border-y border-blue-400/40 text-left hover:from-blue-500/30 hover:to-indigo-500/30 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-blue-200">Server update available</p>
          <p className="text-[11px] text-blue-200/70 mt-0.5">
            {count} recommended {count === 1 ? 'setting' : 'settings'} — tap to review and apply.
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-blue-300/70 flex-shrink-0" />
      </div>
    </button>
  );
};

/**
 * GameServersDashboard Component
 * Shows deployed game servers with status monitoring
 * Fetches apps from Flux network based on user's zelid
 */
const GameServersDashboard = ({ refreshTrigger = 0 }) => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedServerName, setSelectedServerName] = useState(null);
  const [showManagement, setShowManagement] = useState(false);
  // Tab the panel should land on when opened from a card action ("Add locations").
  const [managementTab, setManagementTab] = useState(null);
  const [currentBlockHeight, setCurrentBlockHeight] = useState(null);
  const [copiedServerId, setCopiedServerId] = useState(null);
  const [pendingRenewals, setPendingRenewals] = useState([]); // Track pending renewals (array)
  // name → last placement diagnosis timestamp (see checkPlacement).
  const placementCheckedRef = useRef(new Map());
  const serversRef = useRef(servers);
  const initialLoadRef = useRef(true); // Track if this is the first load
  const currentBlockHeightRef = useRef(null);
  const isMountedRef = useRef(true);
  const copyTimeoutRef = useRef(null);
  const isCheckingRef = useRef(false); // Prevent overlapping status checks
  const isDomainCheckingRef = useRef(false); // Prevent overlapping domain checks
  const showManagementRef = useRef(false);
  const selectedServerNameRef = useRef(null);
  const userRef = useRef(user);

  // Calculate stats (memoized to avoid recalculation on every render) - MUST be before any conditional returns
  const runningServers = useMemo(() =>
    servers.filter(s => s.status === 'running').length,
    [servers]
  );

  // Keep refs in sync — update inline (not in effect) to avoid race conditions
  serversRef.current = servers;
  currentBlockHeightRef.current = currentBlockHeight;
  userRef.current = user;
  showManagementRef.current = showManagement;
  selectedServerNameRef.current = selectedServerName;

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Derive selectedServer from name — avoids sync effect and extra re-renders
  const selectedServer = useMemo(
    () => servers.find(s => s.name === selectedServerName) || null,
    [servers, selectedServerName]
  );

  // Load servers and block height on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Fetch block height first, then load servers with that height
        const blockHeight = await fetchBlockHeight();
        await loadServers(blockHeight);
      } catch (error) {
        console.error('Failed to initialize dashboard:', error);
        // loadServers already handles showing local servers on error
      }
    };
    init();

    // Refresh block height every 5 minutes
    const blockHeightInterval = setInterval(async () => {
      try {
        const blockHeight = await fetchBlockHeight();
        await loadServers(blockHeight);
      } catch (error) {
        console.error('Failed to refresh dashboard:', error);
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(blockHeightInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Finish any restart this browser still owes a server.
  //
  // FluxOS treats an API stop as a durable operator lock and will NOT restart the
  // container itself — only a start clears it. So if a node dies (or FluxOS restarts)
  // inside the stopped window of a config write, the app stays `exited` forever. Every
  // dashboard load re-checks the debt and starts whatever is still down.
  useEffect(() => {
    const heal = async () => {
      try {
        const zelidauth = await secureStorage.getItem('zelidauth');
        if (!zelidauth) return;
        const recovered = await recoverPendingRestores(JSON.stringify(zelidauth));
        if (recovered.length && isMountedRef.current) {
          toast.success(`Restarted ${recovered.length === 1 ? 'a server' : `${recovered.length} servers`} that had been left stopped.`);
          handleUpdate();
        }
      } catch { /* best effort — retried on the next dashboard load */ }
    };
    heal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle refresh from payment success page
  useEffect(() => {
    let cancelled = false;
    const shouldRefresh = searchParams.get('refresh');
    if (shouldRefresh === 'true') {
      console.log('🔄 Refreshing dashboard after payment...');
      // Remove the parameter from URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('refresh');
      setSearchParams(newParams, { replace: true });
      // Trigger a full reload - clear servers first to force fresh data
      const refresh = async () => {
        initialLoadRef.current = true; // Mark as initial load to show loading screen
        setServers([]); // Clear servers to force fresh load
        const blockHeight = await fetchBlockHeight();
        if (cancelled) return;
        await loadServers(blockHeight);
      };
      refresh().catch(error => {
        if (!cancelled) console.error('Failed to refresh after payment:', error);
      });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Handle refresh trigger from parent (deployment dialog)
  useEffect(() => {
    let cancelled = false;
    if (refreshTrigger > 0) {
      console.log('🔄 Refreshing dashboard from deployment dialog...');
      const refresh = async () => {
        const blockHeight = await fetchBlockHeight();
        if (cancelled) return;
        await loadServers(blockHeight);
      };
      refresh().catch(error => {
        if (!cancelled) console.error('Failed to refresh from deployment:', error);
      });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  const loadServers = async (blockHeight = null) => {
    try {
      // Only show loading spinner on initial load, not on refreshes
      if (initialLoadRef.current) {
        setLoading(true);
      }

      const zelid = userRef.current?.zelid;

      console.log('📡 Fetching apps from Flux network for zelid:', zelid);
      console.log('📊 Using block height:', blockHeight);

      // Load from localStorage (pending/installing apps)
      const rawLocalServers = JSON.parse(localStorage.getItem('deployedServers') || '[]');

      // Clean up: Remove pending entries older than 1 hour
      const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
      const now = Date.now();
      let hasChanges = false;

      const localServers = rawLocalServers.filter(server => {
        // Add timestamp to old entries without one
        if (!server.pendingTimestamp) {
          server.pendingTimestamp = now;
          hasChanges = true;
          return true;
        }

        const age = now - server.pendingTimestamp;
        const isExpired = age > ONE_HOUR;

        if (isExpired) {
          console.log(`🗑️ Removing expired pending server: ${server.name} (${Math.floor(age / 60000)} minutes old)`);
          hasChanges = true;
          return false;
        }

        return true;
      });

      // Update localStorage if anything changed (added timestamps or removed expired)
      if (hasChanges) {
        localStorage.setItem('deployedServers', JSON.stringify(localServers));
      }

      console.log('📦 Loaded from localStorage:', localServers.length, 'servers',
                  rawLocalServers.length !== localServers.length ? `(removed ${rawLocalServers.length - localServers.length} expired)` : '');

      // Check for pending renewals and clean up if expired
      const rawPendingRenewals = JSON.parse(localStorage.getItem('pendingRenewals') || '[]');
      const activePendingRenewals = rawPendingRenewals.filter(renewal => {
        if (!renewal.pendingTimestamp) {
          renewal.pendingTimestamp = now;
          return true;
        }
        const renewalAge = now - renewal.pendingTimestamp;
        if (renewalAge > ONE_HOUR) {
          console.log(`🗑️ Removing expired pending renewal: ${renewal.appName} (${Math.floor(renewalAge / 60000)} minutes old)`);
          return false;
        }
        return true;
      });

      // Save cleaned up array back to localStorage if changed
      if (activePendingRenewals.length !== rawPendingRenewals.length) {
        localStorage.setItem('pendingRenewals', JSON.stringify(activePendingRenewals));
      }
      setPendingRenewals(activePendingRenewals); // Update state
      if (activePendingRenewals.length > 0) {
        console.log('🔄 Active pending renewals:', activePendingRenewals.map(r => `${r.appName}:${r.paymentHash?.slice(0, 8)}`));
      }

      // Fetch apps from Flux API (running apps)
      try {
        const fluxApps = await apiService.getUserApps(zelid);
        console.log('✅ Received from Flux API:', fluxApps.length, 'apps');

        // Filter to only Palworld apps
        const palworldApps = fluxApps.filter(app =>
          app.name?.toLowerCase().includes('palworld') ||
          app.description?.toLowerCase().includes('palworld') ||
          app.repotag?.toLowerCase().includes('palworld') ||
          app.compose?.some(comp =>
            comp.name?.toLowerCase().includes('palworld') ||
            comp.repotag?.toLowerCase().includes('palworld')
          )
        );
        console.log('🎮 Filtered to Palworld apps:', palworldApps.length);

        // Transform Flux apps to dashboard format (pass block height directly)
        const transformedFluxServers = palworldApps.map(app => transformFluxAppToServer(app, blockHeight));

        // Check for renewal completions (hash matches new payment)
        if (activePendingRenewals.length > 0) {
          const completedRenewals = [];
          activePendingRenewals.forEach(renewal => {
            if (renewal.paymentHash) {
              const renewingServer = transformedFluxServers.find(s => s.name === renewal.appName);
              console.log(`🔍 Renewal check: ${renewal.appName} — stored:${renewal.paymentHash?.slice(0, 8)} vs chain:${renewingServer?.paymentHash?.slice(0, 8)} match:${renewingServer?.paymentHash === renewal.paymentHash}`);
              if (renewingServer && renewingServer.paymentHash === renewal.paymentHash) {
                console.log(`✅ Renewal confirmed for ${renewal.appName}`);
                completedRenewals.push(renewal);
              }
            }
          });

          // Remove completed renewals from array
          if (completedRenewals.length > 0) {
            const remaining = activePendingRenewals.filter(r =>
              !completedRenewals.some(c => c.appName === r.appName && c.paymentHash === r.paymentHash)
            );
            localStorage.setItem('pendingRenewals', JSON.stringify(remaining));
            setPendingRenewals(remaining); // Update state
          }
        }

        // Merge: localStorage apps + Flux apps (avoid duplicates)
        const fluxAppNames = new Set(transformedFluxServers.map(s => s.name));
        const localServerNames = new Set(localServers.map(s => s.name));
        const pendingServers = localServers.filter(s => !fluxAppNames.has(s.name));

        // Mark Flux apps still in localStorage as 'installing' (just deployed, not fully ready).
        // 'configuring' is the later half of the same wait and is written by the status loop,
        // not derived from the spec, so it must survive this refresh — otherwise the row flips
        // back to "Installing on network" every three minutes while the config is being applied.
        const localStatus = new Map(localServers.map(s => [s.name, s.status]));
        transformedFluxServers.forEach(s => {
          if (localServerNames.has(s.name)) {
            s.status = localStatus.get(s.name) === 'configuring' ? 'configuring' : 'installing';
          }
        });

        const mergedServers = [...pendingServers, ...transformedFluxServers];

        // Merge new data with existing servers to avoid flickering
        setServers(prevServers => {
          // If first load (no previous servers), return new data
          if (prevServers.length === 0) {
            return mergedServers;
          }

          // Smart merge: preserve existing server state (domainReady, palworldOnline, etc.)
          const prevMap = new Map(prevServers.map(s => [s.name, s]));

          // Build merged list: update existing, add new, remove gone
          const result = mergedServers.map(newServer => {
            const oldServer = prevMap.get(newServer.name);
            if (!oldServer) return newServer; // New server — use as-is

            // Merge: keep old values, update with new defined values
            const merged = { ...oldServer };
            Object.keys(newServer).forEach(key => {
              if (newServer[key] !== undefined) {
                merged[key] = newServer[key];
              }
            });

            const hasChanges = Object.keys(merged).some(key => merged[key] !== oldServer[key]);
            return hasChanges ? merged : oldServer;
          });

          return result;
        });

        console.log('✅ Total servers:', mergedServers.length, '(Pending:', pendingServers.length, 'Running:', transformedFluxServers.length, ')');
      } catch (apiError) {
        console.error('❌ API Error:', apiError);
        // If API fails, merge localStorage servers without resetting
        setServers(prevServers => {
          if (prevServers.length === 0) return localServers;

          // Merge to preserve object references
          return prevServers.map(oldServer => {
            const newServer = localServers.find(s => s.name === oldServer.name);
            return newServer ? { ...oldServer, ...newServer } : oldServer;
          });
        });
        toast.error('Could not fetch apps from Flux network. Showing local servers only.');
      }
    } catch (error) {
      console.error('❌ Failed to load servers:', error);
      toast.error('Failed to load servers');
      // Don't clear servers on error - keep showing existing data
    } finally {
      setLoading(false);
      initialLoadRef.current = false; // Mark initial load as complete
    }
  };

  const fetchBlockHeight = async () => {
    try {
      console.log('🔍 Fetching block height from /daemon/getinfo...');
      // Fetch current block height from Flux daemon info
      const response = await apiService.get('/daemon/getinfo');
      console.log('📊 Block height API response:', response);

      if (response.status === 'success' && response.data?.blocks) {
        const blockHeight = response.data.blocks;
        setCurrentBlockHeight(blockHeight);
        console.log('✅ Current block height:', blockHeight);
        return blockHeight;
      } else {
        console.warn('⚠️ Block height not found in response, using fallback');
        const fallbackHeight = FORK_BLOCK_HEIGHT + 1000000;
        setCurrentBlockHeight(fallbackHeight);
        console.log('🔄 Fallback block height:', fallbackHeight);
        return fallbackHeight;
      }
    } catch (error) {
      console.error('❌ Failed to fetch block height:', error);
      // Fallback: Use a reasonable estimate if API fails
      // As of Feb 2026, we're well past fork, so use a high number
      const fallbackHeight = FORK_BLOCK_HEIGHT + 1000000;
      setCurrentBlockHeight(fallbackHeight);
      console.log('🔄 Using fallback block height:', fallbackHeight);
      return fallbackHeight;
    }
  };

  // Transform Flux app data to dashboard server format
  const transformFluxAppToServer = (fluxApp, blockHeight = null) => {
    // Get the first component for basic info
    const firstComponent = fluxApp.compose?.[0] || fluxApp;

    // Debug: Log app data to see what fields are available
    console.log('📦 App data for', fluxApp.name, {
      height: fluxApp.height,
      expire: fluxApp.expire,
      blockHeight: blockHeight,
      fullApp: fluxApp
    });

    // Calculate expiration from block heights (FluxOS style)
    let expiresAt = null;
    let blocksRemaining = 0; // Initialize for return
    if (fluxApp.height && blockHeight) {
      try {
        // Registration block height
        const registrationHeight = fluxApp.height;
        // Expiration period in blocks (use default if not specified)
        // Old app specs (< v6) don't have expire field - use correct default based on registration era
        const defaultExpire = registrationHeight < FORK_BLOCK_HEIGHT ? DEFAULT_EXPIRE_PRE_FORK : DEFAULT_EXPIRE_POST_FORK;
        const expireBlocks = fluxApp.expire || defaultExpire;
        // Target expiry block
        const expiryBlockHeight = registrationHeight + expireBlocks;

        // Calculate adjusted expiry considering fork
        // If app was registered before fork but expires after fork
        let adjustedExpiryBlockHeight = expiryBlockHeight;
        if (registrationHeight < FORK_BLOCK_HEIGHT && expiryBlockHeight > FORK_BLOCK_HEIGHT) {
          // App registered pre-fork, expires post-fork
          // Adjust expiry to account for faster block times after fork
          const blocksBeforeFork = FORK_BLOCK_HEIGHT - registrationHeight;
          const blocksAfterFork = expiryBlockHeight - FORK_BLOCK_HEIGHT;
          const timeBeforeFork = blocksBeforeFork * BLOCK_TIME_PRE_FORK;
          const timeAfterFork = blocksAfterFork * BLOCK_TIME_POST_FORK;
          const totalTime = timeBeforeFork + timeAfterFork;

          // Convert back to post-fork blocks
          adjustedExpiryBlockHeight = registrationHeight + Math.floor(totalTime / BLOCK_TIME_POST_FORK);
        }

        // Calculate remaining blocks
        blocksRemaining = adjustedExpiryBlockHeight - blockHeight;

        // Convert blocks to time (minutes)
        let timeRemainingMinutes;
        if (blockHeight >= FORK_BLOCK_HEIGHT) {
          // We're post-fork, use post-fork block time
          timeRemainingMinutes = blocksRemaining * BLOCK_TIME_POST_FORK;
        } else {
          // We're pre-fork (shouldn't happen in 2026, but handle it)
          timeRemainingMinutes = blocksRemaining * BLOCK_TIME_PRE_FORK;
        }

        // Convert minutes to timestamp
        const expirationDate = new Date(Date.now() + timeRemainingMinutes * 60 * 1000);
        expiresAt = expirationDate.toISOString();

        console.log('📅 Expiration calc for', fluxApp.name, {
          registrationHeight,
          expireBlocks,
          expiryBlockHeight,
          adjustedExpiryBlockHeight,
          blockHeight,
          blocksRemaining,
          timeRemainingMinutes,
          expiresAt
        });
      } catch (error) {
        console.error('Failed to calculate expiration for', fluxApp.name, error);
      }
    }

    // Calculate creation time from registration height
    let createdAt = new Date().toISOString();
    if (fluxApp.height && blockHeight) {
      try {
        const registrationHeight = fluxApp.height;
        const blocksSinceRegistration = blockHeight - registrationHeight;

        // Calculate time since registration considering fork
        let timeSinceRegistrationMinutes;
        if (registrationHeight >= FORK_BLOCK_HEIGHT) {
          // Registered post-fork
          timeSinceRegistrationMinutes = blocksSinceRegistration * BLOCK_TIME_POST_FORK;
        } else if (blockHeight >= FORK_BLOCK_HEIGHT) {
          // Registered pre-fork, we're now post-fork
          const blocksBeforeFork = FORK_BLOCK_HEIGHT - registrationHeight;
          const blocksAfterFork = blockHeight - FORK_BLOCK_HEIGHT;
          timeSinceRegistrationMinutes =
            (blocksBeforeFork * BLOCK_TIME_PRE_FORK) +
            (blocksAfterFork * BLOCK_TIME_POST_FORK);
        } else {
          // Both pre-fork (shouldn't happen in 2026)
          timeSinceRegistrationMinutes = blocksSinceRegistration * BLOCK_TIME_PRE_FORK;
        }

        const registrationDate = new Date(Date.now() - timeSinceRegistrationMinutes * 60 * 1000);
        createdAt = registrationDate.toISOString();
      } catch (error) {
        console.error('Failed to calculate creation time for', fluxApp.name, error);
      }
    }

    // Check if server was recently cancelled (persisted in localStorage)
    let isCancelled = false;
    try {
      const cancelled = JSON.parse(localStorage.getItem('cancelledServers') || '{}');
      const entry = cancelled[fluxApp.name];
      if (entry && (Date.now() - entry.timestamp < 2 * 60 * 60 * 1000)) {
        isCancelled = true;
        // Override expiry to ~50 min from cancel time
        expiresAt = new Date(entry.timestamp + 50 * 60 * 1000).toISOString();
        blocksRemaining = 100;
      } else if (entry) {
        // Expired entry — clean up
        delete cancelled[fluxApp.name];
        localStorage.setItem('cancelledServers', JSON.stringify(cancelled));
      }
    } catch { /* ignore */ }

    return {
      name: fluxApp.name,
      // Hardware specs
      cpu: fluxApp.cpu || firstComponent.cpu || 1,
      ram: fluxApp.ram || firstComponent.ram || 2000,
      hdd: fluxApp.hdd || firstComponent.hdd || 10,
      status: isCancelled ? 'cancelling' : 'running',
      instances: fluxApp.instances || 3,
      createdAt,
      expiresAt,
      blocksRemaining,
      paymentHash: fluxApp.hash,
      owner: fluxApp.owner,
      registrationHeight: fluxApp.height,
      expireBlocks: fluxApp.expire,
      // Terminal needs these for container name construction
      version: fluxApp.version || 3, // App version (v3, v4+)
      // Empty for everything we sell; carried so the update badge can tell an
      // undecryptable spec apart from a server that genuinely has no env set.
      enterprise: fluxApp.enterprise || '',
      compose: fluxApp.compose || [{ name: 'null', repotag: fluxApp.repotag || '', ports: fluxApp.ports || [], containerPorts: fluxApp.containerPorts || [] }], // v3: component must be "null" string for FluxOS volume lookup
      repotag: fluxApp.repotag || firstComponent.repotag || '', // Docker image
      ports: fluxApp.ports || firstComponent.ports || [], // External ports
      containerPorts: fluxApp.containerPorts || firstComponent.containerPorts || [], // Internal ports
      // Preserve any existing Palworld data - leave undefined so merge keeps old values
      palworldOnline: undefined,
    };
  };

  // A deploy moves through several states in a couple of minutes (placed → config written →
  // game answering), and the customer is watching every one of them right after paying.
  // Three minutes between ticks is fine for a settled server and far too slow for that.
  const deploying = servers.some((s) => s.status === 'installing' || s.status === 'configuring');

  // Status monitoring - initial check + poll every 3 minutes (30s while deploying)
  useEffect(() => {
    if (servers.length === 0) return;

    // Initial check immediately
    if (!isCheckingRef.current) {
      isCheckingRef.current = true;
      checkServersStatus().catch(error => {
        console.error('Failed to check server status:', error);
      }).finally(() => {
        isCheckingRef.current = false;
      });
    }

    const intervalId = setInterval(async () => {
      if (isCheckingRef.current || showManagementRef.current) return;
      isCheckingRef.current = true;
      try {
        await checkServersStatus();
        loadServers(currentBlockHeightRef.current).catch(error => {
          console.error('Failed to refresh server list:', error);
        });
      } catch (error) {
        console.error('Failed to check server status:', error);
      } finally {
        isCheckingRef.current = false;
      }
    }, deploying ? 30000 : 180000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servers.length, deploying]);

  // Fast domain-check interval (30s) — only for running servers where domain isn't ready yet
  useEffect(() => {
    const domainIntervalId = setInterval(async () => {
      if (isDomainCheckingRef.current || showManagementRef.current) return;
      // Every running server, not only those not yet marked ready: `domainReady` was a
      // one-way latch, so a domain that broke AFTER it went green was never re-checked.
      const pending = serversRef.current.filter(s => s.status === 'running');
      if (pending.length === 0) return;
      isDomainCheckingRef.current = true;
      try {
        await Promise.all(pending.map(async (server) => {
          try {
            const domainReady = await checkDomainReady(server, gamePortOf(server));
            if (domainReady === null) return; // inconclusive — keep whatever we had
            if (!isMountedRef.current) return;
            if (server.domainReady !== domainReady) {
              setServers(prev => prev.map(s => s.name === server.name ? { ...s, domainReady } : s));
            }
          } catch { /* ignore */ }
        }));
      } finally {
        isDomainCheckingRef.current = false;
      }
    }, 30000);

    return () => clearInterval(domainIntervalId);
  }, []);

  const checkServersStatus = async () => {
    // Process all servers in parallel for faster loading
    await Promise.all(
      serversRef.current.map(async (server) => {
        try {
          // Phase 1: Check payment confirmation for pending servers
          if (server.status === 'payment_pending') {
            await checkPaymentConfirmation(server);
            return;
          }

          // Phase 2: Check installation status for servers still being deployed.
          // 'configuring' is the same phase seen from the customer's side — the app is
          // placed and we are finishing its config — so it follows the same path.
          if (server.status === 'installing' || server.status === 'configuring') {
            await checkInstallationStatus(server);
            return;
          }

          // Phase 3 & 4: For running servers, check domain access then Palworld status
          if (server.status === 'running') {
            let locations = server.locations;
            if (!locations) {
              locations = await fetchAppLocations(server);
            }

            // A server can be reachable and still be running on fewer nodes than it was
            // paid for — the redundancy is silently missing, with the same cause and the
            // same fix as one that never got placed at all. Only diagnosed once we have
            // seen at least one real location: an empty list here is more likely a failed
            // lookup than a server that lost every node, and guessing would cry wolf.
            const placed = Array.isArray(locations) ? locations.length : 0;
            if (placed > 0 && placed < (server.instances || 1)) {
              await checkPlacement(server, placed);
            } else if (server.placementIssue) {
              updateServerInList(server.name, { placementIssue: null });
            }

            // Check FDM for master IP, then verify domain DNS matches
            let domainReady = server.domainReady;
            let fdmMasterIp = null;
            try {
              const fdmResponse = await fetch(`/api/fdm/appips/${server.name}`);
              const fdmData = await fdmResponse.json();
              if (fdmData.status === 'success' && fdmData.data?.ips?.length > 0) {
                fdmMasterIp = fdmData.data.ips[0];
              }
              // One method for the flag, shared with the 30s loop — two writers using
              // different rules is how it ended up alternating in the first place.
              const settled = await checkDomainReady(server, gamePortOf(server));
              if (settled !== null) domainReady = settled;
              if (settled !== null && server.domainReady !== domainReady) {
                updateServerInList(server.name, { domainReady });
              }
            } catch {
              // FDM check failed — don't update domainReady
            }

            // Check Palworld status — pass master IP so status check can use it directly
            await checkPalworldStatus({ ...server, locations: locations || server.locations, domainReady, fdmMasterIp });
          }
        } catch (error) {
          console.error(`Failed to check status for ${server.name}:`, error);
        }
      })
    );
  };

  const checkPaymentConfirmation = async (server) => {
    try {
      const spec = await apiService.getAppSpecs(server.name);

      if (spec?.name) {
        console.log(`✅ Payment confirmed for ${server.name}`);
        updateServerInList(server.name, { status: 'installing' });
        updateLocalStorage(server.name, { status: 'installing' });
        // Status change reflected in UI — no toast needed
      }
    } catch (error) {
      console.error(`Failed to check payment for ${server.name}:`, error);
    }
  };

  /**
   * An app that never gets placed sits on "Installing on network" forever, with nothing
   * saying why. The usual cause is a geolocation narrow enough that its handful of nodes
   * are full — a configuration problem the customer can fix themselves, but only if we
   * tell them. Throttled per server: the answer changes on the scale of hours.
   *
   * The same cause also produces a quieter failure: a server that DID come up, but on
   * fewer nodes than it was paid for. Pass the real placed count as `running` so the
   * diagnosis can tell the two apart (0 = never placed, 1-of-3 = short on redundancy).
   */
  const checkPlacement = async (server, running = 0) => {
    const last = placementCheckedRef.current.get(server.name) || 0;
    if (nowMs() - last < PLACEMENT_RECHECK_MS) return;
    placementCheckedRef.current.set(server.name, nowMs());
    try {
      const spec = await apiService.getAppSpecs(server.name);
      if (!spec?.name) return;
      const issue = await diagnosePlacement({
        geolocation: spec.geolocation,
        compose: spec.compose,
        instances: spec.instances || 1,
        isEnterprise: !!spec.enterprise,
        running,
      });
      // 'waiting' means there IS room and it is simply not placed yet — that is what
      // "Installing on network" already says, so it stays as is.
      updateServerInList(server.name, {
        placementIssue: issue && issue.severity !== 'waiting' ? issue : null,
      });
    } catch { /* diagnosis is advisory — never disturb the status loop */ }
  };

  /**
   * The last step of a deploy: make the server's persisted PalWorldSettings.ini agree with
   * the app that was actually registered — the randomized external port it advertises to
   * the in-game community browser, the admin API, and an admin password.
   *
   * This is why it happens here rather than only in the manage panel. The ini a server boots
   * with is the game's own default, which advertises port 8211 and has no admin API; the
   * panel's fallback fixes that whenever the customer next opens it, which in practice is
   * mid-session, and it costs them a restart with players connected. Done during the deploy
   * it costs one extra boot that nobody is there to notice, and the server is never
   * advertised at an address that does not work.
   *
   * Only ever against the FDM master: Syncthing replicates the write from there, and a write
   * landing on a slave is reverted. No master yet (FDM needs a moment to pick one up) means
   * "not now", not "give up" — the next tick tries again. Everything else, including the
   * attempt cap that stops a stubborn server being restarted forever, lives in the util,
   * which is also what keeps this and the panel from ever stopping the same server at once.
   */
  const configureNewServer = async (server) => {
    let masterIp = null;
    try {
      const res = await fetch(`/api/fdm/appips/${server.name}`);
      const data = await res.json();
      if (data.status === 'success' && data.data?.ips?.length > 0) masterIp = data.data.ips[0];
    } catch { /* FDM not answering for this app yet */ }
    if (!masterIp) return;

    try {
      await reconcilePalworldIni(server, masterIp, {
        // The customer is only told once a write is actually needed — reading the file is
        // silent, and most of these passes find nothing to do.
        onPhase: (phase) => {
          if (phase === 'patching') {
            updateServerInList(server.name, { status: 'configuring' });
            updateLocalStorage(server.name, { status: 'configuring' });
          }
        },
        // The file only exists once the container's first boot has generated it, and that
        // boot re-verifies 5 GB of game files first. Two looks per tick is enough: the tick
        // itself repeats every 30 seconds while a server is deploying.
        iniReadAttempts: 2,
      });
    } catch { /* transient — the next tick retries, and the panel is the final fallback */ }
  };

  const checkInstallationStatus = async (server) => {
    try {
      // Check 1: Flux API - Is the app installed and running on Flux nodes?
      const locations = await apiService.getAppLocations(server.name);

      if (!Array.isArray(locations) || locations.length === 0) {
        await checkPlacement(server, 0);
      } else if (server.placementIssue) {
        updateServerInList(server.name, { placementIssue: null });
      }

      if (Array.isArray(locations) && locations.length > 0) {
        console.log(`✅ ${server.name} is installed on Flux nodes:`, locations.length);

        // Check 2: the config the deploy needs, applied before the server is called ready.
        await configureNewServer({ ...server, locations });

        // Check 3: Domain check - Is the Palworld server actually responding?
        const palworldReady = await checkPalworldServerReady(server);

        if (palworldReady) {
          console.log(`✅ ${server.name} is fully running and accessible!`);
          updateServerInList(server.name, {
            status: 'running',
            locations: locations
          });
          // Remove from localStorage as it's now in Flux API
          removeFromLocalStorage(server.name);
          // Status change reflected in UI — no toast needed

          // Fetch full Palworld status immediately
          await checkPalworldStatus({ ...server, status: 'running', locations: locations });
        } else {
          console.log(`⏳ ${server.name} is installed but Palworld server not ready yet...`);
        }
      }
    } catch (error) {
      console.error(`Failed to check installation for ${server.name}:`, error);
    }
  };

  // Quick check if Palworld server is responding (used during installation)
  // Palworld uses UDP (Steam A2S) — must query node IP directly, not domain proxy
  const checkPalworldServerReady = async (server) => {
    try {
      // Need node locations to get IP for UDP query
      const locations = server.locations || await apiService.getAppLocations(server.name);
      if (!Array.isArray(locations) || locations.length === 0) return false;

      // Get master node IP via FDM
      let queryHost;
      try {
        const fdmRes = await fetch(`/api/fdm/appips/${server.name}`);
        const fdmData = await fdmRes.json();
        if (fdmData.status === 'success' && fdmData.data?.ips?.length > 0) {
          queryHost = fdmData.data.ips[0];
        }
      } catch { /* fall through */ }
      if (!queryHost) queryHost = parseAddress(locations[0].ip).host;

      // Get external game port from app spec (first port is the UDP game port)
      const gamePort = server.ports?.[0] || server.compose?.[0]?.ports?.[0] || 8211;

      const response = await fetch(`/api/palworld-status/${queryHost}?port=${gamePort}`);
      if (!response.ok) return false;

      const data = await response.json();
      return data.online === true;
    } catch {
      return false;
    }
  };

  const fetchAppLocations = async (server) => {
    try {
      const locations = await apiService.getAppLocations(server.name);

      if (Array.isArray(locations) && locations.length > 0) {
        updateServerInList(server.name, {
          locations: locations
        });
        return locations;
      }
    } catch (error) {
      console.error(`Failed to fetch locations for ${server.name}:`, error);
    }
    return null;
  };

  const checkPalworldStatus = async (server) => {
    try {
      // Palworld uses UDP (Steam A2S) — must query node IP directly, not domain proxy
      let queryHost;
      if (server.fdmMasterIp) {
        queryHost = server.fdmMasterIp;
      } else if (server.locations?.length > 0) {
        queryHost = parseAddress(server.locations[0].ip).host;
      } else {
        console.warn(`⚠️ No node IP for ${server.name}, skipping status check`);
        return;
      }

      // Get external game port from app spec (first port is the UDP game port)
      const gamePort = server.ports?.[0] || server.compose?.[0]?.ports?.[0] || 8211;
      console.log(`🔍 Palworld query: ${queryHost}:${gamePort}`);

      const response = await fetch(`/api/palworld-status/${queryHost}?port=${gamePort}`);

      if (!response.ok) {
        console.warn(`⚠️ Failed to fetch Palworld status for ${server.name} - HTTP ${response.status}`);
        updateServerInList(server.name, {
          palworldOnline: false, palworldError: `HTTP ${response.status}`,
          palworldLastCheck: new Date().toISOString(),
        });
        return;
      }

      const data = await response.json();
      console.log(`📊 Palworld API response for ${server.name}:`, data);

      // If domain returned offline but FDM confirms master exists → could be domain lag
      // Skip if container is paused or restarting — server is genuinely down
      console.log(`🔍 [DomainCheck] ${server.name}: online=${data.online}, domainReady=${server.domainReady}, fdmMasterIp=${server.fdmMasterIp}`);
      if (!data.online && server.fdmMasterIp) {
        let skip = false;
        try {
          const masterLoc = server.locations?.find(loc => parseAddress(loc.ip).host === server.fdmMasterIp);
          if (masterLoc) {
            const { host: mHost, port: mPort } = parseAddress(masterLoc.ip);
            const stateRes = await fetch(`https://${mHost.replace(/\./g, '-')}-${mPort || 16127}.node.api.runonflux.io/apps/listrunningapps`);
            const stateData = await stateRes.json();
            if (stateData.status === 'success' && stateData.data) {
              const container = stateData.data.find(c => c.Names?.[0]?.includes(server.name));
              if (container?.State === 'paused' || container?.State === 'restarting') skip = true;
              // Recently restarted container — Palworld needs time to boot
              // Docker Status: "Up X seconds", "Up About a minute", "Up Less than a second"
              if (container?.Status && /^Up (\d+ seconds?|About a minute|Less than a second)$/.test(container.Status)) skip = true;
            }
          }
        } catch { /* fall through */ }
        if (!skip) {
          // Deliberately NOT touching domainReady here. One unanswered UDP probe means the
          // game did not reply to THIS packet — it says nothing about whether the domain
          // points at the right node. Writing `false` from here made the badge flap: the
          // domain check set it true, a single dropped datagram set it false again, and the
          // card alternated between "Running" and "Waiting for domain access" on every cycle.
          updateServerInList(server.name, {
            palworldOnline: null,
            palworldLastCheck: new Date().toISOString(),
            palworldError: null,
          });
          return;
        }
      }

      // Always set all fields — clear stale data when server is offline. Liveness only: the
      // probe's own timing is a backend-to-node measurement and says nothing about what a
      // player experiences, so latency is measured in the browser instead (see ClientLatency).
      const palworldData = {
        palworldLastCheck: new Date().toISOString(),
        palworldOnline: data.online ?? false,
        palworldError: data.error || null,
      };

      console.log(`✅ Updating ${server.name} with:`, palworldData);
      updateServerInList(server.name, palworldData);
    } catch (error) {
      console.error(`❌ Failed to check Palworld status for ${server.name}:`, error);
      updateServerInList(server.name, {
        palworldOnline: false, palworldError: 'Connection failed',
        palworldLastCheck: new Date().toISOString(),
      });
    }
  };

  const updateServerInList = (serverName, updates) => {
    setServers(prevServers =>
      prevServers.map(s => {
        if (s.name !== serverName) return s;

        // Smart merge: only update defined values
        const merged = { ...s };
        Object.keys(updates).forEach(key => {
          if (updates[key] !== undefined) {
            merged[key] = updates[key];
          }
        });

        return merged;
      })
    );
  };

  const updateLocalStorage = (serverName, updates) => {
    const localServers = JSON.parse(localStorage.getItem('deployedServers') || '[]');
    const updated = localServers.map(s => {
      if (s.name === serverName) {
        // Add timestamp if this is a new pending entry
        const needsTimestamp = !s.pendingTimestamp &&
                               (updates.status === 'payment_pending' || updates.status === 'installing');
        return {
          ...s,
          ...updates,
          ...(needsTimestamp && { pendingTimestamp: Date.now() })
        };
      }
      return s;
    });
    localStorage.setItem('deployedServers', JSON.stringify(updated));
  };

  const removeFromLocalStorage = (serverName) => {
    const localServers = JSON.parse(localStorage.getItem('deployedServers') || '[]');
    const filtered = localServers.filter(s => s.name !== serverName);
    localStorage.setItem('deployedServers', JSON.stringify(filtered));
  };

  const handleManage = useCallback((server, tab = null) => {
    setSelectedServerName(server.name);
    setManagementTab(tab);
    setShowManagement(true);
  }, []);

  const handleUpdate = useCallback(async () => {
    try {
      const blockHeight = await fetchBlockHeight();
      await loadServers(blockHeight);
      if (!showManagementRef.current) {
        // Full status check when panel is closed
        await checkServersStatus();
      } else {
        // Panel is open — only check domain for the managed server
        const selected = serversRef.current.find(s => s.name === selectedServerNameRef.current);
        if (selected?.status === 'running') {
          try {
            const domainReady = await checkDomainReady(selected, gamePortOf(selected));
            if (domainReady !== null && selected.domainReady !== domainReady) {
              updateServerInList(selected.name, { domainReady });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      console.error('Failed to update:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopyDomain = useCallback((serverId, address) => {
    navigator.clipboard.writeText(address).catch(() => {});
    setCopiedServerId(serverId);

    // Reset icon after 2 seconds
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedServerId(null);
    }, 2000);
  }, []);

  const formatExpiration = (expiresAt) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;

    if (diff < 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}${hours > 0 ? `, ${hours}h` : ''}`;
    } else if (hours > 0) {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
    } else {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  };

  const getExpirationClass = (expiresAt) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (diff < 0) return 'text-red-400 font-medium';
    if (days < 7) return 'text-orange-400 font-medium';
    return 'text-emerald-400';
  };

  // Check if a server has a pending renewal
  const hasServerPendingRenewal = (server) => {
    return pendingRenewals.some(renewal =>
      renewal.appName === server.name
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-center gap-4">
                <div className="bg-gray-700 p-3 rounded-lg animate-pulse">
                  <div className="w-8 h-8"></div>
                </div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-700 rounded w-24 mb-2 animate-pulse"></div>
                  <div className="h-8 bg-gray-700 rounded w-16 animate-pulse"></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Loading Table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Server Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Hardware</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" title={LATENCY_TOOLTIP}>Your Latency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Expires</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => (
                <tr key={i} className="border-b border-gray-700 animate-pulse">
                  <td className="px-4 py-4"><div className="h-4 bg-gray-700 rounded w-32"></div></td>
                  <td className="px-4 py-4"><div className="h-4 bg-gray-700 rounded w-24"></div></td>
                  <td className="px-4 py-4"><div className="h-4 bg-gray-700 rounded w-16"></div></td>
                  <td className="px-4 py-4"><div className="h-4 bg-gray-700 rounded w-20"></div></td>
                  <td className="px-4 py-4"><div className="h-4 bg-gray-700 rounded w-12"></div></td>
                  <td className="px-4 py-4"><div className="h-4 bg-gray-700 rounded w-24"></div></td>
                  <td className="px-4 py-4 text-right"><div className="h-8 bg-gray-700 rounded w-20 ml-auto"></div></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Loading Message */}
          <div className="flex items-center justify-center py-8 border-t border-gray-700">
            <div className="flex items-center gap-3 text-gray-400">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <span className="text-sm font-medium">Loading your servers...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <img
            src="/games/palworld/no-servers.webp"
            alt="No servers"
            className="w-[500px] h-auto mx-auto opacity-80"
          />
          <p className="text-lg text-gray-400 -mt-2">Deploy your first game server to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <style>{`@keyframes dots{to{clip-path:inset(0 0 0 0)}}`}</style>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Servers */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-3 hover:border-gray-700 transition-colors">
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-500/10 p-2.5 rounded-lg flex-shrink-0">
              <Server className="w-7 h-7 text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="text-gray-400 text-xs font-medium truncate">Servers</div>
              <div className="text-2xl font-bold text-white leading-tight">
                {servers.length}
              </div>
            </div>
          </div>
        </div>

        {/* Running */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-3 hover:border-gray-700 transition-colors">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-500/10 p-2.5 rounded-lg flex-shrink-0">
              <Activity className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-gray-400 text-xs font-medium truncate">Running</div>
              <div className="text-2xl font-bold text-emerald-400 leading-tight">
                {runningServers}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Cards View */}
      {/* Mobile View - 2026 Best Practices */}
      <div className="md:hidden space-y-4">
        <AnimatePresence>
          {servers.map((server) => (
            <motion.div
              key={server.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-lg"
            >
              {/* Header - Prominent Title with Status */}
              <div className="pl-0 pr-4 pt-2 pb-2">
                <div className="flex items-stretch gap-0">
                  {/* Game icon */}
                  <div className="flex items-center flex-shrink-0">
                    <img src="/games/palworld/game-icon.webp" alt="" className="w-20 h-20 object-contain" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center pl-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white truncate flex-1">{server.name}</h3>
                </div>
                <p className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold mt-1.5">Server address · players connect here</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Globe className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                  {!gamePortKnown(server) ? (
                  <span className="text-xs text-gray-500 italic truncate flex-1">Available once the server is deployed</span>
                  ) : (<>
                  <span className="font-mono text-xs text-gray-400 truncate flex-1" title="Players enter this in Palworld's Join via IP field">{gameAddressOf(server)}</span>
                  <button
                    onClick={() => handleCopyDomain(server.name, gameAddressOf(server))}
                    className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
                      copiedServerId === server.name
                        ? 'text-blue-400 bg-blue-400/10'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                    aria-label="Copy server address"
                  >
                    {copiedServerId === server.name ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  </>)}
                </div>
                  </div>
                </div>
              </div>

              {/* Pending Deployment Banner */}
              {server.status === 'payment_pending' && (
                <div className="px-4 py-2.5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-y border-yellow-500/30">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                      <span className="text-xs font-medium text-yellow-300">
                        Deployment queued
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Installing Banner */}
              {server.status === 'installing' && (
                server.placementIssue ? (
                  <div className="px-4 py-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-y border-amber-500/30">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-amber-300">{server.placementIssue.title}</p>
                        <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
                          {server.placementIssue.message}
                        </p>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleManage(server, 'geolocation'); }}
                          className="mt-1.5 text-[11px] font-semibold text-amber-200 underline underline-offset-2 hover:text-white"
                        >
                          Add more locations
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-2.5 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-y border-blue-500/30">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <DatabaseBackup className="w-3.5 h-3.5 text-blue-400 animate-pulse flex-shrink-0" />
                        <span className="text-xs font-medium text-blue-300">
                          Installing on Flux network...
                        </span>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Configuring — the deploy's own last step: the app is placed, and its
                  advertised port and admin access are written before anyone connects. */}
              {server.status === 'configuring' && (
                <div className="px-4 py-2.5 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border-y border-blue-500/30">
                  <div className="flex items-start gap-2">
                    <Settings className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5 animate-spin" style={{ animationDuration: '3s' }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-blue-300">Configuring your server</p>
                      <p className="text-[11px] text-blue-200/70 mt-0.5 leading-relaxed">
                        Setting up the address players connect to and your admin access. It restarts once and is then ready.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cancelling Banner */}
              {server.status === 'cancelling' && (
                <div className="px-4 py-2.5 bg-gradient-to-r from-red-500/20 to-orange-500/20 border-y border-red-500/30">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                      <span className="text-xs font-medium text-red-300">
                        Server cancelled — expires soon
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Renewal Banner */}
              {hasServerPendingRenewal(server) && (
                <div className="px-4 py-2.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-y border-blue-500/30">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      <span className="text-xs font-medium text-blue-300">
                        Renewal queued
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Banner */}
              {server.status === 'running' && !hasServerPendingRenewal(server) && (
                server.domainReady === false ? (
                  <div className="px-4 py-2.5 bg-gradient-to-r from-blue-500/10 to-orange-500/10 border-y border-blue-500/30">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="relative w-2 h-2">
                          <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-75" />
                          <div className="relative w-2 h-2 rounded-full bg-blue-400" />
                        </div>
                        <span className="text-xs font-medium text-blue-300">
                          Waiting for domain access<span className="inline-flex w-5"><span style={{display:'inline-block',clipPath:'inset(0 100% 0 0)',animation:'dots 1.5s steps(4,end) infinite'}}>...</span></span>
                        </span>
                      </div>
                    </div>
                  </div>
                ) : server.domainReady === true ? (
                  <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-y border-emerald-500/30">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-xs font-medium text-emerald-300">
                          Running
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null
              )}

              {/* Degraded redundancy — the server works, so this sits below the Running
                  banner rather than replacing it, and stays informative in tone. */}
              {server.status === 'running' && server.placementIssue && (
                <div className="px-4 py-2.5 bg-amber-500/[0.08] border-y border-amber-500/30">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-amber-300">
                        Running on {server.placementIssue.running} of {server.placementIssue.instances} nodes
                      </p>
                      <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
                        {server.placementIssue.message}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleManage(server, 'geolocation'); }}
                        className="mt-1.5 text-[11px] font-semibold text-amber-200 underline underline-offset-2 hover:text-white"
                      >
                        Add more locations
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <UpdateAvailableBanner server={server} onOpen={handleManage} />

              {/* Divider */}
              <div className="h-px bg-gray-700" />

              {/* Hardware - Professional Style */}
              <div className="px-4 py-3 border-t border-gray-700">
                <div className="flex gap-3">
                  <div className="flex items-center gap-2.5 flex-1 bg-gray-800/90 rounded-lg p-2.5">
                    <div className="p-2.5 rounded-lg bg-blue-500/20 flex-shrink-0">
                      <MdSpeed className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white">{server.cpu}</div>
                      <div className="text-xs text-gray-500">{server.cpu === 1 ? 'vCore' : 'vCores'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 flex-1 bg-gray-800/90 rounded-lg p-2.5">
                    <div className="p-2.5 rounded-lg bg-purple-500/20 flex-shrink-0">
                      <MdMemory className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white">{server.ram}</div>
                      <div className="text-xs text-gray-500">MB</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 flex-1 bg-gray-800/90 rounded-lg p-2.5">
                    <div className="p-2.5 rounded-lg bg-cyan-500/20 flex-shrink-0">
                      <MdStorage className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white">{server.hdd}</div>
                      <div className="text-xs text-gray-500">GB</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Server Metrics - Visual Hierarchy */}
              <div className="px-4 py-4 border-t border-gray-700">
                <div className="grid grid-cols-2 gap-3">
                  {/* Status - Primary Metric */}
                  <div className="bg-gray-800/90 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${server.status === 'running' && server.palworldOnline ? 'bg-emerald-500/20' : 'bg-blue-500/20'}`}>
                        <Activity className={`w-4 h-4 ${server.status === 'running' && server.palworldOnline ? 'text-emerald-400' : 'text-blue-400'}`} />
                      </div>
                      <div className="text-xs font-medium text-gray-500">Status</div>
                    </div>
                    <div className="text-base font-bold">
                      {server.status === 'running' && server.palworldOnline !== undefined && server.palworldOnline !== null ? (
                        server.palworldOnline ? (
                          <span className="text-emerald-400">Online</span>
                        ) : (
                          <span className="text-red-400">Offline</span>
                        )
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </div>
                  </div>

                  {/* Latency - Primary Metric */}
                  <div className="bg-gray-800/90 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/20">
                        <Activity className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="text-xs font-medium text-gray-500" title={LATENCY_TOOLTIP}>Your Latency</div>
                    </div>
                    <div className="text-base font-bold">
                      <ClientLatencyValue server={server} enabled={server.status === 'running'} />
                    </div>
                  </div>


                  {/* Expires - Hide only for payment_pending */}
                  {server.status !== 'payment_pending' && (
                    <div className="bg-gray-800/90 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-orange-500/20">
                          <Clock className="w-4 h-4 text-orange-400" />
                        </div>
                        <div className="text-xs font-medium text-gray-500">Expires</div>
                      </div>
                      <div className={`text-base font-bold ${getExpirationClass(server.expiresAt)}`}>
                        {formatExpiration(server.expiresAt)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button - Hide only for payment_pending */}
              {server.status !== 'payment_pending' && (
                <div className="px-4 pb-4 pt-1">
                  <button
                    onClick={() => handleManage(server)}
                    className="w-full flex items-center justify-center gap-1.5 px-4 h-9 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-semibold transition-colors duration-150"
                  >
                    <Settings className="w-5 h-5" />
                    Manage Server
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-gray-900 rounded-lg border border-gray-800 overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-max">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/50">
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Server Name
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                Hardware
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wider" title={LATENCY_TOOLTIP}>
                Your Latency
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                Expires
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            <AnimatePresence>
              {servers.map((server) => (
                <motion.tr
                  key={server.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="hover:bg-gray-700/30 transition-colors"
                >
                  <td className="pl-0 pr-1 py-3 whitespace-nowrap">
                    <div className="flex items-stretch gap-0">
                      {/* Game icon */}
                      <div className="flex items-center flex-shrink-0">
                        <img src="/games/palworld/game-icon.webp" alt="" className="w-20 h-20 object-contain -my-6" />
                      </div>
                      {/* Server info */}
                      <div className="flex flex-col gap-1.5">
                      {/* Server Name */}
                      <div className="flex items-center">
                        <span className="text-sm font-semibold text-white">{server.name}</span>
                      </div>

                      {/* Server address (domain + game port) — players connect here */}
                      <span className="block text-[9px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">Server address · players connect here</span>
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                        {!gamePortKnown(server) ? (
                        <span className="text-xs text-gray-500 italic">Available once the server is deployed</span>
                        ) : (<>
                        <span className="text-xs text-gray-400 font-mono" title="Players enter this in Palworld's Join via IP field">{gameAddressOf(server)}</span>
                        <button
                          onClick={() => handleCopyDomain(server.name, gameAddressOf(server))}
                          className={`p-0.5 rounded transition-all ${
                            copiedServerId === server.name
                              ? 'text-blue-400'
                              : 'text-gray-500 hover:text-gray-300'
                          }`}
                          title="Copy address"
                        >
                          {copiedServerId === server.name ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        </>)}
                      </div>

                      {/* Pending Deployment Indicator */}
                      {server.status === 'payment_pending' && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-md w-fit">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
                          <span className="text-xs font-medium text-yellow-300 whitespace-nowrap">
                            Deployment queued
                          </span>
                        </div>
                      )}

                      {/* Installing Indicator — replaced by the real reason when the app
                          cannot be placed at all, so the customer is not left watching a
                          spinner that will never finish. */}
                      {server.status === 'installing' && (
                        server.placementIssue ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleManage(server, 'geolocation'); }}
                            className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded-md w-fit hover:bg-amber-500/20 transition-colors"
                            title={server.placementIssue.message}
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                            <span className="text-xs font-medium text-amber-300 whitespace-nowrap">
                              No node available — add locations
                            </span>
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded-md w-fit">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                            <span className="text-xs font-medium text-blue-300 whitespace-nowrap">
                              Installing on network
                            </span>
                          </div>
                        )
                      )}

                      {/* Configuring — see the mobile card. */}
                      {server.status === 'configuring' && (
                        <div
                          className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded-md w-fit"
                          title="Setting up the address players connect to and your admin access. Your server restarts once and is then ready."
                        >
                          <Settings className="w-3 h-3 text-blue-400 flex-shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
                          <span className="text-xs font-medium text-blue-300 whitespace-nowrap">
                            Configuring your server
                          </span>
                        </div>
                      )}

                      {/* Cancelling Indicator */}
                      {server.status === 'cancelling' && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded-md w-fit">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
                          <span className="text-xs font-medium text-red-300 whitespace-nowrap">
                            Cancelled — expires soon
                          </span>
                        </div>
                      )}

                      {/* Renewal Indicator */}
                      {hasServerPendingRenewal(server) && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded-md w-fit">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                          <span className="text-xs font-medium text-blue-300 whitespace-nowrap">
                            Renewal queued
                          </span>
                        </div>
                      )}

                      {/* Status Indicator */}
                      {server.status === 'running' && !hasServerPendingRenewal(server) && (
                        server.domainReady === false ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded-md w-fit">
                            <div className="relative w-2 h-2 flex-shrink-0">
                              <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-75" />
                              <div className="relative w-2 h-2 rounded-full bg-blue-400" />
                            </div>
                            <span className="text-xs font-medium text-blue-300 whitespace-nowrap">
                              Waiting for domain access<span className="inline-flex w-5"><span style={{display:'inline-block',clipPath:'inset(0 100% 0 0)',animation:'dots 1.5s steps(4,end) infinite'}}>...</span></span>
                            </span>
                          </div>
                        ) : server.domainReady === true ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-md w-fit">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                            <span className="text-xs font-medium text-emerald-300 whitespace-nowrap">
                              Running
                            </span>
                          </div>
                        ) : null
                      )}

                      {/* Degraded redundancy — shown next to Running, not instead of it. */}
                      {server.status === 'running' && server.placementIssue && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleManage(server, 'geolocation'); }}
                          className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded-md w-fit hover:bg-amber-500/20 transition-colors"
                          title={server.placementIssue.message}
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                          <span className="text-xs font-medium text-amber-300 whitespace-nowrap">
                            Running on {server.placementIssue.running} of {server.placementIssue.instances} nodes — add locations
                          </span>
                        </button>
                      )}

                      <UpdateAvailableBadge server={server} onOpen={handleManage} />
                    </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="grid grid-cols-2 gap-2 mx-auto" style={{ width: 'max-content' }}>
                      {/* CPU Chip */}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 whitespace-nowrap">
                        <MdSpeed className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-blue-300 leading-none">{server.cpu} {server.cpu === 1 ? 'vCore' : 'vCores'}</span>
                      </div>
                      {/* Storage Chip */}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 whitespace-nowrap">
                        <MdStorage className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-cyan-300 leading-none">{server.hdd}GB</span>
                      </div>
                      {/* RAM Chip */}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30 col-span-2 whitespace-nowrap">
                        <MdMemory className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-purple-300 leading-none">{server.ram}MB</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    {server.status === 'running' ? (
                      server.palworldOnline !== undefined && server.palworldOnline !== null ? (
                        server.palworldOnline ? (
                          <span className="text-sm font-medium text-emerald-400">
                            Online
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-red-400">
                            Offline
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-gray-500">Checking...</span>
                      )
                    ) : (
                      <span className="text-xs text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center text-sm">
                    <ClientLatencyValue
                      server={server}
                      enabled={server.status === 'running'}
                      className="font-medium"
                    />
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center text-sm">
                    {server.status !== 'payment_pending' ? (
                      server.expiresAt ? (
                        <span className={getExpirationClass(server.expiresAt)}>
                          {formatExpiration(server.expiresAt)}
                        </span>
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium">
                    {server.status !== 'payment_pending' ? (
                      <button
                        onClick={() => handleManage(server)}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        <Settings className="w-4 h-4" />
                        Manage
                      </button>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Management Panel */}
      <ServerManagementPanel
        key={selectedServer?.name}
        server={selectedServer}
        isOpen={showManagement}
        initialTab={managementTab}
        onClose={() => {
          setShowManagement(false);
          showManagementRef.current = false;
          setSelectedServerName(null);
          setManagementTab(null);
          handleUpdate();
        }}
        onUpdate={handleUpdate}
      />
    </div>
  );
};

export default memo(GameServersDashboard, (prevProps, nextProps) => {
  // Only re-render if refreshTrigger changes
  return prevProps.refreshTrigger === nextProps.refreshTrigger;
});
