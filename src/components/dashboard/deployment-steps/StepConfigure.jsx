import { memo, useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MdSpeed } from 'react-icons/md';

const stepVariants = {
  enter: (d) => ({ opacity: 0, x: d > 0 ? 20 : -20 }),
  center: { opacity: 1, x: 0 },
  exit: (d) => ({ opacity: 0, x: d > 0 ? -20 : 20 }),
};

// Memoized spec icons
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

// Constants moved outside component to prevent recreation on every render
const labels = {
  players: 'Players',
  ram: 'RAM',
  storage: 'Storage',
  cpu: 'CPU',
  bandwidth: 'Bandwidth',
};

const SUBSCRIPTION_OPTIONS = [
  { months: 1, label: '1 Month', discount: 0 },
  { months: 3, label: '3 Months (3% off)', discount: 3 },
  { months: 6, label: '6 Months (6% off)', discount: 6 },
  { months: 12, label: '12 Months (12% off)', discount: 12 },
];

const StepConfigure = memo(({
  direction = 1,
  selectedPlan,
  serverConfig,
  onServerConfigChange,
  subscriptionMonths,
  onSubscriptionChange,
  loadingPricing,
  totalCost,
  currentDiscount,
  onBack,
  onContinue,
  isFreeFirstMonth,
}) => {
  const [_showError, setShowError] = useState(false);
  const serverNameRef = useRef(null);

  // Generate server name and appName using plan name + timestamp
  useEffect(() => {
    if (selectedPlan && !serverConfig.name && !serverConfig.appName) {
      const name = `palworld${Date.now()}`;
      onServerConfigChange({ ...serverConfig, name: name, appName: name });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowError(false);
    onContinue(e);
  };

  return (
    <motion.div
      key="step2"
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <h3 className="text-sm sm:text-base font-semibold text-white mb-3">Configure Your Server</h3>
      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <div>
          <label htmlFor="serverName" className="block text-sm font-medium text-text mb-2">
            Server Name
          </label>
          <input
            ref={serverNameRef}
            type="text"
            id="serverName"
            value={serverConfig.name}
            readOnly
            disabled
            className="input opacity-50 cursor-not-allowed"
          />
          <p className="text-xs mt-2 ml-2 text-gray-400 flex items-center gap-1">
            <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Auto-generated - unique identifier for your deployment</span>
          </p>
        </div>

        <div className="hidden">
          <label htmlFor="instances" className="block text-sm font-medium text-text mb-2">
            Number of Instances
          </label>
          <input
            type="number"
            id="instances"
            value={serverConfig.instances || 3}
            readOnly
            disabled
            className="input opacity-50 cursor-not-allowed"
          />
          <p className="text-xs text-text-muted mt-1">
            Minimum 3 instances for redundancy. More instances = higher availability.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Subscription Duration
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SUBSCRIPTION_OPTIONS.map((option) => (
              <button
                key={option.months}
                type="button"
                onClick={() => onSubscriptionChange(option.months)}
                className={`
                  relative px-3 py-2 rounded-lg font-medium text-xs transition-[background-color,color,box-shadow,border-color] duration-150
                  ${subscriptionMonths === option.months
                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700/50'
                  }
                `}
              >
                {option.label.split(' (')[0]}
                {option.discount > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 text-xs font-semibold rounded-full border ${
                    subscriptionMonths === option.months
                      ? 'bg-yellow-500/30 text-yellow-300 border-yellow-500/40'
                      : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                  }`}>
                    -{option.discount}% OFF
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 border-2 border-gray-700/50 rounded-2xl p-3 sm:p-4 shadow-lg shadow-black/20">
          <h4 className="font-bold text-white mb-3 text-sm sm:text-base">Selected Plan</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-700/30">
              <span className="font-semibold text-white">{selectedPlan?.name}</span>
              {loadingPricing && totalCost === 0 && (
                <div className="text-xs text-gray-400">Calculating...</div>
              )}
            </div>

            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-300">
                  {subscriptionMonths} Month{subscriptionMonths > 1 ? 's' : ''}
                </span>
                {currentDiscount > 0 && (
                  <span className="text-sm px-2.5 py-0.5 bg-blue-500/20 text-blue-400 font-semibold rounded-full border border-blue-500/40">
                    {currentDiscount}% savings
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">Total Cost</span>
                <div className="text-right">
                  {isFreeFirstMonth ? (
                    <>
                      <span className="text-sm text-gray-500 line-through mr-1">${totalCost.toFixed(2)}</span>
                      <span className="text-lg font-bold text-blue-400">$0.00</span>
                      <span className="ml-1.5 px-1.5 py-0.5 bg-blue-500/15 border border-blue-500/25 rounded text-[10px] font-bold text-blue-300">FREE</span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg font-bold text-primary">${totalCost.toFixed(2)}</span>
                      <span className="text-xs text-gray-400 ml-1">+ VAT</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {selectedPlan?.specs && (
              <div className="space-y-2">
                {Object.entries(selectedPlan.specs).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-3 text-xs bg-gray-900/40 rounded-lg px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 flex-shrink-0">
                        <SpecIcon type={key} />
                      </span>
                      <span className="text-gray-400 font-medium">{labels[key] || key}</span>
                    </div>
                    <span className="text-white font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4 relative z-0">
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary flex-1"
          >
            Back
          </button>
          <button type="submit" className="btn-primary flex-1">
            Continue
          </button>
        </div>
      </form>
    </motion.div>
  );
});

StepConfigure.displayName = 'StepConfigure';

export default StepConfigure;
