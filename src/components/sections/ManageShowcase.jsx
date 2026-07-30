import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Package, SlidersHorizontal, Settings, Cpu,
  Globe, Terminal, Folder, Database, BarChart3,
} from 'lucide-react';
import Card, { CardBody } from '../common/Card';

/**
 * "Manage Everything From One Dashboard" — screenshot carousel plus a grid of what the
 * management panel actually does.
 *
 * Screenshots live in public/games/palworld/screenshots/ and are optional: a missing file
 * falls back to a placeholder instead of an empty frame, so the section can ship before the
 * captures exist.
 */

const TILES = [
  { Icon: Package, title: 'Mod manager', desc: 'Upload a .pak and switch mods on or off — no config editing, no FTP.' },
  { Icon: Settings, title: 'Server settings', desc: 'Difficulty, rates, PvP and hundreds of other options, edited in the browser.' },
  { Icon: Globe, title: 'Remote control', desc: 'See who is online, kick, ban and broadcast without joining the game.' },
  { Icon: SlidersHorizontal, title: 'Deployment settings', desc: 'Rename the server, set passwords and change how it runs, then redeploy.' },
  { Icon: Cpu, title: 'Scale hardware', desc: 'Add CPU, RAM or storage when your world outgrows the plan.' },
  { Icon: Terminal, title: 'Live console', desc: 'A real terminal into the server: run commands and watch the log as it happens.' },
  { Icon: Folder, title: 'File manager', desc: 'Browse, edit, upload and download server files straight from the browser.' },
  { Icon: Database, title: 'Backups & restore', desc: 'Your own backups plus the restore points Palworld writes every hour — roll the world back to either.' },
];

// One screenshot per management tab. `tab` names the tab so a viewer can find it later;
// `pitch` sells what it does for them, which is what a landing page is for.
const SCREENSHOTS = [
  { src: '/games/palworld/screenshots/manage-1.webp', tab: 'Overview', pitch: 'players, uptime and hardware at a glance' },
  { src: '/games/palworld/screenshots/manage-2.webp', tab: 'Mods', pitch: 'upload a .pak and turn it on with one click' },
  { src: '/games/palworld/screenshots/manage-3.webp', tab: 'Server Settings', pitch: 'tune difficulty, rates and PvP without touching a config file' },
  { src: '/games/palworld/screenshots/manage-4.webp', tab: 'Hardware', pitch: 'scale CPU, RAM & storage on the fly' },
  { src: '/games/palworld/screenshots/manage-5.webp', tab: 'Remote Control', pitch: 'kick, ban and broadcast without joining the game' },
  { src: '/games/palworld/screenshots/manage-6.webp', tab: 'Console', pitch: 'run commands and watch the log live' },
  { src: '/games/palworld/screenshots/manage-7.webp', tab: 'Files', pitch: 'edit any server file straight from the browser' },
  { src: '/games/palworld/screenshots/manage-8.webp', tab: 'Backup', pitch: 'roll back to your own backup or one of the game’s hourly restore points' },
];

// Puzzle transition: the image is split into COLS×ROWS pieces that fly in from scattered
// positions in a random order, assembling the screenshot on every change.
const COLS = 8;
const ROWS = 5;
const TILE_COUNT = COLS * ROWS;

// Deterministic pseudo-random from a seed, so pieces keep their scatter across unrelated
// re-renders instead of reshuffling on every paint.
const rand = (seed) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const PIECES = Array.from({ length: TILE_COUNT }, (_, t) => {
  const r1 = rand(t + 1);
  const r2 = rand(t + 13);
  const r3 = rand(t + 47);
  const r4 = rand(t + 91);
  return {
    tx: `${(r1 - 0.5) * 90}px`,
    ty: `${(r2 - 0.5) * 90}px`,
    tz: `${-120 - r3 * 220}px`,
    rot: `${(r1 - 0.5) * 44}deg`,
    delay: Math.round(r4 * 620),
  };
});

