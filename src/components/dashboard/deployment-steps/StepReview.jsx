import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';

const stepVariants = {
  enter: (d) => ({ opacity: 0, x: d > 0 ? 20 : -20 }),
  center: { opacity: 1, x: 0 },
  exit: (d) => ({ opacity: 0, x: d > 0 ? -20 : 20 }),
};
import { MdSpeed } from 'react-icons/md';
import { Server, Package, ChevronDown } from 'lucide-react';
import { formatHour } from '../../../config/serverMaintenance';

// Spec icons
const SpecIcon = ({ type }) => {
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
};

const labels = {
  players: 'Players',
  ram: 'RAM',
  storage: 'Storage',
  cpu: 'CPU',
  bandwidth: 'Bandwidth',
};

const StepReview = memo(({
  direction = 1,
  selectedPlan,
  serverConfig,
  subscriptionMonths,
  monthlyPrice,
  totalCost,
  currentDiscount,
  environmentParams,
  rebootSettings,
  allowedLocations,
  formatLocationLabel,
  getFlagIcon,
  isDeploying,
  autoRenewal,
  onAutoRenewalChange,
  onBack,
  onDeploy,
  fluxPrice,
  fluxDiscount,
  onCryptoPay,
  isFreeFirstMonth,
  checkingEligibility,
  existingCustomer,
  onFreeDeploy,
}) => {
  const [cryptoExpanded, setCryptoExpanded] = useState(false);
  return (
    <motion.div
      key="step5"
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <h3 className="text-sm sm:text-base font-semibold text-white mb-3">Review & Deploy</h3>

      <div className="space-y-4 mb-4">
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 border-2 border-gray-700/50 rounded-2xl p-3 sm:p-4 shadow-lg shadow-black/20">
          <h4 className="font-bold text-white mb-3 text-sm sm:text-base">Server Configuration</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-gray-900/40 rounded-lg px-2.5 py-1.5">
              <span className="text-blue-400 flex-shrink-0">
                <Server className="w-4 h-4" />
              </span>
              <div className="flex items-center justify-between flex-1 gap-2 min-w-0">
                <span className="text-sm text-gray-400 font-medium">Server Name</span>
                <span className="text-sm text-white font-semibold">{serverConfig.name}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-900/40 rounded-lg px-2.5 py-1.5">
              <span className="text-blue-400 flex-shrink-0">
                <Package className="w-4 h-4" />
              </span>
              <div className="flex items-center justify-between flex-1 gap-2 min-w-0">
                <span className="text-sm text-gray-400 font-medium">Plan</span>
                <span className="text-sm text-white font-semibold">{selectedPlan?.name}</span>
              </div>
            </div>
          </div>
        </div>

        {selectedPlan?.specs && (
          <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 border-2 border-gray-700/50 rounded-2xl p-3 sm:p-4 shadow-lg shadow-black/20">
            <h4 className="font-bold text-white mb-3 text-sm sm:text-base">Hardware Specifications</h4>
            <div className="space-y-2">
              {Object.entries(selectedPlan.specs)
                .filter(([key]) => ['ram', 'cpu', 'storage'].includes(key))
                .map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 bg-gray-900/40 rounded-lg px-2.5 py-1.5">
                    <span className="text-blue-400 flex-shrink-0">
                      <SpecIcon type={key} />
                    </span>
                    <div className="flex items-center justify-between flex-1 gap-2 min-w-0">
                      <span className="text-sm text-gray-400 font-medium">{labels[key] || key}</span>
                      <span className="text-sm text-white font-semibold">{value}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {Object.keys(environmentParams).length > 0 && (
          <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 border-2 border-gray-700/50 rounded-2xl p-3 sm:p-4 shadow-lg shadow-black/20">
            <h4 className="font-bold text-white mb-3 text-sm sm:text-base">Environment Parameters</h4>
            <div className="space-y-2">
              {Object.entries(environmentParams).map(([key, value]) => (
                value && (
                  <div key={key} className="flex justify-between items-center gap-2 bg-gray-900/40 rounded-lg px-3 py-2">
                    <span className="text-gray-400 text-xs font-medium">{key}:</span>
                    <span className="text-white text-sm font-semibold">{value}</span>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {rebootSettings && (
          <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 border-2 border-gray-700/50 rounded-2xl p-3 sm:p-4 shadow-lg shadow-black/20">
            <h4 className="font-bold text-white mb-3 text-sm sm:text-base">Automatic Restarts</h4>
            <div className="flex justify-between items-center gap-2 bg-gray-900/40 rounded-lg px-3 py-2">
              <span className="text-gray-400 text-xs font-medium">Schedule:</span>
              <span className="text-white text-sm font-semibold text-right">
                {rebootSettings.enabled
                  ? `Daily at ${formatHour(rebootSettings.hour)} (${rebootSettings.timeZone})`
                  : 'Off'}
              </span>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 border-2 border-gray-700/50 rounded-2xl p-3 sm:p-4 shadow-lg shadow-black/20">
          <h4 className="font-bold text-white mb-3 text-sm sm:text-base">Deployment Locations</h4>
          {allowedLocations.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {allowedLocations.map(geoCode => {
                const stripped = geoCode.replace(/^ac/, '');
                const isCountry = stripped.includes('_');
                const continentGlobeIcons = { EU: 'heroicons:globe-europe-africa', AF: 'heroicons:globe-europe-africa', NA: 'heroicons:globe-americas', SA: 'heroicons:globe-americas', AS: 'heroicons:globe-asia-australia', OC: 'heroicons:globe-asia-australia' };
                return (
                  <span key={geoCode} className="inline-flex items-center gap-1.5 bg-blue-900/30 rounded-full px-3 py-[4.8px] border border-blue-500/30 text-sm leading-5 text-blue-300 font-medium">
                    {isCountry ? (
                      <Icon icon={getFlagIcon(stripped.split('_')[1])} width="18" height="13" className="rounded-sm flex-shrink-0" />
                    ) : (
                      <Icon icon={continentGlobeIcons[stripped] || 'heroicons:globe-americas'} width="18" height="18" className="flex-shrink-0 text-blue-400" />
                    )}
                    {formatLocationLabel(geoCode)}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-text-muted text-sm">Global deployment (any available location)</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 border-2 border-blue-700/50 rounded-2xl p-3 sm:p-4 shadow-lg shadow-blue-500/10">
          <h4 className="font-bold text-white mb-3 text-sm sm:text-base">Price Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">Monthly Price:</span>
              <span className="text-white font-medium">${monthlyPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Duration:</span>
              <span className="text-white font-medium">{subscriptionMonths} {subscriptionMonths === 1 ? 'month' : 'months'}</span>
            </div>
            {currentDiscount > 0 && (
              <div className="flex justify-between text-blue-400">
                <span>Discount ({currentDiscount}%):</span>
                <span className="font-medium">-${(monthlyPrice * subscriptionMonths * currentDiscount / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-blue-700/50 pt-2 mt-2">
              <span className="text-white font-bold text-sm sm:text-base">Total:</span>
              <div className="text-right">
                {isFreeFirstMonth ? (
                  <>
                    <span className="text-gray-500 line-through text-sm mr-2">${totalCost.toFixed(2)}</span>
                    <span className="text-blue-400 font-bold text-lg sm:text-xl">$0.00</span>
                    <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-full">FREE</span>
                  </>
                ) : (
                  <>
                    <span className="text-blue-400 font-bold text-lg sm:text-xl">${totalCost.toFixed(2)}</span>
                    <span className="text-gray-400 font-medium text-xs sm:text-sm ml-2">+ VAT</span>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700/30">
              <p className="text-xs text-gray-400 flex items-start gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>VAT will be calculated at checkout based on your billing address</span>
              </p>
            </div>
          </div>
        </div>
        {/* Crypto Payment Panel - only when auto-renewal is OFF and not free */}
        {!autoRenewal && !isFreeFirstMonth && (
          <div className="border-2 border-orange-700/40 rounded-2xl overflow-hidden shadow-lg shadow-orange-500/5">
            <button
              type="button"
              onClick={() => setCryptoExpanded(!cryptoExpanded)}
              className="w-full flex items-center justify-between p-3 sm:p-4 bg-gradient-to-br from-orange-900/30 to-orange-800/20 hover:from-orange-900/40 hover:to-orange-800/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-sm font-semibold text-white">Pay with Crypto (FLUX)</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${cryptoExpanded ? 'rotate-180' : ''}`} />
            </button>
            {cryptoExpanded && (
              <div className="p-3 sm:p-4 bg-gradient-to-br from-orange-900/10 to-blue-900/10 border-t border-orange-700/30 space-y-3">
                {fluxPrice > 0 && (
                  <div className="text-center space-y-1.5">
                    {/* FLUX price element */}
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
                      {/* Discount badge */}
                      {(currentDiscount > 0 || fluxDiscount > 0) && (
                        <div
                          className="absolute -top-1.5 -right-3 px-2 py-0.5 rounded-full font-bold text-white text-xs"
                          style={{ background: '#D4860B', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
                        >
                          -{currentDiscount > 0 ? currentDiscount : fluxDiscount}%
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onCryptoPay?.('zelcore')}
                    disabled={isDeploying}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 rounded-xl text-sm font-medium text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <img src="/wallets/zelcore.svg" alt="ZelCore" className="w-5 h-5" />
                    ZelCore
                  </button>
                  <button
                    type="button"
                    onClick={() => onCryptoPay?.('ssp')}
                    disabled={isDeploying}
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

        {/* Existing-customer notice — free month not applicable */}
        {existingCustomer && (
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-2xl p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-300">Free first month not applicable</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  The free first month is for customers new to Flux Cloud. Our records show an existing app on your account, so this month is billed at the standard rate — covered by our 30-day money-back guarantee.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Free First Month Banner */}
        {isFreeFirstMonth && (
          <div className="bg-gradient-to-r from-blue-900/30 to-yellow-900/30 border border-blue-500/30 rounded-2xl p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-300">First Month Free!</p>
                <p className="text-xs text-gray-400">
                  {autoRenewal
                    ? 'Enter your card to set up auto-renewal. No charge for the first month.'
                    : 'Your server will be deployed at no cost. No payment required.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Auto-Renewal Toggle - hidden when crypto panel is expanded */}
        {!cryptoExpanded && (
        <div className="bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border-2 border-blue-700/50 rounded-2xl p-3 sm:p-4 shadow-lg shadow-blue-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <div>
                <span className="text-sm font-semibold text-white">Auto-Renewal</span>
                <p className="text-xs text-gray-400 mt-0.5">
                  {autoRenewal
                    ? `Automatically renews every ${subscriptionMonths} ${subscriptionMonths === 1 ? 'month' : 'months'} via Stripe`
                    : 'One-time payment. Manually renew before expiry.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onAutoRenewalChange(!autoRenewal)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
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
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isDeploying}
          className="btn-secondary flex-1"
        >
          Back
        </button>
        <button
          onClick={isFreeFirstMonth ? onFreeDeploy : onDeploy}
          disabled={isDeploying || checkingEligibility}
          className={`flex-1 flex items-center justify-center gap-2 ${isFreeFirstMonth ? 'btn-primary bg-gradient-to-r from-blue-600 to-yellow-600 hover:from-blue-500 hover:to-yellow-500' : 'btn-primary'}`}
        >
          {isDeploying ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Deploying...
            </>
          ) : checkingEligibility ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Checking...
            </>
          ) : isFreeFirstMonth ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
              {autoRenewal ? 'Setup Subscription (1st Month Free)' : 'Deploy Free'}
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {selectedPlan?.contactRequired ? 'Contact Sales' : 'Proceed to Payment'}
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
});

StepReview.displayName = 'StepReview';

export default StepReview;
