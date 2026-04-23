import { memo } from 'react';
import { motion } from 'framer-motion';
import { MdSpeed } from 'react-icons/md';

// Memoized spec icons to avoid recreating SVGs
const SpecIcon = memo(({ type }) => {
  const icons = {
    players: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    ram: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    ),
    storage: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    cpu: (
      <MdSpeed className="w-4 h-4" />
    ),
    bandwidth: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  };
  return icons[type] || icons.cpu;
});
SpecIcon.displayName = 'SpecIcon';

const stepVariants = {
  enter: (d) => ({ opacity: 0, x: d > 0 ? 20 : -20 }),
  center: { opacity: 1, x: 0 },
  exit: (d) => ({ opacity: 0, x: d > 0 ? -20 : 20 }),
};

const labels = {
  players: 'Players',
  ram: 'RAM',
  storage: 'Storage',
  cpu: 'CPU',
  bandwidth: 'Bandwidth',
};

const StepPlanSelection = memo(({ direction = 1, availablePlans, selectedPlan, onPlanSelect, loading }) => {
  return (
    <motion.div
      key="step1"
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={loading ? "" : "space-y-4"}
    >
      <div className={`text-center ${loading ? '' : 'pb-2'}`}>
        <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent mb-2">
          Select a Server Plan
        </h3>
        <p className="text-xs sm:text-sm text-gray-400">Choose the perfect plan for your gaming server</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center -mt-8">
          <img
            src="/games/palworld/planLoader.webp"
            alt="Loading plans..."
            className="w-72 h-72 object-contain animate-pulse"
          />
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {availablePlans.map((plan) => (
          <div
            key={plan.id}
            onClick={() => onPlanSelect(plan)}
            className={`p-4 rounded-xl border-2 cursor-pointer transform-gpu transition-[transform,box-shadow,border-color,background-color] duration-150 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] ${
              selectedPlan?.id === plan.id
                ? 'border-primary/60 bg-blue-900/20 shadow-lg shadow-primary/30'
                : 'border-gray-700/50 bg-gray-800/80 shadow-lg hover:border-primary/40 hover:shadow-xl hover:shadow-primary/20'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-text text-lg">{plan.name}</h4>
              {plan.popular && (
                <span className="px-2.5 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold rounded-lg shadow-md shadow-yellow-500/30">
                  ⭐ Popular
                </span>
              )}
            </div>
            <p className="text-text-muted text-sm mb-3">{plan.description}</p>
            <div className="mb-3">
              {plan.price?.monthly > 0 ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-bold text-blue-400">
                      {plan.price.displayPrice}
                    </span>
                    <span className="text-sm text-text-muted font-medium">/month</span>
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-primary/15 border border-primary/25 rounded-full text-xs font-semibold text-blue-300 relative overflow-hidden"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/20 to-transparent animate-[shimmer_2s_infinite]" />
                    <span className="relative">🎁 First month free for new users</span>
                  </span>
                </>
              ) : (
                <span className="text-xl sm:text-2xl font-bold text-success">Free</span>
              )}
            </div>
            {plan.specs && (
              <div className="space-y-2 pt-2 border-t border-gray-700/30">
                {Object.entries(plan.specs).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-2 text-xs bg-gray-900/40 rounded-lg px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-primary flex-shrink-0">
                        <SpecIcon type={key} />
                      </span>
                      <span className="text-gray-400 font-medium">{labels[key] || key}</span>
                    </div>
                    <span className="text-white font-semibold text-right">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </motion.div>
  );
});

StepPlanSelection.displayName = 'StepPlanSelection';

export default StepPlanSelection;
