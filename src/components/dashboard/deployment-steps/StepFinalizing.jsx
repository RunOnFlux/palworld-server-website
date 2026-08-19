import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Copy, Check } from 'lucide-react';

/**
 * StepFinalizing Component
 * Final step after payment - shows success and deployment info
 */
const StepFinalizing = memo(({
  serverConfig,
  selectedPlan,
  subscriptionMonths,
  autoRenewal,
  paymentHash,
  stripeSessionId,
  cryptoTxid,
  isFreeFirstMonth,
  onSuccess,
  onClose
}) => {
  const navigate = useNavigate();
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedStripe, setCopiedStripe] = useState(false);
  const [copiedTxid, setCopiedTxid] = useState(false);

  const handleCopyHash = () => {
    if (paymentHash) {
      navigator.clipboard.writeText(paymentHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleCopyStripe = () => {
    if (stripeSessionId) {
      navigator.clipboard.writeText(stripeSessionId);
      setCopiedStripe(true);
      setTimeout(() => setCopiedStripe(false), 2000);
    }
  };

  const handleViewDashboard = () => {
    if (onSuccess) {
      onSuccess();
    }
    onClose();
    // Navigate to dashboard if not already there
    if (window.location.pathname !== '/dashboard') {
      navigate('/dashboard');
    }
  };
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-6 max-w-2xl mx-auto"
    >
      {/* Success Icon */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center">
          <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      {/* Success Message */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">
          Deployment Submitted!
        </h2>
        <p className="text-gray-400">
          Your server is being deployed on the Flux network
        </p>
      </div>

      {/* What happens next. The deploy has three phases and the dashboard shows which one a
          server is in; saying so here means the wait reads as progress instead of a spinner
          with no end — in particular the restart in phase 2, which is us finishing the setup
          and not something going wrong. */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5">
        <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">
          What happens next
        </div>
        <ol className="space-y-3">
          {[
            ['Deploying to Flux', 'Your server is placed on nodes in the locations you chose.'],
            ['Configuring your server', 'We set the address players connect to and your admin access. Your server restarts once.'],
            ['Ready to play', 'The address above starts answering, and your server appears in the in-game community list.'],
          ].map(([title, body], index) => (
            <li key={title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 border border-blue-500/40 text-[10px] font-bold text-blue-300">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-white">{title}</span>
                <span className="block text-xs text-gray-400 mt-0.5">{body}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-[11px] text-gray-500 mt-4">
          Your dashboard shows which step your server is on. It usually takes a few minutes.
        </p>
      </div>

      {/* Server Connection Info */}
      <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/10 border-2 border-blue-500/30 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          Server Connection
        </h3>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-gray-400 mb-2">Server Domain</div>
            <div className="flex items-center gap-2 bg-gray-900/50 p-3 rounded-lg border border-blue-500/20">
              <div className="text-sm text-blue-300 font-mono break-all flex-1">
                {serverConfig.appName?.toLowerCase()}.app.runonflux.io
              </div>
              <button
                onClick={() => {
                  const domain = `${serverConfig.appName?.toLowerCase()}.app.runonflux.io`;
                  navigator.clipboard.writeText(domain);
                }}
                className="p-1.5 rounded transition-[background-color,color] duration-150 flex-shrink-0 text-gray-400 hover:text-white hover:bg-gray-700"
                title="Copy domain"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-200">
                <div className="font-semibold mb-1">How to connect:</div>
                <div className="text-blue-300/90">
                  Connect to your Palworld server using the domain shown in your dashboard.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deployment Info */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
        <h3 className="text-lg font-semibold text-white mb-4">Deployment Details</h3>

        <div className="space-y-3">
          <InfoRow label="App Name" value={serverConfig.appName} />
          <InfoRow label="Plan" value={selectedPlan.name} />
          <InfoRow label="Duration" value={`${subscriptionMonths} Month${subscriptionMonths > 1 ? 's' : ''}`} />
          <InfoRow label="Payment Type" value={isFreeFirstMonth ? (autoRenewal ? 'Free First Month (Subscription)' : 'Free First Month') : cryptoTxid ? 'Crypto (FLUX)' : autoRenewal ? 'Subscription (Auto-Renewal)' : 'One-Time Payment'} />
          {paymentHash && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Flux Registration Hash</div>
              <div className="flex items-center gap-2 bg-gray-900 p-2 rounded">
                <div className="text-xs text-blue-400 font-mono break-all flex-1">
                  {paymentHash}
                </div>
                <button
                  onClick={handleCopyHash}
                  className={`p-1.5 rounded transition-[background-color,color] duration-150 flex-shrink-0 ${
                    copiedHash
                      ? 'text-blue-400 bg-blue-400/10'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                  title="Copy hash"
                >
                  {copiedHash ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}
          {stripeSessionId && !cryptoTxid && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Stripe Transaction ID</div>
              <div className="flex items-center gap-2 bg-gray-900 p-2 rounded">
                <div className="text-xs text-blue-400 font-mono break-all flex-1">
                  {stripeSessionId}
                </div>
                <button
                  onClick={handleCopyStripe}
                  className={`p-1.5 rounded transition-[background-color,color] duration-150 flex-shrink-0 ${
                    copiedStripe
                      ? 'text-blue-400 bg-blue-400/10'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                  title="Copy transaction ID"
                >
                  {copiedStripe ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}
          {cryptoTxid && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Crypto Transaction ID</div>
              <div className="flex items-center gap-2 bg-gray-900 p-2 rounded">
                <a
                  href={`https://explorer.runonflux.io/tx/${cryptoTxid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-orange-400 hover:text-orange-300 font-mono break-all flex-1 underline"
                >
                  {cryptoTxid}
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(cryptoTxid);
                    setCopiedTxid(true);
                    setTimeout(() => setCopiedTxid(false), 2000);
                  }}
                  className={`p-1.5 rounded transition-[background-color,color] duration-150 flex-shrink-0 ${
                    copiedTxid
                      ? 'text-blue-400 bg-blue-400/10'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                  title="Copy transaction ID"
                >
                  {copiedTxid ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* What's Next */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-400 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          What happens next?
        </h3>
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Payment received successfully</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Setting up your server</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span>Server will be ready in a few minutes</span>
          </li>
        </ul>
      </div>

      {/* Status Monitoring Info */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <p className="text-sm text-gray-400 text-center">
          You can monitor the deployment status in your dashboard.
          <br />
          The system will automatically check for updates every 30 seconds.
        </p>
      </div>

      {/* Close Button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={handleViewDashboard}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          View in Dashboard
        </button>
      </div>
    </motion.div>
  );
});

StepFinalizing.displayName = 'StepFinalizing';

// Helper component
const InfoRow = ({ label, value }) => (
  <div className="flex justify-between items-center">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-sm text-white font-medium">{value}</span>
  </div>
);

export default StepFinalizing;
