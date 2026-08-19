import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import Modal from '../common/Modal';
import CustomSelect from '../common/CustomSelect';
import { MdMemory, MdSpeed, MdStorage, MdFolder, MdDownload, MdEdit, MdDelete, MdDriveFileRenameOutline, MdFileUpload, MdCheckCircle, MdMoreVert, MdAccessTime, MdTimerOff, MdRestore, MdLink, MdCloudUpload, MdInsertDriveFile, MdMonetizationOn } from 'react-icons/md';
import { RiFolderReceivedFill } from 'react-icons/ri';
import { GrPlan } from 'react-icons/gr';
import { FaFileImage, FaFileVideo, FaFileAudio, FaFileArchive, FaFileAlt, FaFileCode, FaFilePdf, FaFile } from 'react-icons/fa';
import { BarChart3, Terminal, Folder, RefreshCw, DatabaseBackup, CheckCircle, XCircle, ArrowLeft, Settings, Database, Copy, Check, Server, Upload, Home, X, ChevronRight, Tag, Clock, Pause, Play, ExternalLink, Info, CreditCard, AlertTriangle, Globe, Trash2, Gamepad2, TrendingUp, Hammer, MapPin, SlidersHorizontal, ShieldCheck, Eye, EyeOff, Square, Cpu, Package, Sparkles } from 'lucide-react';
import EnvironmentTab from './EnvironmentTab';
import GeolocationTab from './GeolocationTab';
import HardwareTab from './HardwareTab';
import ModManager from './ModManager';

// Lazy load Monaco Editor (heavy: ~4.7MB) - only loads when file editing is used
const Editor = lazy(() => import('@monaco-editor/react'));
import apiService, { parseAddress } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import stripeService from '../../services/stripeService';
import { payWithSSP, payWithZelcore, isSSPAvailable } from '../../services/walletService';
import marketplaceService from '../../services/marketplaceService';
import ServerTerminal from './ServerTerminal';
import ServerStats from './ServerStats';
import { useClientLatency, latencyClass, LATENCY_TOOLTIP } from '../../utils/clientLatency';
import secureStorage from '../../utils/secureStorage';
import VirtualizedFileList from './VirtualizedFileList';
import toast from 'react-hot-toast';
import { nodeApiBase, withAppStopped, restartApp, isAppPowerBusy, clearPendingRestore } from '../../utils/appPower';
import { reconcilePalworldIni, externalGamePort, patchPublicPort, fetchIniText } from '../../utils/palworldIni';
import { jobFailureMessage, pollOperation, readVolumeResponse } from '../../utils/volumeOperations';
import { parseEnvArray } from '../../utils/appSpecHelpers';
import { findMissingStandardEnv } from '../../config/serverMaintenance';
import { diagnosePlacement } from '../../utils/nodeCapacity';

// Helper functions for expiration display
const formatExpiration = (expiresAt) => {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry - now;

  if (diff < 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `~${days} day${days > 1 ? 's' : ''}${hours > 0 ? `, ${hours}h` : ''}`;
  } else if (hours > 0) {
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `~${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
  } else {
    const minutes = Math.floor(diff / (1000 * 60));
    return `~${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
};

const getExpirationClass = (expiresAt) => {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (diff < 0) return 'text-red-400';
  if (days < 7) return 'text-orange-400';
  return 'text-emerald-400';
};

// Language detection for Monaco Editor
const getLanguageFromFileName = (fileName) => {
  const lowerFileName = fileName.toLowerCase();

  // Special cases
  if (lowerFileName === 'dockerfile') return 'dockerfile';
  if (lowerFileName === 'makefile') return 'makefile';
  if (lowerFileName.endsWith('pom.xml')) return 'xml';

  const extensionMap = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    py: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    swift: 'swift',
    kt: 'kotlin',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    yml: 'yaml',
    yaml: 'yaml',
    xml: 'xml',
    txt: 'plaintext',
    log: 'plaintext',
    conf: 'ini',
    ini: 'ini',
    toml: 'toml',
    lua: 'lua',
    r: 'r',
    pl: 'perl',
    pm: 'perl',
    dart: 'dart',
    coffee: 'coffeescript',
  };

  const parts = lowerFileName.split('.');
  if (parts.length <= 1) return 'plaintext';
  const ext = parts.pop();

  return extensionMap[ext] || 'plaintext';
};

// Custom tooltip style — arrow with border, no native title lag
const _TIP = "hidden sm:block absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-gray-900 border border-gray-700 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 before:content-[''] before:absolute before:bottom-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-700";

// Portal tooltip — works inside scrollable/overflow containers
const Tip = ({ children, text }) => {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!show || !ref.current) { setPos(null); return; }
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
  }, [show]);
  return (
    <span ref={ref} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} className="contents">
      {children}
      {show && pos && createPortal(
        <span className="fixed px-2 py-1 text-xs text-white bg-gray-900 border border-gray-700 rounded whitespace-nowrap pointer-events-none z-[99999] before:content-[''] before:absolute before:bottom-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-700" style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}>
          {text}
        </span>,
        document.body
      )}
    </span>
  );
};

/**
 * ClockSkewScreen — full-screen overlay shown when master node clock is out of sync.
 * Counts down from skewSec to 0 and auto-dismisses when the window clears.
 */
