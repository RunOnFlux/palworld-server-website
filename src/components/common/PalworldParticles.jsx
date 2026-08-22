
import { motion } from 'framer-motion';
import { useMemo } from 'react';

/**
 * Animated Palworld Electric Effect
 * Long blue lightning bolts with branching + screen flashes
 */
const PalworldParticles = () => {

  // Long lightning bolts spanning most of the screen height
  const bolts = useMemo(() => [
    { x: '10%', points: 'M0,0 L15,60 L-10,100 L20,180 L-5,250 L12,340 L-8,400 L10,480', delay: 0 },
    { x: '25%', points: 'M0,0 L-12,70 L8,130 L-15,210 L6,290 L-10,370 L14,440 L-3,520', delay: 3 },
    { x: '40%', points: 'M0,0 L18,55 L-7,120 L13,200 L-12,270 L9,350 L-6,430 L15,500', delay: 6 },
    { x: '55%', points: 'M0,0 L-14,65 L10,140 L-18,220 L8,300 L-11,380 L16,450 L-4,530', delay: 2 },
    { x: '70%', points: 'M0,0 L12,75 L-9,150 L16,230 L-13,310 L7,390 L-10,460 L11,540', delay: 5 },
    { x: '85%', points: 'M0,0 L-16,50 L11,110 L-8,190 L14,260 L-12,340 L9,420 L-5,500', delay: 8 },
    { x: '50%', points: 'M0,0 L20,80 L-14,160 L18,240 L-10,320 L15,400 L-7,480 L12,560', delay: 10 },
    { x: '18%', points: 'M0,0 L-11,70 L14,140 L-16,220 L10,300 L-8,380 L13,460 L-6,530', delay: 7 },
  ], []);

  // Branch lightning (smaller forks off main bolts)
  const branches = useMemo(() => [
    { x: '12%', top: '20%', points: 'M0,0 L25,30 L15,60 L30,80', delay: 0.15 },
    { x: '27%', top: '35%', points: 'M0,0 L-20,25 L-10,55 L-25,75', delay: 3.15 },
    { x: '42%', top: '15%', points: 'M0,0 L22,35 L12,65 L28,90', delay: 6.15 },
    { x: '57%', top: '40%', points: 'M0,0 L-18,30 L-8,60 L-22,85', delay: 2.15 },
    { x: '72%', top: '25%', points: 'M0,0 L20,28 L14,58 L26,82', delay: 5.15 },
    { x: '87%', top: '30%', points: 'M0,0 L-24,32 L-12,62 L-28,88', delay: 8.15 },
    { x: '52%', top: '45%', points: 'M0,0 L22,25 L16,52 L30,78', delay: 10.15 },
    { x: '20%', top: '50%', points: 'M0,0 L-20,28 L-14,56 L-26,80', delay: 7.15 },
  ], []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">

      {/* Main lightning bolts */}
      {bolts.map((bolt, index) => (
        <motion.svg
          key={`bolt-${index}`}
          className="absolute"
          style={{ left: bolt.x, top: '0%' }}
          width="50"
          height="600"
          viewBox="-25 0 50 600"
          fill="none"
        >
          {/* Outer glow */}
          <motion.path
            d={bolt.points}
            stroke="rgba(33,150,243,0.6)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#heavyGlow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: [0, 1, 1, 0],
              opacity: [0, 0.8, 0.6, 0],
            }}
            transition={{
              duration: 0.6,
              delay: bolt.delay,
              repeat: Infinity,
              repeatDelay: 5 + index * 0.8,
              ease: 'easeOut',
            }}
          />
          {/* Core bright line */}
          <motion.path
            d={bolt.points}
            stroke="rgba(255,255,255,0.95)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: [0, 1, 1, 0],
              opacity: [0, 1, 0.9, 0],
            }}
            transition={{
              duration: 0.6,
              delay: bolt.delay,
              repeat: Infinity,
              repeatDelay: 5 + index * 0.8,
              ease: 'easeOut',
            }}
          />
          <defs>
            <filter id="heavyGlow">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </motion.svg>
      ))}

      {/* Branch forks */}
      {branches.map((branch, index) => (
        <motion.svg
          key={`branch-${index}`}
          className="absolute"
          style={{ left: branch.x, top: branch.top }}
          width="70"
          height="100"
          viewBox="-30 0 70 100"
          fill="none"
        >
          <motion.path
            d={branch.points}
            stroke="rgba(100,181,246,0.7)"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: [0, 1, 1, 0],
              opacity: [0, 0.7, 0.5, 0],
            }}
            transition={{
              duration: 0.4,
              delay: branch.delay,
              repeat: Infinity,
              repeatDelay: 5 + index * 0.8,
              ease: 'easeOut',
            }}
          />
        </motion.svg>
      ))}

      {/* Screen flash on each bolt */}
      {bolts.map((bolt, index) => (
        <motion.div
          key={`flash-${index}`}
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at ${bolt.x} 50%, rgba(33,150,243,0.12), transparent 50%)`,
          }}
          initial={false}
          animate={{ opacity: [0, 0.8, 0] }}
          transition={{
            duration: 0.35,
            delay: bolt.delay + 0.05,
            repeat: Infinity,
            repeatDelay: 5 + index * 0.8,
          }}
        />
      ))}
    </div>
  );
};

export default PalworldParticles;
