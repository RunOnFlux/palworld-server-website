import { useState, useEffect, useRef, useMemo } from 'react';
import { MdMemory, MdSpeed, MdStorage } from 'react-icons/md';
import { BarChart3 } from 'lucide-react';
import secureStorage from '../../utils/secureStorage';

/**
 * Real memory a container is using, the way `docker stats` reports it.
 *
 * FluxOS hands back Docker's raw `memory_stats`, whose `usage` counts the container's
 * file page cache on top of the process's own memory. A container that has merely READ
 * a few GB of files reports those GB as "used", and the figure only drops when the
 * container is restarted - which reads to a customer as a memory leak. The kernel
 * reclaims that cache the moment anything needs it, so subtract it like `docker stats`
 * does: cgroup v2 exposes it as `inactive_file`, cgroup v1 as `cache`.
 */
const containerMemoryUsage = (memStats) => {
  const cache = memStats?.stats?.inactive_file ?? memStats?.stats?.cache ?? 0;
  return Math.max(0, (memStats?.usage || 0) - cache);
};

/**
 * Beautiful segmented usage bars for server stats
 * Shows CPU, RAM, and Disk usage with gradient colors
 */
const ServerStats = ({ server, masterLocation, containerName, refreshKey }) => {
  const [stats, setStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(null);
  const [animatedStats, setAnimatedStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [segmentCount, setSegmentCount] = useState(150);
  const [segmentsReady, setSegmentsReady] = useState(false); // Track if segments are calculated
  const pollingInterval = useRef(null);
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastWidthRef = useRef(0); // Track last calculated width to avoid unnecessary updates

  // Fetch stats from FluxOS API
  const fetchStats = async () => {
    if (!containerName || !server?.locations || server.locations.length === 0) {
      setLoading(false);
      return;
    }

    try {
      // Get zelidauth from storage
      const zelidauth = await secureStorage.getItem('zelidauth');
      console.log('🔑 [Stats] zelidauth:', zelidauth ? { zelid: zelidauth.zelid, hasSignature: !!zelidauth.signature, hasLoginPhrase: !!zelidauth.loginPhrase, loginPhraseLen: zelidauth.loginPhrase?.length } : 'NULL');

      if (!masterLocation) {
        console.warn('⚠️ No master location available');
        return;
      }

      const [host, port = 16127] = masterLocation.ip.split(':');
      const apiUrl = `https://${host.replace(/\./g, '-')}-${port}.node.api.runonflux.io/apps/appstats/${containerName}`;
      console.log('🔗 Stats API [MASTER]:', { host, port, containerName, apiUrl, serverVersion: server?.version, serverName: server?.name });

      const headerValue = JSON.stringify(zelidauth);
      const browserNow = Date.now();
      const phraseTime = Number(zelidauth.loginPhrase?.substring(0, 13));
      console.log('⏰ [Clock] browserNow:', browserNow, 'phraseTime:', phraseTime, 'age:', Math.round((browserNow - phraseTime) / 1000) + 's', 'phraseInFuture:', phraseTime > browserNow);
      console.log('📤 [Stats] zelidauth header length:', headerValue?.length, 'first 80 chars:', headerValue?.substring(0, 80));

      // Make request with zelidauth
      const response = await fetch(apiUrl, {
          headers: {
            zelidauth: headerValue,
            'x-apicache-bypass': true,
          },
        });

        // Get node time from HTTP Date header
        const serverDateHeader = response.headers.get('Date');
        const serverTime = serverDateHeader ? new Date(serverDateHeader).getTime() : null;
        const browserNowResp = Date.now();
        console.log('📥 [Stats] HTTP status:', response.status, response.statusText);
        console.log('⏰ [Clock Skew] serverDate:', serverDateHeader, 'serverTime:', serverTime, 'browserNow:', browserNowResp, 'skew:', serverTime ? Math.round((browserNowResp - serverTime) / 1000) + 's' : 'N/A');

        if (!response.ok) {
          throw new Error(`Failed to fetch stats: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📦 API Response:', data);

        if (data.status === 'error') {
          console.error('❌ [Stats] API error for', containerName, ':', data.data?.message || data.message, '| Full response:', JSON.stringify(data));
          throw new Error(data.data?.message || 'Container not found');
        }

        if (data.status === 'success' && data.data) {
        console.log('📊 Raw stats data:', data.data);

        // Parse CPU usage - only use what API provides
        const cpuStats = data.data.cpu_stats || {};
        const preCpuStats = data.data.precpu_stats || {};

        const cpuUsage = (cpuStats.cpu_usage?.total_usage || 0) - (preCpuStats.cpu_usage?.total_usage || 0);
        const systemCpuUsage = (cpuStats.system_cpu_usage || 0) - (preCpuStats.system_cpu_usage || 0);
        const onlineCpus = cpuStats.online_cpus || 1;
        const nanoCpus = data.data.nanoCpus || 1e9;

        let cpuPercent = '0';
        if (systemCpuUsage > 0 && cpuUsage > 0) {
          const rawCpu = (cpuUsage / systemCpuUsage) * onlineCpus;
          cpuPercent = Math.min(100, (rawCpu / (nanoCpus / 1e9)) * 100).toFixed(1);
        }

        console.log('💻 CPU:', { cpuUsage, systemCpuUsage, onlineCpus, nanoCpus, cpuPercent });

        // Parse memory usage - no fallbacks, only use what API provides
        const memStats = data.data.memory_stats || {};
        const hasMemoryData = Object.keys(memStats).length > 0;

        const memoryUsed = hasMemoryData ? containerMemoryUsage(memStats) : 0;
        const memoryLimit = hasMemoryData ? (memStats.limit || 0) : 0;

        const memoryPercent = (memoryLimit > 0 && memoryUsed > 0)
          ? ((memoryUsed / memoryLimit) * 100).toFixed(1)
          : '0';
        const memoryUsedMB = (memoryUsed / 1024 / 1024).toFixed(0);
        const memoryLimitMB = (memoryLimit / 1024 / 1024).toFixed(0);

        console.log('🧠 Memory:', { hasMemoryData, memoryUsed, memoryLimit, memoryPercent, memoryUsedMB, memoryLimitMB });

        // Parse disk stats - use ONLY used field from stats API
        const diskStats = data.data.disk_stats || {};
        const diskUsed = diskStats.used || 0;
        // Get total from server specs (in GB, convert to bytes)
        const diskSize = (server.hdd || 0) * 1024 * 1024 * 1024;

        const diskPercent = (diskSize > 0 && diskUsed > 0)
          ? ((diskUsed / diskSize) * 100).toFixed(1)
          : '0';
        const diskUsedGB = (diskUsed / 1024 / 1024 / 1024).toFixed(1);
        const diskSizeGB = (server.hdd || 0).toFixed(0);

        console.log('💾 Disk:', { diskUsed, diskSize, diskPercent, diskUsedGB, diskSizeGB });

        setStats({
          cpu: {
            percent: parseFloat(cpuPercent),
            label: `${cpuPercent}%`,
          },
          memory: {
            percent: parseFloat(memoryPercent),
            used: memoryUsedMB,
            total: memoryLimitMB,
            label: `${memoryUsedMB}MB / ${memoryLimitMB}MB`,
          },
          disk: {
            percent: parseFloat(diskPercent),
            used: diskUsedGB,
            total: diskSizeGB,
            label: `${diskUsedGB}GB / ${diskSizeGB}GB`,
          },
        });
        setLastUpdated(Date.now());
        setError(null);
        console.log('✅ Successfully fetched stats from master');
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('❌ Stats fetch error:', err);
      if (!stats) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate optimal segment count based on container width
  useEffect(() => {
    let callCount = 0;
    const calculateSegments = (source = 'unknown') => {
      callCount++;
      const timestamp = performance.now().toFixed(2);

      console.log(`📊 [${timestamp}ms] calculateSegments #${callCount} from ${source}`);

      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const currentCount = segmentCount;

        console.log(`   Current state:`, {
          width,
          lastWidth: lastWidthRef.current,
          diff: Math.abs(width - lastWidthRef.current),
          currentSegmentCount: currentCount,
          segmentsReady
        });

        // Ignore width of 0 (happens when tab is hidden)
        if (width === 0) {
          console.log(`   ⏭️ SKIP: width is 0 (tab hidden)`);
          return;
        }

        // Only update if width changed significantly (more than 10px difference)
        // This prevents unnecessary recalculation when tab visibility changes
        if (Math.abs(width - lastWidthRef.current) < 10 && lastWidthRef.current > 0) {
          console.log(`   ⏭️ SKIP: width change < 10px (${Math.abs(width - lastWidthRef.current)}px)`);
          setSegmentsReady(true); // Mark as ready even if skipped
          return;
        }

        lastWidthRef.current = width;
        const targetSegmentWidth = 5; // Target width per segment in pixels
        const gapWidth = 2; // Gap between segments
        const totalSegments = Math.floor(width / (targetSegmentWidth + gapWidth));
        const newCount = Math.max(50, Math.min(totalSegments, 200));
        console.log(`   ✅ UPDATE: Setting count from ${currentCount} → ${newCount}`, {
          width,
          totalSegments,
          clamped: newCount
        });
        setSegmentCount(newCount);
        setSegmentsReady(true);
      } else {
        console.log(`   ❌ containerRef.current is null`);
      }
    };

    // Initial calculation - immediate, no delay
    console.log('🎬 ServerStats useEffect mounting');
    calculateSegments('initial');

    // Listen to window resize
    const handleResize = () => calculateSegments('window-resize');
    window.addEventListener('resize', handleResize);

    // Use ResizeObserver to detect when container becomes visible (display: none -> block)
    let resizeObserver;
    if (containerRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        console.log('👀 ResizeObserver fired:', entries[0]?.contentRect);
        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => calculateSegments('ResizeObserver'));
      });
      resizeObserver.observe(containerRef.current);
      console.log('👁️ ResizeObserver attached');
    }

    return () => {
      console.log('🧹 ServerStats useEffect cleanup');
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
        console.log('👁️ ResizeObserver disconnected');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start polling stats
  useEffect(() => {
    fetchStats();

    // Poll every 30 seconds
    pollingInterval.current = setInterval(fetchStats, 30000);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server, containerName, refreshKey]);

  // Animate stats progressively when they change (smoother with steps)
  useEffect(() => {
    if (!stats) {
      setAnimatedStats(null);
      return;
    }

    const steps = 60; // Number of animation steps for smooth filling
    const stepDuration = 15; // ms per step (900ms total)
    const startValues = animatedStats || {
      cpu: { percent: 0, label: '0%' },
      memory: { percent: 0, used: 0, total: 0, label: '0MB / 0MB' },
      disk: { percent: 0, used: 0, total: 0, label: '0GB / 0GB' }
    };

    let currentStep = 0;

    const animate = () => {
      currentStep++;
      const progress = Math.min(currentStep / steps, 1);

      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 2);

      setAnimatedStats({
        cpu: {
          percent: startValues.cpu.percent + (stats.cpu.percent - startValues.cpu.percent) * eased,
          label: stats.cpu.label
        },
        memory: {
          percent: startValues.memory.percent + (stats.memory.percent - startValues.memory.percent) * eased,
          used: stats.memory.used,
          total: stats.memory.total,
          label: stats.memory.label
        },
        disk: {
          percent: startValues.disk.percent + (stats.disk.percent - startValues.disk.percent) * eased,
          used: stats.disk.used,
          total: stats.disk.total,
          label: stats.disk.label
        }
      });

      if (progress < 1) {
        animationFrameRef.current = setTimeout(animate, stepDuration);
      }
    };

    animationFrameRef.current = setTimeout(animate, stepDuration);

    return () => {
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  // Get color based on usage percentage (with glow)
  const getColorClass = (percent) => {
    if (percent < 60) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
    if (percent < 80) return 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]';
    return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
  };

  // Get chip styles based on usage
  const getChipStyles = (percent) => {
    if (percent < 60) return 'bg-emerald-500/10 text-emerald-400';
    if (percent < 80) return 'bg-yellow-500/10 text-orange-400';
    return 'bg-red-500/10 text-red-400';
  };

  // Use animated stats or default to zero values while loading
  const displayStats = animatedStats || {
    cpu: { percent: 0, label: loading ? '' : '0%' },
    memory: { percent: 0, used: 0, total: 0, label: loading ? '' : '0MB / 0MB' },
    disk: { percent: 0, used: 0, total: 0, label: loading ? '' : '0GB / 0GB' }
  };

  // Generate segments based on percentage (Uptime Kuma style)
  const generateSegments = (percent) => {
    let filledSegments = Math.round((percent / 100) * segmentCount);

    // Show at least 1 segment for any non-zero usage (minimum visibility)
    if (percent > 0 && filledSegments < 1) {
      filledSegments = 1;
    }

    return Array.from({ length: segmentCount }, (_, i) => ({
      filled: i < filledSegments,
      percent: percent
    }));
  };

  // Memoize segments to avoid recreating 27,000 objects during animation
  const cpuSegments = useMemo(
    () => generateSegments(displayStats.cpu.percent),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayStats.cpu.percent, segmentCount]
  );

  const memorySegments = useMemo(
    () => generateSegments(displayStats.memory.percent),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayStats.memory.percent, segmentCount]
  );

  const diskSegments = useMemo(
    () => generateSegments(displayStats.disk.percent),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayStats.disk.percent, segmentCount]
  );

  // Update "seconds ago" counter
  useEffect(() => {
    if (!lastUpdated) return;
    const tick = () => setSecondsAgo(Math.round((Date.now() - lastUpdated) / 1000));
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  // Only hide on error (auth failures, etc) - must be after all hooks
  if (error) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9))', border: '1px solid rgba(51,65,85,0.5)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(51,65,85,0.3)' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.15)' }}>
            <BarChart3 className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Hardware Usage</h3>
        </div>
        {secondsAgo !== null && (
          <span className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(15,23,42,0.5)', color: '#94a3b8' }}>
            Live
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {secondsAgo < 5 ? 'now' : `${secondsAgo}s ago`}
          </span>
        )}
      </div>
      <div className="p-4">
        <div ref={containerRef} className="space-y-2 transition-opacity duration-150">
        {/* CPU Usage */}
        <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 flex items-center justify-center rounded-md" style={{ background: 'rgba(59,130,246,0.1)' }}>
                    <MdSpeed className="w-4 h-4 text-blue-400" />
                  </span>
                  <span className="text-xs font-medium text-slate-300">CPU</span>
                </div>
                {displayStats.cpu.label && (
                  <div className={`flex items-center px-2 py-0.5 rounded-full ${getChipStyles(displayStats.cpu.percent)}`}>
                    <span className="text-xs font-medium leading-none">{displayStats.cpu.label}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-[2px]">
                {cpuSegments.map((segment, i) => (
                  <div
                    key={i}
                    className={`h-4 flex-1 rounded-sm transition-all duration-300 ${
                      segment.filled
                        ? getColorClass(segment.percent)
                        : ''
                    }`}
                    style={!segment.filled ? { background: 'rgba(30,41,59,0.5)' } : undefined}
                  />
                ))}
              </div>
            </div>

            {/* Memory Usage */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 flex items-center justify-center rounded-md" style={{ background: 'rgba(139,92,246,0.1)' }}>
                    <MdMemory className="w-4 h-4 text-purple-400" />
                  </span>
                  <span className="text-xs font-medium text-slate-300">RAM</span>
                </div>
                {displayStats.memory.label && (
                  <div className={`flex items-center px-2 py-0.5 rounded-full ${getChipStyles(displayStats.memory.percent)}`}>
                    <span className="text-xs font-medium leading-none">{displayStats.memory.label}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-[2px]">
                {memorySegments.map((segment, i) => (
                  <div
                    key={i}
                    className={`h-4 flex-1 rounded-sm transition-all duration-300 ${
                      segment.filled
                        ? getColorClass(segment.percent)
                        : ''
                    }`}
                    style={!segment.filled ? { background: 'rgba(30,41,59,0.5)' } : undefined}
                  />
                ))}
              </div>
            </div>

            {/* Disk Usage */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 flex items-center justify-center rounded-md" style={{ background: 'rgba(6,182,212,0.1)' }}>
                    <MdStorage className="w-4 h-4 text-cyan-400" />
                  </span>
                  <span className="text-xs font-medium text-slate-300">Disk</span>
                </div>
                {displayStats.disk.label && (
                  <div className={`flex items-center px-2 py-0.5 rounded-full ${getChipStyles(displayStats.disk.percent)}`}>
                    <span className="text-xs font-medium leading-none">{displayStats.disk.label}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-[2px]">
                {diskSegments.map((segment, i) => (
                  <div
                    key={i}
                    className={`h-4 flex-1 rounded-sm transition-all duration-300 ${
                      segment.filled
                        ? getColorClass(segment.percent)
                        : ''
                    }`}
                    style={!segment.filled ? { background: 'rgba(30,41,59,0.5)' } : undefined}
                  />
                ))}
              </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ServerStats;
