import { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import locationsSnapshot from '../../config/snapshots/locations.json';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from 'react-simple-maps';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Inject marquee keyframes once
if (typeof document !== 'undefined' && !document.getElementById('marquee-keyframes')) {
  const style = document.createElement('style');
  style.id = 'marquee-keyframes';
  style.textContent = `@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`;
  document.head.appendChild(style);
}


// Cache key and TTL
const CACHE_KEY = 'flux_server_locations_v2';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function processNodeData(data) {
  const countries = {};
  const cities = {};
  let total = 0;
  for (const node of data) {
    const lat = parseFloat(node.geolocation?.lat);
    const lon = parseFloat(node.geolocation?.lon);
    if (isNaN(lat) || isNaN(lon)) continue;

    const country = node.geolocation?.country || 'Unknown';
    const region = node.geolocation?.regionName || '';

    // Country-level clusters
    if (!countries[country]) {
      countries[country] = { lat, lon, count: 0, country };
    }
    countries[country].count++;

    // City/region-level clusters (round to ~10km grid for grouping)
    const cityKey = `${country}_${Math.round(lat * 10) / 10}_${Math.round(lon * 10) / 10}`;
    if (!cities[cityKey]) {
      cities[cityKey] = { lat, lon, count: 0, country, region };
    }
    cities[cityKey].count++;

    total++;
  }

  return {
    clusters: Object.values(countries).filter(c => c.count >= 3),
    cityClusters: Object.values(cities).filter(c => c.count >= 1),
    total,
    countryCount: Object.keys(countries).length,
  };
}

// Fetch Flux node locations with localStorage cache
async function fetchNodeLocations() {
  // Check cache first
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL && data?.cityClusters) {
        return data;
      }
    }
  } catch { /* ignore cache errors */ }

  // Fetch fresh
  try {
    const res = await fetch('https://stats.runonflux.io/fluxinfo?projection=geolocation,tier');
    const json = await res.json();
    if (json.status !== 'success' || !Array.isArray(json.data)) {
      // Return stale cache if available
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) return JSON.parse(cached).data;
      } catch { /* ignore */ }
      return { clusters: [], total: 0, countryCount: 0 };
    }

    const result = processNodeData(json.data);

    // Only cache if we got real data
    if (result.total > 0 && result.clusters.length > 0) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result, timestamp: Date.now() }));
      } catch { /* storage full, ignore */ }
    }

    return result;
  } catch {
    // Return stale cache on network error
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached).data;
    } catch { /* ignore */ }
    return { clusters: [], total: 0, countryCount: 0 };
  }
}

function markerSize(count) {
  if (count >= 500) return 7;
  if (count >= 100) return 5;
  if (count >= 30) return 3.5;
  return 2;
}

// Stat counter with animated number
const AnimatedNumber = ({ value }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!value) return;
    const duration = 1200;
    const start = performance.now();
    let animId;

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) {
        animId = requestAnimationFrame(tick);
      }
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [value]);

  return <>{display.toLocaleString()}</>;
};


// Country name → ISO 3166-1 alpha-2 (lowercase) for flagcdn.com
const COUNTRY_FLAGS = {
  'United States': 'us', 'Canada': 'ca', 'Germany': 'de', 'France': 'fr', 'Finland': 'fi',
  'Netherlands': 'nl', 'United Kingdom': 'gb', 'Poland': 'pl', 'Romania': 'ro', 'Japan': 'jp',
  'Singapore': 'sg', 'Australia': 'au', 'Brazil': 'br', 'South Korea': 'kr', 'India': 'in',
  'Sweden': 'se', 'Norway': 'no', 'Spain': 'es', 'Italy': 'it', 'Switzerland': 'ch',
  'Austria': 'at', 'Ireland': 'ie', 'Czech Republic': 'cz', 'Lithuania': 'lt', 'Latvia': 'lv',
  'Estonia': 'ee', 'Bulgaria': 'bg', 'Hungary': 'hu', 'Belgium': 'be', 'Denmark': 'dk',
  'Portugal': 'pt', 'South Africa': 'za', 'Mexico': 'mx', 'Argentina': 'ar', 'Chile': 'cl',
  'Colombia': 'co', 'Turkey': 'tr', 'Thailand': 'th', 'Vietnam': 'vn', 'Indonesia': 'id',
  'Malaysia': 'my', 'Philippines': 'ph', 'Taiwan': 'tw', 'Hong Kong': 'hk', 'New Zealand': 'nz',
  'Croatia': 'hr', 'Slovakia': 'sk', 'Slovenia': 'si', 'Luxembourg': 'lu', 'Ukraine': 'ua',
  'Russia': 'ru', 'China': 'cn', 'Israel': 'il', 'United Arab Emirates': 'ae', 'Kenya': 'ke',
  'Nigeria': 'ng', 'Egypt': 'eg', 'Peru': 'pe', 'Greece': 'gr', 'Serbia': 'rs',
  'Moldova': 'md', 'Georgia': 'ge', 'Iceland': 'is', 'Cyprus': 'cy', 'Malta': 'mt',
};

