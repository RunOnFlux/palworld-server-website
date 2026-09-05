import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Portal tooltip — works inside overflow:hidden containers
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
    <span ref={ref} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} style={{ display: 'contents' }}>
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
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SerializeAddon } from '@xterm/addon-serialize';
import { io } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';
import toast from 'react-hot-toast';
import secureStorage from '../../utils/secureStorage';
import qs from 'qs';
import CustomSelect from '../common/CustomSelect';
import { AnsiUp } from 'ansi_up';

const ansiUp = new AnsiUp();
ansiUp.use_classes = false;

const ROLLED_OVER_NOTICE = '\u2014 earlier logs rolled over on this node and are no longer available \u2014';

/**
 * ServerLogsPanel Component
 * Polls Flux applogpolling API and displays server logs in a scrollable panel.
 *
 * The node is asked for everything since the position it last handed back, so no
 * line written between two polls is missed. Before positions existed this asked
 * for the last 100 lines each time and replaced the view with them, so a server
 * writing more than 100 lines in the ten seconds between polls lost the rest with
 * nothing to show it had happened.
 */
const ServerLogsPanel = ({ server, masterLocation, selectedComponent, splitDirection, onToggleDirection, isMobile, commandTrigger, isVisible }) => {
  const [logs, setLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(() => {
    try { return localStorage.getItem('terminal_autoScroll') !== 'false'; } catch { return true; }
  });
  const logContainerRef = useRef(null);
  const intervalRef = useRef(null);
  const hiddenLinesRef = useRef(new Set());
  // Where this panel has read up to, as the node described it. Opaque on purpose:
  // nodes and this site upgrade independently, so reading it here would make its
  // shape a contract. Null means "start from the most recent lines", which is
  // also all a node that predates positions can answer.
  const logCursorRef = useRef(null);
  const isProgrammaticScrollRef = useRef(false);
  const scrollPersistTimerRef = useRef(null);

  const containerName = server?.version >= 4
    ? `${selectedComponent}_${server?.name}`
    : server?.name;

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true; // Reset on re-mount (React 18 Strict Mode)
    return () => { mountedRef.current = false; };
  }, []);

  // Extract primitive string to prevent object reference churn causing fetch aborts
  const masterIp = masterLocation?.ip ?? null;

  // A position belongs to ONE node's container. The same server on another node
  // has its own log with its own timestamps, so a position carried across would
  // name a moment that means nothing there and skip lines to match a count taken
  // somewhere else.
  useEffect(() => {
    logCursorRef.current = null;
    setLogs([]);
  }, [masterIp, containerName]);

  const fetchLogs = useCallback(async (signal) => {
    if (!masterIp || !containerName) {
      console.log('[LogPoll] skipped: masterIp=%s containerName=%s', masterIp, containerName);
      return;
    }
    try {
      const zelidauth = await secureStorage.getItem('zelidauth');
      if (!zelidauth) { console.log('[LogPoll] no zelidauth in storage'); return; }
      if (!mountedRef.current) { console.log('[LogPoll] component unmounted, aborting'); return; }

      const [h, p = 16127] = masterIp.split(':');
      const baseUrl = `https://${h.replace(/\./g, '-')}-${p}.node.api.runonflux.io/apps/applogpolling/${containerName}/100`;

      const hadPosition = logCursorRef.current !== null;
      let supportsPositions = false;
      let rolledOver = false;
      const collected = [];

      // Bounded, because the node asks to be called straight back whenever more
      // was waiting than one answer carries. A burst is drained now rather than
      // one page per ten-second tick, and the bound is what stops a server
      // logging faster than this reads holding the loop open.
      for (let page = 0; page < 20; page += 1) {
        // A query parameter, not a path segment: the route takes three optional
        // segments and a fourth would not match, so a node that predates
        // positions would answer a 404 instead of logs.
        const query = logCursorRef.current ? `?cursor=${encodeURIComponent(logCursorRef.current)}` : '';

        console.log('[LogPoll] fetching %s%s', baseUrl, query);
        const resp = await fetch(baseUrl + query, {
          headers: { zelidauth: JSON.stringify(zelidauth) },
          signal,
        });
        console.log('[LogPoll] response status=%d ok=%s', resp.status, resp.ok);

        const data = await resp.json();
        console.log('[LogPoll] data status=%s logsIsArray=%s logsLength=%s', data.status, Array.isArray(data.logs), data.logs?.length);

        if (!mountedRef.current) return;

        if (!(data.status === 'success' && Array.isArray(data.logs))) {
          console.warn('[LogPoll] unexpected response:', JSON.stringify(data).slice(0, 500));
          return;
        }

        const lines = data.logs.map(line =>
          typeof line === 'string' ? line : (line.message || line.log || JSON.stringify(line))
        );
        collected.push(...lines.filter(line => !hiddenLinesRef.current.has(line)));

        // A node that answers positions returns one. A node that predates them
        // returns the most recent lines and nothing else, which is what this
        // panel has always shown - so against that node it keeps showing exactly
        // that, with no version check anywhere.
        if (typeof data.cursor !== 'string') break;

        supportsPositions = true;
        rolledOver = rolledOver || Boolean(data.rolledOver);
        logCursorRef.current = data.cursor;

        // What lies AHEAD of the position just stored, which is the only
        // thing another pass can fetch. `truncated` is the log holding more than
        // the line count asked for - behind this panel, unreachable with a
        // cursor, and true on nearly every first page.
        if (!data.hasMore) break;
      }

      console.log('[LogPoll] collected=%d positions=%s rolledOver=%s', collected.length, supportsPositions, rolledOver);

      setLogs(prev => {
        if (!supportsPositions || !hadPosition) return collected;

        // The line this panel had read up to no longer exists on the node: docker
        // discarded the file holding it. What sat between it and the oldest line
        // below is gone for everyone, so it is said rather than skipped over.
        const marker = rolledOver && prev.length ? [ROLLED_OVER_NOTICE] : [];
        return [...prev, ...marker, ...collected];
      });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('[LogPoll] fetch error:', err?.message || err);
    }
  }, [masterIp, containerName]);

  // Initial fetch + 10s polling interval — only when panel is visible
  useEffect(() => {
    if (!isVisible || !masterIp || !containerName) {
      console.log('[LogPoll] polling NOT started: isVisible=%s masterIp=%s containerName=%s', isVisible, masterIp, containerName);
      return;
    }
    console.log('[LogPoll] polling STARTED for %s @ %s (10s interval)', containerName, masterIp);
    const controller = new AbortController();
    fetchLogs(controller.signal);
    intervalRef.current = setInterval(() => fetchLogs(controller.signal), 10000);
    return () => {
      console.log('[LogPoll] polling STOPPED (cleanup)');
      controller.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (scrollPersistTimerRef.current) clearTimeout(scrollPersistTimerRef.current);
    };
  }, [isVisible, masterIp, containerName, fetchLogs]);

  // Fetch immediately after user sends a command — only when panel is visible
  useEffect(() => {
    if (!isVisible || commandTrigger === 0) return;
    const controller = new AbortController();
    fetchLogs(controller.signal);
    return () => controller.abort();
  }, [isVisible, commandTrigger, fetchLogs]);

  const handleClear = () => {
    hiddenLinesRef.current = new Set(logs);
    setLogs([]);
  };

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      isProgrammaticScrollRef.current = true;
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      const t = setTimeout(() => { isProgrammaticScrollRef.current = false; }, 50);
      return () => clearTimeout(t);
    }
  }, [logs, autoScroll]);

  return (
    <div className="flex flex-col h-full bg-gray-900 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-medium text-white">Server Logs</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setAutoScroll(p => { const next = !p; try { localStorage.setItem('terminal_autoScroll', next); } catch { /* ignore */ } return next; })}
            className={`relative group/tip overflow-visible text-xs px-2 py-1 rounded transition-colors ${autoScroll ? 'bg-blue-600/80 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
          >
            Auto
            <span className="hidden sm:block absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-gray-900 border border-gray-700 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50 before:content-[''] before:absolute before:bottom-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-700">Auto-scroll</span>
          </button>
          <button
            onClick={handleClear}
            className="relative group/tip overflow-visible text-xs px-2 py-1 rounded bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            Clear
            <span className="hidden sm:block absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-gray-900 border border-gray-700 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50 before:content-[''] before:absolute before:bottom-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-700">Clear logs</span>
          </button>
          {!isMobile && onToggleDirection && (
            <button
              onClick={onToggleDirection}
              className="relative group/tip overflow-visible ml-1 text-gray-500 hover:text-gray-300 transition-colors"
            >
              {splitDirection === 'horizontal' ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18M4 3h16" />
                </svg>
              )}
              <span className="hidden sm:block absolute top-full right-0 mt-2 px-2 py-1 text-xs text-white bg-gray-900 border border-gray-700 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50 before:content-[''] before:absolute before:bottom-full before:right-1 before:border-4 before:border-transparent before:border-b-gray-700">{splitDirection === 'horizontal' ? 'Vertical' : 'Horizontal'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Log lines */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#4a5568 transparent' }}
        onScroll={(e) => {
          if (isProgrammaticScrollRef.current) return;
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
          setAutoScroll(atBottom);
          clearTimeout(scrollPersistTimerRef.current);
          scrollPersistTimerRef.current = setTimeout(() => {
            try { localStorage.setItem('terminal_autoScroll', atBottom); } catch { /* ignore */ }
          }, 300);
        }}
      >
        {logs.length === 0 ? (
          <p className="text-gray-600 text-center mt-8">Waiting for logs...</p>
        ) : (
          logs.map((line, i) => {
            const raw = line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, '').trim();
            if (!raw) return null;

            const html = ansiUp.ansi_to_html(raw);

            return (
              <div key={i} className="py-px leading-relaxed hover:bg-gray-800/30">
                <span
                  className="break-all font-mono text-xs text-blue-300/90"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

/**
 * ServerTerminal Component
 * Terminal interface for game servers using xterm.js and Socket.io
 * Based on FluxOS Terminal implementation
 */
// eslint-disable-next-line no-unused-vars
const ServerTerminal = ({ server, onClose, isVisible, masterLocation, onMasterError, isPaused = false }) => {
  const [terminals, setTerminals] = useState([]);
  const [activeTerminalId, setActiveTerminalId] = useState(null);
  const terminalIdCounter = useRef(0);

  // Separate state for UI properties to avoid re-rendering terminal divs
  // This prevents React from clearing xterm children during reconciliation
  const [terminalUI, setTerminalUI] = useState({});

  // Refs for each terminal div (React renders them in JSX now)
  const terminalDivRefs = useRef({});

  // Store terminal instances in refs to avoid re-renders (DO NOT store in terminals array)
  const terminalInstancesRef = useRef({});

  // Store all timeout IDs for cleanup on unmount
  const timeoutsRef = useRef([]);

  // Helper to add timeout with automatic cleanup tracking
  const addTimeout = useCallback((fn, delay) => {
    const id = setTimeout(() => {
      fn();
      // Remove from tracking array when it executes
      timeoutsRef.current = timeoutsRef.current.filter(tid => tid !== id);
    }, delay);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  // Stable ref callback - reads terminal ID from data attribute to avoid creating new functions
  const setTerminalRef = useCallback((element) => {
    if (element) {
      const terminalId = parseInt(element.getAttribute('data-terminal-id'));
      if (terminalId) {
        terminalDivRefs.current[terminalId] = element;
        console.log(`📌 Ref set for terminal ${terminalId}`);
      }
    }
    // Note: When called with null, we can't determine which terminal, so cleanup happens in useEffect
  }, []);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, []);

  // Cleanup refs for terminals that no longer exist
  useEffect(() => {
    const currentTerminalIds = new Set(terminals.map(t => t.id));
    Object.keys(terminalDivRefs.current).forEach(id => {
      if (!currentTerminalIds.has(parseInt(id))) {
        console.log(`🗑️ Cleaning up ref for terminal ${id}`);
        delete terminalDivRefs.current[id];
      }
    });
  }, [terminals]);

  // Handle terminal switching - fit and focus active terminal
  useEffect(() => {
    if (!activeTerminalId) return;

    console.log(`🔄 Switching to terminal ${activeTerminalId}`);

    // Get terminal instances from ref (not from state!)
    const activeTermData = terminalInstancesRef.current[activeTerminalId];

    // Small delay to ensure div is visible before fitting
    setTimeout(() => {
      if (activeTermData?.terminal && activeTermData?.fitAddon) {
        console.log(`📐 Fitting terminal ${activeTerminalId}`);
        try {
          activeTermData.fitAddon.fit();
          activeTermData.terminal.focus();
          console.log(`✅ Terminal ${activeTerminalId} fitted and focused`);
        } catch (err) {
          console.error(`❌ Error fitting terminal ${activeTerminalId}:`, err);
        }
      } else {
        console.warn(`⚠️ Terminal ${activeTerminalId} missing terminal or fitAddon:`, {
          hasTerminal: !!activeTermData?.terminal,
          hasFitAddon: !!activeTermData?.fitAddon
        });
      }
    }, 50);
  }, [activeTerminalId]);

  // Refit terminals when tab becomes visible
  useEffect(() => {
    if (!isVisible || !activeTerminalId) return;

    console.log('👁️ Terminal tab became visible, refitting active terminal');

    // Get active terminal instances from ref
    const activeTermData = terminalInstancesRef.current[activeTerminalId];

    // Small delay to ensure display: none -> block transition is complete
    const timer = setTimeout(() => {
      if (activeTermData?.terminal && activeTermData?.fitAddon) {
        try {
          // Fit multiple times to ensure proper text reflow
          activeTermData.fitAddon.fit();
          // Force text refresh by fitting again and calling refresh
          setTimeout(() => {
            activeTermData.fitAddon.fit();
            activeTermData.terminal.refresh(0, activeTermData.terminal.rows - 1);
            activeTermData.terminal.focus();
            console.log('✅ Terminal refitted and refreshed after becoming visible');
          }, 50);
        } catch (err) {
          console.error('❌ Error refitting terminal on visibility:', err);
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isVisible, activeTerminalId]);

  // Split view state — persisted in localStorage
  const [splitView, setSplitView] = useState(() => {
    try { const v = localStorage.getItem('terminal_splitView'); return v === null ? false : v !== 'false'; } catch { return false; }
  });
  const [splitDirection, setSplitDirection] = useState(() => {
    try { return localStorage.getItem('terminal_splitDirection') || 'horizontal'; } catch { return 'horizontal'; }
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [commandTrigger, setCommandTrigger] = useState(0);
  const cmdTriggerTimeoutRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Re-fit active terminal when split view is toggled
  useEffect(() => {
    if (activeTerminalId === null) return;
    const timer = setTimeout(() => {
      try {
        const instances = terminalInstancesRef.current[activeTerminalId];
        if (instances?.fitAddon) {
          instances.fitAddon.fit();
          if (instances.socket?.connected && instances.terminal) {
            instances.socket.emit('resize', { cols: instances.terminal.cols, rows: instances.terminal.rows });
          }
        }
      } catch {
        // ignore
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [splitView, splitDirection, activeTerminalId]);

  // IP Selection state (FluxOS pattern)
  const [selectedIp, setSelectedIp] = useState('');

  // Form state for new terminals
  const [selectedComponent, setSelectedComponent] = useState('');

  // Initialize component selection and IP based on app version
  useEffect(() => {
    if (server) {
      // For v4+ apps with compose, use first component name
      // For v3 and below, use the app name itself
      if (server.version >= 4 && server.compose?.length > 0) {
        setSelectedComponent(server.compose[0].name);
      } else {
        setSelectedComponent(server.name);
      }
    }
  }, [server]);

  // Set selectedIp from masterLocation (DNS already resolved when panel opens)
  useEffect(() => {
    if (!selectedIp && masterLocation?.ip) {
      setSelectedIp(masterLocation.ip);
      console.log('✅ [Terminal] Using master IP:', masterLocation.ip);
    }
  }, [masterLocation, selectedIp]);

  // Get available components based on app version
  const availableComponents = server?.version >= 4 && server?.compose?.length > 0
    ? server.compose.map(c => c.name)
    : [server?.name].filter(Boolean);

  const isMultiComponent = availableComponents.length > 1;

  // Cleanup function
  const cleanup = useCallback((terminalId) => {
    console.log(`🧹 Cleanup called for terminal ${terminalId}`);

    // Get instances from ref
    const instances = terminalInstancesRef.current[terminalId];
    if (instances) {
      if (instances.socket) {
        instances.socket.removeAllListeners();
        instances.socket.disconnect();
      }
      if (instances.terminal) {
        console.log(`♻️ Disposing terminal instance ${terminalId}`);
        instances.terminal.dispose();
      }
      if (instances.cleanup) {
        instances.cleanup();
      }
      delete terminalInstancesRef.current[terminalId];
    }

    // Remove from terminals array (only metadata)
    setTerminals(prev => prev.filter(t => t.id !== terminalId));

    // Clean up UI state
    setTerminalUI(prev => {
      const next = { ...prev };
      delete next[terminalId];
      return next;
    });
  }, []);

  // Cleanup all terminals when paused (e.g. during reinstall)
  // Full cleanup (not just disconnect) so auto-connect can re-fire when unpaused
  useEffect(() => {
    if (!isPaused) return;
    const ids = Object.keys(terminalInstancesRef.current).map(Number);
    ids.forEach(id => cleanup(id));
  }, [isPaused, cleanup]);

  // Cleanup all terminals on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(terminalInstancesRef.current).forEach(instances => {
        if (instances.socket) {
          instances.socket.removeAllListeners();
          instances.socket.disconnect();
        }
        if (instances.terminal) {
          instances.terminal.dispose();
        }
        if (instances.cleanup) {
          instances.cleanup();
        }
      });
      clearTimeout(cmdTriggerTimeoutRef.current);
    };
  }, []);

  // Terminal element lifecycle tracking removed (spam)

  // Debug: Track UI state changes separately
  useEffect(() => {
    console.log('🎨 Terminal UI state changed:', terminalUI);
  }, [terminalUI]);

  // Update terminal state
  const updateTerminal = useCallback((terminalId, updates) => {
    // Separate UI state from terminal instance state
    const uiKeys = ['isConnecting', 'isConnected', 'error', 'isInitialized'];
    const instanceKeys = ['socket', 'terminal', 'fitAddon', 'cleanup'];

    const uiUpdates = {};
    const instanceUpdates = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (uiKeys.includes(key)) {
        uiUpdates[key] = value;
      } else if (instanceKeys.includes(key)) {
        instanceUpdates[key] = value;
      }
    });

    // Update UI state (triggers re-render for visibility changes only)
    if (Object.keys(uiUpdates).length > 0) {
      setTerminalUI(prev => ({
        ...prev,
        [terminalId]: {
          ...prev[terminalId],
          ...uiUpdates,
        },
      }));
    }

    // Store terminal instances in ref (NO re-render, NO div clearing!)
    if (Object.keys(instanceUpdates).length > 0) {
      console.log(`💾 Storing terminal instances in ref for terminal ${terminalId}:`, Object.keys(instanceUpdates));
      if (!terminalInstancesRef.current[terminalId]) {
        terminalInstancesRef.current[terminalId] = {};
      }
      Object.assign(terminalInstancesRef.current[terminalId], instanceUpdates);
    }
  }, []);

  // Connect terminal session
  const connectTerminal = useCallback(async (terminalId, termData) => {
    // Get zelidauth from encrypted storage
    const zelidauth = await secureStorage.getItem('zelidauth');
    if (!zelidauth) {
      updateTerminal(terminalId, {
        error: 'Authentication required. Please login first.',
        isConnecting: false,
      });
      return;
    }

    // Use selectedIp (FluxOS pattern) - IP is already selected from dropdown
    if (!selectedIp) {
      updateTerminal(terminalId, {
        error: 'No IP selected. Please select a location.',
        isConnecting: false,
      });
      return;
    }

    const serverIp = selectedIp;

    // Find location info for logging (optional)
    const location = server.locations?.find(loc => loc.ip === selectedIp);

    console.log('🔍 Using selected IP for terminal:', {
      ip: serverIp,
      name: location?.name || 'Unknown',
      totalLocations: server.locations?.length || 0,
      allLocations: server.locations
    });

    // Use Flux DNS format: https://IP-with-dashes-PORT.node.api.runonflux.io
    const [host, port = 16127] = serverIp.split(':');
    const url = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/terminal`;

    console.log('🔌 Connecting terminal:', { terminalId, url, container: termData.containerName });

    // Create Socket.io connection
    const socket = io.connect(url, {
      reconnection: false, // We handle reconnection ourselves
    });

    console.log('🔍 Socket namespace:', socket.nsp);
    console.log('🔍 Socket io:', socket.io);

    // Create xterm terminal (FluxOS pattern)
    const term = new Terminal({
      allowProposedApi: true,
      cursorBlink: true,
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#ffffff',
        cursorAccent: '#000000',
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    });

    const fitAddon = new FitAddon();

    // Load all addons (FluxOS pattern)
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(new Unicode11Addon());
    term.loadAddon(new SerializeAddon());
    term._initialized = true;

    // Find the terminal element from our refs (React manages these divs now)
    const termElement = terminalDivRefs.current[terminalId];
    if (!termElement) {
      console.error('❌ Terminal element ref not found for terminal:', terminalId);
      console.error('Available terminal refs:', Object.keys(terminalDivRefs.current));
      updateTerminal(terminalId, {
        error: 'Terminal element not found in refs',
        isConnecting: false,
      });
      cleanup(terminalId);
      return;
    }

    console.log('✅ Terminal element ref found:', termElement);
    console.log('Element dimensions:', termElement.clientWidth, 'x', termElement.clientHeight);
    console.log('Element children before open:', termElement.children.length);

    term.open(termElement);

    console.log('Element children after open:', termElement.children.length);

    // Initial fit to give terminal dimensions (needed for rendering)
    addTimeout(() => {
      fitAddon.fit();
    }, 100);

    // Terminal event handlers
    term.onResize(({ cols, rows }) => {
      console.log(`📏 Terminal ${terminalId} resized:`, { cols, rows });
      if (socket.connected) {
        socket.emit('resize', { cols, rows });
      }
    });

    let lastDataReceived = Date.now();
    let staleCheckTimeout = null;

    term.onData((data) => {
      if (socket.connected) {
        socket.emit('cmd', data);
        // Trigger log fetch ~800ms after Enter so server has time to process
        if (data === '\r') {
          clearTimeout(cmdTriggerTimeoutRef.current);
          cmdTriggerTimeoutRef.current = setTimeout(() => setCommandTrigger(n => n + 1), 1000);
          // Stale connection detection: if no data received within 5s after Enter, reconnect
          clearTimeout(staleCheckTimeout);
          staleCheckTimeout = setTimeout(() => {
            if (Date.now() - lastDataReceived > 5000 && socket.connected) {
              console.warn('🔌 Stale connection detected — no response for 5s');
              const instances = terminalInstancesRef.current[terminalId];
              if (instances?.term) {
                instances.term.write('\r\n\x1b[1;31m⚠ Connection stale — reconnecting...\x1b[0m\r\n');
              }
              cleanup(terminalId);
              addTimeout(() => connectTerminal(terminalId), 2000);
            }
          }, 5000);
        }
      } else {
        console.warn('❌ Cannot send cmd - socket not connected');
      }
    });

    // Auto-copy selected text to clipboard (debounced to prevent toast spam)
    let copyTimeout = null;
    const copyToastId = `term-copy-${terminalId}`;
    term.onSelectionChange(() => {
      clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        copyTimeout = null;
        const sel = term.getSelection();
        if (!sel) return;
        navigator.clipboard.writeText(sel).then(() => {
          toast.success('Copied to clipboard', { id: copyToastId, duration: 1500, style: { fontSize: '13px' } });
        }).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = sel;
          ta.style.cssText = 'position:absolute;left:-9999px;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          toast.success('Copied to clipboard', { id: copyToastId, duration: 1500, style: { fontSize: '13px' } });
        });
      }, 300);
    });

    // Ctrl+V to paste from clipboard
    term.attachCustomKeyEventHandler((e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (e.type === 'keydown') {
          e.preventDefault();
          navigator.clipboard.readText().then((text) => {
            if (text && socket.connected) {
              socket.emit('cmd', text);
            }
          }).catch(() => {});
        }
        return false;
      }
      return true;
    });

    // Get zelidauth from storage and stringify it
    const zelidauthString = qs.stringify(zelidauth);

    // Variables for socket handlers (FluxOS pattern)
    let consoleInit = 0;

    // EMIT EXEC BEFORE HANDLERS (FluxOS pattern - Terminal.vue:572)
    console.log('📤 Emitting exec BEFORE handlers (FluxOS pattern)');
    console.log('📤 Zelidauth present:', !!zelidauthString);
    console.log('📤 Container:', termData.containerName);
    console.log('📤 Command:', termData.command);

    socket.emit('exec',
      zelidauthString,
      termData.containerName,
      termData.command,
      termData.env,
      termData.user
    );
    console.log('✅ Exec emitted');

    // NOW set up socket event handlers (FluxOS Terminal.vue:574+)
    socket.on('error', (err) => {
      console.error('❌ Socket error:', err);
      const errorStr = typeof err === 'string' ? err : (err?.message || String(err));

      if (errorStr.toLowerCase().includes('not authorized')) {
        updateTerminal(terminalId, {
          error: 'Session expired. Please login again.',
          isConnecting: false,
          isConnected: false
        });
      } else {
        updateTerminal(terminalId, {
          error: `Connection error: ${errorStr}`,
          isConnecting: false,
          isConnected: false
        });
      }
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Connection error:', err.message);
      updateTerminal(terminalId, {
        error: `Failed to connect: ${err.message}`,
        isConnecting: false,
        isConnected: false
      });
    });

    socket.on('connect_timeout', () => {
      console.error('⏱️ Socket connect_timeout event');
      updateTerminal(terminalId, {
        error: 'Connection timeout',
        isConnecting: false,
        isConnected: false
      });
    });

    socket.on('show', (data) => {
      lastDataReceived = Date.now();
      // Check for OCI runtime errors
      if (typeof data === 'string' && consoleInit === 0 && data.includes('OCI runtime exec')) {
        console.error('❌ OCI runtime error detected');
        updateTerminal(terminalId, {
          error: 'Command not supported by container',
          isConnecting: false,
        });
        cleanup(terminalId);
        return;
      }

      // Initialize terminal on first data (FluxOS pattern)
      if (consoleInit === 0) {
        console.log('🎉 Terminal initialized, first data received');
        consoleInit = 1;

        // Set up terminal environment (FluxOS: only if NOT custom command)
        if (termData.command === '/bin/bash' || termData.command === '/bin/sh') {
          socket.emit('cmd', 'export TERM=xterm\n');
          if (termData.command === '/bin/bash') {
            socket.emit('cmd', 'PS1="\\[\\033[01;31m\\]\\u\\[\\033[01;33m\\]@\\[\\033[01;36m\\]\\h \\[\\033[01;33m\\]\\w \\[\\033[01;35m\\]\\$ \\[\\033[00m\\]"\n');
          }
          socket.emit('cmd', "alias ls='ls --color'\n");
          socket.emit('cmd', "alias ll='ls -alF'\n");

        }

        // EXACT FluxOS timing with nextTick simulation (FluxOS line 634-649)
        addTimeout(() => {
          addTimeout(() => {  // Simulate Vue nextTick
            addTimeout(() => {
              console.log(`🎬 Timing complete, setting isConnecting = false for terminal ${terminalId}`);
              const elementBefore = document.getElementById(`terminal-${terminalId}`);
              console.log('📊 Element state BEFORE isConnecting=false:', {
                exists: !!elementBefore,
                children: elementBefore?.children.length,
                hasXterm: !!elementBefore?.querySelector('.xterm')
              });

              console.log('✅ Setting isConnecting=false in terminalUI (NOT terminals array) - this prevents React re-render!');
              updateTerminal(terminalId, { isConnecting: false });  // Now set false (FluxOS line 637)

              // Check element AFTER state update (but before React re-renders)
              addTimeout(() => {
                const elementAfter = document.getElementById(`terminal-${terminalId}`);
                console.log('📊 Element state AFTER isConnecting=false:', {
                  exists: !!elementAfter,
                  children: elementAfter?.children.length,
                  hasXterm: !!elementAfter?.querySelector('.xterm'),
                  sameElement: elementBefore === elementAfter
                });

                console.log('🧹 Calling term.clear() to remove setup color commands');
                term.clear();  // Clear to remove color commands from terminal setup (FluxOS line 639)

                // Show welcome message with command list AFTER cleanup
                if (termData.command === '/bin/bash' || termData.command === '/bin/sh') {
                  addTimeout(() => {
                    // Clear current line and move to start, then write message
                    term.write('\r\x1b[2K'); // Move to start of line and clear it
                    term.write('\r\n');
                    term.write(`\x1b[1;36m🎮  Palworld Server Console Connected\x1b[0m\r\n`);
                    term.write('\r\n');
                  }, 100);
                }

                addTimeout(() => {  // Simulate Vue nextTick
                  console.log('🎯 Focusing terminal');
                  term.focus();
                  addTimeout(() => {
                    console.log('📐 Fitting terminal and emitting resize');
                    fitAddon.fit();
                    socket.emit('resize', { cols: term.cols, rows: term.rows });

                    // Final check
                    const elementFinal = document.getElementById(`terminal-${terminalId}`);
                    console.log('📊 Element state FINAL:', {
                      exists: !!elementFinal,
                      children: elementFinal?.children.length,
                      hasXterm: !!elementFinal?.querySelector('.xterm'),
                      focused: document.activeElement === elementFinal || document.activeElement?.closest('.xterm')
                    });

                    // Mark terminal as fully initialized - now safe to show
                    updateTerminal(terminalId, { isInitialized: true });
                  }, 100);
                }, 0);
              }, 0);
            }, 500);
          }, 0);
        }, 1400);
      }

      term.write(data);
    });

    socket.on('disconnect', (reason) => {
      console.warn('🔌 Socket disconnected');
      console.warn('🔌 Reason:', reason);
      updateTerminal(terminalId, {
        isConnected: false,
        isConnecting: false
      });
      if (reason !== 'io client disconnect') {
        // Show disconnect message in terminal
        const instances = terminalInstancesRef.current[terminalId];
        if (instances?.term) {
          instances.term.write('\r\n\x1b[1;31m⚠ Connection lost — reconnecting...\x1b[0m\r\n');
        }
        updateTerminal(terminalId, { error: 'Connection lost' });
        // Auto-reconnect after 3 seconds
        const reconnectId = setTimeout(() => {
          cleanup(terminalId);
          connectTerminal(terminalId);
        }, 3000);
        timeoutsRef.current.push(reconnectId);
      }
    });

    socket.on('end', () => {
      console.log('🔚 Socket end event');
      cleanup(terminalId);
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected');
      console.log('✅ Socket ID:', socket.id);
    });

    // Socket event logging removed (spam)

    // Update terminal with socket and xterm instances
    updateTerminal(terminalId, {
      socket,
      terminal: term,
      fitAddon,
    });

    // Handle window resize
    const handleResize = () => {
      if (fitAddon && term) {
        fitAddon.fit();
        if (socket?.connected) {
          socket.emit('resize', { cols: term.cols, rows: term.rows });
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Store cleanup function
    updateTerminal(terminalId, {
      cleanup: () => {
        window.removeEventListener('resize', handleResize);
        clearTimeout(copyTimeout);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server, selectedIp, cleanup, updateTerminal]);

  // Create new terminal session
  const createNewTerminal = useCallback(() => {
    if (!server) return;

    // Validate selectedIp is set (FluxOS pattern)
    if (!selectedIp) {
      console.error('❌ No IP selected');
      return;
    }

    const terminalId = ++terminalIdCounter.current;

    // Container name format for v4+ (FluxOS pattern):
    // componentName_appName where appName includes the full instance ID
    const containerName = server.version >= 4
      ? `${selectedComponent}_${server.name}`
      : server.name;

    const cmd = '/bin/bash';
    const label = `${selectedComponent} - bash`;

    const newTerminal = {
      id: terminalId,
      terminal: null,
      socket: null,
      element: null,
      containerName,
      selectedComponent,
      command: cmd,
      user: '',
      env: '',
      label,
      fitAddon: null,
    };

    setTerminals(prev => [...prev, newTerminal]);
    setActiveTerminalId(terminalId);

    // Set UI state separately to avoid re-rendering terminal divs
    setTerminalUI(prev => ({
      ...prev,
      [terminalId]: {
        isConnecting: true,
        isConnected: false,
        error: null,
      },
    }));

    // Wait for DOM to render
    setTimeout(() => {
      connectTerminal(terminalId, newTerminal);
    }, 100);
  }, [server, selectedIp, selectedComponent, connectTerminal]);

  // Close terminal
  const closeTerminal = (terminalId) => {
    // If closing active terminal, switch to another BEFORE cleanup
    if (activeTerminalId === terminalId && terminals.length > 1) {
      // Find the index of the terminal being closed
      const currentIndex = terminals.findIndex(t => t.id === terminalId);
      const remaining = terminals.filter(t => t.id !== terminalId);

      if (remaining.length > 0) {
        // Switch to the next terminal in line, or previous if it's the last one
        const nextIndex = currentIndex < remaining.length ? currentIndex : currentIndex - 1;
        setActiveTerminalId(remaining[Math.max(0, nextIndex)].id);
      }
    }
    // Now cleanup
    cleanup(terminalId);
  };

  // Auto-connect when tab is visited for the first time
  useEffect(() => {
    // Only auto-create terminal if:
    // 1. Tab is visible
    // 2. Server is loaded
    // 3. No terminals exist yet
    // 4. IP is selected (from DNS resolution)
    // 5. Component is selected
    if (isVisible && server && terminals.length === 0 && selectedIp && selectedComponent) {
      console.log('🔌 Auto-connecting terminal on tab visit');
      // Small delay to ensure all initialization is complete
      const timer = setTimeout(() => {
        createNewTerminal();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible, server, terminals.length, selectedIp, selectedComponent, createNewTerminal]);

  // Combine terminal data with UI state
  const activeTerminal = activeTerminalId
    ? {
        ...terminals.find(t => t.id === activeTerminalId),
        ...terminalUI[activeTerminalId],
      }
    : null;

  const isVerticalSplit = splitView && (isMobile || splitDirection === 'vertical');
  const isHorizontalSplit = splitView && !isMobile && splitDirection === 'horizontal';

  return (
    <div className="server-terminal flex flex-col h-full bg-gray-900 rounded-lg border border-gray-700">
      {/* Custom scrollbar styles for xterm - scoped to .server-terminal */}
      <style>{`
        /* Scoped scrollbar styles - only inside terminal component */
        .server-terminal ::-webkit-scrollbar {
          width: 6px !important;
          height: 6px !important;
        }

        .server-terminal ::-webkit-scrollbar-track {
          background: transparent !important;
        }

        .server-terminal ::-webkit-scrollbar-thumb {
          background: #4a5568 !important;
          border-radius: 10px !important;
        }

        .server-terminal ::-webkit-scrollbar-thumb:hover {
          background: #718096 !important;
        }

        /* Firefox - scoped */
        .server-terminal,
        .server-terminal * {
          scrollbar-width: thin !important;
          scrollbar-color: #4a5568 transparent !important;
        }

        /* xterm custom scrollbar elements - proper selectors */
        .xterm .xterm-scrollable-element > .scrollbar {
          width: 4px !important;
          background: transparent !important;
          position: absolute !important;
          top: 1px !important;
          bottom: 1px !important;
        }

        .xterm .xterm-scrollable-element > .scrollbar.vertical {
          opacity: 1 !important;
          width: 4px !important;
          right: 0px !important;
          position: absolute !important;
          z-index: 10 !important;
          pointer-events: auto !important;
        }

        /* Make terminal content use full width - scrollbar overlays */
        .xterm .xterm-viewport {
          overflow-y: scroll !important;
          width: 100% !important;
          right: 0 !important;
        }

        /* Hide native scrollbar, use custom one */
        .xterm .xterm-viewport::-webkit-scrollbar {
          display: none !important;
        }

        .xterm {
          padding-right: 0 !important;
          width: 100% !important;
          position: relative !important;
        }

        .xterm-screen {
          padding-right: 0 !important;
          width: 100% !important;
        }

        /* Force terminal rows to extend full width */
        .xterm .xterm-rows {
          width: 100% !important;
          padding-right: 0 !important;
        }

        /* Force helper elements to not reserve space */
        .xterm .xterm-helpers {
          width: 100% !important;
        }

        /* Make scrollable element not reserve space */
        .xterm .xterm-scrollable-element {
          position: relative !important;
          width: 100% !important;
        }

        .xterm .xterm-scrollable-element > .scrollbar.vertical.invisible {
          display: none !important;
        }

        .xterm .xterm-scrollable-element > .scrollbar.vertical:hover {
          opacity: 1 !important;
        }

        .xterm .xterm-scrollable-element > .scrollbar > .slider {
          background: #10b981 !important;
          border-radius: 10px !important;
          width: 4px !important;
        }

        .xterm .xterm-scrollable-element > .scrollbar > .slider:hover {
          background: #059669 !important;
        }

        .xterm .xterm-scrollable-element > .scrollbar > .slider.active {
          background: #059669 !important;
        }

        /* Split view layout */
        .server-terminal .console-area {
          display: flex;
          flex-direction: row;
          position: relative;
          min-height: 0;
          overflow: hidden;
        }
        .server-terminal .console-area .terminal-pane {
          flex: 1;
          min-width: 0;
          min-height: 0;
        }
        .server-terminal .console-area.split .terminal-pane {
          flex: 0 0 50%;
          width: 50%;
        }
        .server-terminal .console-area.split .logs-pane {
          flex: 0 0 50%;
          width: 50%;
          border-left: 1px solid #374151;
        }
        @media (max-width: 767px) {
          .server-terminal .console-area.split {
            flex-direction: column;
          }
          .server-terminal .console-area.split .terminal-pane {
            flex: 0 0 50%;
            width: 100%;
            height: 50%;
          }
          .server-terminal .console-area.split .logs-pane {
            flex: 0 0 50%;
            width: 100%;
            height: 50%;
            border-left: none;
            border-top: 1px solid #374151;
          }
        }
      `}</style>

      {/* Header */}
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 rounded-t-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/20 rounded-lg flex-shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-white">Console</h3>
            <p className="text-xs text-gray-400 truncate">{server?.name}</p>
          </div>

          {/* Split View Toggle */}
          <button
            onClick={() => setSplitView(p => { const next = !p; try { localStorage.setItem('terminal_splitView', next); } catch { /* ignore */ } return next; })}
            className={`relative group ml-auto px-2.5 py-1 rounded-lg font-medium transition-colors text-xs sm:text-sm flex items-center justify-center gap-1.5 whitespace-nowrap border ${
              splitView
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 hover:bg-blue-600/30'
                : 'bg-gray-700/50 border-gray-600/30 text-gray-400 hover:text-gray-300'
            }`}
          >
            <svg className="w-4.5 h-4.5" style={{ width: '1.125rem', height: '1.125rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">Logs</span>
            <span className="hidden sm:block absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-gray-900 border border-gray-700 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 before:content-[''] before:absolute before:bottom-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-700">{splitView ? 'Hide logs' : 'Show logs'}</span>
          </button>

          {/* New Console Button */}
          <button
            onClick={createNewTerminal}
            className="relative group px-2.5 sm:px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap border border-blue-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">New Console</span>
            <span className="hidden sm:block absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-gray-900 border border-gray-700 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 before:content-[''] before:absolute before:bottom-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-700">New Console</span>
          </button>
        </div>

        {/* Connection Controls */}
        {isMultiComponent && (
          <div className="flex items-center gap-2 mb-3">
            {/* Component Selection - Only show if multiple components */}
            <CustomSelect
              id="component-selection"
              value={selectedComponent}
              onChange={(e) => setSelectedComponent(e.target.value)}
              options={availableComponents.map(comp => ({ value: comp, label: comp }))}
              className="w-[200px] [&_button]:pr-2"
            />
          </div>
        )}

        {/* IP Selection Dropdown (FluxOS pattern) - Hidden but functional */}
        <div style={{ display: 'none' }}>
          <CustomSelect
            id="ip-selection"
            value={selectedIp}
            onChange={(e) => setSelectedIp(e.target.value)}
            options={selectedIp ? server.locations?.map(loc => {
              const isMaster = masterLocation && loc.ip === masterLocation.ip;
              return {
                value: loc.ip,
                label: loc.ip,
                isMaster: isMaster
              };
            }) || [] : []}
            placeholder="Resolving DNS..."
            disabled={!selectedIp}
            className="w-[260px] [&_button]:pr-2"
          />
        </div>
      </div>

      {/* Console Tabs */}
      {terminals.length > 0 && (
        <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2 overflow-x-auto">
            {terminals.map(term => (
              <div
                key={term.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  activeTerminalId === term.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <button
                  onClick={() => setActiveTerminalId(term.id)}
                  className="flex items-center gap-2 flex-1"
                >
                  <span>{term.label}</span>
                  {terminalUI[term.id]?.isConnecting && (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminal(term.id);
                  }}
                  className="hover:text-red-400 transition-colors ml-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Console Area */}
      <div
        style={{
          flex: '1 1 0%',
          minHeight: 0,
          display: 'flex',
          flexDirection: isVerticalSplit ? 'column' : 'row',
          overflow: 'hidden',
          background: '#000',
          position: 'relative',
        }}
      >
        {/* Terminal pane */}
        <div
          style={{
            flex: splitView ? '0 0 50%' : '1 1 0%',
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            ...(isVerticalSplit ? { width: '100%', height: '50%' } : {}),
            ...(isHorizontalSplit ? { width: '50%', height: '100%' } : {}),
          }}
        >
          {terminals.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-10">
              <div className="w-16 h-16 mb-4 bg-gray-800 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-400 mb-2">No active consoles</p>
              <p className="text-gray-500 text-sm">Click "New Console" to start a session</p>
            </div>
          )}

          {/* Terminal divs - React renders these, xterm attaches to them */}
          <div className="flex-1 pl-4 pt-1.5 pb-1.5 pr-px relative" style={{ minHeight: 0 }}>
            <div className="h-full w-full relative">
              {terminals.map(term => {
                const isActive = activeTerminalId === term.id;
                const isInitialized = terminalUI[term.id]?.isInitialized;
                const isConnecting = terminalUI[term.id]?.isConnecting;
                const shouldShow = isActive && (isInitialized === true || (isInitialized === undefined && !isConnecting));

                return (
                  <div
                    key={term.id}
                    ref={setTerminalRef}
                    id={`terminal-${term.id}`}
                    className={`h-full w-full ${shouldShow ? 'block' : 'hidden'}`}
                    data-terminal-id={term.id}
                  />
                );
              })}
            </div>
          </div>

          {/* Loading/Error Overlays */}
          {activeTerminal?.isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Connecting to console...</p>
              </div>
            </div>
          )}

          {activeTerminal?.error && !activeTerminal.isConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mb-4 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-red-400 font-medium mb-2">Connection Failed</p>
                <p className="text-gray-400 text-sm mb-4">{activeTerminal.error}</p>
                <button
                  onClick={() => closeTerminal(activeTerminal.id)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Close Console
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Logs pane — always mounted to preserve logs, hidden via CSS when not visible */}
        <div
          style={{
            flex: '0 0 50%',
            minWidth: 0,
            minHeight: 0,
            display: splitView ? 'flex' : 'none',
            flexDirection: 'column',
            overflow: 'hidden',
            borderLeft: isHorizontalSplit ? '1px solid #374151' : 'none',
            borderTop: isVerticalSplit ? '1px solid #374151' : 'none',
            ...(isVerticalSplit ? { width: '100%', height: '50%' } : {}),
            ...(isHorizontalSplit ? { width: '50%', height: '100%' } : {}),
          }}
        >
          <ServerLogsPanel
            server={server}
            masterLocation={masterLocation}
            selectedComponent={selectedComponent}
            splitDirection={splitDirection}
            onToggleDirection={() => setSplitDirection(d => { const next = d === 'horizontal' ? 'vertical' : 'horizontal'; try { localStorage.setItem('terminal_splitDirection', next); } catch { /* ignore */ } return next; })}
            isMobile={isMobile}
            commandTrigger={commandTrigger}
            isVisible={isVisible && splitView && !isPaused}
          />
        </div>
      </div>
    </div>
  );
};

export default ServerTerminal;