const ManageShowcase = () => {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState({});
  const timer = useRef(null);

  const go = useCallback((d) => {
    setIndex((i) => (i + d + SCREENSHOTS.length) % SCREENSHOTS.length);
  }, []);

  const start = useCallback(() => {
    timer.current = setInterval(() => setIndex((i) => (i + 1) % SCREENSHOTS.length), 3000);
  }, []);
  const stop = useCallback(() => timer.current && clearInterval(timer.current), []);

  useEffect(() => { start(); return stop; }, [start, stop]);

  // A missing screenshot must not render as an empty frame, and preloading is the only way to
  // find out — the puzzle grid paints the image as a CSS background, which fails silently.
  useEffect(() => {
    const shot = SCREENSHOTS[index];
    if (!shot.src || failed[shot.src] !== undefined) return;
    const probe = new Image();
    probe.onload = () => setFailed((f) => ({ ...f, [shot.src]: false }));
    probe.onerror = () => setFailed((f) => ({ ...f, [shot.src]: true }));
    probe.src = shot.src;
  }, [index, failed]);

  const shot = SCREENSHOTS[index];
  const hasImage = shot.src && failed[shot.src] === false;

  return (
    <section id="dashboard" className="relative py-12 bg-background-alt border-t border-border/20">
      {/* Same tiled backdrop as Features / Locations / FAQ */}
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
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Manage Everything From <span className="text-primary">One Dashboard</span>
          </h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Full control of your Palworld server from the browser — mods, settings, files and
            backups. No Linux, no SSH.
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-12" onMouseEnter={stop} onMouseLeave={start}>
          <div className="relative">
            {/* Glow behind the frame, not on it: a blurred copy of the gradient reads as light
                coming off the screenshot instead of a coloured outline around it. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-r from-primary/25 via-primary/10 to-primary/25 blur-2xl"
            />

            {/* Gradient ring — a 2px padded wrapper, which is how you get a gradient border
                that still clips the screenshot to a rounded corner. */}
            <div className="relative rounded-2xl bg-gradient-to-br from-primary/70 via-primary/25 to-primary/70 p-[2px] shadow-xl shadow-primary/20">
              <div
                className="relative w-full rounded-[14px] overflow-hidden border border-black/40 bg-surface"
                style={{ aspectRatio: '1280 / 668' }}
              >
                {hasImage ? (
                  <div key={index} className="absolute inset-0" style={{ perspective: '900px' }}>
                    {PIECES.map((p, t) => {
                      const col = t % COLS;
                      const row = Math.floor(t / COLS);
                      return (
                        <div
                          key={t}
                          className="absolute"
                          style={{
                            left: `${(col / COLS) * 100}%`,
                            top: `${(row / ROWS) * 100}%`,
                            width: `${100 / COLS}%`,
                            height: `${100 / ROWS}%`,
                            backgroundImage: `url(${shot.src})`,
                            backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
                            backgroundPosition: `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`,
                            '--tx': p.tx,
                            '--ty': p.ty,
                            '--tz': p.tz,
                            '--rot': p.rot,
                            animation: 'puzzle-in 0.55s cubic-bezier(0.34, 1.36, 0.5, 1) both',
                            animationDelay: `${p.delay}ms`,
                          }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 text-text-secondary text-sm">
                    <BarChart3 className="w-5 h-5 opacity-60" />
                    Dashboard preview
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/90 via-black/75 to-transparent backdrop-blur-[2px] border-t border-white/10 z-10">
                  <p className="text-base sm:text-lg font-bold text-white leading-tight">
                    {shot.tab}
                  </p>
                  <p className="text-xs sm:text-sm text-white/75 mt-0.5">
                    {shot.pitch}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous screenshot"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-black/60 hover:bg-black/80 text-white border border-white/10 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next screenshot"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-black/60 hover:bg-black/80 text-white border border-white/10 cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex justify-center gap-2 mt-4">
            {SCREENSHOTS.map((s, i) => (
              <button
                key={s.src}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to screenshot ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                className={`h-2 rounded-full transition-all cursor-pointer ${i === index ? 'w-6 bg-primary' : 'w-2 bg-white/30 hover:bg-white/50'}`}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TILES.map((tile) => (
            <Card key={tile.title} hover shadow="md" className="h-full">
              <CardBody className="text-center">
                <div className="flex justify-center mb-3">
                  <span className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 border border-primary/25">
                    {/* Member expression, not a destructured binding: the lint config does not
                        count the latter as "used" when it is only rendered as a JSX tag. */}
                    <tile.Icon className="w-7 h-7 text-primary" />
                  </span>
                </div>
                <h3 className="text-base font-bold mb-1.5 text-text">{tile.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{tile.desc}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ManageShowcase;