const InfraCarousel = ({ data, onHoverCountry }) => {
  const [isPaused, setIsPaused] = useState(false);
  const sortedClusters = useMemo(() =>
    (data?.clusters || [])
      .filter(c => c.country !== 'Unknown' && COUNTRY_FLAGS[c.country])
      .sort((a, b) => b.count - a.count),
    [data],
  );

  return (
    <div className="relative overflow-hidden">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-8 z-[5] pointer-events-none" style={{ background: 'linear-gradient(to right, rgba(10,10,10,0.15), transparent)' }} />
      <div className="absolute right-0 top-0 bottom-0 w-8 z-[5] pointer-events-none" style={{ background: 'linear-gradient(to left, rgba(10,10,10,0.15), transparent)' }} />

      <div
        className="flex gap-2.5 w-max"
        style={{
          animation: `marquee ${Math.max(sortedClusters.length * 2, 30)}s linear infinite`,
          animationPlayState: isPaused ? 'paused' : 'running',
        }}
      >
        {/* Country chips — duplicated for seamless infinite scroll */}
        {[...sortedClusters, ...sortedClusters].map((cluster, idx) => {
            const code = COUNTRY_FLAGS[cluster.country];
            return (
              <div
                key={`${cluster.country}-${idx}`}
                className="flex-shrink-0 inline-flex items-center gap-1.5 sm:gap-2.5 rounded-full pl-1.5 sm:pl-2 pr-3 sm:pr-4 py-1 sm:py-2 bg-surface/70 border border-border/20 hover:border-primary/25 transition-colors leading-none cursor-pointer"
                onMouseEnter={() => { onHoverCountry(cluster.country); setIsPaused(true); }}
                onMouseLeave={() => { onHoverCountry(null); setIsPaused(false); }}
              >
                <img
                  src={`https://flagcdn.com/w40/${code}.png`}
                  alt={cluster.country}
                  // Intrinsic size of the w40 asset. CSS still decides the rendered size;
                  // these let the browser reserve the box before the image arrives.
                  width={40}
                  height={30}
                  className="w-4 h-3 sm:w-5 sm:h-3.5 rounded-[2px] object-cover"
                  loading="lazy"
                />
                <span className="text-[10px] sm:text-xs font-medium text-white whitespace-nowrap">{cluster.country}</span>
                <span className="text-[11px] sm:text-sm font-bold text-primary">{cluster.count.toLocaleString()}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
};

const ServerLocations = () => {
  // Seeded from src/config/snapshots/locations.json (refreshed at build time by
  // scripts/sync-snapshots.mjs) rather than from null. fetchNodeLocations() only runs in an
  // effect, which never fires during renderToString — so with a null start this whole
  // section hit the `!data` guard below and vanished from the prerendered HTML, taking the
  // "N servers across M countries" line, the country list and the <h2> with it. The effect
  // still replaces this with live data on mount; the snapshot is only the first paint, on
  // the server and in the browser alike, which is also what keeps hydration matching.
  const [data, setData] = useState(locationsSnapshot);
  const [hoveredCluster, setHoveredCluster] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [highlightedCountry, setHighlightedCountry] = useState(null);
  const [mapCenter, setMapCenter] = useState([10, 20]);
  const [mapScale, setMapScale] = useState(155);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(null);
  useEffect(() => {
    // Keep the snapshot on screen if the live call comes back empty (API down, or a
    // cached-but-stale payload) — an accurate old count beats no section at all.
    fetchNodeLocations().then((live) => {
      if (live?.total > 0 && live.clusters?.length) setData(live);
    });
  }, []);

  const [zoomedCountry, setZoomedCountry] = useState(null);

  const visibleClusters = useMemo(() => {
    const countryClusters = (data?.clusters || []).filter(c => c.country !== 'Unknown');
    if (!zoomedCountry) return countryClusters;

    // Show city-level dots for zoomed country + other countries as small dots
    const citiesInCountry = (data?.cityClusters || [])
      .filter(c => c.country === zoomedCountry)
      .map(c => ({ ...c, isCity: true }));
    const otherCountries = countryClusters.filter(c => c.country !== zoomedCountry);
    return [...otherCountries, ...citiesInCountry];
  }, [data, zoomedCountry]);

  const handleMouseMove = useCallback((e) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
    if (isDragging && dragStart.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const sensitivity = 0.5 / (mapScale / 155);
      setMapCenter(prev => [
        prev[0] - dx * sensitivity,
        prev[1] + dy * sensitivity,
      ]);
      dragStart.current = { x: e.clientX, y: e.clientY };
    }
  }, [isDragging, mapScale]);

  const handleMouseDown = useCallback((e) => {
    if (e.target.style?.cursor === 'pointer' || e.target.classList?.contains('cursor-pointer')) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  const handleDotClick = useCallback((cluster) => {
    setHoveredCluster(null);
    if (cluster.isCity) {
      // Clicking a city dot — zoom out
      setZoomedCountry(null);
      setMapCenter([10, 20]);
      setMapScale(155);
    } else if (zoomedCountry === cluster.country) {
      // Clicking same country again — zoom out
      setZoomedCountry(null);
      setMapCenter([10, 20]);
      setMapScale(155);
    } else {
      // Clicking country dot — zoom in, show cities
      // Center on the middle of all city clusters in this country
      const cities = (data?.cityClusters || []).filter(c => c.country === cluster.country);
      if (cities.length > 1) {
        const lats = cities.map(c => c.lat);
        const lons = cities.map(c => c.lon);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const centerLat = (minLat + maxLat) / 2;
        const centerLon = (minLon + maxLon) / 2;
        // Scale based on spread — larger countries get less zoom
        const spread = Math.max(maxLat - minLat, maxLon - minLon);
        const autoScale = spread > 20 ? 400 : spread > 10 ? 550 : spread > 5 ? 700 : 900;
        const mobileBoost = window.innerWidth < 768 ? 1.3 : 1;
        setMapCenter([centerLon, centerLat]);
        setMapScale(Math.round(autoScale * mobileBoost));
      } else {
        setMapCenter([cluster.lon, cluster.lat]);
        setMapScale(window.innerWidth < 768 ? 600 : 400);
      }
      setZoomedCountry(cluster.country);
    }
  }, [zoomedCountry, data]);

  if (!data || data.total === 0) return null;

  return (
    <section id="locations" className="relative pt-8 pb-4 bg-background-alt border-t border-border/20 overflow-hidden">
      {/* Decorative background */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 8px,
            rgba(33, 150, 243, 0.1) 8px,
            rgba(33, 150, 243, 0.1) 16px
          ),
          repeating-linear-gradient(
            90deg,
            transparent,
            transparent 8px,
            rgba(33, 150, 243, 0.1) 8px,
            rgba(33, 150, 243, 0.1) 16px
          )`,
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <motion.img
            src="/games/palworld/features/global-network.webp"
            alt="Decentralized Infrastructure"
            className="w-52 h-52 sm:w-64 sm:h-64 mx-auto mb-6"
            initial={{ scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25, type: 'spring', stiffness: 150 }}
            width={512}
            height={512}
            decoding="async"
          />
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 font-heading">
            Global Server Network
          </h2>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg">
            Your server runs on a decentralized network of{' '}
            <span className="text-primary font-semibold">{data.total.toLocaleString()}</span>{' '}
            servers across{' '}
            <span className="text-accent font-semibold">{data.countryCount}</span>{' '}
            countries
          </p>
        </motion.div>

        {/* Stats bar */}
        <motion.div
            className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-10"
            initial={{ y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            {[
              { value: data.total, label: 'Active Servers', color: 'text-primary' },
              { value: data.countryCount, label: 'Countries', color: 'text-accent' },
              { value: 99.9, label: 'Uptime %', color: 'text-blue-400', suffix: '%', raw: true },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className={`text-2xl sm:text-3xl font-bold ${stat.color}`}>
                  {stat.raw ? stat.value + stat.suffix : <AnimatedNumber value={stat.value} />}
                </div>
                <div className="text-[11px] text-text-muted uppercase tracking-widest mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>

      </div>

      {/* Map container — full width */}
      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="relative overflow-hidden rounded-2xl border-2 border-primary/20 bg-transparent"
          initial={{ y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isDragging ? 'grabbing' : undefined }}
        >

          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              scale: mapScale,
              center: mapCenter,
            }}
            style={{ width: '100%', height: 'auto', transition: isDragging ? 'none' : 'all 0.5s ease-in-out' }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                (geographies || []).map(geo => {
                  const geoName = geo.properties.name || '';
                  const isZoomed = zoomedCountry && (
                    geoName === zoomedCountry ||
                    geoName.includes(zoomedCountry) ||
                    zoomedCountry.includes(geoName)
                  );
                  return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={
                      isZoomed
                        ? 'rgba(74, 155, 74, 0.25)'
                        : zoomedCountry
                          ? 'rgba(74, 155, 74, 0.04)'
                          : 'rgba(74, 155, 74, 0.08)'
                    }
                    stroke={
                      isZoomed
                        ? 'rgba(74, 155, 74, 0.5)'
                        : zoomedCountry
                          ? 'rgba(74, 155, 74, 0.06)'
                          : 'rgba(74, 155, 74, 0.12)'
                    }
                    strokeWidth={isZoomed ? 1 : 0.4}
                    style={{
                      default: { outline: 'none', transition: 'fill 0.4s, stroke 0.4s', cursor: 'grab' },
                      hover: { outline: 'none', fill: 'rgba(74, 155, 74, 0.12)' },
                      pressed: { outline: 'none' },
                    }}
                  />
                  );
                })
              }
            </Geographies>

            {/* Node cluster markers */}
            {visibleClusters.map((cluster, i) => {
              const isCity = cluster.isCity;
              const size = isCity ? Math.max(markerSize(cluster.count) * 0.7, 2) : markerSize(cluster.count);
              const isHovered = (hoveredCluster?.lat === cluster.lat && hoveredCluster?.lon === cluster.lon) || (!isCity && highlightedCountry === cluster.country);
              const isDimmed = zoomedCountry && !isCity && cluster.country !== zoomedCountry;
              const baseColor = isCity ? '#00BAD1' : '#4A9B4A';
              const dotColor = isHovered ? '#FFD700' : isDimmed ? '#2a3a2a' : baseColor;

              return (
                <Marker
                  key={`${cluster.country}-${i}`}
                  coordinates={[cluster.lon, cluster.lat]}
                  onMouseEnter={() => setHoveredCluster(cluster)}
                  onMouseLeave={() => setHoveredCluster(null)}
                  onClick={() => handleDotClick(cluster)}
                >
                  {/* Ambient glow */}
                  <circle
                    r={size * 3}
                    fill={dotColor}
                    opacity={isHovered ? 0.25 : 0.08}
                    style={{ transition: 'all 0.3s' }}
                  />
                  {/* Outer ring */}
                  <circle
                    r={isHovered ? size + 4 : size + 2}
                    fill="none"
                    stroke={dotColor}
                    strokeWidth={0.6}
                    opacity={isHovered ? 0.6 : 0.2}
                    style={{ transition: 'all 0.3s' }}
                  />
                  {/* Main dot */}
                  <circle
                    r={isHovered ? size + 1 : size}
                    fill={dotColor}
                    opacity={isDimmed ? 0.3 : isHovered ? 1 : 0.85}
                    className="cursor-pointer"
                    style={{ transition: 'all 0.3s' }}
                  />
                  {/* Center bright spot */}
                  <circle
                    r={Math.max(size * 0.4, 1)}
                    fill={isHovered ? '#FFF8DC' : isCity ? '#80DEEA' : '#8FD88F'}
                    opacity={isHovered ? 0.9 : 0.5}
                    style={{ transition: 'all 0.3s' }}
                  />
                  {/* Pulse for large clusters */}
                  {cluster.count >= 100 && (
                    <circle
                      r={size}
                      fill="none"
                      stroke={dotColor}
                      strokeWidth={0.8}
                    >
                      <animate
                        attributeName="r"
                        from={size}
                        to={size + 10}
                        dur="2.5s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        from="0.4"
                        to="0"
                        dur="2.5s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                </Marker>
              );
            })}
          </ComposableMap>

          {/* Tooltip */}
          <AnimatePresence>
            {hoveredCluster && (
              <motion.div
                className="fixed z-50 pointer-events-none"
                style={{
                  left: tooltipPos.x + 16,
                  top: tooltipPos.y - 16,
                }}
                initial={{ scale: 0.9, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
              >
                <div
                  className="rounded-xl px-4 py-2.5 backdrop-blur-md"
                  style={{
                    background: 'rgba(15, 20, 15, 0.92)',
                    border: '1px solid rgba(74, 155, 74, 0.3)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(74, 155, 74, 0.1)',
                  }}
                >
                  <div className="text-white font-semibold text-sm">
                    {hoveredCluster.region ? `${hoveredCluster.region}, ${hoveredCluster.country}` : hoveredCluster.country}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${hoveredCluster.isCity ? 'bg-cyan-400' : 'bg-primary'}`} />
                    <span className={`text-xs font-medium ${hoveredCluster.isCity ? 'text-cyan-400' : 'text-primary'}`}>
                      {hoveredCluster.count.toLocaleString()} {hoveredCluster.count === 1 ? 'server' : 'servers'}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Carousel overlay at bottom of map */}
          <div className="absolute bottom-0 left-0 right-0 z-20 pb-3">
            <InfraCarousel data={data} onHoverCountry={setHighlightedCountry} />
          </div>

        </motion.div>

      </div>
    </section>
  );
};

export default memo(ServerLocations);