const ClockSkewScreen = ({ endTime, onDismiss }) => {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.round((endTime - Date.now()) / 1000)));

  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.max(0, Math.round((endTime - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0) {
        clearInterval(id);
        onDismiss();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [endTime, onDismiss]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const label = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="flex flex-col items-center space-y-6 border border-blue-500/30 rounded-2xl bg-blue-500/5 px-12 py-10 max-w-sm w-full">
        <div className="w-24 h-24 rounded-full bg-blue-500/10 border border-blue-500/40 flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400 animate-spin" style={{ animationDuration: '3s' }} />
          <Clock className="w-12 h-12 text-blue-400" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-lg font-semibold text-blue-300">Preparing secure connection</h3>
          <p className="text-sm text-gray-400 text-center">
            The server is synchronizing.
          </p>
          <p className="text-sm text-gray-500 text-center">
            Authentication will be ready shortly.
          </p>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-5xl font-mono font-bold text-blue-300 tabular-nums">{label}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * ServerManagementPanel Component
 * Management panel for game servers with tabs
 * Simpler version of FluxOS app management
 */
const ServerManagementPanel = ({ server, isOpen, onClose, onUpdate, initialTab = null }) => {
  const { loginTime } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [clockSkewEndTime, setClockSkewEndTime] = useState(null);

  // Reset to overview tab when modal opens — unless the caller opened it for a specific
  // job (e.g. the card's "Add locations" action).
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'overview');
    }
  }, [isOpen, initialTab]);

  // Standard settings this server is missing (servers bought before we started shipping
  // them). Surfaced as a dot on the Deployment Settings tab so a customer who never opens
  // that tab still sees there is something to apply. EnvironmentTab refreshes the count
  // once it has the (possibly decrypted) spec in hand.
  const [pendingEnvUpdates, setPendingEnvUpdates] = useState(0);
  // Why the app is running on fewer nodes than it should — almost always a geolocation
  // narrow enough that the matching nodes are full. Null when locations aren't the problem.
  const [placementIssue, setPlacementIssue] = useState(null);
  useEffect(() => {
    if (!isOpen || !server?.name) return undefined;
    let cancelled = false;
    (async () => {
      let spec = null;
      try {
        spec = await apiService.getAppSpecs(server.name);
        // Enterprise specs ship an empty compose until decrypted — no compose means no
        // opinion, not "everything is missing".
        const env = spec?.compose?.[0]?.environmentParameters;
        if (!cancelled && Array.isArray(env)) {
          setPendingEnvUpdates(findMissingStandardEnv(parseEnvArray(env)).length);
        }
      } catch { /* non-fatal: the tab itself reports the real state */ }

      if (cancelled || !spec?.name) return;
      try {
        const locations = await apiService.getAppLocations(server.name).catch(() => []);
        const running = Array.isArray(locations) ? locations.length : 0;
        const diagnosis = await diagnosePlacement({
          geolocation: spec.geolocation,
          compose: spec.compose,
          instances: spec.instances || 1,
          isEnterprise: !!spec.enterprise,
          running,
        });
        if (!cancelled) setPlacementIssue(diagnosis);
      } catch { /* diagnosis is a bonus — never break the panel over it */ }
    })();
    return () => { cancelled = true; };
  }, [isOpen, server?.name]);

  // Master Resolution via FDM - Single source of truth for all tabs
  // Uses the same FDM /appips/ endpoint that FluxOS uses for master selection
  const [masterLocation, setMasterLocation] = useState(null);
  const masterLocationRef = useRef(null);
  // Skip state update if IP unchanged — prevents re-renders on null→null or same-IP re-resolves
  const setMasterLocationStable = useCallback((val) => {
    if (val === null && masterLocationRef.current === null) return;
    if (val !== null && val?.ip === masterLocationRef.current?.ip) return;
    masterLocationRef.current = val;
    setMasterLocation(val);
  }, []);
  const [masterLoading, setMasterLoading] = useState(true);
  const masterResolvingRef = useRef(false);

  const masterAbortRef = useRef(null);
  const serverRef = useRef(server);
  serverRef.current = server; // Always current

  // false = the node was found by probing locations, not by FDM: management works, but the
  // player-facing domain is not routing to it yet.
  const [domainRouted, setDomainRouted] = useState(true);

  // Whether the resolved node is running the container. The panel deliberately falls back to
  // an instance that is only INSTALLED so that a crashed server can still be managed — but
  // that node is not hosting anyone, so anything that describes the play experience (latency)
  // has to stay quiet rather than report the path to a stopped container.
  const [masterLive, setMasterLive] = useState(false);

  // Resolve master node via FDM API (same as FluxOS) - called on panel open and on error
  const resolveMaster = useCallback(async (signal) => {
    const srv = serverRef.current;
    if (!srv?.locations || srv.locations.length === 0) {
      setMasterLive(false);
      setMasterLocationStable(null);
      setMasterLoading(false);
      return;
    }

    if (masterResolvingRef.current) return; // Prevent concurrent resolutions
    masterResolvingRef.current = true;
    // Always, not just when re-resolving: when FDM has nothing this now probes every location
    // for the container, which takes seconds. Without a loading state the panel would first
    // claim "waiting for domain access" and only then find a perfectly reachable node.
    setMasterLoading(true);

    try {
      console.log('📍 [Master] Locations:', srv.locations.map((l, i) => `${i}: ${l.ip}`));

      // Query FDM for master IP (same source of truth as FluxOS)
      const fdmResponse = await fetch(`/api/fdm/appips/${srv.name}`, { signal });
      const fdmData = await fdmResponse.json();

      if (fdmData.status === 'success' && fdmData.data?.ips?.length > 0) {
        const masterIp = fdmData.data.ips[0]; // ips[0] is master
        console.log('🔍 [Master] FDM master IP:', masterIp, 'all:', fdmData.data.ips);

        // Match FDM master IP against locations (compare IP without port)
        for (let i = 0; i < srv.locations.length; i++) {
          const { host: locHost } = parseAddress(srv.locations[i].ip);
          if (locHost === masterIp) {
            console.log(`✅ [Master] Found at location ${i}:`, locHost);
            setDomainRouted(true);
            // FDM only lists instances that answer the game port, so a master from FDM is by
            // definition the live one.
            setMasterLive(true);
            setMasterLocationStable(srv.locations[i]);
            masterResolvingRef.current = false;
            setMasterLoading(false);
            return;
          }
        }
        console.log('⚠️ [Master] FDM IP not in locations list');
      } else {
        console.log('⚠️ [Master] FDM returned no IPs — domain access not yet configured');
      }

      // FDM answers "where do PLAYERS go", which is not the same question as "where can this
      // app be MANAGED from". FDM drops an instance the moment the game stops answering, so
      // deriving node access from it means a crashed game also takes away Console, Files and
      // Server Settings — exactly the tools needed to fix it. The node API is addressed by
      // node IP (from the on-chain locations), never by the app domain, so it stays reachable.
      //
      // Fall back to the location that is actually RUNNING the container: for a multi-instance
      // app that is the instance worth talking to, and it is a stronger signal than FDM here,
      // which only reports health as seen by the load balancer.
      if (signal?.aborted) { masterResolvingRef.current = false; return; }

      const zelidauth = await secureStorage.getItem('zelidauth');
      let running = null;
      let installed = null;
      if (zelidauth) {
        const authHeader = JSON.stringify(zelidauth);
        const headers = { zelidauth: authHeader, 'x-apicache-bypass': true };
        for (const loc of srv.locations) {
          if (signal?.aborted) { masterResolvingRef.current = false; return; }
          try {
            const res = await fetch(`${nodeApiBase(loc.ip)}/apps/listrunningapps`, { headers, signal });
            const body = await res.json();
            if ((body?.data || []).some((c) => (c.Names || []).some((n) => String(n).includes(srv.name)))) {
              running = loc;
              break;
            }
            // Installed but not running is the crash case — the one where management matters
            // most, and the one `listrunningapps` cannot see.
            if (!installed) {
              const inst = await fetch(`${nodeApiBase(loc.ip)}/apps/installedapps/${srv.name}`, { headers, signal });
              const instBody = await inst.json();
              if (instBody?.status === 'success' && (instBody.data || []).length > 0) installed = loc;
            }
          } catch { /* node unreachable — try the next location */ }
        }
      }

      // Deliberately NO blind fallback to locations[0]: right after a deploy the locations
      // exist while the image is still being pulled, and pointing the panel at a node with no
      // container would replace the honest "still being set up" screen with a wall of errors
      // from tabs that need it. Only take over once the app is actually there.
      const resolved = running || installed;
      if (resolved) {
        console.log('📍 [Master] FDM unavailable — using node', resolved.ip, running ? '(container running)' : '(installed, not running)');
        setDomainRouted(false);
      }
      setMasterLive(!!running);
      setMasterLocationStable(resolved || null);
      masterResolvingRef.current = false;
      setMasterLoading(false);
    } catch (error) {
      if (error.name === 'AbortError') {
        masterResolvingRef.current = false;
        return; // Don't touch masterLoading — let the next call handle it
      }
      console.error('❌ [Master] FDM failed:', error);
      if (signal?.aborted) { masterResolvingRef.current = false; return; }
      setMasterLive(false);
      setMasterLocationStable(null);
      masterResolvingRef.current = false;
      setMasterLoading(false);
    }
  }, [setMasterLocationStable]); // Stable — reads server from ref

  // Wrapper for child tabs to trigger re-resolve (creates its own AbortController)
  const retryResolveMaster = useCallback(() => {
    masterAbortRef.current?.abort();
    masterResolvingRef.current = false; // Reset guard — aborted call may not have cleared it yet
    const controller = new AbortController();
    masterAbortRef.current = controller;
    resolveMaster(controller.signal);
  }, [resolveMaster]);

  // Resolve master when panel opens or server locations change
  // Don't depend on full `server` — it changes on every status update and would abort in-flight resolves
  //
  // Keyed on the location IPs rather than how many there are: when FluxOS relocates the app
  // or the load balancer promotes a different instance, the count is unchanged, so the panel
  // would keep managing the node it resolved on open. Silently — a node that still answers
  // never raises the TypeError that onMasterError depends on, so config saves, uploads and
  // backups would land on the instance that is no longer serving players.
  // Sorted: the API does not promise a stable order, and an order flip would otherwise read
  // as a location change and abort an in-flight resolve on every status poll.
  const locationKey = (server?.locations || []).map((l) => l?.ip).sort().join(',');
  useEffect(() => {
    if (isOpen) {
      masterAbortRef.current?.abort();
      masterResolvingRef.current = false; // Reset guard — previous call is aborted
      const controller = new AbortController();
      masterAbortRef.current = controller;
      resolveMaster(controller.signal);
    }
    return () => masterAbortRef.current?.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, server?.name, locationKey]);

  const [isRestarting, setIsRestarting] = useState(false);
  const [isReinstalling, setIsReinstalling] = useState(false);
  const [showReinstallConfirm, setShowReinstallConfirm] = useState(false);
  const [reinstallLogs, setReinstallLogs] = useState([]);
  const [reinstallDone, setReinstallDone] = useState(false);
  const [reinstallStep, setReinstallStep] = useState({ current: 0, total: 0 }); // progress bar
  const reinstallLogsEndRef = useRef(null);
  const reinstallWaitingRef = useRef(false);

  const nodePollingRef = useRef([]);
  const reinstallStreamRef = useRef(null); // active redeploy stream reader — cancelled on unmount
  const [postReinstall, setPostReinstall] = useState(false); // suppress blocking screen after reinstall

  // Poll every 30s when domain is not ready — compare DNS vs FDM master IP (same as dashboard check)
  useEffect(() => {
    if (!isOpen || !masterLocation || server?.domainReady !== false) return;
    const domainName = `${server.name.toLowerCase()}.app.runonflux.io`;
    const id = setInterval(async () => {
      try {
        const fdmRes = await fetch(`/api/fdm/appips/${server.name}`);
        const fdmData = await fdmRes.json();
        if (fdmData.status !== 'success' || !fdmData.data?.ips?.length) return;
        const masterIp = fdmData.data.ips[0];
        const dnsRes = await fetch(`/api/dns-resolve/${domainName}`);
        const dnsData = await dnsRes.json();
        const synced = dnsData.status === 'success' && dnsData.data?.ip === masterIp;
        if (synced && onUpdate) onUpdate();
      } catch { /* ignore */ }
    }, 30_000);
    return () => clearInterval(id);
  }, [isOpen, masterLocation, server?.domainReady, server?.name, onUpdate]);

  // When masterLocation comes back during reinstall wait, enable Close button (domain poll still checks DNS sync)
  useEffect(() => {
    if (!reinstallWaitingRef.current || !masterLocation || reinstallDone) return;
    setReinstallLogs(prev => [...prev, { msg: 'Server node resolved — waiting for domain sync', status: 'success' }]);
    setReinstallDone(true);
    if (onUpdate) onUpdate();
  }, [masterLocation, reinstallDone, onUpdate]);

  // Clear postReinstall flag once master resolves after reinstall
  useEffect(() => {
    if (masterLocation && postReinstall) setPostReinstall(false);
  }, [masterLocation, postReinstall]);

  // Auto-retry master resolution every 15s whenever the panel is working from a degraded
  // answer: no master at all, or a master that came only from the container probe because FDM
  // had nothing to say. That second case cannot key on `masterLocation` — it is always set
  // there, by construction — and FDM drops an app for the couple of minutes a restart takes,
  // so without a retry the "load balancer isn't routing here" banner outlives the outage that
  // raised it for as long as the panel stays open.
  useEffect(() => {
    if (!isOpen) return;
    const staleRouting = !!masterLocation && !domainRouted;
    // Nothing resolved at all — deploying, relocating, or every location is down. Retry
    // regardless of postReinstall/domainReady: those only narrowed which outages recovered
    // on their own, and the panel is unusable until one does.
    if (masterLocation && !staleRouting) return;
    const id = setInterval(() => {
      // Never restart a resolve that is still running. Probing the locations is sequential and
      // can outlast the 15s tick, and retryResolveMaster aborts whatever is in flight — so a
      // slow set of nodes would be cancelled and restarted forever, never reaching an answer.
      if (masterResolvingRef.current) return;
      retryResolveMaster();
    }, 15000);
    return () => clearInterval(id);
  }, [masterLocation, domainRouted, isOpen, retryResolveMaster]);

  // Clear postReinstall when panel closes
  useEffect(() => {
    if (!isOpen) setPostReinstall(false);
  }, [isOpen]);

  const [isPaused, setIsPaused] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const mainTimersRef = useRef([]);

  // Cleanup timers and streams on unmount — intentionally read refs at cleanup time (timer arrays are dynamic)
  useEffect(() => {
    return () => {
      mainTimersRef.current.forEach(clearTimeout); // eslint-disable-line react-hooks/exhaustive-deps
      nodePollingRef.current.forEach(clearTimeout);
      reinstallStreamRef.current?.cancel?.();
    };
  }, []);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);

  // Check clock skew when panel opens or master changes
  // Uses loginTime to subtract already-elapsed wait — won't re-show if enough time has passed
  useEffect(() => {
    if (!isOpen || !masterLocation) return;
    const controller = new AbortController();
    const [host, port = 16127] = masterLocation.ip.split(':');
    fetch(`https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/flux/uptime`, { signal: controller.signal })
      .then(res => {
        const dateHeader = res.headers.get('Date');
        if (!dateHeader) return;
        const skew = Math.round(Math.abs(Date.now() - new Date(dateHeader).getTime()) / 1000);
        if (skew <= 30) { setClockSkewEndTime(null); return; }
        // Subtract time already elapsed since login — if user waited long enough, skip screen
        const elapsedSinceLogin = loginTime ? Math.round((Date.now() - loginTime) / 1000) : 0;
        const remaining = Math.max(0, skew - elapsedSinceLogin);
        if (remaining <= 0) { setClockSkewEndTime(null); return; }
        // Only set if not already counting (preserve existing end time across tab switches)
        setClockSkewEndTime(prev => prev ?? Date.now() + remaining * 1000);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isOpen, masterLocation, loginTime]);

  // Fetch container state from master node
  useEffect(() => {
    if (!masterLocation || !server?.name) return;
    const fetchState = async () => {
      try {
        const [host, port = 16127] = masterLocation.ip.split(':');
        const res = await fetch(
          `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/apps/listrunningapps`
        );
        const data = await res.json();
        if (data.status === 'success' && data.data) {
          const container = data.data.find((c) => c.Names?.[0]?.includes(server.name));
          setIsPaused(container?.State === 'paused');
        }
      } catch {
        // ignore - state unknown
      }
    };
    fetchState();
  }, [masterLocation, server?.name]);

  // ── Auto-reconcile the ini to what this deploy actually needs ─────────────────
  // The write itself lives in utils/palworldIni — a new deploy is reconciled by the
  // dashboard, before the server is ever announced as ready, so this is now the FALLBACK
  // for every other case: a server bought before that existed, a browser that was closed
  // during the deploy, or a redeploy that moved the server to a new external port.
  //
  // Still runs on EVERY panel open, for EVERY server — the read is one cache-bypassed GET,
  // and only a real divergence costs a restart. It has to stay ungated: a PublicPort that
  // drifts after a successful fix (a later config save writing the stale value back) would
  // otherwise go unnoticed forever.
  useEffect(() => {
    if (!isOpen || !masterLocation || !server?.name) return undefined;

    let changes = [];
    reconcilePalworldIni(server, masterLocation.ip, {
      onPhase: (phase, ctx) => {
        changes = ctx.changes;
        // Announce the restart exactly when the stop is issued — never when the lock was
        // taken by another operation, nor when the server was already down.
        if (phase === 'stopping') {
          toast(`Applying ${changes.length > 1 ? 'automatic config changes' : 'an automatic config change'} (${changes.join(', ')}) — restarting your server…`, { icon: '🔧', duration: 6000 });
        }
      },
    }).then((result) => {
      const summary = (result.changes || changes).join(', ');
      // The restart is guaranteed to be attempted, but if the node refused it the user has
      // to know rather than discover an `exited` server later.
      if (result.startState === 'stopped') {
        toast.error('Your server did not come back up automatically — press Start on the Overview tab.', { duration: 10000 });
      }
      if (result.status === 'done') {
        toast.success(`Server settings updated automatically (${summary}) — server restarting.`);
        if (onUpdate) onUpdate();
      } else if (result.status === 'exhausted' && summary) {
        toast.error(`Could not update your server settings automatically (${summary}). Your server still runs — contact support if the community browser or the Remote Control tab misbehaves.`);
      } else if (result.status === 'failed') {
        toast.error('Automatic config change did not persist — will retry.');
      }
    }).catch(() => { /* transient/network — allow a retry on the next panel open */ });

    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, masterLocation, server?.name]);

  const handleTogglePause = async () => {
    if (isTogglingPause || !masterLocation) return;
    setIsTogglingPause(true);
    try {
      const [host, port = 16127] = masterLocation.ip.split(':');
      const zelidauth = await secureStorage.getItem('zelidauth');
      const endpoint = isPaused ? 'appunpause' : 'apppause';
      const response = await fetch(
        `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/apps/${endpoint}/${server.name}`,
        {
          method: 'GET',
          headers: { zelidauth: JSON.stringify(zelidauth) },
        }
      );
      const data = await response.json();
      if (data.status === 'error') {
        toast.error(data.data?.message || `${isPaused ? 'Unpause' : 'Pause'} failed`);
      } else {
        setIsPaused(!isPaused);
        [5000, 10000, 20000, 30000, 60000].forEach(delay => {
          mainTimersRef.current.push(setTimeout(() => {
            setStatsRefreshKey((k) => k + 1);
            if (onUpdate) onUpdate();
          }, delay));
        });
        toast.success(isPaused ? 'Server resumed' : 'Server paused');
      }
    } catch (error) {
      if (error instanceof TypeError) retryResolveMaster();
      toast.error(`Failed to ${isPaused ? 'unpause' : 'pause'} server`);
    } finally {
      mainTimersRef.current.push(setTimeout(() => setIsTogglingPause(false), 2000));
    }
  };

  const [isStopping, setIsStopping] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleStop = async () => {
    if (isStopping || !masterLocation) return;
    // Don't race a config save / port reconcile: those stop the container and own the
    // restart, so a stop slipped in between would be undone a few seconds later.
    if (isAppPowerBusy(server.name)) {
      toast('A maintenance task is running on this server — try again in a moment.', { icon: '⏳' });
      return;
    }
    setIsStopping(true);
    try {
      const [host, port = 16127] = masterLocation.ip.split(':');
      const zelidauth = await secureStorage.getItem('zelidauth');
      const response = await fetch(
        `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/apps/appstop/${server.name}`,
        {
          method: 'GET',
          headers: { zelidauth: JSON.stringify(zelidauth) },
        }
      );
      const data = await response.json();
      if (data.status === 'error') {
        toast.error(data.data?.message || 'Stop failed');
      } else {
        // The user wants it down: cancel any restart this browser still owed the server,
        // so the recovery sweep doesn't start it back up on the next dashboard load.
        clearPendingRestore(server.name);
        setIsStopped(true);
        toast.success('Server stopped');
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      if (error instanceof TypeError) retryResolveMaster();
      toast.error('Failed to stop server');
    } finally {
      mainTimersRef.current.push(setTimeout(() => setIsStopping(false), 2000));
    }
  };

  const handleStart = async () => {
    if (isStarting || !masterLocation) return;
    setIsStarting(true);
    try {
      const [host, port = 16127] = masterLocation.ip.split(':');
      const zelidauth = await secureStorage.getItem('zelidauth');
      const response = await fetch(
        `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/apps/appstart/${server.name}`,
        {
          method: 'GET',
          headers: { zelidauth: JSON.stringify(zelidauth) },
        }
      );
      const data = await response.json();
      if (data.status === 'error') {
        toast.error(data.data?.message || 'Start failed');
      } else {
        setIsStopped(false);
        toast.success('Server starting...');
        [5000, 10000, 20000, 30000, 60000].forEach(delay => {
          mainTimersRef.current.push(setTimeout(() => {
            setStatsRefreshKey((k) => k + 1);
            if (delay >= 20000 && onUpdate) onUpdate();
          }, delay));
        });
      }
    } catch (error) {
      if (error instanceof TypeError) retryResolveMaster();
      toast.error('Failed to start server');
    } finally {
      mainTimersRef.current.push(setTimeout(() => setIsStarting(false), 2000));
    }
  };

  const handleRestart = async () => {
    if (isRestarting || !masterLocation) return;
    setIsRestarting(true);
    try {
      const zelidauth = await secureStorage.getItem('zelidauth');
      // restartApp verifies the container came back and falls back to a start, so a failed
      // `apprestart` can't leave the server down.
      const state = await restartApp(nodeApiBase(masterLocation.ip), server.name, JSON.stringify(zelidauth));
      if (state === 'stopped') {
        toast.error('Restart failed — the server is stopped. Use Start to bring it back.');
        setIsStopped(true);
      } else {
        toast.success('Server restarting...');
        setIsStopped(false);
        // Trigger stats + status checks as server boots
        // Stats refresh immediately, onUpdate after 20s+ (listrunningapps cache is 15s)
        [5000, 10000, 20000, 30000, 60000].forEach(delay => {
          mainTimersRef.current.push(setTimeout(() => {
            setStatsRefreshKey((k) => k + 1);
            if (delay >= 20000 && onUpdate) onUpdate();
          }, delay));
        });
      }
    } catch (error) {
      if (error instanceof TypeError) retryResolveMaster();
      toast.error('Failed to restart server');
    } finally {
      mainTimersRef.current.push(setTimeout(() => setIsRestarting(false), 10000));
    }
  };

  const handleReinstall = async (force = true) => {
    if (isReinstalling || !server?.locations?.length) return;
    setShowReinstallConfirm(false);
    setIsReinstalling(true);
    setReinstallDone(false);
    setPostReinstall(true);
    nodePollingRef.current.forEach(clearTimeout);
    nodePollingRef.current = [];
    reinstallStreamRef.current?.cancel?.();
    reinstallStreamRef.current = null;
    setMasterLocation(null);
    masterLocationRef.current = null;

    setReinstallLogs([{ msg: 'Starting reinstall...', status: 'info' }]);

    const zelidauth = await secureStorage.getItem('zelidauth');

    const appendLog = (msg, status = 'info') => {
      setReinstallLogs(prev => {
        const next = [...prev, { msg, status }];
        setTimeout(() => {
          try {
            if (reinstallLogsEndRef.current) {
              reinstallLogsEndRef.current.scrollTop = reinstallLogsEndRef.current.scrollHeight;
            }
          } catch { /* unmounted */ }
        }, 50);
        return next;
      });
    };

    // Parse a stream line — handles regular JSON and Flux's double-encoded strings
    const parseLine = (line) => {
      try {
        let parsed = JSON.parse(line);
        // Double-encoded: outer parse gives a string → parse again
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch { return { msg: parsed, isError: false }; }
        }
        // Docker pull progress events — always skip (progressDetail = Docker layer event)
        if (parsed?.progressDetail !== undefined) return null;
        // Extract human-readable message
        let msg;
        if (typeof parsed?.data === 'string') msg = parsed.data;
        else if (typeof parsed?.data?.message === 'string') msg = parsed.data.message;
        else if (typeof parsed?.status === 'string' && parsed?.data === undefined) msg = parsed.status;
        else return null; // unknown shape — skip
        return { msg, isError: parsed?.status === 'error' };
      } catch {
        return { msg: line.trim(), isError: false };
      }
    };


    // Stream the redeploy response — emits one log entry per phase transition
    const streamRedeploy = async (nodeBaseUrl, label, onPhase) => {
      console.log(`🔧 [Redeploy] ${nodeBaseUrl}/apps/redeploy/${server.name}/${force}`);
      const response = await fetch(`${nodeBaseUrl}/apps/redeploy/${server.name}/${force}`, {
        method: 'GET',
        headers: { zelidauth: JSON.stringify(zelidauth) },
      });

      if (!response.ok) {
        throw new Error(`Node returned ${response.status}`);
      }

      const reader = response.body.getReader();
      reinstallStreamRef.current = reader;
      const decoder = new TextDecoder();
      let hasError = false;
      let phase = null;

      const enterPhase = (newPhase, msg, status) => {
        if (phase === newPhase) return;
        phase = newPhase;
        appendLog(msg, status);
        onPhase(); // increment global step counter on each phase change
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value).replace(/\}\s*\{/g, '}\n{');
          for (const line of text.split('\n')) {
            if (!line.trim()) continue;
            const parsed = parseLine(line);
            if (!parsed) continue;
            const m = parsed.msg.toLowerCase();

            if (parsed.isError) {
              // Transient errors during redeploy — skip
              if (m.includes('not found') || m.includes('cannot read properties')) continue;
              hasError = true;
              appendLog(parsed.msg, 'error');
              continue;
            }

            // Phase transitions based on stream content
            if (m.includes('stopping') || m.includes('removing') || m.includes('cleaning up')) {
              enterPhase('removing', `Removing ${label}`, 'removing');
            } else if (m.includes('initiating') || m.includes('awaiting installation') || m.includes('pulling from') || m.includes('downloaded newer image') || m.includes('status: image is up to date')) {
              enterPhase('installing', `Installing ${label}`, 'installing');
            }
            if (m.includes('successfully installed and launched')) {
              enterPhase('done', `${label} deployed`, 'success');
            }
          }
        }
      } finally {
        reinstallStreamRef.current = null;
      }

      return !hasError;
    };

    // Master first, then slaves — so Syncthing master is back before slaves wipe
    const masterLoc = masterLocation || server.locations[0];
    const orderedLocs = [
      masterLoc,
      ...server.locations.filter(l => l.ip !== masterLoc.ip),
    ];

    // 3 phases per instance (removing, installing, complete)
    const totalPhases = orderedLocs.length * 3;
    setReinstallStep({ current: 0, total: totalPhases });

    // Stream redeploy for all nodes one by one
    for (let nodeIdx = 0; nodeIdx < orderedLocs.length; nodeIdx++) {
      const loc = orderedLocs[nodeIdx];
      const label = 'Instance';
      const [ipRaw, portRaw] = loc.ip.split(':');
      const port = portRaw || '16127';
      const nodeBaseUrl = `https://${ipRaw.replace(/\./g, '-')}-${port}.node.api.runonflux.io`;

      try {
        await streamRedeploy(nodeBaseUrl, label, () => {
          setReinstallStep(prev => ({ ...prev, current: prev.current + 1 }));
        });
      } catch (err) {
        console.error(`❌ [Redeploy] ${nodeBaseUrl} failed:`, err);
        appendLog(`${label}: ${err.message}`, 'error');
      }
    }

    appendLog('All instances reinstalled. Waiting for server to come back', 'installing');
    reinstallWaitingRef.current = true;

    // Poll FDM master IP + domain DNS with increasing delays
    // 30s, 60s, 90s, 120s, 150s, 180s = ~10.5 min total
    const domainName = `${server.name.toLowerCase()}.app.runonflux.io`;
    const checkDelays = [30000, 60000, 120000, 180000, 240000, 300000];
    checkDelays.forEach((delay, i) => {
      const timerId = setTimeout(async () => {
        if (!reinstallWaitingRef.current) return;
        try {
          const [fdmRes, dnsRes] = await Promise.all([
            fetch(`/api/fdm/appips/${server.name}`),
            fetch(`/api/dns-resolve/${domainName}`),
          ]);
          if (!fdmRes.ok || !dnsRes.ok) throw new Error('API unavailable');
          const ct1 = fdmRes.headers.get('content-type') || '';
          const ct2 = dnsRes.headers.get('content-type') || '';
          if (!ct1.includes('json') || !ct2.includes('json')) throw new Error('API not running');
          const fdmData = await fdmRes.json();
          const dnsData = await dnsRes.json();
          const masterIp = fdmData.data?.ips?.[0];
          const dnsIp = dnsData.data?.ip;
          // appendLog(`FDM: ${masterIp || 'waiting'} | DNS: ${dnsIp || 'waiting'}`, 'info');
          // Re-resolve master each tick — FDM may assign new master after reinstall
          if (masterIp) retryResolveMaster();
          const synced = masterIp && dnsData.status === 'success' && dnsIp === masterIp;
          if (synced) {
            reinstallWaitingRef.current = false;
            appendLog('Domain synced — players can connect', 'success');
            if (onUpdate) onUpdate();
            setReinstallDone(true);
            return;
          }
        } catch (err) {
          appendLog(`Check failed: ${err.message}`, 'error');
        }
        if (i === checkDelays.length - 1 && reinstallWaitingRef.current) {
          reinstallWaitingRef.current = false;
          appendLog('Domain may still be syncing', 'done');
          setReinstallDone(true);
        }
      }, delay);
      nodePollingRef.current.push(timerId);
    });

    setIsReinstalling(false);
  };

  if (!server) return null;

  const hasCompose = server.compose?.length > 0 && server.compose[0]?.name !== 'null';
  // Tabs that talk to the Flux API instead of the server's node, so they keep working when
  // the node can't be reached. That matters most exactly when it can't: a broken setting can
  // stop the server from booting, FDM then reports no healthy instance, masterLocation stays
  // null — and gating everything behind it would hide the very tabs that fix the cause.
  const NODE_FREE_TABS = ['billing', 'environment', 'geolocation', 'hardware'];
  const tabWorksOffline = NODE_FREE_TABS.includes(activeTab);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'environment', label: 'Deployment Settings', icon: SlidersHorizontal },
    { id: 'geolocation', label: 'Location', icon: MapPin },
    { id: 'hardware', label: 'Hardware', icon: Cpu },
    { id: 'config', label: 'Server Settings', icon: Settings },
    { id: 'mods', label: 'Mods', icon: Package },
    { id: 'remote', label: 'Remote Control', icon: Globe },
    { id: 'terminal', label: 'Console', icon: Terminal },
    { id: 'files', label: 'Files', icon: Folder },
    ...(hasCompose ? [{ id: 'backup', label: 'Backup', icon: Database }] : []),
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center justify-between flex-1 min-w-0 pr-8" style={{ width: '100%' }}>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Settings className="w-6 h-6" style={{ color: 'white', opacity: 1 }} />
            <span>Manage</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              onClick={handleTogglePause}
              disabled={isTogglingPause || !masterLocation}
              className={`relative group w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 flex items-center justify-center disabled:opacity-30 rounded-full border bg-gray-700/50 ${isPaused ? 'text-blue-400 border-blue-500/30 hover:text-blue-300 hover:border-blue-400/30' : 'text-gray-400 border-gray-600/30 hover:text-orange-400 hover:border-yellow-500/30'}`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              <span className={_TIP}>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              onClick={handleRestart}
              disabled={isRestarting || !masterLocation || isPaused}
              className="relative group w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-blue-400 disabled:opacity-30 rounded-full border border-gray-600/30 hover:border-blue-500/30 bg-gray-700/50"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRestarting ? 'animate-spin text-blue-400' : ''}`} />
              <span className={_TIP}>Restart</span>
            </button>
            <button
              onClick={isStopped ? handleStart : handleStop}
              disabled={isStopping || isStarting || !masterLocation || isPaused}
              className={`relative group w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 flex items-center justify-center disabled:opacity-30 rounded-full border bg-gray-700/50 ${
                isStopped
                  ? 'text-emerald-400 border-emerald-500/30 hover:text-emerald-300 hover:border-emerald-400/30'
                  : 'text-gray-400 hover:text-red-400 border-gray-600/30 hover:border-red-500/30'
              }`}
            >
              {isStopped
                ? <Play className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isStarting ? 'animate-pulse' : ''}`} />
                : <Square className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isStopping ? 'animate-pulse text-red-400' : ''}`} />
              }
              <span className={_TIP}>{isStopped ? 'Start' : 'Stop'}</span>
            </button>
            <button
              onClick={() => setShowReinstallConfirm(true)}
              disabled={isReinstalling || !masterLocation}
              className="relative group w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 flex items-center justify-center disabled:opacity-30 rounded-full"
              style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.12)' }}
            >
              {isReinstalling ? <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <DatabaseBackup className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              <span className={_TIP}>Reinstall</span>
            </button>
            <span className="hidden sm:inline-flex items-center gap-2 text-sm px-3 py-1.5 bg-gray-700/50 rounded-full border border-gray-600/30" style={{ color: 'white', opacity: 1 }}>
              <span className={`w-2 h-2 rounded-full ${isRestarting ? 'bg-blue-400 animate-spin' : isPaused ? 'bg-orange-400' : 'bg-emerald-400 animate-pulse'}`} />
              {server.name}
            </span>
          </div>
        </div>
      }
      size="fullscreen"
      noMinHeight={true}
      headerContent={
        <div
          className="flex overflow-x-auto"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x'
          }}
        >
          <style>{`
            div.overflow-x-auto::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-shrink-0 px-3 sm:px-6 py-2 text-sm font-medium transition-colors relative flex items-center justify-center gap-2 whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'text-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'environment' && pendingEnvUpdates > 0 && (
                  <span
                    className="flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-blue-500 text-white text-[10px] font-bold leading-none"
                    title={`${pendingEnvUpdates} recommended ${pendingEnvUpdates === 1 ? 'setting' : 'settings'} available`}
                  >
                    {pendingEnvUpdates}
                  </span>
                )}
                {tab.id === 'geolocation' && placementIssue && placementIssue.severity !== 'waiting' && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title={placementIssue.title} />
                )}
              </button>
            );
          })}
        </div>
      }
    >
      {/* Clock skew warning — shown as full screen when node clock is out of sync */}
      {clockSkewEndTime && !tabWorksOffline ? (
        <ClockSkewScreen endTime={clockSkewEndTime} onDismiss={() => { setClockSkewEndTime(null); retryResolveMaster(); }} />
      ) : !masterLocation && !tabWorksOffline && (postReinstall || server?.domainReady === false) ? (
        // After reinstall or domain syncing: show lightweight reconnecting spinner instead of full blocking screen
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="w-16 h-16 rounded-full border-2 border-transparent border-t-blue-400/70 animate-spin" style={{ animationDuration: '1.5s' }} />
          <p className="text-sm text-gray-400">Reconnecting to server...</p>
          <p className="text-xs text-gray-600">Retrying every 15 seconds</p>
        </div>
      ) : !masterLocation && masterLoading && !tabWorksOffline ? (
        // Still resolving — locating the node now includes probing each location, so this is a
        // real wait rather than an instant lookup. Saying "waiting for the domain" here would
        // be a guess at a conclusion we have not reached yet.
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="w-16 h-16 rounded-full border-2 border-transparent border-t-blue-400/70 animate-spin" style={{ animationDuration: '1.5s' }} />
          <p className="text-sm text-gray-400">Locating your server...</p>
        </div>
      ) : !masterLocation && !tabWorksOffline && placementIssue && placementIssue.severity !== 'waiting' ? (
        // The app is not merely slow to answer: it has nowhere to run. Saying "waiting for
        // domain access" here would be a lie the customer could stare at forever, when the
        // fix is one tab away.
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="w-24 h-24 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
            <MapPin className="w-12 h-12 text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-amber-300">{placementIssue.title}</h3>
          <p className="text-sm text-gray-300 text-center px-4 max-w-lg leading-relaxed">
            {placementIssue.message}
          </p>
          <p className="text-xs text-gray-500 text-center px-4 max-w-lg">
            Adding a location never moves an existing world — it only widens where your server
            is allowed to run. Your subscription and settings stay exactly as they are.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <button
              onClick={() => setActiveTab('geolocation')}
              className="px-6 py-2 text-sm font-semibold text-white rounded-lg transition-colors flex items-center gap-2"
              style={{ background: 'linear-gradient(90deg,#2196F3,#1B7AC7)', boxShadow: '0 4px 12px rgba(33,150,243,0.3)' }}
            >
              <MapPin className="w-3.5 h-3.5" />
              Add more locations
            </button>
            <button
              onClick={retryResolveMaster}
              className="px-6 py-2 text-sm text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/30 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        </div>
      ) : !masterLocation && !tabWorksOffline ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="w-24 h-24 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400/50 animate-spin" style={{ animationDuration: '3s' }} />
            <Globe className="w-12 h-12 text-blue-400 animate-pulse" />
          </div>
          <h3 className="text-lg font-semibold text-blue-300">Waiting for domain access<span className="inline-flex w-6"><span className="animate-[dots_1.5s_steps(3,start)_infinite]">...</span></span></h3>
          <style>{`.animate-\\[dots_1\\.5s_steps\\(4\\,end\\)_infinite\\]{display:inline-block;clip-path:inset(0 100% 0 0);animation:dots 1.5s steps(3,start) infinite}@keyframes dots{to{clip-path:inset(0 0 0 0)}}`}</style>
          <p className="text-sm text-gray-400 text-center px-4 max-w-md">
            Your server is being configured on the Flux network. Console, Files, Server Settings
            and Remote Control become available once it answers.
          </p>
          {/* A server that keeps failing to boot never answers, so this screen would otherwise
              be a dead end — and the setting that broke it is edited two tabs away. */}
          <p className="text-xs text-gray-500 text-center px-4 max-w-md">
            Taking unusually long? Deployment Settings, Location, Hardware and Billing keep
            working — they don&apos;t need the server to be reachable.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <button
              onClick={retryResolveMaster}
              className="px-6 py-2 text-sm text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/30 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
            <button
              onClick={() => setActiveTab('environment')}
              className="px-6 py-2 text-sm text-gray-200 hover:text-white border border-gray-600/50 hover:border-gray-500/60 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors flex items-center gap-2"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Open Deployment Settings
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Reachable, but running on fewer nodes than it was paid for — the redundancy the
              customer bought is silently missing, and the cause is the location selection. */}
          {placementIssue && placementIssue.severity !== 'waiting' && activeTab !== 'geolocation' && activeTab !== 'billing' && (
            <button
              type="button"
              onClick={() => setActiveTab('geolocation')}
              className="mx-1 mt-0.5 mb-3 w-[calc(100%-0.5rem)] flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-left hover:bg-amber-500/[0.12] transition-colors"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15">
                <MapPin className="h-4 w-4 text-amber-400" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-amber-300">{placementIssue.title}</span>
                <span className="block mt-0.5 text-xs text-amber-200/80">
                  Running on {placementIssue.running} of {placementIssue.instances} nodes — tap to add more locations.
                </span>
              </span>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-amber-400/70" />
            </button>
          )}

          {/* Standard settings this server predates. The dot on the tab only ever reached
              customers who happened to look at the tab strip, so the offer is made on every
              tab instead — except the one that already shows it in full, and Billing, where
              the customer is in the middle of paying for something. */}
          {pendingEnvUpdates > 0 && activeTab !== 'environment' && activeTab !== 'billing' && (
            <button
              type="button"
              onClick={() => setActiveTab('environment')}
              className="mx-1 mt-0.5 mb-3 w-[calc(100%-0.5rem)] flex items-center gap-3 rounded-xl border border-blue-500/40 bg-blue-500/[0.10] px-4 py-3 text-left hover:bg-blue-500/[0.16] transition-colors"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/15">
                <Sparkles className="h-4 w-4 text-blue-300" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-blue-200">Server update available</span>
                <span className="block mt-0.5 text-xs text-blue-200/75">
                  Your server predates {pendingEnvUpdates} recommended{' '}
                  {pendingEnvUpdates === 1 ? 'setting' : 'settings'} that keep Palworld servers healthy. Applying
                  them leaves your world and your own settings untouched.
                </span>
              </span>
              <span className="hidden sm:inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-blue-400/40 bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-100">
                Review and apply
              </span>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-blue-300/70" />
            </button>
          )}

          {/* Domain sync banner — masterLocation found but domain DNS hasn't propagated yet */}
          {masterLocation && server?.domainReady === false && activeTab !== 'billing' && (
            <div className="mx-1 mt-0.5 mb-3 px-4 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-3">
              <div className="relative w-2 h-2 flex-shrink-0">
                <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-75" />
                <div className="relative w-2 h-2 rounded-full bg-blue-400" />
              </div>
              <div className="text-xs text-blue-300 leading-relaxed">
                Domain is syncing — players cannot connect yet.
                <div className="font-mono text-amber-200/70 text-[11px] mt-0.5 truncate">{server.name?.toLowerCase()}.app.runonflux.io</div>
              </div>
            </div>
          )}
          {/* Managing works (we reached the node directly), but the load balancer is not
              routing the domain here — normally because the game itself stopped answering.
              Said plainly, because players are affected even though this panel is not. */}
          {masterLocation && !domainRouted && activeTab !== 'billing' && (
            <div className="mx-1 mt-0.5 mb-3 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15">
                <Globe className="h-4 w-4 text-amber-400" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-300">Players can&apos;t reach this server</p>
                <p className="mt-0.5 truncate text-xs text-amber-200/80">
                  The load balancer isn&apos;t routing{' '}
                  <span className="font-mono">{server.name?.toLowerCase()}.app.runonflux.io</span> here.
                </p>
              </div>
              <span className="hidden flex-shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200/90 sm:block">
                Managing still works
              </span>
            </div>
          )}
          {/* Reached one of the node-free tabs while the server itself is unreachable. Say so,
              rather than letting the settings look like they apply to a healthy server. */}
          {!masterLocation && tabWorksOffline && activeTab !== 'billing' && (
            <div className="mx-1 mt-0.5 mb-3 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-300">Server isn&apos;t responding</p>
                <p className="mt-0.5 text-xs text-amber-200/80">
                  It may still be starting, or a setting may be keeping it from booting.
                </p>
              </div>
              <span className="hidden flex-shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200/90 sm:block">
                Changes apply on redeploy
              </span>
            </div>
          )}
          {/* Tab Content - Only render active tab to prevent unnecessary API calls and memory leaks */}
          {activeTab === 'environment' && (
            <div key="environment" className="animate-fade-in">
              <EnvironmentTab server={server} onUpdate={onUpdate} onRedeploy={() => handleReinstall(false)} onStandardEnvChange={setPendingEnvUpdates} />
            </div>
          )}
          {activeTab === 'geolocation' && (
            <div key="geolocation" className="animate-fade-in">
              <GeolocationTab server={server} onUpdate={onUpdate} onRedeploy={() => handleReinstall(false)} onSwitchTab={setActiveTab} />
            </div>
          )}
          {activeTab === 'hardware' && (
            <div key="hardware" className="animate-fade-in">
              <HardwareTab server={server} onUpdate={onUpdate} onRedeploy={() => handleReinstall(false)} onReinstall={() => handleReinstall(true)} onSwitchTab={setActiveTab} />
            </div>
          )}
          {activeTab === 'overview' && (
            <div key="overview" className="animate-fade-in">
              <OverviewTab server={server} masterLocation={masterLocation} masterLive={masterLive} onMasterError={retryResolveMaster} statsRefreshKey={statsRefreshKey} onSwitchTab={setActiveTab} />
            </div>
          )}
          {activeTab === 'config' && (
            <div key="config" className="animate-fade-in">
              <ConfigTab server={server} masterLocation={masterLocation} onMasterError={retryResolveMaster} />
            </div>
          )}
          {activeTab === 'mods' && (
            <div key="mods" className="animate-fade-in">
              <ModManager server={server} masterLocation={masterLocation} onMasterError={retryResolveMaster} onRedeploy={() => handleReinstall(false)} />
            </div>
          )}
          {activeTab === 'remote' && (
            <div key="remote" className="animate-fade-in">
              <RemoteControlTab server={server} masterLocation={masterLocation} />
            </div>
          )}
          {/* Terminal stays mounted (WebSocket connection) — hidden via CSS */}
          <div className={`h-full ${activeTab === 'terminal' ? 'block animate-fade-in' : 'hidden'}`}>
            <TerminalTab server={server} isVisible={activeTab === 'terminal' && reinstallLogs.length === 0} isPaused={isReinstalling || (reinstallLogs.length > 0 && !reinstallDone) || !!clockSkewEndTime} masterLocation={masterLocation} onMasterError={retryResolveMaster} />
          </div>
          {activeTab === 'files' && (
            <div key="files" className="animate-fade-in">
              <div className="flex flex-col pt-3" style={{ height: 'calc(100% - 20px)' }}>
                <FilesTab server={server} masterLocation={masterLocation} onMasterError={retryResolveMaster} />
              </div>
              <div style={{ height: '20px' }} className="flex-shrink-0"></div>
            </div>
          )}
          {activeTab === 'backup' && (
            <div key="backup" className="animate-fade-in">
              <BackupTab server={server} masterLocation={masterLocation} onMasterError={retryResolveMaster} />
            </div>
          )}
        </>
      )}
      {/* Billing tab always available - doesn't need master */}
      {activeTab === 'billing' && (
        <BillingTab server={server} onUpdate={onUpdate} onClose={onClose} />
      )}
    </Modal>

    {/* Reinstall confirmation dialog */}
    {showReinstallConfirm && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowReinstallConfirm(false)} />
        <div className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl shadow-black/60" style={{ border: '1px solid rgba(239,68,68,0.25)' }}>
          {/* Red top accent */}
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #ef4444, #dc2626)' }} />
          <div className="bg-surface p-6">
            {/* Icon + title */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <DatabaseBackup className="w-5 h-5" style={{ color: '#f87171' }} />
              </div>
              <div>
                <p className="font-bold text-base text-white">Reinstall Server</p>
                <p className="text-xs mt-0.5" style={{ color: '#f87171' }}>Hard redeploy — all data wiped</p>
              </div>
            </div>
            {/* Warning box */}
            <div className="rounded-xl p-3.5 mb-5 text-sm" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="font-semibold mb-1" style={{ color: '#f87171' }}>All data will be permanently deleted</p>
              <p className="text-gray-400 leading-relaxed">This will wipe all server files and world data, giving you a clean fresh start. Make sure you have a backup if you want to keep your world.</p>
            </div>
            {/* Session warning if less than 10 min left */}
            {loginTime && (() => {
              const remaining = (90 * 60 * 1000) - (Date.now() - loginTime);
              if (remaining < 10 * 60 * 1000) {
                return (
                  <div className="rounded-xl p-3.5 mb-4 flex items-center gap-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: '#fbbf24' }} />
                    <p className="text-sm leading-snug" style={{ color: '#fbbf24' }}>Session expires in {Math.max(0, Math.floor(remaining / 60000))} min. Please re-login before reinstalling.</p>
                  </div>
                );
              }
              return null;
            })()}
            {/* Buttons */}
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowReinstallConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Cancel
              </button>
              {(!loginTime || (90 * 60 * 1000) - (Date.now() - loginTime) >= 10 * 60 * 1000) && (
                <button
                  onClick={handleReinstall}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all cursor-pointer hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}
                >
                  Reinstall
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Reinstall progress dialog */}
    {(isReinstalling || reinstallLogs.length > 0) && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
        <div className="relative w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl shadow-black/60" style={{ border: `1px solid ${isReinstalling ? 'rgba(239,68,68,0.2)' : reinstallDone ? 'rgba(33,150,243,0.25)' : 'rgba(251,191,36,0.25)'}` }}>
          <div style={{ height: '3px', background: isReinstalling ? 'linear-gradient(90deg, #ef4444, #dc2626)' : reinstallDone ? 'linear-gradient(90deg, #D4860B, #B8720A)' : 'linear-gradient(90deg, #f59e0b, #d97706)' }} />
          <div className="bg-surface p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={
                isReinstalling ? { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }
                : reinstallDone ? { background: 'rgba(33,150,243,0.1)', border: '1px solid rgba(33,150,243,0.25)' }
                : { background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }
              }>
                {isReinstalling
                  ? <RefreshCw className="w-5 h-5 animate-spin" style={{ color: '#f87171' }} />
                  : reinstallDone
                  ? <DatabaseBackup className="w-5 h-5" style={{ color: '#4ade80' }} />
                  : <RefreshCw className="w-5 h-5 animate-spin" style={{ color: '#fbbf24' }} />
                }
              </div>
              <div>
                <p className="font-bold text-base text-white">{isReinstalling ? 'Reinstalling Server...' : reinstallDone ? 'Reinstall Complete' : 'Waiting for Server...'}</p>
                <p className="text-xs mt-0.5 text-gray-500">{isReinstalling ? 'Do not close this window' : reinstallDone ? 'All instances processed' : 'Checking domain access'}</p>
              </div>
            </div>
            {/* Single progress bar with pulsing dot and instance counter */}
            {reinstallStep.total > 0 && (
              <div className="flex items-center gap-3 mb-4">
                {/* Pulsing dot — red while active, green when done */}
                <div className="relative w-2.5 h-2.5 flex-shrink-0">
                  <div className={`absolute inset-0 rounded-full animate-ping opacity-60 ${reinstallDone ? 'bg-blue-400' : 'bg-red-500'}`} />
                  <div className={`relative w-2.5 h-2.5 rounded-full ${reinstallDone ? 'bg-blue-400' : 'bg-red-500'}`} />
                </div>
                {/* Progress bar */}
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(reinstallStep.current / reinstallStep.total) * 100}%`,
                      background: reinstallDone ? '#D4860B' : 'linear-gradient(90deg, #ef4444, #dc2626)',
                    }}
                  />
                </div>
                {/* Counter */}
                <span className="text-sm font-bold font-mono flex-shrink-0" style={{ color: reinstallDone ? '#4ade80' : '#d1d5db' }}>
                  {Math.min(Math.ceil(reinstallStep.current / 3), reinstallStep.total / 3)}/{reinstallStep.total / 3}
                </span>
              </div>
            )}
            {/* Log list */}
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="max-h-40 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-track-transparent" ref={reinstallLogsEndRef} style={{ scrollbarWidth: 'thin', scrollbarColor: `${reinstallDone ? '#B8720A' : '#b91c1c'} transparent` }}>
                {reinstallLogs.map((log, i) => {
                  const isLast = i === reinstallLogs.length - 1;
                  const isWaiting = isLast && ['removing', 'installing', 'info'].includes(log.status);
                  const icon = (() => {
                    if (log.status === 'error') return <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />;
                    if (log.status === 'success') return <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#4ade80' }} />;
                    if (log.status === 'done') return <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#fbbf24' }} />;
                    if (log.status === 'removing') return <Trash2 className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5${isLast ? ' animate-pulse' : ''}`} style={{ color: '#fb923c', opacity: isLast ? 1 : 0.5 }} />;
                    if (log.status === 'installing') return <DatabaseBackup className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5${isLast ? ' animate-pulse' : ''}`} style={{ color: '#60a5fa', opacity: isLast ? 1 : 0.5 }} />;
                    return <RefreshCw className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5${isLast ? ' animate-pulse' : ''}`} style={{ color: '#6b7280', opacity: isLast ? 1 : 0.5 }} />;
                  })();
                  const color = log.status === 'error' ? '#f87171' : log.status === 'success' ? '#4ade80' : log.status === 'done' ? '#fbbf24' : isLast ? '#d1d5db' : '#6b7280';
                  return (
                    <div key={i} className="flex items-start gap-2">
                      {icon}
                      <p className="text-xs font-mono leading-relaxed" style={{ color }}>
                        {isWaiting
                          ? <>{log.msg}<span className="inline-flex w-6"><span style={{display:'inline-block',clipPath:'inset(0 100% 0 0)',animation:'dots 1.5s steps(3,start) infinite'}}>...</span></span></>
                          : log.msg}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Close button */}
            {reinstallDone && (
              <button
                onClick={() => setReinstallLogs([])}
                className="mt-4 w-full px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all cursor-pointer hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, #D4860B, #B8720A)', boxShadow: '0 4px 12px rgba(33,150,243,0.25)' }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

// Overview Tab - Shows server info and status
const OverviewTab = ({ server, masterLocation, masterLive, onMasterError: _onMasterError, statsRefreshKey }) => {
  // masterLocation is passed down from parent - no DNS resolution needed

  // Live Palworld status — poll every 30s while overview tab is active.
  // Liveness only: this probe is sent by our own backend, so its timing measures the path from
  // whichever node serves this site to the game node. Latency is measured in the browser below.
  const [livePalworld, setLivePalworld] = useState(null);
  useEffect(() => {
    if (!masterLocation) { setLivePalworld(null); return; }
    const endpoint = 'palworld-status';
    // Use master IP when domain not ready, otherwise use domain
    const queryHost = server?.domainReady !== true
      ? masterLocation.ip.split(':')[0]
      : `${server.name.toLowerCase()}.app.runonflux.io`;
    const gamePort = server?.ports?.[0] || server?.compose?.[0]?.ports?.[0] || 8211;
    const fetchStatus = () => {
      fetch(`/api/${endpoint}/${queryHost}?port=${gamePort}`)
        .then(r => r.json())
        .then(data => setLivePalworld({ ...data, lastCheck: new Date().toISOString() }))
        .catch(() => {});
    };
    fetchStatus();
    const id = setInterval(fetchStatus, 30000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterLocation, server?.domainReady, server?.name]);

  // Get container name for stats
  const containerName = server?.version >= 4 && server?.compose?.length > 0
    ? `${server.compose[0].name}_${server.name}`
    : server?.name;
  const componentName = server?.version >= 4 && server?.compose?.length > 0
    ? server.compose[0].name
    : 'null';

  // Latency measured from this browser to the node running the game — the customer's own
  // network path, which is what they mean when they ask about ping. Only the live instance is
  // worth timing: the standby ones are not carrying the game, and on a stopped container the
  // number would describe a machine the player never touches.
  const [nodeHost, nodePort = 16127] = (masterLocation?.ip || '').split(':');
  const { latency: clientLatency, measuring: measuringLatency } = useClientLatency(
    nodeHost || null,
    nodePort,
    { enabled: masterLive && server?.status === 'running' },
  );

  // The real in-game ping: the Palworld REST API reports a `ping` per connected player,
  // measured by the game server itself. Nothing we probe from outside can beat it — but it
  // only exists while someone is playing, and only if the server has an Admin Password.
  const [playerPing, setPlayerPing] = useState(null);
  useEffect(() => {
    if (!masterLocation || server?.status !== 'running') { setPlayerPing(null); return undefined; }

    let cancelled = false;
    let timer = null;
    const host = masterLocation.ip.split(':')[0];
    const port = restApiPort(server);

    const poll = async (password) => {
      try {
        const res = await fetch(`/api/palworld-rest/${host}/players?port=${port}&password=${encodeURIComponent(password)}`);
        if (!res.ok || cancelled) return;

        const data = await res.json();
        const pings = (data.players || [])
          .map((p) => Number(p.ping))
          .filter((n) => Number.isFinite(n) && n > 0);
        if (cancelled) return;

        setPlayerPing(pings.length > 0
          ? {
            avg: Math.round(pings.reduce((sum, n) => sum + n, 0) / pings.length),
            worst: Math.round(Math.max(...pings)),
            count: pings.length,
          }
          : null);
      } catch { /* a failed poll keeps the last known value */ }
    };

    // The password is read once, not on every tick: it means downloading the config file from
    // the node, and a server without an Admin Password would otherwise re-download it forever
    // to learn the same nothing. No password simply means no in-game ping to show.
    (async () => {
      const password = await loadAdminPasswordFromConfig(server, masterLocation, componentName)
        .catch(() => null);
      if (!password || cancelled) return;
      await poll(password);
      if (cancelled) return;
      timer = setInterval(() => poll(password), 30000);
    })();

    return () => { cancelled = true; if (timer) clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterLocation, server?.status, server?.name]);

  return (
    <div className="p-4 space-y-3">
      {/* Server Info */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9))', border: '1px solid rgba(51,65,85,0.5)' }}>
        <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(51,65,85,0.3)' }}>
          <div className="p-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.15)' }}>
            <Database className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Server Information</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Name" value={<span className="break-all">{server.name}</span>} />
            <InfoRow
              label="Expires"
              value={
                server.expiresAt ? (
                  <span className={getExpirationClass(server.expiresAt)}>
                    {formatExpiration(server.expiresAt)}
                  </span>
                ) : '-'
              }
            />
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Hardware</div>
              <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)' }}>
                  <MdSpeed className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-blue-300">{server.cpu} vCores</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
                  <MdMemory className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-purple-300">{server.ram >= 1000 ? `${(server.ram / 1000).toFixed(server.ram % 1000 === 0 ? 0 : 1)} GB` : `${server.ram} MB`} RAM</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)' }}>
                  <MdStorage className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-cyan-300">{server.hdd} GB SSD</span>
                </div>
              </div>
            </div>
            <InfoRow label="Connect Address" value={`${server.name.toLowerCase()}.app.runonflux.io:${server?.ports?.[0] || server?.compose?.[0]?.ports?.[0] || 8211}`} copyText={`${server.name.toLowerCase()}.app.runonflux.io:${server?.ports?.[0] || server?.compose?.[0]?.ports?.[0] || 8211}`} />
          </div>
        </div>
      </div>

      {/* Hardware Usage Stats */}
      {server.locations?.length > 0 && containerName && masterLocation && (
        <ServerStats
          server={server}
          masterLocation={masterLocation}
          containerName={containerName}
          refreshKey={statsRefreshKey}
        />
      )}

      {/* Palworld Server Status */}
      {server.status === 'running' && (server.palworldOnline !== undefined || livePalworld) && (() => {
        const mcOnline = livePalworld ? livePalworld.online : server.palworldOnline;
        return (
          <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9))', border: '1px solid rgba(51,65,85,0.5)' }}>
            <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(51,65,85,0.3)' }}>
              <div className="p-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.15)' }}>
                <Server className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Palworld Server Status</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
              <div className="rounded-lg px-3 py-2.5 text-center" style={{ background: 'rgba(15,23,42,0.5)' }}>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Status</div>
                <div className={`text-sm font-bold flex items-center justify-center gap-1.5 ${mcOnline ? 'text-emerald-400' : 'text-red-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${mcOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  {mcOnline ? 'Online' : 'Offline'}
                </div>
              </div>
              <div className="rounded-lg px-3 py-2.5 text-center" style={{ background: 'rgba(15,23,42,0.5)' }} title={LATENCY_TOOLTIP}>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Your Latency</div>
                <div className={`text-sm font-bold ${clientLatency ? latencyClass(clientLatency) : 'text-slate-500'}`}>
                  {clientLatency ? `${clientLatency}ms` : measuringLatency ? 'Measuring...' : '-'}
                </div>
              </div>
              <div
                className="rounded-lg px-3 py-2.5 text-center"
                style={{ background: 'rgba(15,23,42,0.5)' }}
                title={playerPing
                  ? `Reported by the game server for ${playerPing.count} connected player${playerPing.count === 1 ? '' : 's'} (worst: ${playerPing.worst}ms).`
                  : 'The exact ping the game server measures for connected players. Needs someone online and an Admin Password set.'}
              >
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">In-Game Ping</div>
                <div className={`text-sm font-bold ${playerPing ? latencyClass(playerPing.avg) : 'text-slate-500'}`}>
                  {playerPing ? `${playerPing.avg}ms` : '-'}
                </div>
              </div>
              <div className="rounded-lg px-3 py-2.5 text-center" style={{ background: 'rgba(15,23,42,0.5)' }}>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Version</div>
                <div className="text-sm font-bold text-slate-400">Latest</div>
              </div>
            </div>
            <div className="px-4 py-2 text-xs text-slate-600 space-y-1" style={{ borderTop: '1px solid rgba(51,65,85,0.2)' }}>
              <div>
                Your latency is measured from this browser to the node hosting your server, so it
                reflects your own connection. In-game ping comes from the game server itself and
                shows while players are online — see Remote Control for the per-player figures.
              </div>
              {(livePalworld?.lastCheck || server.palworldLastCheck) && (
                <div>Last checked: {new Date(livePalworld?.lastCheck || server.palworldLastCheck).toLocaleString()}</div>
              )}
            </div>
          </div>
        );
      })()}

    </div>
  );
};

// Configuration Tab - Edit PalWorldSettings.ini
const CONFIG_PATH = 'appdata/Config/LinuxServer/PalWorldSettings.ini';

const PALWORLD_SETTINGS = [
  // --- Server ---
  { key: '_section_server', type: 'section', label: 'Server', icon: Server },
  { key: 'ServerName', label: 'Server Name', type: 'text', default: 'Default Palworld Server', description: 'Name shown to players' },
  { key: 'ServerDescription', label: 'Description', type: 'text', default: '', description: 'Server description' },
  { key: 'ServerPassword', label: 'Server Password', type: 'password', default: '', description: 'Password to join (empty = no password)' },
  { key: 'AdminPassword', label: 'Admin Password', type: 'password', default: '', description: 'Password for REST API access (Remote Control tab)' },
  { key: 'ServerPlayerMaxNum', label: 'Max Players', type: 'number', default: '32', description: 'Maximum players allowed' },
  { key: 'CoopPlayerMaxNum', label: 'Co-op Max Players', type: 'number', default: '4', description: 'Max players in co-op session' },
  { key: 'GuildPlayerMaxNum', label: 'Guild Max Players', type: 'number', default: '20', description: 'Max players per guild' },
  { key: 'Region', label: 'Region', type: 'text', default: '', description: 'Server region tag' },
  { key: 'bUseAuth', label: 'Verify Players', type: 'toggle', default: 'True', description: 'Verify player accounts with Steam/Xbox. Disable to allow unverified clients' },
  { key: 'bIsMultiplay', label: 'Multiplayer', type: 'toggle', default: 'False', description: 'Enable multiplayer mode' },
  // --- Gameplay ---
  { key: '_section_gameplay', type: 'section', label: 'Gameplay', icon: Gamepad2 },
  { key: 'Difficulty', label: 'Difficulty', type: 'select', default: 'None', options: ['None', 'Easy', 'Normal', 'Hard'], description: 'Game difficulty' },
  { key: 'bIsPvP', label: 'PvP', type: 'toggle', default: 'False', description: 'Enable player vs player combat' },
  { key: 'bHardcore', label: 'Hardcore', type: 'toggle', default: 'False', description: 'Permanent death mode' },
  { key: 'bCharacterRecreateInHardcore', label: 'Recreate in Hardcore', type: 'toggle', default: 'False', description: 'Allow character recreation in hardcore' },
  { key: 'bPalLost', label: 'Pal Lost on Death', type: 'toggle', default: 'False', description: 'Lose Pals on death' },
  { key: 'DeathPenalty', label: 'Death Penalty', type: 'select', default: 'All', options: ['None', 'Item', 'ItemAndEquipment', 'All'], description: 'What drops on death' },
  { key: 'bEnablePlayerToPlayerDamage', label: 'Player Damage', type: 'toggle', default: 'False', description: 'Players can damage each other' },
  { key: 'bEnableFriendlyFire', label: 'Friendly Fire', type: 'toggle', default: 'False', description: 'Allow friendly fire' },
  { key: 'bEnableInvaderEnemy', label: 'Base Raids', type: 'toggle', default: 'True', description: 'Enable enemy raids on bases' },
  { key: 'bEnableFastTravel', label: 'Fast Travel', type: 'toggle', default: 'True', description: 'Allow fast travel' },
  { key: 'bIsStartLocationSelectByMap', label: 'Spawn Select by Map', type: 'toggle', default: 'True', description: 'Allow choosing start location' },
  { key: 'bExistPlayerAfterLogout', label: 'Player Exists After Logout', type: 'toggle', default: 'False', description: 'Player body stays after logout' },
  { key: 'bEnableNonLoginPenalty', label: 'Non-Login Penalty', type: 'toggle', default: 'True', description: 'Penalize not logging in' },
  { key: 'bCanPickupOtherGuildDeathPenaltyDrop', label: 'Pickup Other Guild Drops', type: 'toggle', default: 'False', description: 'Pick up other guild death drops' },
  { key: 'bAllowGlobalPalboxExport', label: 'Palbox Export', type: 'toggle', default: 'True', description: 'Allow global Palbox export' },
  { key: 'bAllowGlobalPalboxImport', label: 'Palbox Import', type: 'toggle', default: 'False', description: 'Allow global Palbox import' },
  { key: 'EnablePredatorBossPal', label: 'Predator Boss Pal', type: 'toggle', default: 'True', description: 'Enable predator boss Pals' },
  // --- Rates ---
  { key: '_section_rates', type: 'section', label: 'Rates & Multipliers', icon: TrendingUp },
  { key: 'DayTimeSpeedRate', label: 'Day Speed', type: 'number', default: '1.000000', step: '0.1', description: 'Day time speed multiplier' },
  { key: 'NightTimeSpeedRate', label: 'Night Speed', type: 'number', default: '1.000000', step: '0.1', description: 'Night time speed multiplier' },
  { key: 'ExpRate', label: 'XP Rate', type: 'number', default: '1.000000', step: '0.1', description: 'Experience gain multiplier' },
  { key: 'PalCaptureRate', label: 'Capture Rate', type: 'number', default: '1.000000', step: '0.1', description: 'Pal capture success multiplier' },
  { key: 'PalSpawnNumRate', label: 'Pal Spawn Rate', type: 'number', default: '1.000000', step: '0.1', description: 'Pal spawn frequency multiplier' },
  { key: 'PalDamageRateAttack', label: 'Pal Attack Damage', type: 'number', default: '1.000000', step: '0.1', description: 'Pal attack damage multiplier' },
  { key: 'PalDamageRateDefense', label: 'Pal Defense', type: 'number', default: '1.000000', step: '0.1', description: 'Pal defense multiplier' },
  { key: 'PlayerDamageRateAttack', label: 'Player Attack Damage', type: 'number', default: '1.000000', step: '0.1', description: 'Player attack damage multiplier' },
  { key: 'PlayerDamageRateDefense', label: 'Player Defense', type: 'number', default: '1.000000', step: '0.1', description: 'Player defense multiplier' },
  { key: 'PlayerStomachDecreaceRate', label: 'Player Hunger Rate', type: 'number', default: '1.000000', step: '0.1', description: 'Player hunger drain speed' },
  { key: 'PlayerStaminaDecreaceRate', label: 'Player Stamina Rate', type: 'number', default: '1.000000', step: '0.1', description: 'Player stamina drain speed' },
  { key: 'PlayerAutoHPRegeneRate', label: 'Player HP Regen', type: 'number', default: '1.000000', step: '0.1', description: 'Player HP regeneration rate' },
  { key: 'PlayerAutoHpRegeneRateInSleep', label: 'Player Sleep HP Regen', type: 'number', default: '1.000000', step: '0.1', description: 'Player HP regen while sleeping' },
  { key: 'PalStomachDecreaceRate', label: 'Pal Hunger Rate', type: 'number', default: '1.000000', step: '0.1', description: 'Pal hunger drain speed' },
  { key: 'PalStaminaDecreaceRate', label: 'Pal Stamina Rate', type: 'number', default: '1.000000', step: '0.1', description: 'Pal stamina drain speed' },
  { key: 'PalAutoHPRegeneRate', label: 'Pal HP Regen', type: 'number', default: '1.000000', step: '0.1', description: 'Pal HP regeneration rate' },
  { key: 'PalAutoHpRegeneRateInSleep', label: 'Pal Sleep HP Regen', type: 'number', default: '1.000000', step: '0.1', description: 'Pal HP regen while sleeping' },
  { key: 'CollectionDropRate', label: 'Collection Drop Rate', type: 'number', default: '1.000000', step: '0.1', description: 'Resource collection drop multiplier' },
  { key: 'CollectionObjectHpRate', label: 'Collection Object HP', type: 'number', default: '1.000000', step: '0.1', description: 'Resource object HP multiplier' },
  { key: 'CollectionObjectRespawnSpeedRate', label: 'Collection Respawn', type: 'number', default: '1.000000', step: '0.1', description: 'Resource respawn speed' },
  { key: 'EnemyDropItemRate', label: 'Enemy Drop Rate', type: 'number', default: '1.000000', step: '0.1', description: 'Enemy item drop multiplier' },
  { key: 'ItemWeightRate', label: 'Item Weight', type: 'number', default: '1.000000', step: '0.1', description: 'Item weight multiplier' },
  { key: 'WorkSpeedRate', label: 'Work Speed', type: 'number', default: '1.000000', step: '0.1', description: 'Pal work speed multiplier' },
  { key: 'EquipmentDurabilityDamageRate', label: 'Equipment Durability', type: 'number', default: '1.000000', step: '0.1', description: 'Equipment durability loss rate' },
  { key: 'ItemCorruptionMultiplier', label: 'Item Corruption', type: 'number', default: '1.000000', step: '0.1', description: 'Item corruption multiplier' },
  // --- Building ---
  { key: '_section_building', type: 'section', label: 'Building & Base', icon: Hammer },
  { key: 'BuildObjectHpRate', label: 'Build HP', type: 'number', default: '1.000000', step: '0.1', description: 'Building HP multiplier' },
  { key: 'BuildObjectDamageRate', label: 'Build Damage', type: 'number', default: '1.000000', step: '0.1', description: 'Building damage multiplier' },
  { key: 'BuildObjectDeteriorationDamageRate', label: 'Build Deterioration', type: 'number', default: '1.000000', step: '0.1', description: 'Building deterioration rate' },
  { key: 'bBuildAreaLimit', label: 'Build Area Limit', type: 'toggle', default: 'False', description: 'Limit building area' },
  { key: 'MaxBuildingLimitNum', label: 'Max Buildings', type: 'number', default: '0', description: 'Max buildings (0 = unlimited)' },
  { key: 'BaseCampMaxNum', label: 'Max Base Camps', type: 'number', default: '128', description: 'Maximum base camps' },
  { key: 'BaseCampMaxNumInGuild', label: 'Guild Base Camps', type: 'number', default: '4', description: 'Max base camps per guild' },
  { key: 'BaseCampWorkerMaxNum', label: 'Max Base Workers', type: 'number', default: '15', description: 'Max Pal workers at base' },
  // --- World ---
  { key: '_section_world', type: 'section', label: 'World', icon: MapPin },
  { key: 'DropItemMaxNum', label: 'Max Dropped Items', type: 'number', default: '3000', description: 'Maximum dropped items in world' },
  { key: 'DropItemAliveMaxHours', label: 'Drop Item Hours', type: 'number', default: '1.000000', step: '0.5', description: 'Hours dropped items persist' },
  { key: 'PalEggDefaultHatchingTime', label: 'Egg Hatch Time', type: 'number', default: '72.000000', step: '1', description: 'Default egg hatching time (hours)' },
  { key: 'AutoSaveSpan', label: 'Auto Save Interval', type: 'number', default: '30.000000', step: '5', description: 'Auto save interval (seconds)' },
  { key: 'bIsUseBackupSaveData', label: 'Backup Save Data', type: 'toggle', default: 'True', description: 'Enable backup save data' },
  { key: 'SupplyDropSpan', label: 'Supply Drop Interval', type: 'number', default: '180', description: 'Supply drop interval (seconds)' },
  { key: 'bEnableDefenseOtherGuildPlayer', label: 'Defense Other Guild', type: 'toggle', default: 'False', description: 'Defend against other guild players' },
  { key: 'bAutoResetGuildNoOnlinePlayers', label: 'Auto Reset Empty Guilds', type: 'toggle', default: 'False', description: 'Reset guilds with no online players' },
  { key: 'AutoResetGuildTimeNoOnlinePlayers', label: 'Reset Guild Hours', type: 'number', default: '72.000000', step: '1', description: 'Hours before guild reset' },
  // --- Aim & Controls ---
  { key: '_section_controls', type: 'section', label: 'Controls', icon: SlidersHorizontal },
  { key: 'bEnableAimAssistPad', label: 'Aim Assist (Controller)', type: 'toggle', default: 'True', description: 'Aim assist for controllers' },
  { key: 'bEnableAimAssistKeyboard', label: 'Aim Assist (Keyboard)', type: 'toggle', default: 'False', description: 'Aim assist for keyboard' },
  { key: 'ChatPostLimitPerMinute', label: 'Chat Limit/Min', type: 'number', default: '10', description: 'Chat messages per minute limit' },
  { key: 'bShowPlayerList', label: 'Show Player List', type: 'toggle', default: 'True', description: 'Show player list to all' },
  // --- Admin ---
  { key: '_section_admin', type: 'section', label: 'Admin & API', icon: ShieldCheck },
  { key: 'RESTAPIEnabled', label: 'REST API', type: 'toggle', default: 'true', description: 'Enable REST API on port 8212. Required — the health check pings it; if off (or no Admin Password), the server restart-loops. Also powers the Remote Control tab.' },
  { key: 'ServerReplicatePawnCullDistance', label: 'Pawn Cull Distance', type: 'number', default: '15000.000000', step: '1000', description: 'Network pawn cull distance' },
  { key: 'CrossplayPlatforms', label: 'Crossplay Platforms', type: 'multicheck', default: 'Steam,Xbox,PS5,Mac', options: ['Steam', 'Xbox', 'PS5', 'Mac'], description: 'Allowed crossplay platforms', paren: true },
  { key: 'BanListURL', label: 'Ban List URL', type: 'text', default: 'https://api.palworldgame.com/api/banlist.txt', description: 'URL for ban list' },
];

function parseIniSettings(content) {
  const settings = {};
  // Find OptionSettings=(...) block
  const match = content.match(/OptionSettings=\((.+)\)/);
  if (!match) return settings;
  const pairs = match[1];
  // Parse key=value pairs (handles quoted strings and nested parens)
  const regex = /(\w+)=("([^"]*)"|([^,()]+)|\(([^)]*)\))/g;
  let m;
  while ((m = regex.exec(pairs)) !== null) {
    settings[m[1]] = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[5]);
  }
  return settings;
}

/**
 * Read AdminPassword out of the server's PalWorldSettings.ini. Both Remote Control and the
 * Overview tab (for the in-game ping) need it, and neither can ask the customer: the password
 * is generated at deploy time and only ever lives in the config file on the node.
 * Returns null whenever it cannot be read — no password is a normal state, not an error.
 */
async function loadAdminPasswordFromConfig(server, masterLocation, component) {
  if (!masterLocation) return null;
  const zelidauth = await secureStorage.getItem('zelidauth');
  if (!zelidauth) return null;

  const [host, port = 16127] = masterLocation.ip.split(':');
  const apiUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/apps/downloadfile/${server.name}/${component}/${encodeURIComponent(CONFIG_PATH)}`;
  const response = await fetch(apiUrl, {
    headers: { zelidauth: JSON.stringify(zelidauth) },
  });
  if (!response.ok) return null;

  const parsed = parseIniSettings(await response.text());
  return parsed.AdminPassword?.trim() || null;
}

/** External REST port (index 2 = the 8212 slot); randomized deploys expose a high port. */
function restApiPort(server) {
  return server?.ports?.[2] || server?.compose?.[0]?.ports?.[2] || 8212;
}

function buildIniContent(settings, originalContent) {
  const match = originalContent.match(/OptionSettings=\((.+)\)/);
  if (!match) return originalContent;
  let pairs = match[1];

  // Detect which keys were originally quoted
  const quotedKeys = new Set();
  const detectRegex = /(\w+)="[^"]*"/g;
  let dm;
  while ((dm = detectRegex.exec(match[1])) !== null) {
    quotedKeys.add(dm[1]);
  }

  for (const [key, value] of Object.entries(settings)) {
    const keyRegex = new RegExp(`(${key})=("[^"]*"|[^,()]+|\\([^)]*\\))`);
    if (keyRegex.test(pairs)) {
      const settingDef = PALWORLD_SETTINGS.find(s => s.key === key);
      let formatted;
      if (settingDef?.paren) {
        formatted = `(${value})`;
      } else if (quotedKeys.has(key)) {
        // Preserve quotes for fields that were originally quoted
        formatted = `"${value}"`;
      } else {
        formatted = value;
      }
      pairs = pairs.replace(keyRegex, `$1=${formatted}`);
    }
  }
  return originalContent.replace(/OptionSettings=\(.+\)/, `OptionSettings=(${pairs})`);
}

const ConfigTab = ({ server, masterLocation, onMasterError }) => {
  const [settings, setSettings] = useState({});
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState(''); // 'stopping', 'writing', 'starting', ''
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedContent, setAdvancedContent] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [expandedSections, setExpandedSections] = useState({ _section_server: true });
  const originalSettings = useRef({});

  const selectedComponent = server?.version >= 4 && server?.compose?.length > 0
    ? server.compose[0].name
    : 'null';

  // Stamped onto PublicPort on every save — see buildFrom in saveConfig.
  const gamePort = externalGamePort(server);

  // Load config file
  useEffect(() => {
    const loadConfig = async () => {
      if (!masterLocation) return;
      setLoading(true);
      setError(null);
      try {
        const zelidauth = await secureStorage.getItem('zelidauth');
        if (!zelidauth) throw new Error('Not authenticated');
        const [host, port = 16127] = masterLocation.ip.split(':');
        const apiUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/apps/downloadfile/${server.name}/${selectedComponent}/${encodeURIComponent(CONFIG_PATH)}`;
        const response = await fetch(apiUrl, {
          headers: { zelidauth: JSON.stringify(zelidauth) },
        });
        if (!response.ok) throw new Error('Failed to load config file');
        const text = await response.text();
        setOriginalContent(text);
        // Format for readability: one setting per line (preserve commas inside parens/quotes)
        const formatted = text.replace(/OptionSettings=\((.+)\)/, (_, inner) => {
          const lines = [];
          let depth = 0;
          let inQuote = false;
          let current = '';
          for (let i = 0; i < inner.length; i++) {
            const ch = inner[i];
            if (ch === '"') inQuote = !inQuote;
            if (!inQuote && ch === '(') depth++;
            if (!inQuote && ch === ')') depth--;
            if (ch === ',' && depth === 0 && !inQuote) {
              lines.push(current + ',');
              current = '';
            } else {
              current += ch;
            }
          }
          if (current) lines.push(current);
          return 'OptionSettings=(\n' + lines.join('\n') + '\n)';
        });
        setAdvancedContent(formatted);
        const parsed = parseIniSettings(text);
        setSettings(parsed);
        originalSettings.current = { ...parsed };
      } catch (err) {
        if (err instanceof TypeError) onMasterError();
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterLocation, server.name]);

  const updateSetting = (key, value) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      setHasChanges(JSON.stringify(updated) !== JSON.stringify(originalSettings.current));
      return updated;
    });
  };

  const saveConfig = async () => {
    if (!masterLocation) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    const nodeBase = nodeApiBase(masterLocation.ip);

    try {
      const zelidauth = await secureStorage.getItem('zelidauth');
      if (!zelidauth) throw new Error('Not authenticated');
      const authHeader = JSON.stringify(zelidauth);

      // Build against `base` (the ini as it exists on disk) and stamp the port.
      //
      // The stamp is not belt-and-braces: `settings` comes from parseIniSettings, which
      // parses EVERY key in the file — PublicPort included — and buildIniContent writes
      // every one of them back. So a save doesn't merely carry the editor's snapshot along,
      // it actively writes that snapshot's PublicPort over whatever is on disk, undoing the
      // reconcile above. PublicPort is not a user setting: it must equal the external port
      // Flux registered, or the community browser advertises an address nothing listens on.
      const buildFrom = (base) => {
        const built = showAdvanced
          ? advancedContent.replace(/OptionSettings=\(\n([\s\S]+?)\n\)/, (_, inner) => {
            return 'OptionSettings=(' + inner.split('\n').map(l => l.trim()).filter(Boolean).join('') + ')';
          })
          : buildIniContent(settings, base);
        return gamePort ? patchPublicPort(built, String(gamePort)) : built;
      };

      // Build once up front — a formatting error must never cost the user a stopped server.
      // This copy is only the validation probe; the one actually written is rebuilt below.
      let content = buildFrom(originalContent);

      const uploadPath = encodeURIComponent('appdata/Config/LinuxServer');
      const uploadUrl = `${nodeBase}/ioutils/fileupload/volume/${server.name}/${selectedComponent}/${uploadPath}`;

      // Write with the container stopped so the running game can't overwrite the file on
      // shutdown. withAppStopped restarts it no matter how the upload ends — a throw here
      // used to skip the start entirely and leave the app `exited`.
      const { wasRunning, startState } = await withAppStopped(
        nodeBase,
        server.name,
        authHeader,
        async () => {
          // Rebuild on the file as it is with the container down. The editor's snapshot was
          // taken when the panel opened; the port reconcile, another tab, or Palworld's own
          // flush on shutdown may have rewritten it since, and keys the snapshot never had
          // (a game update adding settings) would be dropped by building on the stale copy.
          // Advanced mode is exempt: there the user is editing the whole file by hand, so
          // their text is the intent — only the port stamp still applies.
          if (!showAdvanced) {
            const fresh = await fetchIniText(nodeBase, server.name, selectedComponent, authHeader);
            if (fresh) content = buildFrom(fresh);
          }

          const blob = new Blob([content], { type: 'text/plain' });
          const formData = new FormData();
          formData.append('PalWorldSettings.ini', blob);

          const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: { zelidauth: authHeader },
            body: formData,
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `Upload failed: HTTP ${response.status}`);
          }
        },
        { onPhase: (phase) => setSavingStep(phase === 'working' ? 'writing' : phase) },
      );

      if (wasRunning && startState === 'stopped') {
        throw new Error('Config saved, but the server did not come back up. Use the Start button.');
      }
      // Wait for server to fully boot (skipped when it was already stopped before saving)
      if (wasRunning) await new Promise(r => setTimeout(r, 30000));

      setOriginalContent(content);
      originalSettings.current = { ...settings };
      setHasChanges(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      if (err instanceof TypeError) onMasterError();
      // `startState` is set by withAppStopped even when the write failed — say so, so a
      // server that couldn't be brought back doesn't look like a plain save error.
      const downHint = err.startState === 'stopped'
        ? ' The server is stopped — use the Start button to bring it back.'
        : '';
      setError(err.name === 'AppBusyError'
        ? 'Another operation is running on this server — try again in a moment.'
        : `${err.message}${downHint}`);
    } finally {
      setSaving(false);
      setSavingStep('');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400 animate-spin" style={{ animationDuration: '1.2s' }} />
          <Settings className="absolute inset-0 m-auto w-8 h-8 text-blue-400/60" />
        </div>
        <div className="text-center">
          <p className="text-base font-medium text-slate-300">Loading settings</p>
          <p className="text-sm text-slate-600 mt-1">Please wait...</p>
        </div>
      </div>
    );
  }

  const switchToAdvanced = () => {
    const built = buildIniContent(settings, originalContent);
    const formatted = built.replace(/OptionSettings=\((.+)\)/, (_, inner) => {
      const lines = [];
      let depth = 0, inQuote = false, current = '';
      for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (ch === '"') inQuote = !inQuote;
        if (!inQuote && ch === '(') depth++;
        if (!inQuote && ch === ')') depth--;
        if (ch === ',' && depth === 0 && !inQuote) {
          lines.push(current + ',');
          current = '';
        } else {
          current += ch;
        }
      }
      if (current) lines.push(current);
      return 'OptionSettings=(\n' + lines.join('\n') + '\n)';
    });
    setAdvancedContent(formatted);
    setShowAdvanced(true);
  };

  return (
    <div className="p-4 space-y-3">
      {/* Notifications */}
      {error && (
        <div className="rounded-xl p-3 text-sm flex items-center gap-2 animate-fade-in" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl p-3 text-sm flex items-center gap-2 animate-fade-in" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}>
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Configuration saved. Stop server before saving to persist changes.
        </div>
      )}

      {/* Header */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9))', border: '1px solid rgba(51,65,85,0.5)' }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.15)' }}>
              <Settings className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{showAdvanced ? 'Advanced Editor' : 'Server Settings'}</h3>
              <p className="text-[11px] text-slate-500">PalWorldSettings.ini</p>
            </div>
          </div>
          <button
            onClick={() => showAdvanced ? setShowAdvanced(false) : switchToAdvanced()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)'; }}
          >
            {showAdvanced ? 'Simple Mode' : 'Advanced Edit'}
          </button>
        </div>

        {/* REST API health warning — the server's healthcheck pings the REST API (port 8212).
            If it isn't reachable the app is marked unhealthy and restart-loops (re-downloading
            the game each time). It needs BOTH RESTAPIEnabled=On AND an AdminPassword — and
            those live in different sections, which is easy to miss. */}
        {!loading && (() => {
          const hasPw = settings.AdminPassword && settings.AdminPassword.trim();
          const restOn = String(settings.RESTAPIEnabled).toLowerCase() === 'true';
          if (hasPw && restOn) return null;
          return (
            <div className="px-4 py-3 flex items-start gap-3" style={{ background: 'rgba(234,179,8,0.06)', borderTop: '1px solid rgba(234,179,8,0.15)' }}>
              <AlertTriangle className="w-5 h-5 text-yellow-500/90 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-yellow-400">Enable the REST API — required</p>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Your server&apos;s health check pings the REST API (port 8212). If it isn&apos;t reachable,
                  the server is marked unhealthy and <strong>restarts repeatedly</strong> (re-downloading
                  the game every time). You need <span className="font-mono text-yellow-300">REST API = On</span>{' '}
                  <em>and</em> an <span className="font-mono text-yellow-300">Admin Password</span> — they&apos;re in
                  different sections below.
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {!restOn && (
                    <button
                      type="button"
                      onClick={() => { updateSetting('RESTAPIEnabled', 'true'); setExpandedSections(p => ({ ...p, _section_admin: true })); }}
                      className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-yellow-500/15 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/25 transition-colors cursor-pointer"
                    >
                      Enable REST API
                    </button>
                  )}
                  {!hasPw && (
                    <button
                      type="button"
                      onClick={() => setExpandedSections(p => ({ ...p, _section_server: true }))}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-300 border border-slate-600/60 bg-slate-700/40 hover:bg-slate-600/50 transition-colors cursor-pointer"
                    >
                      Set Admin Password
                    </button>
                  )}
                  <span className="text-[11px] text-slate-500">then Save to apply.</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {showAdvanced ? (
        /* Advanced Editor */
        <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9))', border: '1px solid rgba(51,65,85,0.5)' }}>
          <textarea
            value={advancedContent}
            onChange={(e) => { setAdvancedContent(e.target.value); setHasChanges(true); }}
            className="w-full h-96 bg-transparent p-4 text-sm font-mono text-slate-300 focus:outline-none resize-y"
            style={{ caretColor: '#60a5fa' }}
            spellCheck={false}
          />
        </div>
      ) : (
        /* Settings List */
        <div className="space-y-3">
          {(() => {
            // Group settings by section
            const sections = [];
            let currentSection = null;
            PALWORLD_SETTINGS.forEach(s => {
              if (s.type === 'section') {
                currentSection = { ...s, items: [] };
                sections.push(currentSection);
              } else if (currentSection) {
                currentSection.items.push(s);
              }
            });

            return sections.map(section => {
              const SectionIcon = section.icon;
              const isExpanded = expandedSections[section.key] ?? false;
              return (
                <div key={section.key} className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9))', border: '1px solid rgba(51,65,85,0.5)' }}>
                  {/* Section Header — clickable */}
                  <button
                    onClick={() => setExpandedSections(prev => ({ ...prev, [section.key]: !prev[section.key] }))}
                    className="w-full px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-700/20 transition-colors"
                    style={{ borderBottom: isExpanded ? '1px solid rgba(51,65,85,0.3)' : 'none' }}
                  >
                    <div className="flex items-center gap-2.5">
                      {SectionIcon && <SectionIcon className="w-4 h-4 text-blue-400" />}
                      <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-widest">{section.label}</h4>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>{section.items.length}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>
                  {/* Settings rows — collapsible */}
                  {isExpanded && <div className="divide-y" style={{ borderColor: 'rgba(51,65,85,0.2)' }}>
                    {section.items.map(setting => {
                      const value = settings[setting.key] ?? setting.default;
                      return (
                        <div key={setting.key} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-800/30 transition-colors" style={{ borderColor: 'rgba(51,65,85,0.2)' }}>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-200">{setting.label}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{setting.description}</div>
                          </div>
                          <div className="flex-shrink-0">
                            {setting.type === 'toggle' ? (
                              <button
                                onClick={() => {
                                  const current = String(value).toLowerCase();
                                  updateSetting(setting.key, current === 'true' ? 'False' : 'True');
                                }}
                                className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200"
                                style={{
                                  background: String(value).toLowerCase() === 'true'
                                    ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                                    : 'rgba(51,65,85,0.5)',
                                  boxShadow: String(value).toLowerCase() === 'true' ? '0 0 12px rgba(59,130,246,0.3)' : 'none',
                                }}
                              >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 mt-0.5 ml-0.5 ${
                                  String(value).toLowerCase() === 'true' ? 'translate-x-5' : 'translate-x-0'
                                }`} />
                              </button>
                            ) : setting.type === 'select' ? (
                              <select
                                value={value}
                                onChange={(e) => updateSetting(setting.key, e.target.value)}
                                className="rounded-lg px-3 py-1.5 text-sm text-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                                style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.5)' }}
                              >
                                {setting.options.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : setting.type === 'multicheck' ? (
                              <div className="flex flex-wrap gap-1.5">
                                {setting.options.map(opt => {
                                  const selected = String(value).split(',').map(s => s.trim()).includes(opt);
                                  return (
                                    <button
                                      key={opt}
                                      onClick={() => {
                                        const current = String(value).split(',').map(s => s.trim()).filter(Boolean);
                                        const updated = selected ? current.filter(s => s !== opt) : [...current, opt];
                                        updateSetting(setting.key, updated.join(','));
                                      }}
                                      className="px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer"
                                      style={{
                                        background: selected ? 'rgba(59,130,246,0.15)' : 'rgba(15,23,42,0.5)',
                                        border: `1px solid ${selected ? 'rgba(59,130,246,0.4)' : 'rgba(51,65,85,0.4)'}`,
                                        color: selected ? '#60a5fa' : '#64748b',
                                      }}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : setting.type === 'password' ? (
                              <div className="relative">
                                <input
                                  type={visiblePasswords[setting.key] ? 'text' : 'password'}
                                  value={value}
                                  onChange={(e) => updateSetting(setting.key, e.target.value)}
                                  className="w-48 rounded-lg px-3 py-1.5 pr-9 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                                  style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.5)' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setVisiblePasswords(prev => ({ ...prev, [setting.key]: !prev[setting.key] }))}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
                                >
                                  {visiblePasswords[setting.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            ) : setting.type === 'number' ? (
                              <input
                                type="number"
                                value={value}
                                step={setting.step || '1'}
                                onChange={(e) => updateSetting(setting.key, e.target.value)}
                                className="w-24 rounded-lg px-3 py-1.5 text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                                style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.5)' }}
                              />
                            ) : (
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => updateSetting(setting.key, e.target.value)}
                                className="w-48 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                                style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.5)' }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={saveConfig}
        disabled={saving || !hasChanges}
        className="w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: hasChanges ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(59,130,246,0.15)',
          color: hasChanges ? '#ffffff' : '#60a5fa',
          boxShadow: hasChanges ? '0 4px 15px rgba(59,130,246,0.3)' : 'none',
          border: hasChanges ? 'none' : '1px solid rgba(59,130,246,0.2)',
        }}
      >
        {saving ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            {savingStep === 'stopping' ? 'Stopping server...' : savingStep === 'writing' ? 'Writing config...' : savingStep === 'starting' ? 'Starting server...' : 'Saving...'}
          </>
        ) : (
          <>
            <CheckCircle className="w-4 h-4" />
            Save & Restart
          </>
        )}
      </button>
    </div>
  );
};

// Remote Control Tab - Palworld REST API actions
const RemoteControlTab = ({ server, masterLocation }) => {
  const [adminPassword, setAdminPassword] = useState('');
  const [configLoading, setConfigLoading] = useState(true);
  const [configHasPassword, setConfigHasPassword] = useState(null); // null=loading, true/false
  const [connected, setConnected] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [unbanId, setUnbanId] = useState('');
  const [shutdownSeconds, setShutdownSeconds] = useState(30);
  const [shutdownMsg, setShutdownMsg] = useState('Server shutting down');
  const [showShutdownConfirm, setShowShutdownConfirm] = useState(false);
  const [showForceStopConfirm, setShowForceStopConfirm] = useState(false);
  const pollRef = useRef(null);

  const selectedComponent = server?.version >= 4 && server?.compose?.length > 0
    ? server.compose[0].name
    : 'null';

  // Auto-read AdminPassword from config file
  useEffect(() => {
    const loadPassword = async () => {
      if (!masterLocation) { setConfigLoading(false); return; }
      try {
        const password = await loadAdminPasswordFromConfig(server, masterLocation, selectedComponent);
        if (password) {
          setAdminPassword(password);
          setConfigHasPassword(true);
        } else {
          setConfigHasPassword(false);
        }
      } catch {
        setConfigHasPassword(false);
      } finally {
        setConfigLoading(false);
      }
    };
    loadPassword();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterLocation, server.name]);

  // Auto-connect when password is detected
  const autoConnectRef = useRef(false);
  useEffect(() => {
    if (configHasPassword && adminPassword && !connected && !autoConnectRef.current) {
      autoConnectRef.current = true;
      connect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configHasPassword, adminPassword]);

  const getHost = () => {
    if (!masterLocation) return null;
    return masterLocation.ip.split(':')[0];
  };

  const apiCall = async (endpoint, method = 'GET', body = null) => {
    const host = getHost();
    if (!host) throw new Error('No server IP available');
    const port = restApiPort(server);
    const url = method === 'GET'
      ? `/api/palworld-rest/${host}/${endpoint}?port=${port}&password=${encodeURIComponent(adminPassword)}`
      : `/api/palworld-rest/${host}/${endpoint}?port=${port}&password=${encodeURIComponent(adminPassword)}`;
    const options = { method };
    if (body && method === 'POST') {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetch(url, options);
    } catch {
      throw new Error('Unable to reach the server. Make sure the server is running.');
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error('Invalid admin password. Check AdminPassword in Server Settings.');
      if (response.status === 500) throw new Error('Server is starting up or REST API is not enabled. Try again in a moment.');
      throw new Error(data.error || `Connection failed (HTTP ${response.status})`);
    }
    return response.json();
  };

  const connect = async () => {
    if (!adminPassword) {
      setError('Admin password is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const info = await apiCall('info');
      setServerInfo(info);
      const m = await apiCall('metrics');
      setMetrics(m);
      const p = await apiCall('players');
      setPlayers(p.players || []);
      setConnected(true);
      setError(null);
    } catch (err) {
      setError(err.message);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = async () => {
    if (!connected) return;
    setIsRefreshing(true);
    try {
      const m = await apiCall('metrics');
      setMetrics(m);
      const p = await apiCall('players');
      setPlayers(p.players || []);
    } catch { /* a failed poll keeps the last known values — apiCall surfaces real errors */ } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // Auto-refresh every 15s when connected
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!connected) return;
    pollRef.current = setInterval(() => refreshRef.current(), 15000);
    return () => clearInterval(pollRef.current);
  }, [connected]);

  // Cleanup timers on unmount
  const actionTimersRef = useRef([]);
  useEffect(() => {
    const timers = actionTimersRef.current;
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const doAction = async (action, body = null) => {
    setActionResult(null);
    try {
      await apiCall(action, 'POST', body);
      setActionResult({ type: 'success', msg: `${action} executed successfully` });
      actionTimersRef.current.push(setTimeout(() => setActionResult(null), 3000));
      if (action === 'kick' || action === 'ban') refreshRef.current();
    } catch (err) {
      setActionResult({ type: 'error', msg: err.message });
      actionTimersRef.current.push(setTimeout(() => setActionResult(null), 5000));
    }
  };

  // Loading config
  if (configLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400 animate-spin" style={{ animationDuration: '1.2s' }} />
          <Globe className="absolute inset-0 m-auto w-8 h-8 text-blue-400/60" />
        </div>
        <div className="text-center">
          <p className="text-base font-medium text-slate-300">Connecting to server</p>
          <p className="text-sm text-slate-600 mt-1">Reading configuration...</p>
        </div>
      </div>
    );
  }

  // No password set — show info
  if (!connected && configHasPassword === false && !adminPassword) {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Admin Password Required</h3>
              <p className="text-xs text-gray-500">Remote Control requires an admin password to connect to the REST API.</p>
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 space-y-2">
            <p className="text-sm text-gray-300">
              Go to the <span className="text-blue-400 font-semibold">Config</span> tab and set an <span className="font-mono text-yellow-400">AdminPassword</span>, then restart the server.
            </p>
            <p className="text-xs text-gray-500">
              This password enables the REST API, allowing you to manage players, save world, broadcast messages, and more via the Remote Control tab.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Not connected — auto-connect or show password input
  if (!connected) {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Globe className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Remote Control</h3>
              <p className="text-xs text-gray-500">
                {configHasPassword
                  ? 'Admin password detected from config. Click connect to start.'
                  : 'Connect to your server\'s REST API to manage players, save world, and more.'}
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={connect}
            disabled={loading || !adminPassword}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Connecting...</>
            ) : (
              <><Globe className="w-4 h-4" /> Connect</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Format uptime
  const formatUptime = (seconds) => {
    if (!seconds) return '-';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Connected — show controls
  const fpsColor = (metrics?.serverfps ?? 0) >= 50 ? 'text-emerald-400' : (metrics?.serverfps ?? 0) >= 30 ? 'text-yellow-400' : 'text-red-400';
  const fpsBarWidth = Math.min(100, ((metrics?.serverfps ?? 0) / 60) * 100);
  const fpsBarColor = (metrics?.serverfps ?? 0) >= 50 ? 'bg-emerald-500' : (metrics?.serverfps ?? 0) >= 30 ? 'bg-yellow-500' : 'bg-red-500';
  const playerPercent = metrics?.maxplayernum ? ((metrics?.currentplayernum ?? 0) / metrics.maxplayernum) * 100 : 0;

  return (
    <div className="p-4 space-y-3">
      {actionResult && (
        <div className={`${actionResult.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'} border rounded-xl p-3 text-sm flex items-center gap-2 animate-fade-in`}>
          {actionResult.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {actionResult.msg}
        </div>
      )}

      {/* Server Status Header */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9))', border: '1px solid rgba(51,65,85,0.5)' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(51,65,85,0.3)' }}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-40" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white leading-none">{serverInfo?.servername || 'Palworld Server'}</h4>
              <span className="text-[11px] text-slate-500">{serverInfo?.version || ''}</span>
            </div>
          </div>
          <button onClick={refresh} disabled={isRefreshing} className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50" aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-slate-700/30">
          {/* Players */}
          <div className="px-3 py-3 text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Players</div>
            <div className="text-lg font-bold text-white leading-none">{metrics?.currentplayernum ?? 0}<span className="text-sm text-slate-600">/{metrics?.maxplayernum ?? 32}</span></div>
            <div className="mt-1.5 h-1 rounded-full bg-slate-700/50 overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${playerPercent}%` }} />
            </div>
          </div>
          {/* FPS */}
          <div className="px-3 py-3 text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">FPS</div>
            <div className={`text-lg font-bold leading-none ${fpsColor}`}>{metrics?.serverfps ?? '-'}</div>
            <div className="mt-1.5 h-1 rounded-full bg-slate-700/50 overflow-hidden">
              <div className={`h-full rounded-full ${fpsBarColor} transition-all duration-500`} style={{ width: `${fpsBarWidth}%` }} />
            </div>
          </div>
          {/* Uptime */}
          <div className="px-3 py-3 text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Uptime</div>
            <div className="text-lg font-bold text-white leading-none">{formatUptime(metrics?.uptime)}</div>
          </div>
          {/* Day */}
          <div className="px-3 py-3 text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Day</div>
            <div className="text-lg font-bold text-white leading-none">{metrics?.days ?? '-'}</div>
          </div>
          {/* Bases */}
          <div className="px-3 py-3 text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Bases</div>
            <div className="text-lg font-bold text-white leading-none">{metrics?.basecampnum ?? '-'}</div>
          </div>
          {/* Frame Time */}
          <div className="px-3 py-3 text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Frame</div>
            <div className="text-lg font-bold text-slate-300 leading-none">{metrics?.serverframetime ? `${metrics.serverframetime.toFixed(1)}` : '-'}<span className="text-xs text-slate-600">ms</span></div>
          </div>
        </div>
      </div>

      {/* Players & Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Players Panel */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9))', border: '1px solid rgba(51,65,85,0.5)' }}>
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(51,65,85,0.3)' }}>
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Players</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>{players.length} online</span>
          </div>
          <div className="p-3 min-h-[120px]">
            {players.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-slate-600">
                <Gamepad2 className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">No players online</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {players.map((player, i) => (
                  <div key={player.playerId || i} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-700/30 transition-colors group">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(139,92,246,0.3))', border: '1px solid rgba(59,130,246,0.3)' }}>
                        <span className="text-xs font-bold text-blue-300">{(player.name || '?')[0].toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">{player.name || 'Unknown'}</div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">{player.playerId || player.userId || ''}</div>
                      </div>
                      {/* The genuine in-game ping: the game server measures this itself, so it is
                          the same number the player sees in game. */}
                      {Number.isFinite(Number(player.ping)) && Number(player.ping) > 0 && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${latencyClass(Math.round(Number(player.ping)))}`}
                          style={{ background: 'rgba(15,23,42,0.6)' }}
                          title="Ping between this player and the server, reported by the game."
                        >
                          {Math.round(Number(player.ping))}ms
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => doAction('kick', { userid: player.userId, message: 'Kicked by admin' })}
                        className="p-1.5 rounded-lg hover:bg-yellow-500/20 text-yellow-400 transition-colors cursor-pointer"
                        aria-label="Kick player"
                        title="Kick"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => doAction('ban', { userid: player.userId, message: 'Banned by admin' })}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                        aria-label="Ban player"
                        title="Ban"
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Ban/Unban by ID */}
          <div className="px-3 pb-3">
            <div className="flex gap-1.5 items-center rounded-lg p-1" style={{ background: 'rgba(15,23,42,0.5)' }}>
              <input
                type="text"
                value={unbanId}
                onChange={(e) => setUnbanId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && unbanId && doAction('unban', { userid: unbanId }).then(() => setUnbanId(''))}
                placeholder="Enter User ID to ban or unban..."
                className="flex-1 bg-transparent px-2 py-1.5 text-xs text-white font-mono focus:outline-none placeholder-slate-600"
              />
              <button
                onClick={() => { doAction('kick', { userid: unbanId, message: 'Kicked by admin' }); setUnbanId(''); }}
                disabled={!unbanId}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400"
              >
                Kick
              </button>
              <button
                onClick={() => { doAction('ban', { userid: unbanId, message: 'Banned by admin' }); setUnbanId(''); }}
                disabled={!unbanId}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed bg-red-500/10 hover:bg-red-500/20 text-red-400"
              >
                Ban
              </button>
              <button
                onClick={() => { doAction('unban', { userid: unbanId }); setUnbanId(''); }}
                disabled={!unbanId}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400"
              >
                Unban
              </button>
            </div>
          </div>
        </div>

        {/* Actions Panel */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9))', border: '1px solid rgba(51,65,85,0.5)' }}>
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(51,65,85,0.3)' }}>
            <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Quick Actions</span>
          </div>
          <div className="p-3 space-y-3">
            {/* Save World */}
            <button
              onClick={() => doAction('save')}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(59,130,246,0.1))'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)'; }}
            >
              <Database className="w-4 h-4" />
              Save World
            </button>

            {/* Broadcast */}
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Broadcast</div>
              <div className="flex gap-1.5 items-center rounded-lg p-1" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.3)' }}>
                <input
                  type="text"
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && broadcastMsg && doAction('announce', { message: broadcastMsg }).then(() => setBroadcastMsg(''))}
                  placeholder="Message to all players..."
                  className="flex-1 bg-transparent px-2 py-1.5 text-sm text-white focus:outline-none placeholder-slate-600"
                />
                <button
                  onClick={() => { doAction('announce', { message: broadcastMsg }); setBroadcastMsg(''); }}
                  disabled={!broadcastMsg}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed bg-blue-500/15 hover:bg-blue-500/25 text-blue-400"
                >
                  Send
                </button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="pt-2">
              <div className="text-[10px] text-red-400/50 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Danger Zone
              </div>
              {showShutdownConfirm ? (
                <div className="rounded-lg p-3 space-y-2.5" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <p className="text-xs text-slate-400">Saves world, notifies players, then shuts down.</p>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 rounded-md px-2 py-1" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.3)' }}>
                      <input
                        type="number"
                        value={shutdownSeconds}
                        onChange={(e) => setShutdownSeconds(parseInt(e.target.value) || 0)}
                        className="w-10 bg-transparent text-xs text-white text-center focus:outline-none"
                        min="0"
                      />
                      <span className="text-[10px] text-slate-500">sec</span>
                    </div>
                    <input
                      type="text"
                      value={shutdownMsg}
                      onChange={(e) => setShutdownMsg(e.target.value)}
                      placeholder="Shutdown message..."
                      className="flex-1 bg-transparent rounded-md px-2 py-1 text-xs text-white focus:outline-none placeholder-slate-600"
                      style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.3)' }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowShutdownConfirm(false)}
                      className="flex-1 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
                      style={{ background: 'rgba(51,65,85,0.3)', border: '1px solid rgba(51,65,85,0.5)' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { doAction('shutdown', { waittime: shutdownSeconds, message: shutdownMsg }); setShowShutdownConfirm(false); }}
                      className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      Shutdown
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowShutdownConfirm(true)}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.15)'; }}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Shutdown
                  </button>
                  {showForceStopConfirm ? (
                    <button
                      onClick={() => { doAction('stop'); setShowForceStopConfirm(false); }}
                      className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Confirm Force Stop
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowForceStopConfirm(true)}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer"
                      style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.08)', color: 'rgba(248,113,113,0.4)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.04)'; e.currentTarget.style.color = 'rgba(248,113,113,0.4)'; }}
                    >
                      Force Stop
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Disconnect */}
      <button
        onClick={() => { setConnected(false); clearInterval(pollRef.current); }}
        className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-red-400 transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
        style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.3)' }}
      >
        <XCircle className="w-4 h-4 flex-shrink-0" />
        Disconnect
      </button>
    </div>
  );
};

// Console Tab - Shell access
const TerminalTab = ({ server, isVisible, masterLocation, onMasterError, isPaused }) => {
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [serverWithLocations, setServerWithLocations] = useState(server);

  // Fetch locations if not available
  useEffect(() => {
    const fetchLocations = async () => {
      if (!server.locations || server.locations.length === 0) {
        console.log('📡 Fetching locations for terminal...');
        setIsLoadingLocations(true);
        try {
          const locations = await apiService.getAppLocations(server.name);
          if (locations && locations.length > 0) {
            setServerWithLocations({ ...server, locations });
          }
        } catch (error) {
          console.error('Failed to fetch locations:', error);
        } finally {
          setIsLoadingLocations(false);
        }
      } else {
        setServerWithLocations(server);
      }
    };

    fetchLocations();
  }, [server]);

  if (isLoadingLocations) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading server locations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <ServerTerminal
        server={serverWithLocations}
        onClose={() => {}}
        isVisible={isVisible}
        isPaused={isPaused}
        masterLocation={masterLocation}
        onMasterError={onMasterError}
      />
    </div>
  );
};

// Files Tab - FluxDrive-styled file browser
// Palworld records the world it boots here, as a bare GUID matching a folder under
// SaveGames/0/. It lives in GameUserSettings.ini, not PalWorldSettings.ini.
const GAMEUSER_PATH = 'appdata/Config/LinuxServer/GameUserSettings.ini';

// \h matches horizontal whitespace only. Using \s here would let the pattern cross line
// breaks: with an empty "DedicatedServerName=" the \s* after "=" swallows the newline and
// (\S+) captures the *next* key, reporting a world that does not exist and raising a
// mismatch warning over nothing.
const H = '[^\\S\\r\\n]';
const ACTIVE_WORLD_RE = new RegExp(`^${H}*DedicatedServerName${H}*=${H}*(\\S*)${H}*$`, 'm');

const parseActiveWorld = (ini) => {
  const m = ACTIVE_WORLD_RE.exec(String(ini || ''));
  return m && m[1] ? m[1] : '';
};

// Replace the key in place when present. When it is absent the game is running on its
// implicit default, so the key has to be introduced under the section that owns it —
// appending to the end of the file would put it in whatever section came last.
const patchActiveWorld = (ini, guid) => {
  const text = String(ini || '');
  if (ACTIVE_WORLD_RE.test(text)) {
    return text.replace(ACTIVE_WORLD_RE, `DedicatedServerName=${guid}`);
  }
  const section = '[/Script/Pal.PalGameLocalSettings]';
  if (text.includes(section)) {
    return text.replace(section, `${section}\nDedicatedServerName=${guid}`);
  }
  return `${text.replace(/\s*$/, '')}\n\n${section}\nDedicatedServerName=${guid}\n`;
};

/**
 * Which world the server actually loads, and the ability to change it.
 *
 * Palworld stores every world under SaveGames/0/<GUID>/ and picks one by name from
 * GameUserSettings.ini. A save brought in from another server keeps its original folder
 * name, so it lands beside the world the ini points at and the server keeps booting the
 * original — the classic "restore worked but my world is gone" report.
 *
 * Shared by the file browser (which shows the warning, because that is where the folders
 * are visible and where manual uploads happen) and the backup tab (which only needs to
 * know which world to read snapshots from).
 */
const useWorldAudit = (server, masterLocation, { auto = true } = {}) => {
  const [worldAudit, setWorldAudit] = useState({ worlds: [], names: [], active: '', mismatch: false });
  const [activatingWorld, setActivatingWorld] = useState('');

  const component = server?.version >= 4 && server?.compose?.length > 0
    ? server.compose[0].name
    : 'null';

  const nodeUrlFor = useCallback((path) => {
    if (!masterLocation?.ip) return null;
    const [host, port = 16127] = masterLocation.ip.split(':');
    return `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io${path}`;
  }, [masterLocation]);

  const listWorlds = useCallback(async () => {
    const url = nodeUrlFor(`/apps/getfolderinfo/${server?.name}/${component}/${encodeURIComponent('appdata/SaveGames/0')}`);
    if (!url) return [];
    const zelidauth = await secureStorage.getItem('zelidauth');
    const res = await fetch(url, { headers: { zelidauth: JSON.stringify(zelidauth), 'x-apicache-bypass': true } });
    const data = await res.json();
    // The GUID alone is unusable for choosing between worlds — they are random hex. The
    // modified time is what actually tells the owner which one is theirs.
    return data.status === 'success' && Array.isArray(data.data)
      ? data.data.filter((w) => w.isDirectory).map((w) => ({ name: w.name, modifiedAt: w.modifiedAt }))
      : [];
  }, [nodeUrlFor, server?.name, component]);

  const readActiveWorld = useCallback(async () => {
    const url = nodeUrlFor(`/apps/downloadfile/${server?.name}/${component}/${encodeURIComponent(GAMEUSER_PATH)}`);
    if (!url) return { ini: null, active: '' };
    try {
      const zelidauth = await secureStorage.getItem('zelidauth');
      const res = await fetch(url, { headers: { zelidauth: JSON.stringify(zelidauth), 'x-apicache-bypass': true } });
      if (!res.ok) return { ini: null, active: '' };
      const ini = await res.text();
      return { ini, active: parseActiveWorld(ini) };
    } catch { return { ini: null, active: '' }; }
  }, [nodeUrlFor, server?.name, component]);

  const auditWorlds = useCallback(async () => {
    if (!masterLocation) return null;
    const dirs = await listWorlds();
    const names = dirs.map((d) => d.name);
    const { active } = await readActiveWorld();
    // Only worth surfacing when the choice is ambiguous or plainly broken. A single world
    // the ini does not name is normal — Palworld falls back to it.
    const mismatch = dirs.length > 1 || (Boolean(active) && dirs.length > 0 && !names.includes(active));
    // Newest first: after copying a save in, the one you just brought over is usually the
    // one you want, and it sorts to the top.
    const worlds = [...dirs].sort((a, b) => new Date(b.modifiedAt || 0) - new Date(a.modifiedAt || 0));
    const audit = { worlds, names, active, mismatch };
    setWorldAudit(audit);
    return audit;
  }, [masterLocation, listWorlds, readActiveWorld]);

  /**
   * Point GameUserSettings.ini at a world and bring the server back on it.
   *
   * Written while stopped for the same reason the public-port reconciler does it: Palworld
   * flushes its own settings on shutdown and would overwrite a patch applied to a running
   * server. The ini is re-read inside the stopped window so the patch lands on whatever the
   * game just wrote. Save files are never touched — only the ini.
   */
  const activateWorld = useCallback(async (guid) => {
    if (!masterLocation) return;
    setActivatingWorld(guid);
    try {
      const zelidauth = await secureStorage.getItem('zelidauth');
      const authHeader = JSON.stringify(zelidauth);
      const nodeBase = nodeApiBase(masterLocation.ip);
      let persisted = false;

      await withAppStopped(nodeBase, server.name, authHeader, async () => {
        const { ini } = await readActiveWorld();
        if (!ini) throw new Error('GameUserSettings.ini could not be read');

        const uploadUrl = `${nodeBase}/ioutils/fileupload/volume/${server.name}/${component}/${encodeURIComponent('appdata/Config/LinuxServer')}`;
        const fd = new FormData();
        fd.append('GameUserSettings.ini', new Blob([patchActiveWorld(ini, guid)], { type: 'text/plain' }));
        const up = await fetch(uploadUrl, { method: 'POST', headers: { zelidauth: authHeader }, body: fd });
        if (!up.ok) throw new Error(`Upload failed: HTTP ${up.status}`);

        const verify = await readActiveWorld();
        persisted = verify.active === guid;
      }, {
        onPhase: (phase) => {
          if (phase === 'stopping') toast('Switching active world — restarting your server…', { icon: '🌍', duration: 6000 });
        },
      });

      if (!persisted) throw new Error('The change did not stick — the server may have rewritten the file');
      toast.success('Active world switched');
      await auditWorlds();
    } catch (e) {
      toast.error(e?.name === 'AppBusyError'
        ? 'Another operation is running on this server — try again in a moment'
        : (e.message || 'Could not switch the active world'));
    } finally {
      setActivatingWorld('');
    }
  }, [masterLocation, server?.name, component, readActiveWorld, auditWorlds]);

  // Consumers that only call auditWorlds() themselves (the backup tab, which reads
  // audit.active to pick a world) opt out, so opening that tab does not fire two extra
  // requests whose result nothing renders.
  useEffect(() => {
    if (auto) auditWorlds().catch(() => {});
  }, [auto, auditWorlds]);

  return { worldAudit, auditWorlds, activateWorld, activatingWorld };
};

const FilesTab = ({ server, masterLocation, onMasterError }) => {
  const [currentPath, setCurrentPath] = useState('appdata');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedComponent, setSelectedComponent] = useState('');
  const [components, setComponents] = useState([]);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameFile, setRenameFile] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editFile, setEditFile] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editLanguage, setEditLanguage] = useState('plaintext');
  const [hasChanges, setHasChanges] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [openMenuFile, setOpenMenuFile] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuCloseTimeoutRef = useRef(null);
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const editorRef = useRef(null);
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('fileViewMode') || 'grid';
  });
  // masterLocation is passed down from parent - no DNS resolution needed

  // The file browser is where save folders are visible and where a manual restore happens,
  // so both the multi-world warning and the switch live here rather than in the backup tab.
  const { worldAudit, activateWorld, activatingWorld } = useWorldAudit(server, masterLocation);

  // Helper function to check for unauthorized errors
  const checkAuthError = (response, errorMsg = '') => {
    if (response?.status === 401 || response?.status === 403) {
      return 'Unauthorized. Access denied.\nPlease re-login to continue.';
    }
    if (errorMsg && (errorMsg.toLowerCase().includes('unauthorized') || errorMsg.toLowerCase().includes('access denied'))) {
      return 'Unauthorized. Access denied.\nPlease re-login to continue.';
    }
    return null;
  };

  // Get available components from server compose
  useEffect(() => {
    if (server.compose && Array.isArray(server.compose) && server.compose.length > 0) {
      const compNames = server.compose.map(c => c.name);
      setComponents(compNames);
      if (!selectedComponent) {
        setSelectedComponent(compNames[0]);
      }
    } else {
      // Single component / v3 app - use server name
      setSelectedComponent(server.name);
      setComponents([server.name]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server]);

  // Menu closes on mouse leave instead of click outside

  const filesAbortRef = useRef(null);

  // Fetch files from FluxOS volume browser API
  const fetchFiles = async (path = '', signal) => {
    if (!selectedComponent) return;

    setLoading(true);
    setError(null);

    try {
      const zelidauth = await secureStorage.getItem('zelidauth');
      console.log('🔑 [Files] zelidauth:', zelidauth ? { zelid: zelidauth.zelid, hasSignature: !!zelidauth.signature, hasLoginPhrase: !!zelidauth.loginPhrase, loginPhraseLen: zelidauth.loginPhrase?.length } : 'NULL');

      // Get master location
      if (!masterLocation) {
        throw new Error('Master location not available');
      }

      const [host, port = 16127] = masterLocation.ip.split(':');
      // Correct FluxOS API format: /apps/getfolderinfo/{appname}/{component}/{path}
      const encodedPath = path ? encodeURIComponent(path) : '';
      const apiUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/apps/getfolderinfo/${server.name}/${selectedComponent}/${encodedPath}`;
      console.log('🔗 [Files] API:', { apiUrl, appName: server.name, component: selectedComponent, path, serverVersion: server?.version });

      const headerValue = JSON.stringify(zelidauth);
      console.log('📤 [Files] zelidauth header length:', headerValue?.length, 'first 80 chars:', headerValue?.substring(0, 80));

      const response = await fetch(apiUrl, {
        headers: {
          zelidauth: headerValue,
          'x-apicache-bypass': true,
        },
        signal,
      });

      console.log('📥 [Files] HTTP status:', response.status, response.statusText);

      // Check for unauthorized errors
      if (response.status === 401 || response.status === 403) {
        throw new Error('Unauthorized. Access denied.\nPlease re-login to continue.');
      }

      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const data = await response.json();
      console.log('📁 Volume browser response:', data);

      if (data.status === 'success' && data.data) {
        setFiles(data.data);
      } else {
        // Handle error response properly
        let errorMsg = 'Invalid response';
        if (data.message) {
          errorMsg = data.message;
        } else if (data.data) {
          if (typeof data.data === 'string') {
            errorMsg = data.data;
          } else if (data.data.message) {
            errorMsg = data.data.message;
          } else {
            errorMsg = JSON.stringify(data.data);
          }
        }

        // Check if error message indicates unauthorized access
        if (errorMsg.toLowerCase().includes('unauthorized') || errorMsg.toLowerCase().includes('access denied')) {
          errorMsg = 'Unauthorized. Access denied.\nPlease re-login to continue.';
        }

        throw new Error(errorMsg);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('File browser error:', err);
      if (err instanceof TypeError) onMasterError();
      setError(err.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (server.locations?.length > 0 && selectedComponent && masterLocation) {
      filesAbortRef.current?.abort();
      const controller = new AbortController();
      filesAbortRef.current = controller;
      fetchFiles(currentPath, controller.signal);
    }
    return () => filesAbortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server, currentPath, selectedComponent, masterLocation]);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (menuCloseTimeoutRef.current) {
        clearTimeout(menuCloseTimeoutRef.current);
        menuCloseTimeoutRef.current = null;
      }
    };
  }, []);

  // Close menu when clicking outside or after inactivity
  useEffect(() => {
    if (!openMenuFile) return;

    const handleClickOutside = (e) => {
      // Check if click is outside the menu and the three-dot buttons
      const isClickOnButton = e.target.closest('.file-action-menu');
      if (!isClickOnButton) {
        setOpenMenuFile(null);
      }
    };

    // Add small delay before attaching listener to avoid immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuFile]);

  // Navigate to folder
  const navigateToFolder = (folderName) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(newPath);
    setOpenMenuFile(null); // Close any open menu when navigating
  };

  // Navigate up
  const navigateUp = () => {
    // Prevent going above appdata
    if (currentPath === 'appdata') return;

    const pathParts = currentPath.split('/').filter(Boolean);
    pathParts.pop();
    const newPath = pathParts.join('/');

    // Ensure we don't go above appdata
    if (newPath && !newPath.startsWith('appdata')) {
      setCurrentPath('appdata');
    } else {
      setCurrentPath(newPath || 'appdata');
    }
    setOpenMenuFile(null); // Close any open menu when navigating
  };

  // Get breadcrumb parts
  const getBreadcrumbs = () => {
    if (currentPath === 'appdata') return [{ name: 'Home', path: 'appdata' }];

    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Home', path: 'appdata' }];

    // Skip the first part if it's 'appdata' since we already have Home
    const startIndex = parts[0] === 'appdata' ? 1 : 0;

    parts.slice(startIndex).forEach((part, index) => {
      const path = 'appdata/' + parts.slice(startIndex, startIndex + index + 1).join('/');
      breadcrumbs.push({ name: part, path });
    });

    return breadcrumbs;
  };

  // Create new folder
  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const zelidauth = await secureStorage.getItem('zelidauth');
      if (!masterLocation) throw new Error('Master location not available');

      const base = nodeApiBase(masterLocation.ip);
      const folderPath = currentPath ? `${currentPath}/${newFolderName}` : newFolderName;
      const apiUrl = `${base}/apps/createfolder/${server.name}/${selectedComponent}/${encodeURIComponent(folderPath)}`;

      const response = await fetch(apiUrl, {
        cache: 'no-store',
        headers: { zelidauth: JSON.stringify(zelidauth), 'x-apicache-bypass': true },
      });

      const outcome = await readVolumeResponse(response);

      // Check for auth errors
      const authError = checkAuthError(response, outcome.message);
      if (authError) {
        throw new Error(authError);
      }

      if (outcome.state === 'busy' || outcome.state === 'error') {
        throw new Error(outcome.message);
      }
      if (outcome.state === 'job') {
        const view = await pollOperation(base, JSON.stringify(zelidauth), outcome.job);
        if (view.status !== 'Succeeded') throw new Error(jobFailureMessage(view));
      }

      setNewFolderName('');
      setShowNewFolderDialog(false);
      fetchFiles(currentPath);
    } catch (err) {
      if (err instanceof TypeError) onMasterError();
      setError(`Failed to create folder: ${err.message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  // Download file
  const downloadFile = async (file) => {
    const downloadId = `${file.name}-${Date.now()}`;

    // Add to download queue
    const downloadItem = {
      id: downloadId,
      name: file.name,
      size: file.size || 0,
      isDirectory: file.isDirectory,
      progress: 0,
      downloading: true,
      completed: false,
      error: null
    };

    setDownloadQueue(prev => [...prev, downloadItem]);
    setShowDownloadDialog(true);

    try {
      const zelidauth = await secureStorage.getItem('zelidauth');
      if (!masterLocation) throw new Error('Master location not available');

      const [host, port = 16127] = masterLocation.ip.split(':');
      const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
      const route = file.isDirectory ? 'downloadfolder' : 'downloadfile';
      const apiUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/apps/${route}/${server.name}/${selectedComponent}/${encodeURIComponent(filePath)}`;

      console.log('📥 Download URL:', apiUrl);
      console.log('📁 File path:', filePath);
      console.log('🎯 Encoded:', encodeURIComponent(filePath));

      const response = await fetch(apiUrl, {
        headers: { zelidauth: JSON.stringify(zelidauth) },
      });

      if (!response.ok) throw new Error('Download failed');

      // Detect file extension from headers
      let downloadFileName = file.name;
      const contentDisposition = response.headers.get('Content-Disposition');
      const contentType = response.headers.get('Content-Type') || '';

      if (contentDisposition && contentDisposition.includes('filename=')) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches != null && matches[1]) {
          downloadFileName = matches[1].replace(/['"]/g, '');
        }
      } else if (file.isDirectory) {
        // Determine extension based on content type for folders
        if (contentType.includes('zip')) {
          downloadFileName = `${file.name}.zip`;
        } else if (contentType.includes('gzip') || contentType.includes('x-gzip')) {
          downloadFileName = `${file.name}.tar.gz`;
        } else if (contentType.includes('x-tar')) {
          downloadFileName = `${file.name}.tar`;
        } else {
          // FluxOS default is tar.gz
          downloadFileName = `${file.name}.tar.gz`;
        }
      }

      const reader = response.body.getReader();
      const contentLength = +response.headers.get('Content-Length') || file.size || 0;

      let receivedLength = 0;
      const chunks = [];

      while(true) {
        const {done, value} = await reader.read();

        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        // Update progress
        const progress = contentLength ? Math.round((receivedLength / contentLength) * 100) : 0;
        setDownloadQueue(prev => prev.map(item =>
          item.id === downloadId ? {...item, progress} : item
        ));
      }

      // Combine chunks and create blob
      const blob = new Blob(chunks);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Mark as completed
      setDownloadQueue(prev => prev.map(item =>
        item.id === downloadId ? {...item, progress: 100, downloading: false, completed: true} : item
      ));

      // Remove from queue after 3 seconds
      setTimeout(() => {
        setDownloadQueue(prev => prev.filter(item => item.id !== downloadId));
      }, 3000);

    } catch (err) {
      if (err instanceof TypeError) onMasterError();
      console.error('Download failed:', err.message);
      setDownloadQueue(prev => prev.map(item =>
        item.id === downloadId ? {...item, downloading: false, error: err.message} : item
      ));
    }
  };

  // Show delete confirmation
  const deleteObject = (file) => {
    console.log('🗑️ deleteObject called', { file, name: file.name, type: file.type });
    setFileToDelete(file);
    setShowDeleteDialog(true);
    console.log('🗑️ Dialog should show now');
  };

  // Confirm and execute delete
  const confirmDelete = async () => {
    console.log('🗑️ confirmDelete called', { fileToDelete });
    if (!fileToDelete) {
      console.log('🗑️ No fileToDelete, returning');
      return;
    }

    try {
      const zelidauth = await secureStorage.getItem('zelidauth');
      if (!masterLocation) throw new Error('Master location not available');

      const base = nodeApiBase(masterLocation.ip);
      const objectPath = currentPath ? `${currentPath}/${fileToDelete.name}` : fileToDelete.name;
      const apiUrl = `${base}/apps/removeobject/${server.name}/${selectedComponent}/${encodeURIComponent(objectPath)}`;

      console.log('🗑️ Delete request:', {
        type: fileToDelete.type,
        name: fileToDelete.name,
        objectPath,
        apiUrl,
        component: selectedComponent
      });

      const response = await fetch(apiUrl, {
        cache: 'no-store',
        headers: { zelidauth: JSON.stringify(zelidauth), 'x-apicache-bypass': true },
      });

      console.log('🗑️ Delete response:', response.status, response.statusText);

      const outcome = await readVolumeResponse(response);
      console.log('🗑️ Delete outcome:', outcome);

      // Check for auth errors
      const authError = checkAuthError(response, outcome.message);
      if (authError) {
        throw new Error(authError);
      }

      if (outcome.state === 'busy' || outcome.state === 'error') {
        throw new Error(outcome.message);
      }

      // A delete that outlives the node's inline deadline carries on as a job,
      // and its 202 is a success envelope - so reading only `status: 'success'`
      // refreshed the listing while rm -rf was still working, and the file the
      // customer just deleted was still there. Deleting a large folder here is
      // exactly that case.
      if (outcome.state === 'job') {
        const view = await pollOperation(base, JSON.stringify(zelidauth), outcome.job);
        if (view.status !== 'Succeeded') throw new Error(jobFailureMessage(view));
      }

      setError(null);
      fetchFiles(currentPath);
    } catch (err) {
      if (err instanceof TypeError) onMasterError();
      console.error('Delete failed:', err.message);
      setError(`Failed to delete: ${err.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setShowDeleteDialog(false);
      setFileToDelete(null);
    }
  };

  // Rename file/folder
  const renameObject = async () => {
    if (!newFileName.trim() || !renameFile) return;

    try {
      const zelidauth = await secureStorage.getItem('zelidauth');
      if (!masterLocation) throw new Error('Master location not available');

      const base = nodeApiBase(masterLocation.ip);
      const oldPath = currentPath ? `${currentPath}/${renameFile.name}` : renameFile.name;
      const apiUrl = `${base}/apps/renameobject/${server.name}/${selectedComponent}/${encodeURIComponent(oldPath)}/${newFileName}`;

      const response = await fetch(apiUrl, {
        cache: 'no-store',
        headers: { zelidauth: JSON.stringify(zelidauth), 'x-apicache-bypass': true },
      });

      const outcome = await readVolumeResponse(response);

      // Check for auth errors
      const authError = checkAuthError(response, outcome.message);
      if (authError) {
        throw new Error(authError);
      }

      if (outcome.state === 'busy' || outcome.state === 'error') {
        throw new Error(outcome.message);
      }
      if (outcome.state === 'job') {
        const view = await pollOperation(base, JSON.stringify(zelidauth), outcome.job);
        if (view.status !== 'Succeeded') throw new Error(jobFailureMessage(view));
      }

      setShowRenameDialog(false);
      setRenameFile(null);
      setNewFileName('');
      fetchFiles(currentPath);
    } catch (err) {
      if (err instanceof TypeError) onMasterError();
      setError(`Failed to rename: ${err.message}`);
      setTimeout(() => setError(null), 5000);
    }
  };


  // File upload helpers
  const selectFiles = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const selectFolder = () => {
    if (folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  const handleFileSelection = (e) => {
    const selected = Array.from(e.target.files).map(file => {
      // Preserve folder structure from webkitdirectory
      if (file.webkitRelativePath) {
        file.relativePath = file.webkitRelativePath;
      }
      return {
        file,
        uploading: false,
        uploaded: false,
        progress: 0,
      };
    });

    setUploadFiles(prev => {
      const newFiles = selected.filter(newFile => {
        const fileId = newFile.file.relativePath || newFile.file.name;
        return !prev.some(existingFile => (existingFile.file.relativePath || existingFile.file.name) === fileId);
      });
      return [...prev, ...newFiles];
    });

    e.target.value = '';
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const items = e.dataTransfer.items;
    const fileList = [];

    if (items) {
      for (const item of items) {
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            await traverseFileTree(entry, '', fileList);
          }
        }
      }
    } else {
      fileList.push(...Array.from(e.dataTransfer.files));
    }

    const newFiles = fileList.map(file => ({
      file,
      uploading: false,
      uploaded: false,
      progress: 0,
    }));

    setUploadFiles(prev => {
      const filtered = newFiles.filter(newFile => {
        const fileId = newFile.file.relativePath || newFile.file.name;
        return !prev.some(existingFile => (existingFile.file.relativePath || existingFile.file.name) === fileId);
      });
      return [...prev, ...filtered];
    });
  };

  const traverseFileTree = async (item, path, fileList) => {
    if (item.isFile) {
      return new Promise(resolve => {
        item.file(file => {
          file.relativePath = path + file.name;
          fileList.push(file);
          resolve();
        });
      });
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      return new Promise(resolve => {
        dirReader.readEntries(async entries => {
          for (const entry of entries) {
            await traverseFileTree(entry, path + item.name + '/', fileList);
          }
          resolve();
        });
      });
    }
  };

  const removeUploadFile = (fileToRemove) => {
    setUploadFiles(prev => prev.filter(f => f.file !== fileToRemove.file));
  };

  const toggleFolderExpansion = (folderPath) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  // Organize files into tree structure
  const getFileTree = () => {
    const tree = [];
    const folderMap = new Map();

    uploadFiles.forEach(fileObj => {
      const file = fileObj.file;

      if (file.relativePath) {
        const parts = file.relativePath.split('/');
        const folderPath = parts.slice(0, -1).join('/');

        if (!folderMap.has(folderPath)) {
          folderMap.set(folderPath, {
            type: 'folder',
            path: folderPath,
            name: folderPath,
            files: [],
          });
          tree.push(folderMap.get(folderPath));
        }

        folderMap.get(folderPath).files.push(fileObj);
      } else {
        tree.push({
          type: 'file',
          ...fileObj,
        });
      }
    });

    // Calculate folder sizes
    tree.forEach(item => {
      if (item.type === 'folder') {
        item.totalSize = item.files.reduce((sum, f) => sum + f.file.size, 0);
      }
    });

    return tree;
  };

  const handleUpload = async () => {
    try {
      for (const fileObj of uploadFiles) {
        if (!fileObj.uploading && !fileObj.uploaded) {
          await uploadFileWithProgress(fileObj);
        }
      }
    } catch (err) {
      if (err instanceof TypeError) onMasterError();
      setError(`Upload failed: ${err.message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const uploadFileWithProgress = async (fileObj) => {
    // eslint-disable-next-line no-useless-catch
    try {
      const zelidauth = await secureStorage.getItem('zelidauth');
      if (!masterLocation) throw new Error('Master location not available');

      const [host, port = 16127] = masterLocation.ip.split(':');
      let uploadPath = currentPath ? encodeURIComponent(currentPath) : '';
      let apiUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/ioutils/fileupload/volume/${server.name}/${selectedComponent}/${uploadPath}`;

      // Handle folder structure
      if (fileObj.file.relativePath) {
        const pathParts = fileObj.file.relativePath.split('/');
        pathParts.pop(); // Remove filename
        const dirPath = pathParts.join('/');

        if (dirPath) {
          let fullFolderPath = dirPath;
          if (currentPath) {
            fullFolderPath = currentPath + '/' + dirPath;
          }
          apiUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/ioutils/fileupload/volume/${server.name}/${selectedComponent}?folder=${encodeURIComponent(fullFolderPath)}`;
        }
      }

      const formData = new FormData();
      formData.append(fileObj.file.name, fileObj.file);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            setUploadFiles(prev => prev.map(f =>
              f === fileObj ? { ...f, progress } : f
            ));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadFiles(prev => prev.map(f =>
              f === fileObj ? { ...f, uploading: false, uploaded: true, progress: 100 } : f
            ));

            setTimeout(() => {
              removeUploadFile(fileObj);
              setUploadFiles(prev => {
                const remaining = prev.filter(f => f !== fileObj && !f.uploaded);
                if (remaining.length === 0) {
                  setShowUploadDialog(false);
                  fetchFiles(currentPath);
                  return [];
                }
                return prev.filter(f => f !== fileObj);
              });
            }, 1500);
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          setUploadFiles(prev => prev.map(f =>
            f === fileObj ? { ...f, uploading: false } : f
          ));
          reject(new Error('Upload failed'));
        });

        xhr.open('POST', apiUrl);
        xhr.setRequestHeader('zelidauth', JSON.stringify(zelidauth));

        setUploadFiles(prev => prev.map(f =>
          f === fileObj ? { ...f, uploading: true } : f
        ));
        xhr.send(formData);
      });
    } catch (err) {
      throw err;
    }
  };

  // Edit file
  const openEditFile = async (file) => {
    const maxEditSize = 1024 * 1024 * 4; // 4MB limit
    if (file.size > maxEditSize) {
      setError('File too large to edit (max 4MB)');
      setTimeout(() => setError(null), 5000);
      return;
    }

    setIsLoadingFile(true);
    setEditFile(file);
    setShowEditDialog(true);
    setHasChanges(false);

    // Detect language from file extension
    const detectedLang = getLanguageFromFileName(file.name);
    setEditLanguage(detectedLang);

    try {
      const zelidauth = await secureStorage.getItem('zelidauth');
      if (!masterLocation) throw new Error('Master location not available');

      const [host, port = 16127] = masterLocation.ip.split(':');
      const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
      const apiUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/apps/downloadfile/${server.name}/${selectedComponent}/${encodeURIComponent(filePath)}`;

      const response = await fetch(apiUrl, {
        headers: { zelidauth: JSON.stringify(zelidauth) },
      });

      const blob = await response.blob();
      const text = await blob.text();
      setEditContent(text);
    } catch (err) {
      if (err instanceof TypeError) onMasterError();
      setError(`Failed to load file: ${err.message}`);
      setTimeout(() => setError(null), 5000);
      setShowEditDialog(false);
      setEditFile(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const saveEditFile = async () => {
    if (!editFile || !editorRef.current) return;

    setIsSavingFile(true);
    try {
      // Get content from Monaco Editor
      const content = editorRef.current.getValue();

      const zelidauth = await secureStorage.getItem('zelidauth');
      if (!masterLocation) throw new Error('Master location not available');

      const [host, port = 16127] = masterLocation.ip.split(':');
      const uploadPath = currentPath ? encodeURIComponent(currentPath) : '';
      const apiUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/ioutils/fileupload/volume/${server.name}/${selectedComponent}/${uploadPath}`;

      const blob = new Blob([content], { type: 'text/plain' });
      const formData = new FormData();
      formData.append(editFile.name, blob);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          zelidauth: JSON.stringify(zelidauth)
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to save file');
      }

      setShowEditDialog(false);
      setEditFile(null);
      setEditContent('');
      setHasChanges(false);
      fetchFiles(currentPath);
    } catch (err) {
      if (err instanceof TypeError) onMasterError();
      setError(`Failed to save file: ${err.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSavingFile(false);
    }
  };

  // Get file icon with better styling using MDI icons
  const getFileIcon = (file, small = false) => {
    const size = small ? 'w-8 h-8' : 'w-12 h-12';
    const iconSize = small ? 'w-5 h-5' : 'w-7 h-7';

    if (file.isDirectory) {
      return (
        <div className={`${size} rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0`}>
          <MdFolder className={`${iconSize} text-blue-400`} />
        </div>
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    let IconComponent = FaFile;
    let iconColor = 'text-gray-400';
    let bgColor = 'bg-gray-500/20';
    let borderColor = 'border-gray-500/30';

    // File type specific styling with Font Awesome file icons
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
      IconComponent = FaFileImage;
      iconColor = 'text-purple-400';
      bgColor = 'bg-purple-500/20';
      borderColor = 'border-purple-500/30';
    } else if (['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'].includes(ext)) {
      IconComponent = FaFileVideo;
      iconColor = 'text-pink-400';
      bgColor = 'bg-pink-500/20';
      borderColor = 'border-pink-500/30';
    } else if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) {
      IconComponent = FaFileAudio;
      iconColor = 'text-blue-400';
      bgColor = 'bg-blue-500/20';
      borderColor = 'border-blue-500/30';
    } else if (['zip', 'rar', 'tar', 'gz', '7z', 'bz2'].includes(ext)) {
      IconComponent = FaFileArchive;
      iconColor = 'text-orange-400';
      bgColor = 'bg-yellow-500/20';
      borderColor = 'border-yellow-500/30';
    } else if (['txt', 'log', 'md', 'csv'].includes(ext)) {
      IconComponent = FaFileAlt;
      iconColor = 'text-cyan-400';
      bgColor = 'bg-cyan-500/20';
      borderColor = 'border-cyan-500/30';
    } else if (['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php'].includes(ext)) {
      IconComponent = FaFileCode;
      iconColor = 'text-orange-400';
      bgColor = 'bg-yellow-500/20';
      borderColor = 'border-yellow-500/30';
    } else if (ext === 'pdf') {
      IconComponent = FaFilePdf;
      iconColor = 'text-red-400';
      bgColor = 'bg-red-500/20';
      borderColor = 'border-red-500/30';
    }

    return (
      <div className={`${size} rounded-lg ${bgColor} border ${borderColor} flex items-center justify-center flex-shrink-0`}>
        <IconComponent className={`${iconSize} ${iconColor}`} />
      </div>
    );
  };

  // Format file size
  const formatSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 flex flex-col h-full max-h-full overflow-hidden">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1F2937;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #10B981;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #059669;
        }
      `}</style>

      {/* Palworld holds the world in memory and flushes it on shutdown, so anything written
          to a save folder while the server runs is overwritten at the next autosave. */}
      <div className="px-3 sm:px-6 py-2.5 bg-gradient-to-r from-blue-500/10 to-transparent border-b border-blue-500/20">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 shrink-0">
            <Info className="w-4 h-4 text-blue-300" />
          </span>
          <div className="min-w-0 leading-snug">
            <p className="text-xs font-semibold text-blue-200">
              Stop the server before restoring saves by hand
            </p>
            <p className="text-[11px] text-blue-300/70">
              Uploads to <code className="text-blue-200/90">SaveGames</code> are overwritten by the game&apos;s next autosave.
            </p>
          </div>
        </div>
      </div>

      {/* A save brought in from another server keeps its own world GUID, so it lands beside
          the world the server boots instead of replacing it. */}
      {worldAudit.mismatch && (
        <div className="px-3 sm:px-6 py-3 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-amber-500/20">
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-300" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="leading-snug">
                <p className="text-xs font-semibold text-amber-200">
                  {worldAudit.worlds.length > 1
                    ? `${worldAudit.worlds.length} worlds found — the server loads only one`
                    : 'The configured world does not exist on disk'}
                </p>
                <p className="text-[11px] text-amber-300/70">
                  A save copied from another server keeps its own folder name, so it sits beside the active world instead of replacing it.
                </p>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-2">
                {worldAudit.worlds.map(({ name: guid, modifiedAt }) => {
                  const isActive = guid === worldAudit.active;
                  return (
                    <div
                      key={guid}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                        isActive
                          ? 'border-emerald-500/30 bg-emerald-500/10'
                          : 'border-gray-600/50 bg-black/25'
                      }`}
                    >
                      {isActive && <MdCheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
                      <div className="min-w-0 leading-snug">
                        {/* Full GUID: two random hex names are impossible to tell apart once
                            truncated, and this is the field the choice is made on. */}
                        <p className="font-mono text-[11px] text-gray-200 break-all">{guid}</p>
                        <p className="text-[10px] text-gray-500">
                          {modifiedAt
                            ? `last saved ${new Date(modifiedAt).toLocaleString()}`
                            : 'no save date'}
                        </p>
                      </div>
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => activateWorld(guid)}
                          disabled={Boolean(activatingWorld)}
                          className="shrink-0 px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          {activatingWorld === guid ? 'Switching…' : 'Load'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {!worldAudit.names.includes(worldAudit.active) && worldAudit.active && (
                <p className="text-[11px] text-amber-300/70 mt-2">
                  The config points at <code className="text-amber-200/90">{worldAudit.active}</code> — no such folder, so the server starts an empty world.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-2 bg-gray-700/50 border-b border-gray-700">
        <div className="flex items-center gap-2 min-w-0">
          <Folder className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <h3 className="text-base sm:text-lg font-semibold text-white whitespace-nowrap">File Browser</h3>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Upload Button */}
          <button
            onClick={() => setShowUploadDialog(true)}
            className="px-2 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">Upload</span>
          </button>

          {/* New Folder Button */}
          <button
            onClick={() => setShowNewFolderDialog(true)}
            className="px-2 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Folder className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">New Folder</span>
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 flex-shrink-0">
            <button
              onClick={() => {
                setViewMode('grid');
                localStorage.setItem('fileViewMode', 'grid');
              }}
              className={`relative group p-1.5 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className={_TIP}>Grid</span>
            </button>
            <button
              onClick={() => {
                setViewMode('list');
                localStorage.setItem('fileViewMode', 'list');
              }}
              className={`relative group p-1.5 rounded transition-colors ${
                viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              <span className={_TIP}>List</span>
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={() => {
              setOpenMenuFile(null);
              fetchFiles(currentPath);
            }}
            className="relative group p-2 hover:bg-gray-600/50 rounded-lg transition-colors flex-shrink-0"
          >
            <RefreshCw className="w-4 h-4 text-gray-400" />
            <span className={_TIP}>Refresh</span>
          </button>
        </div>
      </div>

      {/* Component Selector */}
      {components.length > 1 && (
        <div className="px-6 py-3 bg-gray-900/30 border-b border-gray-700/50">
          <select
            value={selectedComponent}
            onChange={(e) => {
              setSelectedComponent(e.target.value);
              setCurrentPath('');
              setOpenMenuFile(null); // Close any open menu when changing component
            }}
            className="w-full max-w-xs px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          >
            {components.map(comp => (
              <option key={comp} value={comp}>{comp}</option>
            ))}
          </select>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <div className="px-6 py-3 bg-gray-900/50 border-b border-gray-700/50 flex items-center gap-2">
        <div className="flex items-center gap-1 text-sm flex-1 overflow-x-auto">
          {getBreadcrumbs().map((crumb, index) => (
            <div key={index} className="flex items-center gap-1 flex-shrink-0">
              {index > 0 && <span className="text-gray-600">/</span>}
              <button
                onClick={() => {
                  setCurrentPath(crumb.path);
                  setOpenMenuFile(null); // Close any open menu when clicking breadcrumb
                }}
                className={`px-2 py-1 rounded hover:bg-gray-700/50 transition-colors flex items-center gap-1.5 ${
                  crumb.path === currentPath ? 'text-blue-400 font-medium' : 'text-gray-400'
                }`}
              >
                {crumb.name === 'Root' || crumb.name === 'Home' ? (
                  <Home className="w-4 h-4" />
                ) : (
                  crumb.name
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: '50vh' }}>
            <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400/50 animate-spin" style={{ animationDuration: '2s' }} />
              <Folder className="w-10 h-10 text-blue-400 animate-pulse" />
            </div>
            <p className="text-sm text-gray-400">Loading files...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: '50vh' }}>
            <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <div className="flex flex-col items-center gap-2 max-w-sm">
              <p className="text-xl font-semibold text-red-400">Failed to load files</p>
              <p className="text-base text-gray-500 whitespace-pre-line text-center">{error}</p>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Folder className="w-12 h-12 mb-2" />
            <p>Empty folder</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="h-full flex flex-col min-h-0">
            {/* Virtualized File Grid */}
            <div className="flex-1 min-h-0" style={{ padding: '16px' }}>
              <VirtualizedFileList
                files={currentPath && currentPath !== 'appdata' ? [
                  { name: '..', isDirectory: true, isParent: true },
                  ...files.slice().sort((a, b) => {
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.name.localeCompare(b.name);
                  })
                ] : files.slice().sort((a, b) => {
                  if (a.isDirectory && !b.isDirectory) return -1;
                  if (!a.isDirectory && b.isDirectory) return 1;
                  return a.name.localeCompare(b.name);
                })}
                isGridView={true}
                itemHeight={140}
                itemWidth={180}
                renderFile={(file, index, _totalFiles) => {
                  console.log('[GRID VIEW] renderFile:', file.name, 'index:', index, 'viewMode:', viewMode);

                  // Handle parent folder (..)
                  if (file.isParent) {
                    return (
                      <div
                        key={index}
                        onClick={navigateUp}
                        className="group relative p-4 rounded-xl border-2 transition-all duration-200 bg-gray-800/50 border-gray-700/50 hover:border-gray-600 hover:bg-gray-700/30 cursor-pointer"
                      >
                        <div className="flex flex-col items-center text-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                            <RiFolderReceivedFill className="w-7 h-7 text-blue-400" />
                          </div>
                          <div className="w-full">
                            <div className="text-sm font-medium text-white truncate mb-1">..</div>
                            <div className="text-xs text-gray-500">Parent folder</div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Handle regular files
                  return (
                    <div
                      key={index}
                      style={{  }}
                      className={`group relative p-4 rounded-xl border-2 transition-all duration-200 ${
                        selectedFile === file
                          ? 'bg-gray-700/50 border-blue-500/50 shadow-lg shadow-blue-500/20'
                          : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600 hover:bg-gray-700/30'
                      }`}
                    >
                      <div
                        onClick={() => file.isDirectory && navigateToFolder(file.name)}
                        className={`flex flex-col items-center text-center gap-3 ${file.isDirectory ? 'cursor-pointer' : ''}`}
                      >
                        {getFileIcon(file)}
                    <div className="w-full">
                      <div className="text-sm font-medium text-white truncate mb-1">{file.name}</div>
                      <div className="text-xs text-gray-500">{file.isDirectory ? 'Folder' : formatSize(file.size)}</div>
                    </div>
                  </div>

                  {/* Action Menu */}
                  <div
                    className={`absolute top-2 right-2 file-action-menu transition-opacity ${
                      openMenuFile === file.name ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}>
                    <button
                      onClick={(e) => {
                        console.log('Three-dot clicked, opening menu for:', file.name);
                        e.stopPropagation();

                        // Clear any pending close timeout
                        if (menuCloseTimeoutRef.current) {
                          clearTimeout(menuCloseTimeoutRef.current);
                          menuCloseTimeoutRef.current = null;
                        }

                        const rect = e.currentTarget.getBoundingClientRect();
                        const spaceBelow = window.innerHeight - rect.bottom;
                        const menuHeight = 180; // Approximate menu height

                        if (spaceBelow < menuHeight) {
                          // Not enough space below, position above with overlap for better mouse tracking
                          setMenuPosition({ top: rect.top - menuHeight + 10, left: rect.right - 192 });
                        } else {
                          // Enough space below, position normally
                          setMenuPosition({ top: rect.bottom + 4, left: rect.right - 192 });
                        }
                        console.log('📍 Three-dots clicked!', { fileName: file.name, currentOpen: openMenuFile, willOpen: openMenuFile === file.name ? 'CLOSE' : 'OPEN' });
                        setOpenMenuFile(openMenuFile === file.name ? null : file.name);
                      }}
                      className="relative group/tip p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors shadow-lg"
                    >
                      <MdMoreVert className="w-5 h-5 text-white" />
                      <span className="hidden sm:block absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-gray-900 border border-gray-700 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50 before:content-[''] before:absolute before:bottom-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-700">Actions</span>
                    </button>

                    {/* Dropdown Menu */}
                    {openMenuFile === file.name && createPortal(
                      <div
                        key={`file-menu-${file.name}-${viewMode}`}
                        onClick={(e) => {
                          console.log('🎯 MENU CONTAINER CLICKED!!!');
                          e.stopPropagation();
                        }}
                        onMouseEnter={() => {
                          console.log('🎯 MENU CONTAINER MOUSE ENTER!!!');
                          if (menuCloseTimeoutRef.current) {
                            clearTimeout(menuCloseTimeoutRef.current);
                            menuCloseTimeoutRef.current = null;
                          }
                        }}
                        onMouseLeave={() => {
                          menuCloseTimeoutRef.current = setTimeout(() => {
                            setOpenMenuFile(null);
                          }, 100);
                        }}
                        style={{
                          backgroundColor: '#1f2937',
                          zIndex: 999999,
                          pointerEvents: 'auto',
                          position: 'fixed',
                          top: `${menuPosition.top}px`,
                          left: `${menuPosition.left}px`
                        }}
                        className={`w-48 border border-gray-700 rounded-lg shadow-xl`}>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Download clicked!', file.name);
                            // Clear any pending close timeout
                            if (menuCloseTimeoutRef.current) {
                              clearTimeout(menuCloseTimeoutRef.current);
                              menuCloseTimeoutRef.current = null;
                            }
                            downloadFile(file);
                            setOpenMenuFile(null);
                          }}
                          onMouseEnter={() => console.log('Hover: Download')}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors text-left"
                        >
                          <MdDownload className="w-5 h-5 text-blue-400" />
                          <span className="text-white text-sm">Download</span>
                        </button>
                        {!file.isDirectory && (
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Clear any pending close timeout
                              if (menuCloseTimeoutRef.current) {
                                clearTimeout(menuCloseTimeoutRef.current);
                                menuCloseTimeoutRef.current = null;
                              }
                              openEditFile(file);
                              setOpenMenuFile(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors text-left border-t border-gray-700/50"
                          >
                            <MdEdit className="w-5 h-5 text-orange-400" />
                            <span className="text-white text-sm">Edit</span>
                          </button>
                        )}
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Clear any pending close timeout
                            if (menuCloseTimeoutRef.current) {
                              clearTimeout(menuCloseTimeoutRef.current);
                              menuCloseTimeoutRef.current = null;
                            }
                            setRenameFile(file);
                            setNewFileName(file.name);
                            setShowRenameDialog(true);
                            setOpenMenuFile(null);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors text-left border-t border-gray-700/50"
                        >
                          <MdDriveFileRenameOutline className="w-5 h-5 text-blue-400" />
                          <span className="text-white text-sm">Rename</span>
                        </button>
                        {console.log('🗑️ Rendering Delete button for:', file.name)}
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🚨🚨🚨 DELETE CLICKED!!! 🚨🚨🚨', file.name);
                            // Clear any pending close timeout
                            if (menuCloseTimeoutRef.current) {
                              clearTimeout(menuCloseTimeoutRef.current);
                              menuCloseTimeoutRef.current = null;
                            }
                            // Close menu and execute delete
                            setOpenMenuFile(null);
                            deleteObject(file);
                          }}
                          onMouseEnter={() => console.log('👆 Hover: Delete', file.name)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors text-left border-t border-gray-700/50"
                        >
                          <MdDelete className="w-5 h-5 text-red-400" />
                          <span className="text-white text-sm">Delete</span>
                        </button>
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
                  );
                }}
              />
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col min-h-0">
            {/* Virtualized File List */}
            <div className="flex-1 min-h-0">
              <VirtualizedFileList
                files={currentPath && currentPath !== 'appdata' ? [
                  { name: '..', isDirectory: true, isParent: true },
                  ...files.slice().sort((a, b) => {
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.name.localeCompare(b.name);
                  })
                ] : files.slice().sort((a, b) => {
                  if (a.isDirectory && !b.isDirectory) return -1;
                  if (!a.isDirectory && b.isDirectory) return 1;
                  return a.name.localeCompare(b.name);
                })}
                isGridView={false}
                itemHeight={64}
                renderFile={(file, index, _totalFiles) => {
                  console.log('[LIST VIEW] renderFile:', file.name, 'index:', index, 'viewMode:', viewMode);

                  // Handle parent folder (..)
                  if (file.isParent) {
                    return (
                      <div
                        key={index}
                        onClick={navigateUp}
                        className="group px-3 py-3 hover:bg-gray-700/30 transition-colors cursor-pointer border-b border-gray-700/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                            <RiFolderReceivedFill className="w-5 h-5 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">..</div>
                            <div className="text-xs text-gray-500">Parent folder</div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Handle regular files
                  return (
                    <div
                      key={index}
                      style={{  }}
                      className={`group px-3 py-3 hover:bg-gray-700/30 transition-colors border-b border-gray-700/50 ${
                        selectedFile === file ? 'bg-gray-700/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => file.isDirectory && navigateToFolder(file.name)}
                          className={`flex items-center gap-3 flex-1 min-w-0 ${file.isDirectory ? 'cursor-pointer' : ''}`}
                        >
                          {getFileIcon(file, true)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{file.name}</div>
                      <div className="text-xs text-gray-500">{file.isDirectory ? 'Folder' : formatSize(file.size)}</div>
                    </div>
                  </div>

                  {/* Action Menu */}
                  <div
                    className={`relative file-action-menu transition-opacity ${
                      openMenuFile === file.name ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();

                        // Clear any pending close timeout
                        if (menuCloseTimeoutRef.current) {
                          clearTimeout(menuCloseTimeoutRef.current);
                          menuCloseTimeoutRef.current = null;
                        }

                        const rect = e.currentTarget.getBoundingClientRect();
                        const spaceBelow = window.innerHeight - rect.bottom;
                        const menuHeight = 180; // Approximate menu height

                        if (spaceBelow < menuHeight) {
                          // Not enough space below, position above with overlap for better mouse tracking
                          setMenuPosition({ top: rect.top - menuHeight + 10, left: rect.right - 192 });
                        } else {
                          // Enough space below, position normally
                          setMenuPosition({ top: rect.bottom + 4, left: rect.right - 192 });
                        }
                        console.log('📍 Three-dots clicked!', { fileName: file.name, currentOpen: openMenuFile, willOpen: openMenuFile === file.name ? 'CLOSE' : 'OPEN' });
                        setOpenMenuFile(openMenuFile === file.name ? null : file.name);
                      }}
                      className="relative group/tip p-2 hover:bg-gray-600/50 rounded-lg transition-colors"
                    >
                      <MdMoreVert className="w-5 h-5 text-gray-400" />
                      <span className="hidden sm:block absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-gray-900 border border-gray-700 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50 before:content-[''] before:absolute before:bottom-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-700">Actions</span>
                    </button>

                    {/* Dropdown Menu */}
                    {openMenuFile === file.name && createPortal(
                      <div
                        key={`file-menu-${file.name}-${viewMode}`}
                        onClick={(e) => {
                          console.log('🎯 MENU CONTAINER CLICKED!!!');
                          e.stopPropagation();
                        }}
                        onMouseEnter={() => {
                          console.log('🎯 MENU CONTAINER MOUSE ENTER!!!');
                          if (menuCloseTimeoutRef.current) {
                            clearTimeout(menuCloseTimeoutRef.current);
                            menuCloseTimeoutRef.current = null;
                          }
                        }}
                        onMouseLeave={() => {
                          menuCloseTimeoutRef.current = setTimeout(() => {
                            setOpenMenuFile(null);
                          }, 100);
                        }}
                        style={{
                          backgroundColor: '#1f2937',
                          zIndex: 999999,
                          pointerEvents: 'auto',
                          position: 'fixed',
                          top: `${menuPosition.top}px`,
                          left: `${menuPosition.left}px`
                        }}
                        className={`w-48 border border-gray-700 rounded-lg shadow-xl`}>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Download clicked!', file.name);
                            // Clear any pending close timeout
                            if (menuCloseTimeoutRef.current) {
                              clearTimeout(menuCloseTimeoutRef.current);
                              menuCloseTimeoutRef.current = null;
                            }
                            downloadFile(file);
                            setOpenMenuFile(null);
                          }}
                          onMouseEnter={() => console.log('Hover: Download')}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors text-left"
                        >
                          <MdDownload className="w-5 h-5 text-blue-400" />
                          <span className="text-white text-sm">Download</span>
                        </button>
                        {!file.isDirectory && (
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Clear any pending close timeout
                              if (menuCloseTimeoutRef.current) {
                                clearTimeout(menuCloseTimeoutRef.current);
                                menuCloseTimeoutRef.current = null;
                              }
                              openEditFile(file);
                              setOpenMenuFile(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors text-left border-t border-gray-700/50"
                          >
                            <MdEdit className="w-5 h-5 text-orange-400" />
                            <span className="text-white text-sm">Edit</span>
                          </button>
                        )}
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Clear any pending close timeout
                            if (menuCloseTimeoutRef.current) {
                              clearTimeout(menuCloseTimeoutRef.current);
                              menuCloseTimeoutRef.current = null;
                            }
                            setRenameFile(file);
                            setNewFileName(file.name);
                            setShowRenameDialog(true);
                            setOpenMenuFile(null);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors text-left border-t border-gray-700/50"
                        >
                          <MdDriveFileRenameOutline className="w-5 h-5 text-blue-400" />
                          <span className="text-white text-sm">Rename</span>
                        </button>
                        {console.log('🗑️ Rendering Delete button for:', file.name)}
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🚨🚨🚨 DELETE CLICKED!!! 🚨🚨🚨', file.name);
                            // Clear any pending close timeout
                            if (menuCloseTimeoutRef.current) {
                              clearTimeout(menuCloseTimeoutRef.current);
                              menuCloseTimeoutRef.current = null;
                            }
                            // Close menu and execute delete
                            setOpenMenuFile(null);
                            deleteObject(file);
                          }}
                          onMouseEnter={() => console.log('👆 Hover: Delete', file.name)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors text-left border-t border-gray-700/50"
                        >
                          <MdDelete className="w-5 h-5 text-red-400" />
                          <span className="text-white text-sm">Delete</span>
                        </button>
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
              </div>
                  );
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* New Folder Dialog */}
      {showNewFolderDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewFolderDialog(false)}>
          <div className="bg-gray-800 rounded-lg p-6 w-96 border border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Create New Folder</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createFolder()}
              placeholder="Folder name"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowNewFolderDialog(false); setNewFolderName(''); }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createFolder}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      {showRenameDialog && renameFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRenameDialog(false)}>
          <div className="bg-gray-800 rounded-lg p-6 w-96 border border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              {renameFile.isDirectory ? (
                <MdFolder className="w-5 h-5 text-blue-400" />
              ) : (
                <MdDriveFileRenameOutline className="w-5 h-5 text-blue-400" />
              )}
              Rename {renameFile.isDirectory ? 'Folder' : 'File'}
            </h3>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && renameObject()}
              placeholder="New name"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowRenameDialog(false); setRenameFile(null); setNewFileName(''); }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={renameObject}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Dialog */}
      {showUploadDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowUploadDialog(false); setUploadFiles([]); setExpandedFolders(new Set()); }}>
          <div className="bg-gray-800 rounded-lg w-full max-w-2xl border border-gray-700 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-400" />
                Upload Files
              </h3>
              <button
                onClick={() => { setShowUploadDialog(false); setUploadFiles([]); setExpandedFolders(new Set()); }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelection}
              className="hidden"
            />
            <input
              ref={folderInputRef}
              type="file"
              webkitdirectory="true"
              directory="true"
              onChange={handleFileSelection}
              className="hidden"
            />

            {/* Drag and drop area */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="mx-6 mt-6 border-2 border-dashed border-blue-500/50 rounded-lg bg-gray-900/50 hover:bg-gray-900/70 transition-colors"
            >
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <Upload className="w-16 h-16 text-blue-400 mb-3" />
                <p className="text-white mb-3 text-center">Drop files or folders here</p>
                <div className="flex gap-2">
                  <button
                    onClick={selectFiles}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <MdFileUpload className="w-5 h-5" />
                    Select Files
                  </button>
                  <button
                    onClick={selectFolder}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <MdFolder className="w-5 h-5" />
                    Select Folder
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-3">Max file size: 100MB per file</p>
              </div>
            </div>

            {/* Upload queue */}
            {uploadFiles.length > 0 && (
              <div className="mx-6 mt-4 mb-1 border border-gray-700 rounded-lg max-h-[250px] flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-700/50 border-b border-gray-700">
                  <div className="flex items-center gap-1.5">
                    <MdFileUpload className="w-5 h-5 text-blue-400" />
                    <span className="text-sm font-medium text-white">
                      Upload Queue ({uploadFiles.length})
                    </span>
                    <span className="text-xs text-gray-400">
                      • Total: {formatSize(uploadFiles.reduce((sum, f) => sum + f.file.size, 0))}
                    </span>
                  </div>
                  {uploadFiles.some(f => f.progress === 0) && (
                    <button
                      onClick={() => setUploadFiles([])}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors mr-1.5"
                    >
                      <MdDelete className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {getFileTree().map((item, index, _array) => (
                    item.type === 'folder' ? (
                      // Folder entry
                      <div key={index} className="border-b border-gray-700/50 last:border-b-0">
                        <div
                          onClick={() => toggleFolderExpansion(item.path)}
                          className="flex items-center justify-between px-4 py-2 bg-gray-700/30 hover:bg-gray-700/40 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <MdFolder className="w-5 h-5 text-orange-400 flex-shrink-0" />
                            <span className="text-sm font-medium text-white truncate">{item.name}</span>
                            <span className="text-xs text-gray-400">
                              ({item.files.length} files, {formatSize(item.totalSize)})
                            </span>
                          </div>
                          <ChevronRight
                            className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
                              expandedFolders.has(item.path) ? 'rotate-90' : ''
                            }`}
                          />
                        </div>

                        {/* Files in folder */}
                        {expandedFolders.has(item.path) && item.files.map((fileObj, fileIndex) => (
                          <div key={fileIndex} className="px-4 py-2 pl-12 bg-gray-900/30 border-t border-gray-700/30">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <MdInsertDriveFile className={`w-4 h-4 flex-shrink-0 ${
                                  fileObj.uploaded ? 'text-blue-400' : 'text-gray-400'
                                }`} />
                                <span className="text-sm text-white truncate">{fileObj.file.name}</span>
                                <span className="text-xs text-gray-500 flex-shrink-0">{formatSize(fileObj.file.size)}</span>
                              </div>
                              {fileObj.progress === 0 && !fileObj.uploading && (
                                <button
                                  onClick={() => removeUploadFile(fileObj)}
                                  className="text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
                                  title="Remove"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                              {fileObj.uploaded && (
                                <MdCheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                              )}
                            </div>
                            {(fileObj.uploading || fileObj.uploaded) && (
                              <div className="w-full bg-gray-700 rounded-full h-1 overflow-hidden">
                                <div
                                  className="bg-blue-500 h-1 rounded-full transition-all"
                                  style={{ width: `${fileObj.progress}%` }}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      // Single file entry
                      <div key={index} className="px-4 py-2 border-b border-gray-700/50 last:border-b-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <MdInsertDriveFile className={`w-5 h-5 flex-shrink-0 ${
                              item.uploaded ? 'text-blue-400' : 'text-gray-400'
                            }`} />
                            <span className="text-sm text-white truncate">{item.file.name}</span>
                            <span className="text-xs text-gray-500 flex-shrink-0">{formatSize(item.file.size)}</span>
                          </div>
                          {item.progress === 0 && !item.uploading && (
                            <button
                              onClick={() => removeUploadFile(item)}
                              className="text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
                              title="Remove"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                          {item.uploaded && (
                            <MdCheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
                          )}
                        </div>
                        {(item.uploading || item.uploaded) && (
                          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-center px-6 pb-3 pt-3">
              <button
                onClick={handleUpload}
                disabled={uploadFiles.length === 0 || uploadFiles.every(f => f.uploaded)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Upload Files
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {showEditDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowEditDialog(false); setEditFile(null); setEditContent(''); setHasChanges(false); }}>
          <div className="bg-gray-800 rounded-lg w-[90vw] max-w-6xl h-[85vh] border border-gray-700 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-2 bg-gray-900/50 border-b border-gray-700">
              <div className="flex items-center gap-1.5">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <MdEdit className="w-5 h-5 text-orange-400" />
                  {editFile?.name}
                </h3>
                {hasChanges && (
                  <span className="text-xs text-orange-400 bg-orange-400/10 px-2 py-1 rounded">
                    Modified
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <CustomSelect
                  id="editor-language"
                  value={editLanguage}
                  onChange={(e) => setEditLanguage(e.target.value)}
                  options={[
                    { value: 'plaintext', label: 'Plain Text' },
                    { value: 'javascript', label: 'JavaScript' },
                    { value: 'typescript', label: 'TypeScript' },
                    { value: 'json', label: 'JSON' },
                    { value: 'html', label: 'HTML' },
                    { value: 'css', label: 'CSS' },
                    { value: 'scss', label: 'SCSS' },
                    { value: 'python', label: 'Python' },
                    { value: 'java', label: 'Java' },
                    { value: 'c', label: 'C' },
                    { value: 'cpp', label: 'C++' },
                    { value: 'csharp', label: 'C#' },
                    { value: 'php', label: 'PHP' },
                    { value: 'ruby', label: 'Ruby' },
                    { value: 'go', label: 'Go' },
                    { value: 'rust', label: 'Rust' },
                    { value: 'sql', label: 'SQL' },
                    { value: 'shell', label: 'Shell' },
                    { value: 'yaml', label: 'YAML' },
                    { value: 'xml', label: 'XML' },
                    { value: 'markdown', label: 'Markdown' },
                    { value: 'dockerfile', label: 'Dockerfile' },
                  ]}
                  className="w-48"
                />
                <button
                  onClick={() => { setShowEditDialog(false); setEditFile(null); setEditContent(''); setHasChanges(false); }}
                  className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 text-gray-400 hover:text-white transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            {isLoadingFile ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading file...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 border-y border-gray-700 overflow-hidden">
                  <Suspense fallback={
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-400">Loading editor...</p>
                      </div>
                    </div>
                  }>
                    <Editor
                      height="100%"
                      language={editLanguage}
                      value={editContent}
                      theme="vs-dark"
                      onChange={(value) => {
                        setEditContent(value || '');
                        setHasChanges(true);
                      }}
                      onMount={(editor) => {
                        editorRef.current = editor;
                      }}
                      options={{
                        automaticLayout: true,
                        formatOnType: true,
                        formatOnPaste: true,
                        fontSize: 14,
                        fontFamily: '"Courier New", Courier, monospace',
                        lineHeight: 19,
                        wordWrap: 'off',
                        minimap: {
                          enabled: true,
                          side: 'right',
                          showSlider: 'mouseover',
                          renderCharacters: true,
                          maxColumn: 120
                        },
                        scrollBeyondLastLine: false,
                        scrollBeyondLastColumn: 5,
                        renderWhitespace: 'selection',
                        tabSize: 2,
                        insertSpaces: true,
                      }}
                    />
                  </Suspense>
                </div>

                {/* Footer */}
                <div className="flex justify-end items-center px-6 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowEditDialog(false); setEditFile(null); setEditContent(''); setHasChanges(false); }}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEditFile}
                      disabled={isSavingFile || !hasChanges}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSavingFile ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Saving...
                        </>
                      ) : (
                        'Save'
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowDeleteDialog(false); setFileToDelete(null); }}>
          <div className="bg-gray-800 rounded-lg w-full max-w-md border border-gray-700" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MdDelete className="w-5 h-5 text-red-400" />
                Confirm Delete
              </h3>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <p className="text-white mb-2">Are you sure you want to delete this {fileToDelete?.type === 'directory' ? 'folder' : 'file'}?</p>
              <p className="text-gray-400 text-sm font-mono bg-gray-900/50 px-3 py-2 rounded border border-gray-700">
                {fileToDelete?.name}
              </p>
              {fileToDelete?.type === 'directory' && (
                <p className="text-orange-400 text-sm mt-3 flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  This will delete all contents inside the folder.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-700">
              <button
                onClick={() => { setShowDeleteDialog(false); setFileToDelete(null); }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <MdDelete className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Progress Dialog */}
      {showDownloadDialog && downloadQueue.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => downloadQueue.every(d => d.completed) && setShowDownloadDialog(false)}>
          <div className="bg-gray-800 rounded-lg w-full max-w-2xl border border-gray-700 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MdDownload className="w-5 h-5 text-blue-400" />
                Downloads ({downloadQueue.length})
              </h3>
              <button
                onClick={() => setShowDownloadDialog(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Download Queue */}
            <div className="mx-6 mt-4 mb-6 border border-gray-700 rounded-lg max-h-[300px] flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-700/50 border-b border-gray-700">
                <div className="flex items-center gap-1.5">
                  <MdDownload className="w-5 h-5 text-blue-400" />
                  <span className="text-sm font-medium text-white">
                    Download Queue ({downloadQueue.length})
                  </span>
                </div>
                {downloadQueue.some(d => d.completed) && (
                  <button
                    onClick={() => setDownloadQueue(prev => prev.filter(d => !d.completed))}
                    className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
                    title="Clear completed"
                  >
                    Clear Completed
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {downloadQueue.map((download) => (
                  <div key={download.id} className="px-4 py-3 border-b border-gray-700/50 last:border-b-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <MdInsertDriveFile className={`w-5 h-5 flex-shrink-0 ${
                          download.completed ? 'text-blue-400' : download.error ? 'text-red-400' : 'text-gray-400'
                        }`} />
                        <span className="text-sm text-white truncate">{download.name}</span>
                        {download.size > 0 && (
                          <span className="text-xs text-gray-500 flex-shrink-0">{formatSize(download.size)}</span>
                        )}
                      </div>

                      {/* Action Icons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {download.completed && (
                          <>
                            <MdCheckCircle className="w-4 h-4 text-blue-400" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDownloadQueue(prev => prev.filter(d => d.id !== download.id));
                              }}
                              className="p-1 hover:bg-gray-700 rounded transition-colors"
                              title="Remove"
                            >
                              <X className="w-4 h-4 text-gray-400 hover:text-gray-300" />
                            </button>
                          </>
                        )}
                        {download.error && (
                          <>
                            <span className="text-xs text-red-400 mr-1">Failed</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDownloadQueue(prev => prev.filter(d => d.id !== download.id));
                              }}
                              className="p-1 hover:bg-gray-700 rounded transition-colors"
                              title="Dismiss"
                            >
                              <X className="w-4 h-4 text-red-400 hover:text-red-300" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {(download.downloading || download.completed) && (
                      <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            download.error ? 'bg-red-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${download.progress}%` }}
                        />
                      </div>
                    )}
                    {download.error && (
                      <p className="text-xs text-red-400 mt-1">{download.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Backup Tab - Backup and restore functionality
// The stamp on a parked save is the compact form the restore wrote (YYYYMMDDHHMMSS), not a
// date the browser can parse — so turn it back into something readable.
const formatStamp = (stamp) => {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(stamp || ''));
  if (!m) return stamp || 'an earlier restore';
  const [, y, mo, d, h, mi] = m;
  return `${d}.${mo}.${y} ${h}:${mi}`;
};

const BackupTab = ({ server, masterLocation, onMasterError }) => {
  const [selectedComponents, setSelectedComponents] = useState([]);
  const [availableComponents, setAvailableComponents] = useState([]);
  const [backupList, setBackupList] = useState([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupProgress, setBackupProgress] = useState('');
  const [_fileProgress, setFileProgress] = useState([]);
  const [showProgress, setShowProgress] = useState(false);
  const [isLoadingBackups, setIsLoadingBackups] = useState(true);
  const [downloadingFile, setDownloadingFile] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [deletingFile, setDeletingFile] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [restoringFile, setRestoringFile] = useState(null);
  const [restoreProgress, setRestoreProgress] = useState('');

  // Restore from upload/remote states
  const [uploadFiles, setUploadFiles] = useState([]);
  const [remoteUrlItems, setRemoteUrlItems] = useState([]);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isRestoringRemote, setIsRestoringRemote] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [restoreTab, setRestoreTab] = useState('upload'); // 'upload', 'remote'
  const fileInputRef = useRef(null);
  const activeStreamRef = useRef(null);
  const backupTimersRef = useRef([]);

  // ── In-game snapshots ───────────────────────────────────────────────────────
  // Palworld keeps its own rotating restore points in
  //   Pal/Saved/SaveGames/0/<worldGuid>/backup/world/<YYYY.MM.DD-HH.MM.SS>/
  // Each one holds Level.sav, LevelMeta.sav AND Players/, so restoring brings back a
  // WORKING copy of a player's character instead of deleting it — the usual advice for
  // a player stuck on the loading screen costs them everything.
  //
  // They are NOT a backup: the game rotates them and they live on the same node.
  const [snapshots, setSnapshots] = useState([]);
  const [worldGuid, setWorldGuid] = useState('');
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [restoringSnapshot, setRestoringSnapshot] = useState(null);
  const [snapshotStep, setSnapshotStep] = useState('');
  const [snapshotToRestore, setSnapshotToRestore] = useState(null);
  const [snapshotError, setSnapshotError] = useState('');
  const [undoStamp, setUndoStamp] = useState('');   // stamp of the save a restore replaced
  const [undoing, setUndoing] = useState(false);

  // Snapshots must be read from the world the server actually boots, not whichever folder
  // happens to be listed first. The warning UI lives in the file browser, where the folders
  // are visible — this tab only consumes the audit.
  const { auditWorlds } = useWorldAudit(server, masterLocation, { auto: false });

  const snapshotComponent = server?.version >= 4 && server?.compose?.length > 0
    ? server.compose[0].name
    : 'null';

  // Where the app volume is mounted INSIDE the container. Taken from containerData
  // ("g:/palworld/Pal/Saved" -> "/palworld/Pal/Saved") rather than hardcoded, because that
  // path belongs to the image, not to us: a marketplace image change would silently break
  // every exec. Extra mounts are pipe-separated, so only the primary volume is used.
  const containerBasePath = (() => {
    const raw = String(server?.compose?.[0]?.containerData || '').split('|')[0].trim();
    const path = raw.replace(/^[a-z]+:/i, '');
    return path.startsWith('/') ? path : '/palworld/Pal/Saved';
  })();

  const nodeUrlFor = useCallback((path) => {
    if (!masterLocation?.ip) return null;
    const [host, port = 16127] = masterLocation.ip.split(':');
    return `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io${path}`;
  }, [masterLocation]);

  const listFolder = useCallback(async (relPath) => {
    const url = nodeUrlFor(`/apps/getfolderinfo/${server.name}/${snapshotComponent}/${encodeURIComponent(relPath)}`);
    if (!url) return [];
    const zelidauth = await secureStorage.getItem('zelidauth');
    const res = await fetch(url, { headers: { zelidauth: JSON.stringify(zelidauth), 'x-apicache-bypass': true } });
    const data = await res.json();
    return data.status === 'success' && Array.isArray(data.data) ? data.data : [];
  }, [nodeUrlFor, server?.name, snapshotComponent]);

  // Shared by restore and undo — a rename inside one directory, which is what makes both
  // operations atomic. FluxOS rejects a new name containing "/", so this can only ever move
  // a file within its own folder, which is exactly the guarantee we want here.
  const renameInWorld = useCallback(async (relWorld, from, to) => {
    const zelidauth = await secureStorage.getItem('zelidauth');
    const url = nodeUrlFor(`/apps/renameobject/${server.name}/${snapshotComponent}/${encodeURIComponent(`${relWorld}/${from}`)}/${to}`);
    const res = await fetch(url, { headers: { zelidauth: JSON.stringify(zelidauth) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.status === 'error') throw new Error(body?.data?.message || `rename ${from} failed`);
  }, [nodeUrlFor, server?.name, snapshotComponent]);

  const loadSnapshots = useCallback(async () => {
    if (!masterLocation) return;
    setLoadingSnapshots(true);
    setSnapshotError('');
    try {
      // The world folder is a GUID the game picks, so it has to be discovered.
      const worlds = await listFolder('appdata/SaveGames/0');
      // Prefer the world the server actually boots. Taking the first directory silently
      // operated on an arbitrary world once a second one existed — exactly the state a
      // cross-server restore leaves behind.
      const audit = await auditWorlds();
      const dirs = worlds.filter((w) => w.isDirectory).map((w) => w.name);
      const guid = (audit?.active && dirs.includes(audit.active)) ? audit.active : dirs[0];
      if (!guid) { setSnapshots([]); return; }
      setWorldGuid(guid);

      const list = await listFolder(`appdata/SaveGames/0/${guid}/backup/world`);
      setSnapshots(
        list.filter((f) => f.isDirectory)
          .map((f) => ({ name: f.name, at: new Date(f.modifiedAt) }))
          .sort((a, b) => b.at - a.at),
      );

      // A previous restore leaves the save it replaced as *.pre-restore-<stamp>. Finding one
      // is what makes "undo" possible — otherwise the only way back is renaming files by hand.
      const world = await listFolder(`appdata/SaveGames/0/${guid}`);
      const parked = world.find((f) => /^Level\.sav\.pre-restore-\d+$/.test(f.name));
      setUndoStamp(parked ? parked.name.split('pre-restore-')[1] : '');
    } catch (e) {
      setSnapshotError(e.message || 'Could not read in-game snapshots.');
    } finally {
      setLoadingSnapshots(false);
    }
  }, [masterLocation, listFolder, auditWorlds]);

  useEffect(() => {
    if (restoreTab === 'snapshots') loadSnapshots();
  }, [restoreTab, loadSnapshots]);

  /**
   * Restore an in-game snapshot without ever leaving the world in a half-written state.
   *
   * The two primitives available have opposite constraints, and the whole sequence is
   * built around that:
   *   - `appexec` (cp) needs the container RUNNING — docker exec cannot touch a stopped one.
   *   - `renameobject` (mv -T) works whatever the container is doing, because FluxOS runs it
   *     on the host volume, but it refuses a name containing "/" so it can only rename
   *     WITHIN a directory.
   *
   * So: copy while the server runs (into sibling names, originals untouched), then stop and
   * swap by renaming only. A rename inside one directory is atomic — there is no instant
   * where the old world is gone and the new one is not yet in place. Nothing is deleted:
   * the previous save stays as *.pre-restore-<stamp> and the swap can be undone.
   */
  const restoreSnapshot = useCallback(async (snapshot) => {
    if (!worldGuid || !masterLocation) return;
    const stamp = snapshot.name.replace(/[^0-9]/g, '').slice(0, 14);
    // The same files are addressed two different ways and mixing them up silently targets
    // nothing: exec runs INSIDE the container and needs the absolute container path, while
    // the file API runs on the HOST and takes a path relative to the volume root, where the
    // primary volume is exposed as `appdata`. Verified live: exec on
    // `<base>/SaveGames/0` and getfolderinfo on `appdata/SaveGames/0` list the same world.
    const worldDir = `${containerBasePath}/SaveGames/0/${worldGuid}`;   // exec (container)
    const snapDir = `${worldDir}/backup/world/${snapshot.name}`;        // exec (container)
    const relWorld = `appdata/SaveGames/0/${worldGuid}`;                // file API (host)
    const ITEMS = ['Level.sav', 'LevelMeta.sav', 'Players'];

    setRestoringSnapshot(snapshot.name);
    setSnapshotError('');
    const zelidauth = await secureStorage.getItem('zelidauth');
    const [host, port = 16127] = masterLocation.ip.split(':');

    const exec = async (cmd) => {
      const res = await fetch(`/api/appexec/${host}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port, appname: `${snapshotComponent}_${server.name}`, cmd, zelidauth }),
      });
      const body = await res.json();
      if (!res.ok || body.error) throw new Error(body.error || `exec failed (HTTP ${res.status})`);
      return String(body.data || '');
    };

    const rename = async (from, to) => {
      const url = nodeUrlFor(`/apps/renameobject/${server.name}/${snapshotComponent}/${encodeURIComponent(`${relWorld}/${from}`)}/${to}`);
      const res = await fetch(url, { headers: { zelidauth: JSON.stringify(zelidauth) } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.status === 'error') throw new Error(body?.data?.message || `rename ${from} failed`);
    };

    const swapped = [];
    try {
      // 1. Copy while the server is still up. Only *.restore-<stamp> siblings appear;
      //    the live save is untouched, so a failure here changes nothing.
      setSnapshotStep('Copying snapshot…');
      const copies = ITEMS
        .map((i) => `[ -e "${snapDir}/${i}" ] && cp -a "${snapDir}/${i}" "${worldDir}/${i}.restore-${stamp}" || true`)
        .join('; ');
      await exec(['sh', '-c', `set -e; ${copies}`]);

      // 2. Verify the copies landed BEFORE stopping anything.
      const staged = await exec(['sh', '-c', `ls -1 "${worldDir}" | grep -c ".restore-${stamp}$" || true`]);
      if (!parseInt(staged, 10)) throw new Error('Snapshot could not be copied — nothing was changed.');

      // 3. Stop, swap by rename, start. withAppStopped restarts the app in its finally,
      //    so the server comes back even if the swap throws.
      setSnapshotStep('Stopping server…');
      await withAppStopped(
        nodeApiBase(masterLocation.ip),
        server.name,
        JSON.stringify(zelidauth),
        async () => {
          setSnapshotStep('Swapping save files…');
          const present = await listFolder(relWorld);
          const names = present.map((f) => f.name);
          for (const item of ITEMS) {
            if (!names.includes(`${item}.restore-${stamp}`)) continue;
            if (names.includes(item)) {
              await rename(item, `${item}.pre-restore-${stamp}`);
              swapped.push([`${item}.pre-restore-${stamp}`, item]);
            }
            await rename(`${item}.restore-${stamp}`, item);
          }
        },
      );

      setSnapshotStep('');
      toast.success(`Restored the save from ${snapshot.at.toLocaleString()}`);
      loadSnapshots();
    } catch (e) {
      // Put back whatever was already moved aside, so a partial swap cannot survive.
      for (const [parked, original] of swapped.reverse()) {
        try { await rename(parked, original); } catch { /* leave it for manual recovery */ }
      }
      setSnapshotError(e.message || 'Restore failed — the previous save was kept.');
      toast.error(e.message || 'Restore failed');
    } finally {
      setRestoringSnapshot(null);
      setSnapshotStep('');
    }
  }, [worldGuid, masterLocation, server?.name, snapshotComponent, nodeUrlFor, listFolder, loadSnapshots, containerBasePath]);

  /**
   * Put back the save a restore replaced.
   *
   * Implemented as a three-way SWAP rather than "move the parked file back": the current save
   * takes the parked file's name, so exactly one spare copy exists no matter how many times
   * this is used. Moving it back instead would either lose the current save or leave a new
   * file behind on every undo.
   *
   * Renames only, and only inside the world folder — nothing is copied, nothing is deleted,
   * and each step is atomic.
   */
  const undoRestore = useCallback(async () => {
    if (!worldGuid || !undoStamp || !masterLocation) return;
    const relWorld = `appdata/SaveGames/0/${worldGuid}`;
    const zelidauth = await secureStorage.getItem('zelidauth');

    setUndoing(true);
    setSnapshotError('');
    try {
      await withAppStopped(
        nodeApiBase(masterLocation.ip),
        server.name,
        JSON.stringify(zelidauth),
        async () => {
          const present = (await listFolder(relWorld)).map((f) => f.name);
          for (const item of ['Level.sav', 'LevelMeta.sav', 'Players']) {
            const parked = `${item}.pre-restore-${undoStamp}`;
            if (!present.includes(parked)) continue;
            const tmp = `${item}.swap-${undoStamp}`;
            if (present.includes(item)) await renameInWorld(relWorld, item, tmp);
            await renameInWorld(relWorld, parked, item);
            if (present.includes(item)) await renameInWorld(relWorld, tmp, parked);
          }
        },
      );
      toast.success('Restore undone — the previous save is back');
      loadSnapshots();
    } catch (e) {
      setSnapshotError(e.message || 'Undo failed.');
      toast.error(e.message || 'Undo failed');
    } finally {
      setUndoing(false);
    }
  }, [worldGuid, undoStamp, masterLocation, server?.name, listFolder, renameInWorld, loadSnapshots]);

  // Cleanup streams and timers on unmount
  useEffect(() => {
    const stream = activeStreamRef.current;
    const timers = backupTimersRef.current;
    return () => {
      stream?.cancel?.();
      timers.forEach(clearTimeout);
    };
  }, []);

  // FluxDrive endpoint
  const FLUXDRIVE_ENDPOINT = 'https://mws.fluxdrive.runonflux.io';
  // masterLocation is passed down from parent - no DNS resolution needed

  // Load available components from server spec
  useEffect(() => {
    if (server?.compose && server.compose.length > 0) {
      const components = server.compose.map(comp => comp.name);
      setAvailableComponents(components);
    } else if (server?.name) {
      // Fallback for v3 apps or custom deployments without compose
      setAvailableComponents([server.name]);
    }
  }, [server]);

  // Load backup list (FluxOS pattern - per component)
  const loadBackupList = async () => {
    try {
      setIsLoadingBackups(true);

      if (!masterLocation) {
        console.log('⏳ Waiting for master location...');
        return;
      }

      const zelidauth = await secureStorage.getItem('zelidauth');
      const [host, port = 16127] = masterLocation.ip.split(':');
      const baseUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io`;

      console.log('📦 Loading backups from master:', { host, port });

      const resultList = [];

      // Loop through each component (FluxOS pattern)
      for (const component of availableComponents) {
        try {
          // 1. Get volume mount path for this component
          const volumeUrl = `${baseUrl}/backup/getvolumedataofcomponent/${server.name}/${component}/B/0/mount`;
          const volumeResponse = await fetch(volumeUrl, {
            headers: { zelidauth: JSON.stringify(zelidauth) }
          });
          const volumeData = await volumeResponse.json();

          if (volumeData?.status !== 'success' || !volumeData?.data?.mount) {
            console.log(`⚠️ No volume data for ${component}`);
            continue;
          }

          const mountPath = volumeData.data.mount;
          console.log(`✅ Volume path for ${component}:`, mountPath);

          // 2. Get backup list for this component's backup directory
          // FluxOS uses 'local' as the backup type subdirectory
          const backupPath = `${mountPath}/backup/local`;
          const backupUrl = `${baseUrl}/backup/getlocalbackuplist/${encodeURIComponent(backupPath)}/B/0/true/${server.name}`;

          console.log(`🔍 Checking backup path:`, backupPath);

          const backupResponse = await fetch(backupUrl, {
            headers: { zelidauth: JSON.stringify(zelidauth) }
          });
          const backupData = await backupResponse.json();

          if (backupData?.status === 'success' && Array.isArray(backupData?.data) && backupData.data.length > 0) {
            const backupItem = backupData.data[0]; // Get first (most recent) backup
            console.log(`✅ Found backup for ${component}:`, backupItem);
            resultList.push({
              component: component,
              create: +backupItem.create,
              file_size: backupItem.size,
              file: `${backupPath}/${backupItem.name}`,
              // The archive's real name on disk, matching fluxos-frontend's
              // `file.split('/').pop()`. A timestamped name here meant a downloaded
              // backup could never be uploaded back — the restore reads a fixed path.
              file_name: backupItem.name,
            });
            console.log(`📝 Backup item stored:`, {
              component,
              file_name: backupItem.name,
              file: `${backupPath}/${backupItem.name}`
            });
          } else {
            console.log(`ℹ️ No backups for ${component}`);
          }
        } catch (compError) {
          console.error(`Error loading backup for ${component}:`, compError);
        }
      }

      // Also load FluxDrive backups
      await loadFluxDriveBackups(resultList);

      setBackupList(resultList);
      console.log('📦 Total backups found (local + FluxDrive):', resultList.length);
    } catch (error) {
      if (error instanceof TypeError) onMasterError();
      console.error('Error loading backup list:', error);
      setBackupList([]);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  // Load FluxDrive backups and add them to the backup list
  const loadFluxDriveBackups = async (resultList) => {
    try {
      const zelidauth = await secureStorage.getItem('zelidauth');

      const response = await fetch(
        `${FLUXDRIVE_ENDPOINT}/getbackuplist?appname=${server.name}`,
        {
          headers: { zelidauth: JSON.stringify(zelidauth) }
        }
      );

      const data = await response.json();

      if (data?.status === 'success' && Array.isArray(data?.checkpoints)) {
        console.log('☁️ FluxDrive checkpoints found:', data.checkpoints.length);

        // Process each checkpoint and extract components
        for (const checkpoint of data.checkpoints) {
          if (checkpoint.components && Array.isArray(checkpoint.components)) {
            for (const comp of checkpoint.components) {
              resultList.push({
                component: comp.component,
                create: checkpoint.timestamp,
                file_size: comp.file_size,
                file: comp.file_url, // Use file_url for FluxDrive backups
                // Same scheme as fluxos-frontend: the archive's real name, not a
                // timestamped one. Keeping it means a downloaded file can be handed
                // straight back to the Upload tab.
                file_name: `backup_${String(comp.component || '').toLowerCase()}.tar.gz`,
                source: 'fluxdrive', // Mark as FluxDrive backup
                file_url: comp.file_url, // Keep the download URL
                checkpoint_id: checkpoint.timestamp, // For deletion
              });
            }
          }
        }

        console.log('✅ Added FluxDrive backups to list');
      } else if (data?.status === 'error') {
        console.warn('⚠️ FluxDrive API error:', data.data?.message || 'Unknown error');
      }
    } catch (error) {
      if (error instanceof TypeError) onMasterError();
      console.error('❌ Error loading FluxDrive backups:', error);
      // Don't fail if FluxDrive is unavailable - just continue with local backups
    }
  };

  useEffect(() => {
    if (masterLocation && availableComponents.length > 0) {
      loadBackupList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.name, masterLocation, availableComponents]);

  // Create backup with streaming progress
  const createBackup = async () => {
    // Use first component if none selected
    const componentsToBackup = selectedComponents.length === 0
      ? (availableComponents.length > 0 ? [availableComponents[0]] : [])
      : selectedComponents;

    if (componentsToBackup.length === 0) return;

    if (!masterLocation) {
      setBackupProgress('Error: Master location not available');
      return;
    }

    setIsCreatingBackup(true);
    setShowProgress(true);
    setBackupProgress('Initializing backup jobs...');
    setFileProgress([]);

    try {
      const zelidauth = await secureStorage.getItem('zelidauth');

      // Build request body - use availableComponents as fallback for v3 apps
      const compList = server.compose?.length > 0
        ? server.compose.map(comp => comp.name)
        : availableComponents;
      const postBody = {
        appname: server.name,
        backup: compList.map(name => ({
          component: name,
          backup: componentsToBackup.includes(name)
        }))
      };

      const [host, port = 16127] = masterLocation.ip.split(':');
      const queryUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/apps/appendbackuptask`;

      console.log('💾 Creating backup on master:', { host, port });

      const response = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'zelidauth': JSON.stringify(zelidauth),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postBody)
      });

      const reader = response.body.getReader();
      activeStreamRef.current = reader;
      const decoder = new TextDecoder();

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkText = decoder.decode(value);
            const chunks = chunkText.split('\n');

            for (const chunk of chunks) {
              if (chunk.trim()) {
                setBackupProgress(chunk);
                console.log('Backup progress:', chunk);
              }
            }
          }
        } finally {
          activeStreamRef.current = null;
        }
      };

      await processStream();

      const tid7 = setTimeout(() => {
        setIsCreatingBackup(false);
        setShowProgress(false);
        setBackupProgress('');
        setSelectedComponents([]);
        loadBackupList();
      }, 3000);
      backupTimersRef.current.push(tid7);

    } catch (error) {
      if (error instanceof TypeError) onMasterError();
      console.error('Error creating backup:', error);
      setBackupProgress(`Error: ${error.message}`);
      const tid8 = setTimeout(() => {
        setIsCreatingBackup(false);
        setShowProgress(false);
      }, 5000);
      backupTimersRef.current.push(tid8);
    }
  };

  // Download backup file
  const downloadBackup = async (backupFile) => {
    try {
      const isFluxDrive = backupFile.source === 'fluxdrive';

      if (isFluxDrive) {
        // For FluxDrive backups, use direct link (CORS prevents fetch)
        const fileName = backupFile.file_name;
        console.log('⬇️ Downloading from FluxDrive:', { fileName, url: backupFile.file_url });

        const link = document.createElement('a');
        link.href = backupFile.file_url;
        link.setAttribute('download', fileName);
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('✅ Download initiated:', fileName);
        return;
      }

      // For local backups, download from master node with progress tracking
      if (!masterLocation) {
        console.error('Master location not available');
        return;
      }

      setDownloadingFile(backupFile.file);
      setDownloadProgress(0);
      const zelidauth = await secureStorage.getItem('zelidauth');
      const fileName = backupFile.file_name;
      const [host, port = 16127] = masterLocation.ip.split(':');
      const apiUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/backup/downloadlocalfile/${encodeURIComponent(backupFile.file)}/${server.name}`;

      console.log('⬇️ Downloading from master:', { host, port, fileName });

      const response = await fetch(apiUrl, {
        headers: { zelidauth: JSON.stringify(zelidauth) }
      });

      if (!response.ok) throw new Error('Download failed');

      // Get file size from headers
      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength, 10);

      // Read stream with progress tracking
      const reader = response.body.getReader();
      activeStreamRef.current = reader;
      const chunks = [];
      let receivedLength = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          receivedLength += value.length;

          if (total) {
            const progress = Math.round((receivedLength / total) * 100);
            setDownloadProgress(progress);
          }
        }
      } finally {
        activeStreamRef.current = null;
      }

      // Create blob from chunks
      const blob = new Blob(chunks);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('✅ Download completed:', fileName);
    } catch (error) {
      if (error instanceof TypeError) onMasterError();
      console.error('❌ Error downloading backup:', error);
    } finally {
      setDownloadingFile(null);
      setDownloadProgress(0);
    }
  };

  // Show delete confirmation
  const confirmDelete = (backupFile) => {
    setFileToDelete(backupFile);
    setShowDeleteConfirm(true);
  };

  // Delete backup file (local or FluxDrive)
  const deleteBackup = async () => {
    if (!fileToDelete) return;

    try {
      setDeletingFile(fileToDelete.file);
      setShowDeleteConfirm(false);

      const zelidauth = await secureStorage.getItem('zelidauth');

      // Check if this is a FluxDrive backup
      if (fileToDelete.source === 'fluxdrive') {
        // Delete from FluxDrive
        console.log('☁️ Deleting FluxDrive checkpoint:', fileToDelete.checkpoint_id);

        const response = await fetch(
          `${FLUXDRIVE_ENDPOINT}/removeCheckpoint`,
          {
            method: 'POST',
            headers: {
              'zelidauth': JSON.stringify(zelidauth),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              appname: server.name,
              timestamp: fileToDelete.checkpoint_id,
            })
          }
        );

        const data = await response.json();

        if (data?.status === 'success') {
          loadBackupList();
        } else {
          console.error('Failed to delete FluxDrive checkpoint:', data);
          alert('Failed to delete FluxDrive backup: ' + (data?.message || 'Unknown error'));
        }
      } else {
        // Delete local backup
        if (!masterLocation) {
          console.error('Master location not available');
          return;
        }

        const [host, port = 16127] = masterLocation.ip.split(':');
        const apiUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/backup/removebackupfile/${encodeURIComponent(fileToDelete.file)}/${server.name}`;

        console.log('🗑️ Deleting local backup from master:', { host, port });

        const response = await fetch(apiUrl, {
          headers: { zelidauth: JSON.stringify(zelidauth) }
        });

        const data = await response.json();

        if (data?.status === 'success') {
          loadBackupList();
        } else {
          console.error('Failed to delete backup:', data);
          alert('Failed to delete backup: ' + (data?.message || 'Unknown error'));
        }
      }
    } catch (error) {
      if (error instanceof TypeError) onMasterError();
      console.error('Error deleting backup:', error);
      alert('Failed to delete backup: ' + error.message);
    } finally {
      setDeletingFile(null);
      setFileToDelete(null);
    }
  };

  // Restore backup from local file or FluxDrive
  const restoreBackup = async (backupFile) => {
    try {
      if (!masterLocation) {
        console.error('Master location not available');
        return;
      }

      setRestoringFile(backupFile.file);

      // Check if this is a FluxDrive backup
      const isFluxDrive = backupFile.source === 'fluxdrive';

      if (isFluxDrive) {
        setRestoreProgress('Initializing restore from FluxDrive...');
        console.log('☁️ Restoring from FluxDrive:', backupFile.file_url);
      } else {
        setRestoreProgress('Initializing restore...');
      }

      const zelidauth = await secureStorage.getItem('zelidauth');

      // Build restore request body - different for local vs FluxDrive
      const compList = server.compose?.length > 0
        ? server.compose.map(comp => comp.name)
        : availableComponents;

      // FluxDrive reports a component name that does not match the app spec — its inventory
      // returns "palworldpalworld" for a component the spec calls "palworld", and the
      // official fluxos-frontend renders the same string, so it originates in the backend.
      // Comparing it literally left every entry restore:false, and appendRestoreTask then
      // rejects the whole job with "No restore jobs..." before it does anything.
      const targetComponent = (() => {
        const reported = backupFile.component || '';
        if (compList.includes(reported)) return reported;
        // Longest prefix wins. With components like ["web", "webapi"] a first-match rule
        // would resolve "webapi…" to "web" and restore the wrong volume — Palworld has a
        // single component, but this block gets copied between the game panels.
        const prefixed = compList
          .filter((name) => name && reported.startsWith(name))
          .sort((a, b) => b.length - a.length)[0];
        if (prefixed) return prefixed;
        // Single-component apps (Palworld is one) have no ambiguity left to resolve.
        return compList.length === 1 ? compList[0] : '';
      })();

      if (!targetComponent) {
        throw new Error(`Could not match backup component "${backupFile.component}" to this app`);
      }

      const postBody = {
        appname: server.name,
        type: isFluxDrive ? 'remote' : 'local',
        restore: compList.map(name => ({
          component: name,
          restore: name === targetComponent,
          // For FluxDrive, use URL; for local, use filepath
          ...(isFluxDrive
            ? { url: name === targetComponent ? backupFile.file_url : '' }
            : { filepath: name === targetComponent ? backupFile.file : '' }
          ),
          file_size: name === targetComponent ? backupFile.file_size : 0
        }))
      };

      const [host, port = 16127] = masterLocation.ip.split(':');
      const apiUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/apps/appendrestoretask`;

      console.log('🔄 Restoring backup on master:', { host, port, component: backupFile.component });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'zelidauth': JSON.stringify(zelidauth),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postBody)
      });

      if (!response.ok) throw new Error('Restore failed');

      // Read streaming response
      const reader = response.body.getReader();
      activeStreamRef.current = reader;
      const decoder = new TextDecoder();

      try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.status === 'error') {
              throw new Error(data.data?.message || 'Restore failed');
            }
            if (data.data) {
              setRestoreProgress(data.data);
            }
          } catch {
            // Not JSON, likely progress text
            if (line.trim()) {
              setRestoreProgress(line);
            }
          }
        }
      }
      } finally {
        activeStreamRef.current = null;
      }

      setRestoreProgress('Restore completed successfully!');
      const tid1 = setTimeout(() => {
        setRestoreProgress('');
      }, 3000);
      backupTimersRef.current.push(tid1);
    } catch (error) {
      if (error instanceof TypeError) onMasterError();
      console.error('Error restoring backup:', error);
      setRestoreProgress(`❌ Error: ${error.message}`);
      const tid2 = setTimeout(() => setRestoreProgress(''), 5000);
      backupTimersRef.current.push(tid2);
    } finally {
      setRestoringFile(null);
    }
  };

  // Handle file selection for upload
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const firstComponent = availableComponents[0] || server.compose?.[0]?.name || server.name;
    // Resolve the upload name at selection, the way fluxos-frontend does, so the queue
    // shows what will actually be written. Deciding it inside the upload loop meant the
    // list said "mysave.tar.gz" while the node received "backup_palworld.tar.gz".
    const newFiles = files.map(file => ({
      file,
      component: firstComponent,
      name: `backup_${String(firstComponent).toLowerCase()}.tar.gz`,
      originalName: file.name,
      size: file.size
    }));
    setUploadFiles(prev => [...prev, ...newFiles]);
  };

  // Remove file from upload queue
  const removeUploadFile = (index) => {
    setUploadFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      // Clear file input if no files left
      if (newFiles.length === 0 && fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return newFiles;
    });
  };

  // Restore from uploaded files
  const restoreFromUpload = async () => {
    if (uploadFiles.length === 0) {
      setRestoreProgress('⚠️ Please select files to upload');
      setTimeout(() => setRestoreProgress(''), 3000);
      return;
    }

    // Every archive for a component is uploaded under the same fixed name, so a second
    // file for the same component would silently overwrite the first. The restore list
    // below picks a component's file with .find(), which would then point at a different
    // archive than the one actually on disk. Refuse instead of restoring the wrong world.
    const perComponent = uploadFiles.reduce((acc, f) => {
      acc[f.component] = (acc[f.component] || 0) + 1;
      return acc;
    }, {});
    const duplicated = Object.keys(perComponent).filter((c) => perComponent[c] > 1);
    if (duplicated.length) {
      setRestoreProgress(`⚠️ Select only one archive per component — ${duplicated.join(', ')} has more than one`);
      setTimeout(() => setRestoreProgress(''), 6000);
      return;
    }

    // The picker filters on .tar.gz, but drag-and-drop and "All files" bypass it. FluxOS
    // deletes appdata before it ever looks at the archive, so a wrong file type costs the
    // user their world rather than producing an error.
    // Checked against the file the user picked, not the name it will be sent under.
    const badType = uploadFiles.find((f) => !/\.tar\.gz$/i.test(f.originalName || f.name));
    if (badType) {
      setRestoreProgress(`⚠️ "${badType.originalName || badType.name}" is not a .tar.gz archive`);
      setTimeout(() => setRestoreProgress(''), 6000);
      return;
    }

    try {
      if (!masterLocation) {
        setRestoreProgress('❌ Master location not available');
        setTimeout(() => setRestoreProgress(''), 3000);
        return;
      }

      setIsUploadingFiles(true);
      setRestoreProgress('Uploading files...');
      setUploadProgress({});

      const zelidauth = await secureStorage.getItem('zelidauth');

      if (!zelidauth) {
        setRestoreProgress('❌ Error: Not authenticated. Please log in again.');
        setTimeout(() => {
          setRestoreProgress('');
          setIsUploadingFiles(false);
        }, 5000);
        return;
      }

      console.log('📤 Upload - zelidauth present:', !!zelidauth);
      console.log('📤 Upload URL:', uploadFiles.map(f => f.name).join(', '));

      // Upload files first with progress tracking
      for (let i = 0; i < uploadFiles.length; i++) {
        const fileItem = uploadFiles[i];
        const formData = new FormData();
        formData.append('file', fileItem.file);

        const [host, port = 16127] = masterLocation.ip.split(':');
        // Fixed at selection (see handleFileSelect) — appendRestoreTask reads
        // <mount>/backup/upload/backup_<component>.tar.gz and nothing rewrites the name on
        // the way in, unlike the remote branch which passes rename=true to
        // downloadFileFromUrl. Sending the user's own filename put the archive beside the
        // name the restore looks for, and the restore then failed *after* deleting appdata.
        const filename = fileItem.name;
        const uploadUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/ioutils/fileupload/backup/${server.name}/${fileItem.component}/null/${filename}`;

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percentComplete = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(prev => ({ ...prev, [i]: percentComplete }));
            }
          });

          xhr.addEventListener('load', () => {
            console.log(`📤 Upload response for ${fileItem.name}:`, xhr.status, xhr.statusText);
            console.log('📤 Response body:', xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              const errorMsg = `Upload failed (${xhr.status}): ${xhr.statusText || xhr.responseText || 'Unknown error'}`;
              console.error('❌', errorMsg);
              reject(new Error(errorMsg));
            }
          });

          xhr.addEventListener('error', () => reject(new Error(`Network error uploading ${fileItem.name}`)));
          xhr.addEventListener('abort', () => reject(new Error(`Upload aborted: ${fileItem.name}`)));

          xhr.open('POST', uploadUrl);
          xhr.setRequestHeader('zelidauth', JSON.stringify(zelidauth));
          xhr.send(formData);
        });
      }

      setRestoreProgress('Files uploaded, starting restore...');
      setUploadProgress({});

      // Build restore request (no filepath needed for upload type)
      const compList = server.compose?.length > 0
        ? server.compose.map(comp => comp.name)
        : availableComponents;
      const postBody = {
        appname: server.name,
        type: 'upload',
        restore: compList.map(name => {
          const fileForComp = uploadFiles.find(f => f.component === name);
          return {
            component: name,
            restore: !!fileForComp
          };
        })
      };

      const [host, port = 16127] = masterLocation.ip.split(':');
      const apiUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/apps/appendrestoretask`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'zelidauth': JSON.stringify(zelidauth),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postBody)
      });

      if (!response.ok) throw new Error('Restore failed');

      const reader = response.body.getReader();
      activeStreamRef.current = reader;
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.status === 'error') {
                throw new Error(data.data?.message || 'Restore failed');
              }
              if (data.data) {
                setRestoreProgress(data.data);
              }
            } catch {
              if (line.trim()) {
                setRestoreProgress(line);
              }
            }
          }
        }
      } finally {
        activeStreamRef.current = null;
      }

      setRestoreProgress('Restore completed successfully!');
      setUploadFiles([]);
      const tid3 = setTimeout(() => {
        setRestoreProgress('');
      }, 3000);
      backupTimersRef.current.push(tid3);
    } catch (error) {
      if (error instanceof TypeError) onMasterError();
      console.error('Error restoring from upload:', error);
      setRestoreProgress(`❌ Error: ${error.message}`);
      const tid4 = setTimeout(() => {
        setRestoreProgress('');
        setIsUploadingFiles(false);
      }, 5000);
      backupTimersRef.current.push(tid4);
      return;
    } finally {
      setIsUploadingFiles(false);
      setUploadProgress({});
    }
  };

  // Add remote URL to queue
  const addRemoteUrl = () => {
    if (!remoteUrl.trim()) {
      setRestoreProgress('⚠️ Please enter a URL');
      setTimeout(() => setRestoreProgress(''), 3000);
      return;
    }

    const firstComponent = availableComponents[0] || server.compose?.[0]?.name || server.name;
    setRemoteUrlItems(prev => [...prev, {
      url: remoteUrl,
      component: firstComponent
    }]);
    setRemoteUrl('');
  };

  // Remove URL from queue
  const removeRemoteUrl = (index) => {
    setRemoteUrlItems(prev => prev.filter((_, i) => i !== index));
  };

  // Restore from remote URLs
  const restoreFromRemote = async () => {
    if (remoteUrlItems.length === 0) {
      setRestoreProgress('⚠️ Please add URLs to restore from');
      setTimeout(() => setRestoreProgress(''), 3000);
      return;
    }

    try {
      if (!masterLocation) {
        console.error('Master location not available');
        return;
      }

      setIsRestoringRemote(true);
      setRestoreProgress('Initializing remote restore...');

      const zelidauth = await secureStorage.getItem('zelidauth');

      // Build restore request
      const compList = server.compose?.length > 0
        ? server.compose.map(comp => comp.name)
        : availableComponents;
      const postBody = {
        appname: server.name,
        type: 'remote',
        restore: compList.map(name => {
          const urlForComp = remoteUrlItems.find(item => item.component === name);
          return {
            component: name,
            restore: !!urlForComp,
            url: urlForComp?.url || ''
          };
        })
      };

      const [host, port = 16127] = masterLocation.ip.split(':');
      const apiUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/apps/appendrestoretask`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'zelidauth': JSON.stringify(zelidauth),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postBody)
      });

      if (!response.ok) throw new Error('Restore failed');

      const reader = response.body.getReader();
      activeStreamRef.current = reader;
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.status === 'error') {
                throw new Error(data.data?.message || 'Restore failed');
              }
              if (data.data) {
                setRestoreProgress(data.data);
              }
            } catch {
              if (line.trim()) {
                setRestoreProgress(line);
              }
            }
          }
        }
      } finally {
        activeStreamRef.current = null;
      }

      setRestoreProgress('Restore completed successfully!');
      setRemoteUrlItems([]);
      const tid5 = setTimeout(() => {
        setRestoreProgress('');
      }, 3000);
      backupTimersRef.current.push(tid5);
    } catch (error) {
      if (error instanceof TypeError) onMasterError();
      console.error('Error restoring from remote:', error);
      setRestoreProgress(`❌ Error: ${error.message}`);
      const tid6 = setTimeout(() => {
        setRestoreProgress('');
        setIsRestoringRemote(false);
      }, 5000);
      backupTimersRef.current.push(tid6);
      return;
    } finally {
      setIsRestoringRemote(false);
    }
  };


  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Get time left for expiration (1 day from creation)
  const getTimeLeft = (createTimestamp) => {
    const expireDate = new Date(createTimestamp);
    expireDate.setDate(expireDate.getDate() + 1);

    const now = new Date();
    const diffMs = expireDate - now;

    if (diffMs > 0) {
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `${hours}h ${minutes}m ${seconds}s left`;
    } else {
      return 'expired';
    }
  };

  // Get expiration chip color based on time left
  const getExpirationColor = (createTimestamp) => {
    const expireDate = new Date(createTimestamp);
    expireDate.setDate(expireDate.getDate() + 1);

    const now = new Date();
    const diffMs = expireDate - now;
    const hoursLeft = diffMs / (1000 * 60 * 60);

    if (hoursLeft <= 0) {
      return 'bg-gray-500/20 text-gray-400 border-gray-500/50'; // Expired
    } else if (hoursLeft < 6) {
      return 'bg-red-500/20 text-red-400 border-red-500/50'; // Critical: < 6h
    } else if (hoursLeft < 12) {
      return 'bg-yellow-500/20 text-orange-400 border-yellow-500/50'; // Warning: < 12h
    } else {
      return 'bg-blue-500/20 text-blue-400 border-blue-500/50'; // Good: > 12h
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Backup Section */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9))', border: '1px solid rgba(51,65,85,0.5)' }}>
        <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(51,65,85,0.3)' }}>
          <div className="p-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.15)' }}>
            <Database className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Create Backup</h3>
            <p className="text-xs text-slate-500">Creates a new backup (replaces previous backup)</p>
          </div>
        </div>
        <div className="p-4">
        {/* Create Backup Button */}
        <button
          onClick={createBackup}
          disabled={isCreatingBackup || restoringFile || isUploadingFiles || isRestoringRemote}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: (isCreatingBackup || restoringFile || isUploadingFiles || isRestoringRemote) ? 'rgba(51,65,85,0.3)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: (isCreatingBackup || restoringFile || isUploadingFiles || isRestoringRemote) ? '#64748b' : '#ffffff',
            boxShadow: (isCreatingBackup || restoringFile || isUploadingFiles || isRestoringRemote) ? 'none' : '0 4px 15px rgba(59,130,246,0.3)',
          }}
        >
          {isCreatingBackup ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          {isCreatingBackup ? 'Creating Backup...' : 'Create Backup'}
        </button>

        {/* Progress Section */}
        {showProgress && (
          <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.3)' }}>
            <div className="flex items-center gap-2 text-slate-300">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
              <span className="text-sm">{backupProgress}</span>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Backup List Section */}
      <div className="bg-gradient-to-br from-gray-800/95 via-gray-900/95 to-gray-800/95 rounded-2xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Database className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Available Backups</h3>
              <p className="text-sm text-gray-400">
                {backupList.length === 0 ? 'No backup available' : `${backupList.length} backup${backupList.length !== 1 ? 's' : ''} stored`}
              </p>
            </div>
          </div>
          <button
            onClick={loadBackupList}
            className="relative group p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoadingBackups ? 'animate-spin' : ''}`} />
            <span className={_TIP}>Refresh</span>
          </button>
        </div>

        {isLoadingBackups ? (
          <div className="text-center py-8 text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p>Loading backups...</p>
          </div>
        ) : backupList.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg mb-1">No backup yet</p>
            <p className="text-sm">Create a backup to get started</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {backupList.map((backup, index) => (
              <div
                key={index}
                className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded border border-blue-500/50">
                        {backup.component}_{new Date(backup.create).getTime()}
                      </span>
                      {backup.source === 'fluxdrive' && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded border border-blue-500/50 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
                          </svg>
                          Automatic
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {formatFileSize(backup.file_size)}
                      </span>
                    </div>
                    <div className="mb-3">
                      <span className="px-2 py-1 bg-gray-700/20 text-gray-300 text-xs font-medium rounded border border-gray-600/50 inline-flex items-center gap-1.5">
                        <FaFileArchive className="w-3.5 h-3.5" />
                        {backup.file_name || backup.file.split('/').pop()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded border border-blue-500/50 flex items-center gap-1">
                        <MdAccessTime className="w-3.5 h-3.5" />
                        {formatDate(backup.create)}
                      </span>
                      {/* Only show expiration for local backups */}
                      {backup.source !== 'fluxdrive' && (
                        <span className={`px-2 py-1 text-xs font-medium rounded border flex items-center gap-1 ${getExpirationColor(backup.create)}`}>
                          <MdTimerOff className="w-3.5 h-3.5" />
                          {formatDate(backup.create)} ({getTimeLeft(backup.create)})
                        </span>
                      )}
                    </div>
                    {/* Warning message for local backups */}
                    {backup.source !== 'fluxdrive' && (
                      <div className="mt-2">
                        <p className="text-xs text-blue-400/80 flex items-center gap-1.5">
                          <MdTimerOff className="w-3.5 h-3.5" />
                          Local backups are automatically removed after 24 hours
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => downloadBackup(backup)}
                      disabled={downloadingFile === backup.file || restoringFile === backup.file}
                      className={`relative group p-2 rounded-lg transition-colors ${
                        downloadingFile === backup.file
                          ? 'bg-blue-500/10 text-blue-600 cursor-wait'
                          : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400'
                      }`}
                    >
                      {downloadingFile === backup.file ? (
                        <MdDownload className="w-5 h-5 opacity-50" />
                      ) : (
                        <MdDownload className="w-5 h-5" />
                      )}
                      <span className={_TIP}>{downloadingFile === backup.file ? 'Downloading...' : 'Download'}</span>
                    </button>
                    <button
                      onClick={() => restoreBackup(backup)}
                      disabled={restoringFile || downloadingFile === backup.file || isUploadingFiles || isRestoringRemote}
                      className={`relative group p-2 rounded-lg transition-colors ${
                        restoringFile === backup.file
                          ? 'bg-blue-500/10 text-blue-600 cursor-wait'
                          : restoringFile || isUploadingFiles || isRestoringRemote
                          ? 'bg-blue-500/10 text-blue-600/50 cursor-not-allowed'
                          : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400'
                      }`}
                    >
                      {restoringFile === backup.file ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <MdRestore className="w-5 h-5" />
                      )}
                      <span className={_TIP}>{restoringFile === backup.file ? 'Restoring...' : 'Restore'}</span>
                    </button>
                    <button
                      onClick={() => confirmDelete(backup)}
                      disabled={deletingFile === backup.file || restoringFile || isUploadingFiles || isRestoringRemote}
                      className={`relative group p-2 rounded-lg transition-colors ${
                        deletingFile === backup.file
                          ? 'bg-red-500/10 text-red-600 cursor-wait'
                          : restoringFile || isUploadingFiles || isRestoringRemote
                          ? 'bg-red-500/10 text-red-600/50 cursor-not-allowed'
                          : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                      }`}
                    >
                      {deletingFile === backup.file ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <MdDelete className="w-5 h-5" />
                      )}
                      <span className={_TIP}>{deletingFile === backup.file ? 'Deleting...' : 'Delete'}</span>
                    </button>
                  </div>
                </div>

                {/* Progress bars - full width */}
                {downloadingFile === backup.file && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-blue-400">Downloading...</span>
                      <span className="text-xs text-blue-400 font-medium">{downloadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full transition-all duration-300 ease-out"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                {restoringFile === backup.file && (
                  <div className="mt-3">
                    <div className="flex items-center gap-1.5">
                      <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                      <span className="text-xs text-blue-400">{restoreProgress || 'Restoring...'}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Restore Options Section */}
      <div className="bg-gradient-to-br from-gray-800/95 via-gray-900/95 to-gray-800/95 rounded-2xl p-6 border border-gray-700/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <MdRestore className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Restore Options</h3>
            <p className="text-sm text-gray-400">Upload files or restore from remote URLs</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700">
          <button
            onClick={() => setRestoreTab('upload')}
            className={`px-4 py-2 font-medium transition-colors relative flex items-center gap-2 ${
              restoreTab === 'upload'
                ? 'text-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <MdCloudUpload className="w-5 h-5" />
            Upload Files
            {restoreTab === 'upload' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400" />
            )}
          </button>
          <button
            onClick={() => setRestoreTab('remote')}
            className={`px-4 py-2 font-medium transition-colors relative flex items-center gap-2 ${
              restoreTab === 'remote'
                ? 'text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <MdLink className="w-5 h-5" />
            Remote URL
            {restoreTab === 'remote' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
            )}
          </button>
          <button
            onClick={() => setRestoreTab('snapshots')}
            className={`px-4 py-2 font-medium transition-colors relative flex items-center gap-2 ${
              restoreTab === 'snapshots' ? 'text-emerald-400' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Clock className="w-5 h-5" />
            In-game snapshots
            {restoreTab === 'snapshots' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
            )}
          </button>
        </div>

        {/* Rolling the world back affects every player, so it asks once and says what it costs */}
        {snapshotToRestore && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSnapshotToRestore(null)} />
            <div className="relative w-full max-w-md rounded-2xl border border-gray-700/60 bg-gradient-to-b from-gray-800/95 to-gray-900/95 p-5 shadow-2xl shadow-black/60">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </span>
                <div className="min-w-0">
                  <h4 className="text-base font-semibold text-white">Roll the world back?</h4>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    The save will be replaced with the one from{' '}
                    <span className="text-gray-200 font-medium">{snapshotToRestore.at.toLocaleString()}</span>.
                    Everything every player did since then — building, levels, caught Pals — is
                    gone. The server stops for a moment and comes back on its own.
                  </p>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    The current save is kept, and an <strong className="text-gray-300">Undo restore</strong>{' '}
                    button appears here right after — no file juggling needed.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setSnapshotToRestore(null)}
                  className="flex-1 h-9 rounded-lg text-sm font-medium text-gray-300 border border-gray-600/60 bg-gray-700/40 hover:bg-gray-600/50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { const s = snapshotToRestore; setSnapshotToRestore(null); restoreSnapshot(s); }}
                  className="flex-1 h-9 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 inline-flex items-center justify-center gap-1.5"
                >
                  <MdRestore className="w-4 h-4" /> Restore
                </button>
              </div>
            </div>
          </div>
        )}

        {/* In-game snapshots */}
        {restoreTab === 'snapshots' && (
          <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">
            {/* Structured rather than one long paragraph: an admin scanning this needs four
                separate facts, and a wall of text hides the one that decides the click. */}
            <div className="mb-4 rounded-xl border border-gray-700/60 bg-gray-800/40 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15">
                  <Clock className="h-4 w-4 text-emerald-400" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">Written by the game, not by us</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Palworld saves a restore point about every hour and whenever it shuts down.
                  </p>
                </div>
              </div>

              <div className="grid gap-px bg-gray-700/40 sm:grid-cols-2">
                <div className="bg-gray-800/40 px-4 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-400/80">Not a backup</p>
                  <p className="mt-0.5 text-xs text-gray-300">
                    The game rotates them and they sit on this node — keep real backups as well.
                  </p>
                </div>
                <div className="bg-gray-800/40 px-4 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400/80">Stuck on loading?</p>
                  <p className="mt-0.5 text-xs text-gray-300">
                    This gives the player their character back, instead of deleting it.
                  </p>
                </div>
                <div className="bg-gray-800/40 px-4 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">What is inside</p>
                  <p className="mt-0.5 text-xs text-gray-300">
                    The world and every player character — <span className="font-mono text-gray-400">Level.sav</span> plus <span className="font-mono text-gray-400">Players/</span>.
                  </p>
                </div>
                <div className="bg-gray-800/40 px-4 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Restoring</p>
                  <p className="mt-0.5 text-xs text-gray-300">
                    Rolls the world back for everyone. The server restarts itself and the old save is kept.
                  </p>
                </div>
              </div>
            </div>

            {/* A restore parked the save it replaced, so it can still be put back. Without this
                the only way back was renaming files by hand in the Files tab. */}
            {undoStamp && (
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15">
                    <MdRestore className="h-5 w-5 text-emerald-400" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-300">A restore can still be undone</p>
                    <p className="mt-0.5 text-xs text-emerald-100/70">
                      The save replaced on{' '}
                      <span className="font-medium text-emerald-200">{formatStamp(undoStamp)}</span>{' '}
                      is still on disk. Undoing swaps it back — the current one is kept, so you can
                      redo this at any time.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={undoRestore}
                  disabled={undoing || !!restoringSnapshot}
                  className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {undoing
                    ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Undoing…</>
                    : <><MdRestore className="h-4 w-4" /> Undo restore</>}
                </button>
              </div>
            )}

            {loadingSnapshots ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
                <RefreshCw className="w-4 h-4 animate-spin" /> Reading snapshots…
              </div>
            ) : snapshotError ? (
              <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">{snapshotError}</div>
            ) : snapshots.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-8 border border-dashed border-gray-700/60 rounded-md">
                No in-game snapshots yet — the game writes the first one after it has been running a while.
              </div>
            ) : (
              <ul className="space-y-2 max-h-96 overflow-y-auto">
                {snapshots.map((snap) => {
                  const mins = Math.max(0, Math.round((Date.now() - snap.at.getTime()) / 60000));
                  const ago = mins < 60 ? `${mins} min` : mins < 1440 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} d`;
                  const busy = restoringSnapshot === snap.name;
                  return (
                    <li key={snap.name} className="flex items-center gap-3 bg-gray-800/60 border border-gray-700/50 rounded-md p-2.5">
                      <Clock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white">{snap.at.toLocaleString()}</div>
                        {/* The number that actually matters: how much play everyone loses. */}
                        <div className="text-[11px] text-gray-400">rolls the server back {ago}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSnapshotToRestore(snap)}
                        disabled={!!restoringSnapshot}
                        className="shrink-0 h-8 px-3 rounded-md text-xs font-semibold border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40 inline-flex items-center gap-1.5"
                      >
                        {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MdRestore className="w-3.5 h-3.5" />}
                        {busy ? (snapshotStep || 'Restoring…') : 'Restore'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Upload Files Tab */}
        {restoreTab === 'upload' && (
        <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">

          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".tar.gz"
              multiple
              onChange={handleFileSelect}
              className="w-full px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-300 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30"
            />
          </div>

          {uploadFiles.length > 0 && (
            <div className="space-y-2 mb-4">
              {uploadFiles.map((file, index) => (
                <div key={index} className="p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{file.originalName || file.name}</p>
                      {/* The archive is written under a fixed name the restore reads, so
                          show it rather than letting the upload rename things silently. */}
                      {file.originalName && file.originalName !== file.name && (
                        <p className="text-xs text-gray-500 truncate">
                          uploads as <span className="font-mono text-gray-400">{file.name}</span>
                        </p>
                      )}
                      <p className="text-xs text-gray-400">{file.component} - {formatFileSize(file.size)}</p>
                    </div>
                    <button
                      onClick={() => removeUploadFile(index)}
                      disabled={isUploadingFiles}
                      className="relative group p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MdDelete className="w-4 h-4" />
                      <span className={_TIP}>Remove</span>
                    </button>
                  </div>
                  {uploadProgress[index] !== undefined && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-purple-400">Uploading...</span>
                        <span className="text-xs text-purple-400 font-medium">{uploadProgress[index]}%</span>
                      </div>
                      <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-purple-500 h-full transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress[index]}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Upload status */}
          {isUploadingFiles && restoreProgress && (
            <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-purple-500/30">
              <div className="flex items-center gap-2 text-purple-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">{restoreProgress}</span>
              </div>
            </div>
          )}

          <button
            onClick={restoreFromUpload}
            disabled={uploadFiles.length === 0 || isUploadingFiles || restoringFile || isRestoringRemote}
            className={`w-full px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              isUploadingFiles || restoringFile || isRestoringRemote
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : uploadFiles.length === 0
                ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white'
            }`}
          >
            {isUploadingFiles ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <MdRestore className="w-5 h-5" />
                Restore from Upload
              </>
            )}
          </button>
        </div>
        )}

        {/* Remote URL Tab */}
        {restoreTab === 'remote' && (
        <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">

          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="url"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder="https://example.com/backup.tar.gz"
                className="flex-1 px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-300 text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={addRemoteUrl}
                disabled={!remoteUrl.trim()}
                className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>

          {remoteUrlItems.length > 0 && (
            <div className="space-y-2 mb-4">
              {remoteUrlItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{item.component}</p>
                    <p className="text-xs text-gray-400 truncate">{item.url}</p>
                  </div>
                  <button
                    onClick={() => removeRemoteUrl(index)}
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors ml-2"
                  >
                    <MdDelete className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Remote restore status */}
          {isRestoringRemote && restoreProgress && (
            <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-blue-500/30">
              <div className="flex items-center gap-2 text-blue-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">{restoreProgress}</span>
              </div>
            </div>
          )}

          <button
            onClick={restoreFromRemote}
            disabled={remoteUrlItems.length === 0 || isRestoringRemote || restoringFile || isUploadingFiles}
            className={`w-full px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              isRestoringRemote || restoringFile || isUploadingFiles
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : remoteUrlItems.length === 0
                ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white'
            }`}
          >
            {isRestoringRemote ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <MdRestore className="w-5 h-5" />
                Restore from Remote
              </>
            )}
          </button>
        </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Backup?</h3>
            <p className="text-sm text-gray-400 mb-4">
              Are you sure you want to delete this backup? This action cannot be undone.
            </p>
            <div className="bg-gray-900/50 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-500 mb-1">Backup:</p>
              <p className="text-sm text-white">{fileToDelete?.component}_{new Date(fileToDelete?.create).getTime()}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setFileToDelete(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteBackup}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Subscription block math ─────────────────────────────────────────────────
// Flux bills a "month" as 88,000 blocks and refuses any expire above one year.
// The cap applies to the WHOLE subscription: time still left + time being bought.
const BLOCKS_PER_MONTH = 88000;
const MAX_SUBSCRIPTION_BLOCKS = BLOCKS_PER_MONTH * 12; // 1,056,000 blocks
const BLOCKS_PER_DAY = BLOCKS_PER_MONTH / 30; // a day of that same 30-day month

/** Blocks → "4 months 12 days". */
const formatBlocksDuration = (blocks) => {
  const totalDays = Math.max(0, Math.round(blocks / BLOCKS_PER_DAY));
  if (totalDays < 1) return 'less than a day';
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  const parts = [];
  if (months) parts.push(months === 1 ? '1 month' : `${months} months`);
  if (days) parts.push(days === 1 ? '1 day' : `${days} days`);
  return parts.join(' ');
};

/** Flux's long-duration discount, derived from the TOTAL subscription length. */
const discountForTotalBlocks = (totalBlocks) => {
  const months = totalBlocks / BLOCKS_PER_MONTH;
  if (months >= 9) return 12;
  if (months >= 6) return 6;
  if (months >= 3) return 3;
  return 0;
};

// Billing Tab - Renewal, subscription management, and cancellation
const BillingTab = ({ server, onUpdate, onClose }) => {
  // Blocks the customer is buying right now (slider value).
  const [addBlocks, setAddBlocks] = useState(BLOCKS_PER_MONTH);
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableBlocks, setAvailableBlocks] = useState(null);
  const [currentExpire, setCurrentExpire] = useState(null);
  const [isLoadingLimits, setIsLoadingLimits] = useState(true);
  const [progressSteps, setProgressSteps] = useState([]);
  const [blockedPaymentUrl, setBlockedPaymentUrl] = useState(null);
  const [showPopupBlockedDialog, setShowPopupBlockedDialog] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null); // 'success' or 'cancelled'
  const [renewalDetails, setRenewalDetails] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [cachedPlans, setCachedPlans] = useState(null); // Cache plans to avoid repeated API calls
  const [paymentStep, setPaymentStep] = useState('selection'); // 'selection', 'processing', 'complete'
  const [copiedItem, setCopiedItem] = useState(null); // Track which item was copied ('hash' or 'session')
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null); // null = loading, false = no sub, object = active sub
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelResult, setCancelResult] = useState(() => {
    // Check localStorage for persisted cancel state
    try {
      const cancelled = JSON.parse(localStorage.getItem('cancelledServers') || '{}');
      const entry = cancelled[server?.name];
      if (entry) {
        // Auto-expire after 2 hours
        if (Date.now() - entry.timestamp > 2 * 60 * 60 * 1000) {
          delete cancelled[server?.name];
          localStorage.setItem('cancelledServers', JSON.stringify(cancelled));
          return null;
        }
        return 'success';
      }
    } catch { /* ignore */ }
    return null;
  });
  const [cryptoExpanded, setCryptoExpanded] = useState(false);
  const [waitingForCrypto, setWaitingForCrypto] = useState(false);
  const cryptoAbortRef = useRef(null);
  const [apiPricingFlux, setApiPricingFlux] = useState({ flux: 0, usd: 0, fluxDiscount: 0 }); // FLUX pricing for crypto
  const popupCheckIntervalRef = useRef(null);
  const popupCheckTimeoutRef = useRef(null);
  const pendingTimersRef = useRef([]);

  // Cleanup all timers/intervals on unmount
  useEffect(() => {
    const popupInterval = popupCheckIntervalRef.current;
    const popupTimeout = popupCheckTimeoutRef.current;
    const timers = pendingTimersRef.current;
    const abort = cryptoAbortRef.current;
    return () => {
      if (popupInterval) clearInterval(popupInterval);
      if (popupTimeout) clearTimeout(popupTimeout);
      timers.forEach(clearTimeout);
      abort?.abort();
    };
  }, []);

  // Subscription period mapping (matches FluxOS SUBSCRIPTION_PERIOD_MAP)
  const SUBSCRIPTION_PERIOD_MAP = {
    [BLOCKS_PER_MONTH]: 1,
    [BLOCKS_PER_MONTH * 3]: 3,
    [BLOCKS_PER_MONTH * 6]: 6,
    [BLOCKS_PER_MONTH * 12]: 12,
  };

  // Fetch subscription status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      if (!server?.name) {
        setIsLoadingSubscription(false);
        return;
      }
      try {
        setIsLoadingSubscription(true);
        const sub = await stripeService.getSubscriptionStatus(server.name);
        setSubscriptionStatus(sub || false);
      } catch (error) {
        console.warn('Failed to fetch subscription status:', error.message);
        setSubscriptionStatus(false);
      } finally {
        setIsLoadingSubscription(false);
      }
    };
    fetchStatus();
  }, [server?.name]);

  // Cancel server (set expire to 100 blocks + cancel Stripe subscription if exists)
  const handleCancelServer = async () => {
    if (!server?.name) return;
    setIsCancelling(true);
    setCancelResult(null);

    try {
      // Step 1: Set expire to 100 blocks (~50 min) via appupdate
      await apiService.renewAppSubscription(server.name, 100);

      // Step 2: If active subscription, cancel it on Stripe
      if (subscriptionStatus && subscriptionStatus.status === 'active') {
        try {
          await stripeService.cancelSubscription(server.name);
        } catch (err) {
          console.warn('Failed to cancel Stripe subscription:', err.message);
          // Don't block — network cancel already succeeded
        }
      }

      setCancelResult('success');
      setShowCancelConfirm(false);
      setSubscriptionStatus(false);
      setCurrentExpire(100); // Reflect the 100-block expire we just set

      // Persist cancel state to localStorage (expires after 2h)
      try {
        const cancelled = JSON.parse(localStorage.getItem('cancelledServers') || '{}');
        cancelled[server.name] = { timestamp: Date.now() };
        localStorage.setItem('cancelledServers', JSON.stringify(cancelled));
      } catch { /* ignore */ }

      if (onUpdate) {
        const t = setTimeout(() => onUpdate(), 1000);
        pendingTimersRef.current.push(t);
      }
    } catch (error) {
      console.error('Cancel failed:', error);
      setCancelResult('error');
      toast.error(error.message || 'Failed to cancel server');
    } finally {
      setIsCancelling(false);
    }
  };

  // TEST FUNCTION: Emulate renewal flow without real payment
  const _testRenewalFlow = async () => {
    console.log('🧪 TEST: Starting renewal flow emulation');

    setPaymentStep('processing');
    setIsProcessing(true);
    setProgressSteps([]);

    try {
      // Step 1: Calculate price
      setProgressSteps([{ step: 'Calculating price (TEST)', status: 'loading' }]);
      await new Promise(resolve => setTimeout(resolve, 800));
      const testPrice = pricing?.totalPrice || 5.00;
      setProgressSteps([{ step: 'Calculating price (TEST)', status: 'complete' }]);
      console.log('🧪 TEST: Price calculated:', testPrice);

      // Step 2: Emulate signing
      setProgressSteps(prev => [...prev, { step: 'Signing renewal (TEST)', status: 'loading' }]);
      await new Promise(resolve => setTimeout(resolve, 1000));
      const testHash = 'test_hash_' + Date.now(); // Fake hash
      setProgressSteps(prev => prev.map(s => s.step === 'Signing renewal (TEST)' ? { ...s, status: 'complete' } : s));
      console.log('🧪 TEST: Generated fake hash:', testHash);

      // Step 3: Emulate payment
      setProgressSteps(prev => [...prev, { step: 'Payment (TEST)', status: 'loading' }]);
      await new Promise(resolve => setTimeout(resolve, 2000));
      setProgressSteps(prev => prev.map(s => s.step === 'Payment (TEST)' ? { ...s, status: 'complete' } : s));

      // Step 4: Add to pendingRenewals array AFTER payment (1 step)
      const newRenewal = {
        appName: server.name,
        paymentHash: testHash,
        paymentConfirmed: true,
        type: 'renewal',
        pendingTimestamp: Date.now()
      };

      // Add to array (not replace)
      const existingRenewals = JSON.parse(localStorage.getItem('pendingRenewals') || '[]');
      existingRenewals.push(newRenewal);
      localStorage.setItem('pendingRenewals', JSON.stringify(existingRenewals));
      console.log('🧪 TEST: Added pendingRenewal after payment:', testHash);

      // Step 5: Set renewal details for success UI
      const SECONDS_PER_BLOCK = 30; // Post-fork block time
      const secondsAdded = addBlocks * SECONDS_PER_BLOCK;
      const currentDate = server.expiresAt ? new Date(server.expiresAt) : new Date();
      const newExpirationDate = new Date(currentDate.getTime() + (secondsAdded * 1000));

      setRenewalDetails({
        duration: periodLabel + ' (TEST)',
        price: testPrice,
        blocksAdded: addBlocks,
        currentExpiration: currentDate,
        newExpiration: newExpirationDate,
        daysAdded: Math.floor(secondsAdded / (60 * 60 * 24)),
        testHash: testHash, // Include hash for display
        stripeSessionId: 'test_stripe_' + Date.now()
      });

      setPaymentResult('success');
      setIsProcessing(false);

      console.log('🧪 TEST: Renewal flow complete. Dashboard should now monitor for hash:', testHash);
      console.log('🧪 TEST: Since this is a test hash, it will never match real server data and will expire after 1 hour');

      if (onUpdate) {
        const t = setTimeout(() => onUpdate(), 1000);
        pendingTimersRef.current.push(t);
      }
    } catch (error) {
      console.error('🧪 TEST: Error in emulation:', error);
      setProgressSteps([{ step: 'Test failed', status: 'error' }]);
      setIsProcessing(false);
    }
  };

  const durations = [
    { months: '1', label: '1 Month', blocks: BLOCKS_PER_MONTH },
    { months: '3', label: '3 Months', blocks: BLOCKS_PER_MONTH * 3 },
    { months: '6', label: '6 Months', blocks: BLOCKS_PER_MONTH * 6 },
    { months: '12', label: '12 Months', blocks: BLOCKS_PER_MONTH * 12 },
  ];

  // ── Renewal period selection ──────────────────────────────────────────────
  // The subscription is capped at 1 year IN TOTAL, so the most that can be bought
  // right now is a year minus whatever is still on the server. The slider spans
  // exactly that headroom, in days, so the customer can always top up to the cap.
  const maxAddBlocks = availableBlocks ?? 0;
  const maxAddDays = Math.floor(maxAddBlocks / BLOCKS_PER_DAY);
  const addDays = Math.min(Math.max(1, Math.round(addBlocks / BLOCKS_PER_DAY)), Math.max(1, maxAddDays));
  // Snap the top of the slider to the exact headroom so "max" really means max.
  const blocksForDays = (days) => (days >= maxAddDays ? maxAddBlocks : Math.round(days * BLOCKS_PER_DAY));
  const periodLabel = formatBlocksDuration(addBlocks);
  const totalAfterRenewal = (currentExpire ?? 0) + addBlocks;
  // Stripe subscriptions only exist for the whole-month periods.
  const subscriptionMonths = SUBSCRIPTION_PERIOD_MAP[addBlocks];

  // Quick picks: every preset that fits, plus the exact headroom when no preset hits it.
  const presets = durations.filter(d => d.blocks <= maxAddBlocks).map(d => ({ key: d.months, label: d.label, blocks: d.blocks }));
  if (maxAddBlocks > 0 && !presets.some(p => p.blocks === maxAddBlocks)) {
    presets.push({ key: 'max', label: `Max · ${formatBlocksDuration(maxAddBlocks)}`, blocks: maxAddBlocks });
  }

  // Auto-renewal is a Stripe subscription, which only supports 1/3/6/12-month periods.
  useEffect(() => {
    if (!subscriptionMonths && autoRenewal) setAutoRenewal(false);
  }, [subscriptionMonths, autoRenewal]);

  // Fetch plans once on mount (in-memory cache only)
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        console.log('📦 Fetching server plans from API...');
        const plans = await marketplaceService.getServerPlans();
        setCachedPlans(plans);
        console.log('✅ Plans cached in memory:', plans.length);
      } catch (error) {
        console.error('❌ Failed to fetch plans:', error);
        setCachedPlans([]); // Set empty array to prevent infinite loading
      }
    };

    fetchPlans();
  }, []); // Fetch on mount

  // Load current expire and calculate available blocks
  useEffect(() => {
    const loadLimits = async () => {
      if (!server) return;

      try {
        setIsLoadingLimits(true);

        // If server was cancelled (persisted in localStorage), use 100 blocks.
        // Clamp to 0: an already-expired app has a negative blocksRemaining, which would
        // otherwise report MORE than a year of headroom.
        const wasCancelled = cancelResult === 'success';
        const remainingBlocks = wasCancelled ? 100 : Math.max(0, server.blocksRemaining || 0);
        const available = Math.max(0, MAX_SUBSCRIPTION_BLOCKS - remainingBlocks);

        setCurrentExpire(remainingBlocks);
        setAvailableBlocks(available);

        console.log('📊 Renewal limits:', {
          serverName: server.name,
          remainingBlocks,
          remainingMonths: (remainingBlocks / BLOCKS_PER_MONTH).toFixed(2),
          availableToAdd: available,
          maxTotal: MAX_SUBSCRIPTION_BLOCKS
        });

        // Keep the chosen period, only pulling it down to whatever still fits.
        setAddBlocks((prev) => Math.min(prev || BLOCKS_PER_MONTH, available));
      } catch (error) {
        console.error('Failed to load subscription limits:', error);
      } finally {
        setIsLoadingLimits(false);
      }
    };

    loadLimits();

    // Fetch FLUX pricing once per server (for crypto option)
    const fluxController = new AbortController();
    const fetchFluxPricing = async () => {
      try {
        const appSpec = await apiService.getAppSpecs(server.name);
        if (appSpec && !fluxController.signal.aborted) {
          const pricingResponse = await fetch('https://api.runonflux.io/apps/calculatefiatandfluxprice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: JSON.stringify(appSpec),
            signal: fluxController.signal,
          });
          const pricingData = await pricingResponse.json();
          if (pricingData.status === 'success' && pricingData.data) {
            setApiPricingFlux({
              flux: parseFloat(pricingData.data.flux) || 0,
              usd: parseFloat(pricingData.data.usd) || 0,
              fluxDiscount: parseFloat(pricingData.data.fluxDiscount) || 0,
            });
          }
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.warn('Failed to fetch FLUX pricing:', error);
      }
    };
    if (server?.name) fetchFluxPricing();

    return () => fluxController.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server]);

  // Calculate pricing when duration changes
  useEffect(() => {
    const pricingController = new AbortController();
    const calculatePricing = async () => {
      // currentExpire === 0 is valid (expired server) — only bail while it is still unknown.
      if (!server || currentExpire === null || !cachedPlans) {
        // Wait for plans to be cached before calculating
        if (!cachedPlans) {
          setIsLoadingPrice(true);
        }
        return;
      }

      setIsLoadingPrice(true);
      setPricing(null);

      try {
        // Hard 1-year cap: the subscription is the time still left PLUS the period being
        // bought, and Flux rejects any expire above MAX_SUBSCRIPTION_BLOCKS. The slider can
        // never go past it; this only guards a stale value.
        const available = Math.max(0, MAX_SUBSCRIPTION_BLOCKS - currentExpire);
        const blocksToAdd = Math.min(addBlocks, available);
        if (blocksToAdd <= 0) {
          setPricing({
            error: 'This server is already subscribed for the maximum of 1 year. You can renew again once some of it has elapsed.',
          });
          return;
        }

        // appupdate re-registers the app at the CURRENT block height, so `expire` counts
        // from now on: blocks still remaining + the period just purchased.
        const newExpire = currentExpire + blocksToAdd;

        // Price the REAL current spec at the new expire via the Flux API. This handles
        // custom hardware (e.g. from the Hardware tab) that no marketplace plan matches, and
        // already includes Flux's long-duration discount — matching how zomboid prices renewals.
        const outer = await apiService.getAppSpecs(server.name);
        if (!outer?.name) throw new Error('Could not load the current app spec.');

        // Discount is derived by Flux from the spec's expire; we compute it here only for display.
        const discount = discountForTotalBlocks(newExpire);

        const p = await apiService.calculateAppPrice({ ...outer, expire: newExpire });
        if (!(p?.usd > 0)) throw new Error('Price calculation returned no price.');

        console.log('💰 Renewal price from API (real spec):', { usd: p.usd, flux: p.flux, discount });

        setPricing({
          price: p.usd, // Flux's long-duration discount already included
          blocksToAdd: blocksToAdd,
          newExpire: newExpire,
          discount: discount,
        });

      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('❌ Failed to calculate pricing:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          server: {
            cpu: server?.cpu,
            ram: server?.ram,
            hdd: server?.hdd,
            name: server?.name
          }
        });
        // Set error state so UI can show the actual error message
        setPricing({ error: error.message || 'Unknown error' });
      } finally {
        if (!pricingController.signal.aborted) {
          setIsLoadingPrice(false);
        }
      }
    };

    // Debounced: the slider fires continuously while dragging, and each run hits the
    // Flux price API. Show the spinner straight away, but only price once it settles.
    setIsLoadingPrice(true);
    const debounce = setTimeout(calculatePricing, 350);
    return () => {
      clearTimeout(debounce);
      pricingController.abort();
    };
  }, [addBlocks, server, currentExpire, cachedPlans]);

  const handleRenewal = async () => {
    if (!server) return;

    setPaymentStep('processing'); // Switch to processing view
    setIsProcessing(true);
    setProgressSteps([]);
    setPaymentResult(null);
    setRenewalDetails(null);

    try {
      // Use pre-calculated pricing for initial check
      if (!pricing) {
        throw new Error('Pricing not calculated');
      }

      // CRITICAL: Fetch FRESH block height and recalculate price before payment
      // This ensures we charge the correct amount even if user stayed on page for a long time
      // Matches FluxOS pattern: calculate once for display, recalculate before payment
      setProgressSteps([{ step: 'Calculating price', status: 'loading' }]);

      // Validate server data
      console.log('🔍 Server data:', {
        blocksRemaining: server.blocksRemaining,
        registrationHeight: server.registrationHeight,
        expireBlocks: server.expireBlocks,
        appName: server.name
      });

      // Fetch fresh block height to recalculate remaining blocks
      const freshBlockHeight = await apiService.get('/daemon/getinfo').then(response => {
        if (response.status === 'success' && response.data?.blocks) {
          return response.data.blocks;
        }
        throw new Error('Failed to fetch current block height');
      });

      // Fetch the CURRENT on-chain spec — it is both the base for the renewal price and the
      // source of truth for how much subscription is still left.
      const freshOuter = await apiService.getAppSpecs(server.name);
      if (!freshOuter?.name) throw new Error('Could not load the current app spec.');

      // Blocks still remaining: `expire` counts from the registration height, so what is left
      // is (height + expire) - currentHeight. Falls back to the dashboard value (which is
      // fork-adjusted) if the spec is missing either field.
      const freshRemainingBlocks = (freshOuter.height && freshOuter.expire && freshBlockHeight)
        ? Math.max(0, (freshOuter.height + freshOuter.expire) - freshBlockHeight)
        : Math.max(0, server.blocksRemaining || 0);

      console.log('📊 Block calculation:', {
        freshBlockHeight,
        specHeight: freshOuter.height,
        specExpire: freshOuter.expire,
        blocksRemaining: server.blocksRemaining,
        calculatedRemaining: freshRemainingBlocks
      });

      // Recalculate available blocks (max 12 months total subscription)
      const freshAvailableBlocks = Math.max(0, MAX_SUBSCRIPTION_BLOCKS - freshRemainingBlocks);

      // Never shorten the purchase to fit the cap — refuse it, so the customer always gets
      // exactly the period they selected and paid for. (The slider is bounded by the same
      // cap, so this only trips if the app was renewed elsewhere meanwhile.)
      if (addBlocks > freshAvailableBlocks) {
        throw new Error(
          freshAvailableBlocks > 0
            ? `${periodLabel} would take this server past the 1-year subscription maximum. You can add up to ${formatBlocksDuration(freshAvailableBlocks)} right now.`
            : 'This server is already subscribed for the maximum of 1 year.',
        );
      }

      const freshBlocksToAdd = addBlocks;
      // appupdate re-registers at the CURRENT height (renewAppSubscription drops the old
      // height), so `expire` counts from now: time still remaining + the period purchased.
      const freshNewExpire = freshRemainingBlocks + freshBlocksToAdd;

      console.log('📈 Calculated values:', {
        freshRemainingBlocks,
        freshAvailableBlocks,
        freshBlocksToAdd,
        freshNewExpire
      });

      const newTotalMonths = freshNewExpire / BLOCKS_PER_MONTH;
      const discount = discountForTotalBlocks(freshNewExpire);

      const freshP = await apiService.calculateAppPrice({ ...freshOuter, expire: freshNewExpire });
      if (!(freshP?.usd > 0)) throw new Error('Price calculation returned no price.');
      const freshPrice = freshP.usd; // Flux's duration discount already included

      console.log('💰 FRESH PRICE (API, before payment):', {
        freshBlockHeight,
        freshRemainingBlocks,
        freshBlocksToAdd,
        freshNewExpire,
        newTotalMonths: newTotalMonths.toFixed(2),
        discount: `${discount}%`,
        freshPrice: freshPrice.toFixed(2),
        originalEstimate: pricing.price.toFixed(2),
        priceDifference: (freshPrice - pricing.price).toFixed(2)
      });

      setProgressSteps([{ step: 'Calculating price', status: 'complete' }]);

      // Step 1: Signing renewal with fresh data
      setProgressSteps(prev => [...prev, { step: 'Signing renewal', status: 'loading' }]);

      let paymentHash;
      try {
        paymentHash = await apiService.renewAppSubscription(server.name, freshNewExpire);
        setProgressSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'complete' } : s));
      } catch (signError) {
        console.error('❌ Signing failed:', signError);
        setProgressSteps(prev => prev.map(s =>
          s.status === 'loading' ? { ...s, status: 'error' } : s
        ));
        throw new Error(`Signing failed: ${signError.message}`);
      }

      // Calculate new expiration date using FRESH blocks
      const SECONDS_PER_BLOCK = 30; // Post-fork block time
      const secondsAdded = freshBlocksToAdd * SECONDS_PER_BLOCK;
      const currentDate = server.expiresAt ? new Date(server.expiresAt) : new Date();
      const newExpirationDate = new Date(currentDate.getTime() + (secondsAdded * 1000));

      // Store renewal details for display after success (using FRESH price)
      setRenewalDetails({
        duration: periodLabel,
        price: freshPrice,
        blocksAdded: freshBlocksToAdd,
        currentExpiration: currentDate,
        newExpiration: newExpirationDate,
        daysAdded: Math.floor(secondsAdded / (60 * 60 * 24))
      });

      // Step 2: Create payment session with FRESH price
      setProgressSteps(prev => [...prev, { step: 'Creating payment session', status: 'loading' }]);
      const productName = `${server.name} - Renewal (${periodLabel})`;
      const successUrl = `${window.location.origin}/success?renewal=true&server=${server.name}&hash=${paymentHash}`;
      const cancelUrl = `${window.location.origin}/cancel?renewal=true&server=${server.name}`;

      const appDescription = 'Palworld Server on Flux Decentralized Cloud';

      const sessionId = autoRenewal && subscriptionMonths
        ? await stripeService.createSubscriptionSession(
            server.name,
            successUrl,
            cancelUrl,
            paymentHash,
            freshPrice,
            productName,
            subscriptionMonths,
            appDescription
          )
        : await stripeService.createCheckoutSession(
            server.name,
            successUrl,
            cancelUrl,
            paymentHash,
            freshPrice,
            productName,
            appDescription
          );
      setProgressSteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: 'complete' } : s));

      // Step 3: Open payment in popup
      setProgressSteps(prev => [...prev, { step: 'Opening payment window', status: 'complete' }]);
      // createCheckoutSession/createSubscriptionSession return the FULL checkout URL from the
      // bridge (same as the deploy flow) — use it directly, don't prepend the Stripe domain.
      const stripeCheckoutUrl = sessionId;

      // Open Stripe checkout in popup window
      const win = window.open(stripeCheckoutUrl, '_blank', 'width=600,height=800,resizable=yes,scrollbars=yes');

      // Check if popup was blocked
      if (!win || win.closed || typeof win.closed === 'undefined') {
        // Popup blocked - show dialog
        setBlockedPaymentUrl(stripeCheckoutUrl);
        setShowPopupBlockedDialog(true);
      } else {
        // Monitor popup - if closed without completing payment, clear waiting state
        if (popupCheckIntervalRef.current) clearInterval(popupCheckIntervalRef.current);
        popupCheckIntervalRef.current = setInterval(() => {
          if (win.closed) {
            clearInterval(popupCheckIntervalRef.current);
            popupCheckIntervalRef.current = null;
            // Give a moment for the message to arrive
            popupCheckTimeoutRef.current = setTimeout(() => {
              // If no payment result received, show cancelled
              setProgressSteps(prev => {
                if (prev.length > 0 && !prev.some(s => s.step === 'Payment completed')) {
                  setPaymentResult('cancelled');
                  return [];
                }
                return prev;
              });
            }, 500);
          }
        }, 500);
      }

      setIsProcessing(false);

    } catch (error) {
      console.error('❌ Renewal error:', error);
      setProgressSteps(prev => [
        ...prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s),
        { step: error.message || 'Failed to process renewal', status: 'error' }
      ]);
      setIsProcessing(false);
    }
  };

  // ========== Crypto Renewal Flow ==========

  // Calculate FLUX price for renewal
  const fluxPrice = (() => {
    if (!pricing || pricing.error || !(pricing.price > 0) || apiPricingFlux.usd <= 0) return 0;
    // Convert the API-priced renewal (USD) to FLUX using the current FLUX/USD rate. Works for
    // any spec — including custom hardware from the Hardware tab that no plan matches.
    const fluxPerUsd = apiPricingFlux.flux / apiPricingFlux.usd;
    return parseFloat((pricing.price * fluxPerUsd).toFixed(2));
  })();

  const handleCryptoRenewal = async (walletType) => {
    if (!server || isProcessing) return;

    if (walletType === 'ssp' && !isSSPAvailable()) {
      toast.error('SSP Wallet not found. Please install the SSP browser extension.');
      return;
    }

    setPaymentStep('processing');
    setIsProcessing(true);
    setProgressSteps([]);
    setPaymentResult(null);
    setRenewalDetails(null);

    try {
      // Fresh block height calculation (same as handleRenewal)
      let freshBlockHeight;
      try {
        const statsRes = await fetch('https://api.runonflux.io/daemon/getinfo');
        const statsData = await statsRes.json();
        freshBlockHeight = statsData?.data?.blocks;
      } catch { freshBlockHeight = null; }

      const freshCurrentSpec = await apiService.getAppSpecs(server.name);
      // expire is relative (blocks from registration height), not absolute
      const registrationHeight = freshCurrentSpec?.height || 0;
      const currentExpireBlocks = freshCurrentSpec?.expire || 0;
      const absoluteExpireBlock = registrationHeight + currentExpireBlocks;
      const freshRemainingBlocks = freshBlockHeight
        ? Math.max(0, absoluteExpireBlock - freshBlockHeight)
        : Math.max(0, currentExpire || 0);
      const freshAvailableBlocks = Math.max(0, MAX_SUBSCRIPTION_BLOCKS - freshRemainingBlocks);

      // Same cap rule as the fiat flow: refuse rather than shorten the purchased period.
      if (addBlocks > freshAvailableBlocks) {
        throw new Error(
          freshAvailableBlocks > 0
            ? `${periodLabel} would take this server past the 1-year subscription maximum. You can add up to ${formatBlocksDuration(freshAvailableBlocks)} right now.`
            : 'This server is already subscribed for the maximum of 1 year.',
        );
      }

      const freshBlocksToAdd = addBlocks;
      // appupdate re-registers at the CURRENT height, so `expire` must be the time still
      // remaining plus the period bought — NOT the old expire (that would charge/grant the
      // already-elapsed time again, and the FLUX paid here would then be underpaid on-chain).
      const freshNewExpire = freshRemainingBlocks + freshBlocksToAdd;

      setProgressSteps([{ step: 'Signing renewal', status: 'loading' }]);

      // Step 1: Sign renewal
      let paymentHash;
      try {
        paymentHash = await apiService.renewAppSubscription(server.name, freshNewExpire);
        setProgressSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'complete' } : s));
      } catch (signError) {
        setProgressSteps(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
        throw new Error(`Signing failed: ${signError.message}`);
      }

      // Step 2: Get payment address
      setProgressSteps(prev => [...prev, { step: 'Opening wallet', status: 'loading' }]);
      const deploymentInfo = await apiService.getDeploymentInfo();
      const paymentAddress = deploymentInfo?.address;
      if (!paymentAddress) throw new Error('Failed to get payment address');

      // Step 3: Open wallet and wait for txid
      const amount = String(fluxPrice);
      let txid;
      setWaitingForCrypto(true);
      try {
        if (walletType === 'zelcore') {
          const abortController = new AbortController();
          cryptoAbortRef.current = abortController;
          const result = await payWithZelcore({ address: paymentAddress, amount, message: paymentHash, signal: abortController.signal });
          txid = result.txid;
        } else {
          const response = await payWithSSP({ message: paymentHash, amount, address: paymentAddress, chain: 'flux' });
          txid = response.txid;
        }
        setProgressSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'complete' } : s));
      } catch (error) {
        setWaitingForCrypto(false);
        cryptoAbortRef.current = null;
        if (error.message !== 'Payment cancelled') {
          toast.error(error.message || `Failed to pay with ${walletType === 'zelcore' ? 'ZelCore' : 'SSP'}`);
        }
        setProgressSteps([]);
        setPaymentStep('selection');
        setIsProcessing(false);
        return;
      }
      setWaitingForCrypto(false);
      cryptoAbortRef.current = null;

      // Payment confirmed — save to pendingRenewals (dashboard monitors from here)
      console.log(`✅ Crypto renewal confirmed — txid: ${txid}`);
      const newRenewal = {
        appName: server.name,
        paymentHash,
        paymentConfirmed: true,
        type: 'renewal',
        pendingTimestamp: Date.now(),
      };
      const existingRenewals = JSON.parse(localStorage.getItem('pendingRenewals') || '[]');
      existingRenewals.push(newRenewal);
      localStorage.setItem('pendingRenewals', JSON.stringify(existingRenewals));

      setProgressSteps([
        { step: 'Signing renewal', status: 'complete' },
        { step: 'Crypto payment sent', status: 'complete' },
        { step: 'Payment confirmed', status: 'complete' },
      ]);

      // Set renewal details for success UI
      const SECONDS_PER_BLOCK = 30;
      const secondsAdded = freshBlocksToAdd * SECONDS_PER_BLOCK;
      const currentDate = server.expiresAt ? new Date(server.expiresAt) : new Date();
      const newExpirationDate = new Date(currentDate.getTime() + (secondsAdded * 1000));
      setRenewalDetails({
        duration: periodLabel,
        price: parseFloat(fluxPrice),
        crypto: true,
        txid,
        blocksAdded: freshBlocksToAdd,
        currentExpiration: currentDate,
        newExpiration: newExpirationDate,
        daysAdded: Math.floor(secondsAdded / (60 * 60 * 24)),
      });

      setPaymentResult('success');
      toast.success('Payment confirmed!');
      setIsProcessing(false);

      // Refresh dashboard to reflect new expire
      if (onUpdate) {
        const t = setTimeout(() => onUpdate(), 1000);
        pendingTimersRef.current.push(t);
      }

    } catch (error) {
      console.error('❌ Crypto renewal error:', error);
      setProgressSteps(prev => [
        ...prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s),
        { step: error.message || 'Failed to process renewal', status: 'error' }
      ]);
      setIsProcessing(false);
    }
  };

  // Listen for payment completion messages from popup
  useEffect(() => {
    const handleMessage = (event) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'PAYMENT_SUCCESS' && event.data.renewal) {
        // Payment completed successfully
        setProgressSteps([
          { step: 'Calculating price', status: 'complete' },
          { step: 'Signing renewal', status: 'complete' },
          { step: 'Creating payment session', status: 'complete' },
          { step: 'Payment completed', status: 'complete' }
        ]);
        setPaymentResult('success');
        setIsProcessing(false);

        // Add to pendingRenewals array AFTER payment (1 step)
        if (event.data.paymentHash && event.data.serverName) {
          const newRenewal = {
            appName: event.data.serverName,
            paymentHash: event.data.paymentHash,
            paymentConfirmed: true,
            type: 'renewal',
            pendingTimestamp: Date.now()
          };

          // Add to array (not replace)
          const existingRenewals = JSON.parse(localStorage.getItem('pendingRenewals') || '[]');
          existingRenewals.push(newRenewal);
          localStorage.setItem('pendingRenewals', JSON.stringify(existingRenewals));
          console.log('💾 Added pendingRenewal after payment:', event.data.paymentHash);
        }

        // Reload server data
        if (onUpdate) {
          const t = setTimeout(() => onUpdate(), 1000);
          pendingTimersRef.current.push(t);
        }
      } else if (event.data.type === 'PAYMENT_CANCELLED' && event.data.renewal) {
        // Payment was cancelled
        setProgressSteps([
          { step: 'Payment cancelled', status: 'error' }
        ]);
        setPaymentResult('cancelled');
        setIsProcessing(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onUpdate]);

  // Show payment processing view
  if (paymentStep === 'processing') {
    return (
      <div className="max-w-2xl mx-auto">
        {/* Back button - only show before processing starts or after error/cancel */}
        {(progressSteps.length === 0 || paymentResult === 'cancelled' || progressSteps.some(s => s.status === 'error')) && !isProcessing && (
          <button
            onClick={() => {
              setPaymentStep('selection');
              setProgressSteps([]);
              setPaymentResult(null);
              setIsProcessing(false);
            }}
            className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back to Renewal
          </button>
        )}

        <div className="rounded-xl p-6" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9))', border: '1px solid rgba(51,65,85,0.5)' }}>
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Processing Renewal
          </h3>

          {/* Progress Steps */}
          {progressSteps.length > 0 && (
            <div className="space-y-3 mb-6">
              {progressSteps.map((step, index) => (
                <div key={index} className="flex items-center gap-3">
                  {step.status === 'loading' && (
                    <RefreshCw className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0" />
                  )}
                  {step.status === 'complete' && (
                    <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  )}
                  {step.status === 'error' && (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${
                    step.status === 'loading' ? 'text-blue-300' :
                    step.status === 'complete' ? 'text-blue-300' :
                    step.status === 'error' ? 'text-red-300' : 'text-gray-400'
                  }`}>
                    {step.step}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Cancel button during wallet payment */}
          {isProcessing && !paymentResult && progressSteps.some(s => s.step === 'Opening wallet' && s.status === 'loading') && (
            <button
              onClick={() => {
                cryptoAbortRef.current?.abort();
                setWaitingForCrypto(false);
                cryptoAbortRef.current = null;
                setProgressSteps([]);
                setPaymentStep('selection');
                setIsProcessing(false);
                toast.error('Payment cancelled');
              }}
              className="w-full px-8 py-1.5 text-sm font-medium text-red-400 hover:text-red-300 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 hover:border-red-400/30 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <XCircle className="w-5 h-5" />
              Cancel Payment
            </button>
          )}

          {/* Success Result */}
          {paymentResult === 'success' && renewalDetails && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6 mb-4">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                <h4 className="text-2xl font-semibold text-blue-400 mb-3">Renewal Successful!</h4>
                <div className="text-sm text-gray-300 space-y-3 text-left bg-gray-700/50 p-4 rounded">
                  <p><span className="font-medium">Duration Added:</span> {renewalDetails.duration} (~{renewalDetails.daysAdded} days)</p>
                  <p>
                    <span className="font-medium">Price:</span> {renewalDetails.crypto ? `${renewalDetails.price} FLUX` : `$${renewalDetails.price.toFixed(2)} USD`}
                    {!renewalDetails.testHash && !renewalDetails.crypto && <span className="text-gray-500 text-xs ml-1">(+ VAT if applicable)</span>}
                  </p>
                  <p><span className="font-medium">New Expiration:</span> {renewalDetails.newExpiration.toLocaleString()}</p>

                  {/* Transaction link for crypto payments */}
                  {renewalDetails.txid && (
                    <div className="pt-2 border-t border-gray-600">
                      <p className="font-medium text-blue-400 mb-2">Transaction:</p>
                      <a
                        href={`https://explorer.runonflux.io/tx/${renewalDetails.txid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors break-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                        {renewalDetails.txid}
                      </a>
                    </div>
                  )}

                  {/* Hash with copy button */}
                  {renewalDetails.testHash && (
                    <div className="pt-2 border-t border-gray-600">
                      <p className="font-medium text-blue-400 mb-2">Payment Hash:</p>
                      <div className="flex items-center gap-2 bg-gray-800 p-2 rounded">
                        <code className="text-xs text-blue-300 flex-1 break-all">{renewalDetails.testHash}</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(renewalDetails.testHash);
                            setCopiedItem('hash');
                            setTimeout(() => setCopiedItem(null), 2000);
                          }}
                          className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
                            copiedItem === 'hash'
                              ? 'text-blue-400 bg-blue-400/10'
                              : 'text-gray-400 hover:text-white hover:bg-gray-700'
                          }`}
                        >
                          {copiedItem === 'hash' ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Stripe Session ID with copy button */}
                  {renewalDetails.stripeSessionId && (
                    <div>
                      <p className="font-medium text-blue-400 mb-2">Stripe Session ID:</p>
                      <div className="flex items-center gap-2 bg-gray-800 p-2 rounded">
                        <code className="text-xs text-blue-300 flex-1 break-all">{renewalDetails.stripeSessionId}</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(renewalDetails.stripeSessionId);
                            setCopiedItem('session');
                            setTimeout(() => setCopiedItem(null), 2000);
                          }}
                          className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
                            copiedItem === 'session'
                              ? 'text-blue-400 bg-blue-400/10'
                              : 'text-gray-400 hover:text-white hover:bg-gray-700'
                          }`}
                        >
                          {copiedItem === 'session' ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* What happens next */}
                <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-left">
                  <p className="text-sm font-medium text-blue-400 mb-2">What happens next:</p>
                  <ul className="text-xs text-gray-300 space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>Your renewal is being processed on the Flux network</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>The dashboard monitors your payment hash automatically</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>When confirmed, your server's expiration date will update</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>This usually takes a few minutes (check the dashboard)</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => {
                    setPaymentStep('selection');
                    setPaymentResult(null);
                    setProgressSteps([]);
                    if (onUpdate) onUpdate();
                    if (onClose) onClose();
                  }}
                  className="mt-4 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Close & Refresh Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Cancelled Result */}
          {paymentResult === 'cancelled' && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
              <div className="text-center">
                <XCircle className="w-16 h-16 text-orange-400 mx-auto mb-4" />
                <h4 className="text-xl font-semibold text-orange-400 mb-3">Payment Cancelled</h4>
                <p className="text-sm text-yellow-300 mb-4">
                  The payment was cancelled. No charges were made.
                </p>
                <button
                  onClick={() => {
                    setPaymentStep('selection');
                    setPaymentResult(null);
                    setProgressSteps([]);
                  }}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Back to Renewal
                </button>
              </div>
            </div>
          )}

          {/* Popup Blocked Dialog */}
          {showPopupBlockedDialog && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
              <div className="text-center">
                <h4 className="text-lg font-semibold text-orange-400 mb-3">Popup Blocked</h4>
                <p className="text-sm text-gray-300 mb-4">
                  Your browser blocked the payment window. Please click below to open it manually.
                </p>
                <button
                  onClick={() => {
                    if (blockedPaymentUrl) {
                      window.open(blockedPaymentUrl, '_blank');
                      setShowPopupBlockedDialog(false);
                      setBlockedPaymentUrl(null);
                    }
                  }}
                  className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
                >
                  Open Payment Window
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show renewal selection view
  return (
    <div className="space-y-6">
      {/* Cancel Success Message */}
      {cancelResult === 'success' && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-400">Server cancellation submitted</p>
              <p className="text-xs text-gray-400 mt-1">Your server will expire in ~50 minutes. The dashboard will update automatically.</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9))', border: '1px solid rgba(51,65,85,0.5)' }}>
        <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(51,65,85,0.3)' }}>
          <div className="p-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.15)' }}>
            <CreditCard className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Subscription Management</h3>
        </div>

        <div className="p-4 space-y-4">
          {/* Current Plan */}
          <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.3)' }}>
            <div className="px-4 py-2 flex items-center gap-2 bg-gray-700/70" style={{ borderBottom: '1px solid rgba(51,65,85,0.3)' }}>
              <GrPlan className="w-4 h-4 text-white" />
              <h4 className="text-sm font-semibold text-white">Current Plan</h4>
            </div>
            <div className="p-4 space-y-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Status
              </span>
              <div className="flex items-center gap-2">
                {cancelResult === 'success' || currentExpire <= 200 ? (
                  <span className="inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border bg-red-500/20 text-red-400 border-red-500/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <span>Expiring soon</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1.5 px-2 pt-0.5 pb-1 rounded-full text-xs font-medium border bg-emerald-500/20 text-emerald-400 border-emerald-500/30 leading-none">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="leading-none">Active</span>
                  </span>
                )}
                {!isLoadingSubscription && subscriptionStatus && subscriptionStatus.status === 'active' && currentExpire > 200 && (
                  <span className="inline-flex items-center gap-1 px-2 pt-0.5 pb-1 rounded-full text-xs font-medium border bg-blue-500/20 text-blue-400 border-blue-500/30 leading-none">
                    <RefreshCw className="w-3 h-3" />
                    <span className="leading-none">Auto-renewing</span>
                  </span>
                )}
                {!isLoadingSubscription && subscriptionStatus && subscriptionStatus.status === 'past_due' && (
                  <span className="inline-flex items-center gap-1 px-2 pt-0.5 pb-1 rounded-full text-xs font-medium border bg-red-500/20 text-red-400 border-red-500/30 leading-none">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="leading-none">Payment issue</span>
                  </span>
                )}
              </div>
            </div>
            {server.expiresAt && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Expires
                </span>
                <span className="text-sm text-gray-400">
                  {new Date(server.expiresAt).toLocaleDateString()}
                </span>
              </div>
            )}
            </div>
          </div>

          {/* Subscription active: show management UI instead of renewal */}
          {/* Hide cancel UI if expire is already very low (already cancelled) */}
          {!isLoadingSubscription && subscriptionStatus && subscriptionStatus.status === 'active' && currentExpire > 200 && cancelResult !== 'success' && (
            showCancelConfirm ? (
              <div className="space-y-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-red-300">Are you sure?</p>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>Your server will expire in ~50 minutes</li>
                        <li>Your Stripe auto-renewal will be cancelled</li>
                        <li>After expiration, your server will no longer be accessible</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={isCancelling}
                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Keep Server
                  </button>
                  <button
                    onClick={handleCancelServer}
                    disabled={isCancelling}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {isCancelling ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        Confirm Cancel
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-gray-300">
                  Your server renews automatically via Stripe. You can manage your billing or cancel below.
                </p>
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={() => stripeService.openBillingPortal()}
                    className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Billing Portal
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={isCancelling}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel Subscription
                  </button>
                </div>
              </div>
            )
          )}

          {/* Renewal UI — only when NO active subscription or already cancelled (low expire) */}
          {(!subscriptionStatus || subscriptionStatus.status !== 'active' || currentExpire <= 200) && (
          <>
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <label className="block text-sm font-medium text-gray-300">Select Renewal Duration</label>
              <span className="text-xs text-gray-500">1 year maximum</span>
            </div>
            {isLoadingLimits ? (
              <div className="text-sm text-gray-400 text-center py-4">Loading available options...</div>
            ) : maxAddBlocks <= 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
                This server is already paid up to the 1-year maximum, with {formatBlocksDuration(currentExpire)} still to run.
                You can extend it again once some of that time has elapsed.
              </div>
            ) : (
              <>
              {/* Quick picks — only periods that fit, plus the exact headroom left */}
              <div className="flex flex-wrap gap-3">
                {presets.map((preset) => {
                  // Flux's discount comes off the TOTAL subscription, so the time already on
                  // the server counts towards it too.
                  const discount = discountForTotalBlocks((currentExpire ?? 0) + preset.blocks);

                  return (
                    <button
                      key={preset.key}
                      onClick={() => setAddBlocks(preset.blocks)}
                      disabled={isProcessing}
                      className={`flex-1 min-w-fit px-3 py-2 rounded-lg border-2 transition-colors ${
                        addBlocks === preset.blocks
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 bg-gray-700/30 hover:border-gray-600'
                      } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-2 justify-center">
                        <span className="text-sm font-semibold text-white whitespace-nowrap">
                          {preset.label}
                        </span>
                        {discount > 0 && (
                          <span className="inline-block px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium whitespace-nowrap">
                            {discount}% OFF
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Fine-tune anywhere up to the headroom left under the cap */}
              {maxAddDays > 1 && (
                <div className="mt-4">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <span className="text-sm text-white">
                      Adding <span className="font-semibold text-blue-400">{periodLabel}</span>
                    </span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">up to {formatBlocksDuration(maxAddBlocks)}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={maxAddDays}
                    step={1}
                    value={addDays}
                    disabled={isProcessing}
                    aria-label="Renewal duration"
                    onChange={(e) => setAddBlocks(blocksForDays(Number(e.target.value)))}
                    className="w-full accent-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              )}

              {/* The cap, made visible: time already paid for + time being added, out of 1 year */}
              <div className="mt-4">
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-700/40">
                  <div className="bg-gray-400/60" style={{ width: `${((currentExpire ?? 0) / MAX_SUBSCRIPTION_BLOCKS) * 100}%` }} />
                  <div className="bg-blue-500 transition-all duration-150" style={{ width: `${(addBlocks / MAX_SUBSCRIPTION_BLOCKS) * 100}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className="flex items-center gap-1.5 text-gray-400">
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-400/60" />
                    {formatBlocksDuration(currentExpire)} still active
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-300">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                    + {periodLabel}
                  </span>
                  <span className="sm:ml-auto text-gray-500">
                    {MAX_SUBSCRIPTION_BLOCKS - totalAfterRenewal < BLOCKS_PER_DAY
                      ? 'at the 1-year cap'
                      : `${formatBlocksDuration(MAX_SUBSCRIPTION_BLOCKS - totalAfterRenewal)} left to the cap`}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  A subscription can run for at most 1 year at a time, counting the {formatBlocksDuration(currentExpire)} still
                  on this server plus the time you add now.
                </p>
              </div>
              </>
            )}
          </div>

          {/* Pricing Display */}
          {!isProcessing && !paymentResult && maxAddBlocks > 0 && (
            <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.3)' }}>
              <div className="px-4 py-2 flex items-center gap-1.5 bg-gray-700/70" style={{ borderBottom: '1px solid rgba(51,65,85,0.3)' }}>
                  <MdMonetizationOn className="w-4 h-4 text-white" />
                  <h4 className="text-sm font-semibold text-white">{autoRenewal ? 'Subscription Price (Estimate)' : 'Renewal Price (Estimate)'}</h4>
              </div>
              <div className="px-4 py-2">
              {isLoadingPrice ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Calculating price...</span>
                </div>
              ) : (pricing && !pricing.error) ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-semibold text-sm">
Price
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-blue-400 font-bold text-lg">~${pricing.price.toFixed(2)}</span>
                      <span className="text-gray-500 text-xs">+ VAT</span>
                    </div>
                  </div>
                  {pricing.discount > 0 && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>Enjoy</span>
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full font-medium">
                        {pricing.discount}% OFF
                      </span>
                      <span>on a {formatBlocksDuration(totalAfterRenewal)} subscription</span>
                    </div>
                  )}
                  <div className="text-sm mt-1.5">
                    <p className="text-white font-medium">
                      {autoRenewal ? 'Next billing:' : 'Renewed till:'} {(() => {
                        const SECONDS_PER_BLOCK = 30;
                        const secondsAdded = pricing.blocksToAdd * SECONDS_PER_BLOCK;
                        const currentDate = server.expiresAt ? new Date(server.expiresAt) : new Date();
                        const newDate = new Date(currentDate.getTime() + (secondsAdded * 1000));

                        // Format as dd.MM.yyyy, HH:mm
                        const day = String(newDate.getDate()).padStart(2, '0');
                        const month = String(newDate.getMonth() + 1).padStart(2, '0');
                        const year = newDate.getFullYear();
                        const hours = String(newDate.getHours()).padStart(2, '0');
                        const minutes = String(newDate.getMinutes()).padStart(2, '0');

                        return `~${day}.${month}.${year}, ${hours}:${minutes}`;
                      })()}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400 italic mt-1">
                    {autoRenewal
                      ? '* Recurring charge. You can cancel anytime.'
                      : '* Final price will be recalculated before payment'}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-red-400">
                  {pricing?.error || 'Failed to calculate pricing'}
                </div>
              )}
              </div>
            </div>
          )}

          {/* Auto-Renewal Toggle */}
          {pricing && !pricing.error && (
            <div className="bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border-2 border-blue-700/50 rounded-2xl p-3 sm:p-4 shadow-lg shadow-blue-500/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <div>
                    <span className="text-sm font-semibold text-white">Auto-Renewal</span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {!subscriptionMonths
                        ? 'Available for 1, 3, 6 or 12-month periods — pick one above to enable it.'
                        : autoRenewal
                          ? 'Automatically renews via Stripe each billing period'
                          : 'One-time payment. Manually renew before expiry.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoRenewal(!autoRenewal)}
                  disabled={!subscriptionMonths}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
                    autoRenewal ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      autoRenewal ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Crypto Payment Waiting Dialog */}
          {waitingForCrypto && (
            <div className="flex flex-col items-center justify-center py-6 space-y-4 border-2 border-blue-700/40 rounded-2xl bg-gradient-to-br from-blue-900/10 to-indigo-900/10">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
              <h3 className="text-base font-semibold text-white">Waiting for Payment</h3>
              <p className="text-sm text-gray-400 text-center px-4">Please complete the payment in your wallet.</p>
              <button
                onClick={() => {
                  cryptoAbortRef.current?.abort();
                  setWaitingForCrypto(false);
                }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Crypto Payment Panel - only when auto-renewal is OFF */}
          {!waitingForCrypto && !autoRenewal && pricing && !pricing.error && (
            <div className="border-2 border-blue-700/40 rounded-2xl overflow-hidden shadow-lg shadow-blue-500/5">
              <button
                type="button"
                onClick={() => setCryptoExpanded(!cryptoExpanded)}
                className="w-full flex items-center justify-between p-3 sm:p-4 bg-gradient-to-br from-blue-900/20 to-indigo-900/20 hover:from-blue-900/30 hover:to-indigo-900/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-sm font-semibold text-white">Pay with Crypto (FLUX)</span>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${cryptoExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {cryptoExpanded && (
                <div className="p-3 sm:p-4 bg-gradient-to-br from-blue-900/10 to-indigo-900/10 border-t border-blue-700/30 space-y-3">
                  {fluxPrice > 0 && (
                    <div className="flex justify-center py-1">
                      <div
                        className="relative inline-flex items-baseline gap-1.5 px-4 py-1.5 rounded-lg"
                        style={{
                          background: 'rgba(37,99,235,0.1)',
                          border: '1px solid rgba(37,99,235,0.3)',
                        }}
                      >
                        <span className="inline-flex items-center gap-2.5">
                          <img src="/flux-icon.svg" alt="FLUX" className="w-6 h-6" />
                          <span className="text-2xl font-bold text-blue-300">
                            {fluxPrice}
                          </span>
                        </span>
                        <span className="text-sm font-semibold text-blue-300">
                          FLUX
                        </span>
                        {apiPricingFlux.fluxDiscount > 0 && (
                          <div
                            className="absolute -top-1.5 -right-3 px-2 py-0.5 rounded-full font-bold text-white text-xs"
                            style={{ background: '#2563EB', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
                          >
                            -{apiPricingFlux.fluxDiscount}%
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleCryptoRenewal('zelcore')}
                      disabled={isProcessing || !fluxPrice}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 rounded-xl text-sm font-medium text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <img src="/wallets/zelcore.svg" alt="ZelCore" className="w-5 h-5" />
                      ZelCore
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCryptoRenewal('ssp')}
                      disabled={isProcessing || !fluxPrice}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/40 rounded-xl text-sm font-medium text-orange-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <img src="/wallets/ssp-white.svg" alt="SSP" className="w-5 h-5" />
                      SSP
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 italic">One-time crypto payment. No auto-renewal.</p>
                </div>
              )}
            </div>
          )}

          {/* Renewal Button */}
          {!waitingForCrypto && <button
            onClick={handleRenewal}
            disabled={isProcessing || isLoadingLimits || isLoadingPrice || !pricing || pricing?.error}
            className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            {isProcessing ? 'Processing...' : 'Proceed to Payment'}
          </button>}

          {/* Cancel Server (one-time payment users) — hide if already cancelled/expiring */}
          {currentExpire > 200 && cancelResult !== 'success' && (
          showCancelConfirm ? (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-red-300">Are you sure?</p>
                    <ul className="text-xs text-gray-400 space-y-1">
                      <li>Your server will expire in ~50 minutes</li>
                      <li>After expiration, your server will no longer be accessible</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={isCancelling}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Keep Server
                </button>
                <button
                  onClick={handleCancelServer}
                  disabled={isCancelling}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isCancelling ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Confirm Cancel
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={isCancelling}
              className="w-full px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <XCircle className="w-5 h-5" />
              Cancel Server
            </button>
          )
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper component for info rows
const InfoRow = ({ label, value, copyText }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-sm text-white font-medium flex items-center gap-1.5">
        <span className="break-all min-w-0">{value}</span>
        {copyText && (
          <button
            type="button"
            onClick={handleCopy}
            title="Copy"
            className={`p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors flex-shrink-0 ${copied ? 'text-emerald-400' : 'text-slate-400 hover:text-white'}`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
};

export default ServerManagementPanel;
