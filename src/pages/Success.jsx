import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { SEO } from '../components/common';
import Button from '../components/common/Button';

const Success = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRenewal = searchParams.get('renewal') === 'true';
  const isDeployment = searchParams.get('deployment') === 'true';
  const paymentHash = searchParams.get('hash');
  const stripeSessionId = searchParams.get('session_id'); // Stripe adds this automatically
  const [countdown, setCountdown] = useState(4);
  const [canClose, setCanClose] = useState(true);

  useEffect(() => {
    // Check if opened from another window (popup mode)
    if (window.opener && !window.opener.closed) {
      try {
        // Validate opener is same origin for security
        if (window.opener.location.origin === window.location.origin) {
          // Send message to parent immediately
          const serverName = searchParams.get('server');
          window.opener.postMessage({
            type: 'PAYMENT_SUCCESS',
            renewal: isRenewal,
            deployment: isDeployment,
            paymentHash: paymentHash,
            serverName: serverName, // Server/app name for creating pendingRenewal
            stripeSessionId: stripeSessionId, // Stripe transaction ID
            timestamp: Date.now()
          }, window.location.origin);

          // Try to close immediately
          window.close();

          // If still open after 100ms, show countdown (tab can't be closed)
          setTimeout(() => {
            if (!window.closed) {
              setCanClose(false);
            }
          }, 100);
        } else {
          console.warn('Payment success: Opener origin mismatch, blocking postMessage');
        }
      } catch (e) {
        console.error('Payment success: Cannot access opener origin (cross-origin blocked)', e);
      }
    } else if (isRenewal && paymentHash) {
      // Not popup mode - Add to pendingRenewals array AFTER payment (1 step)
      const serverName = searchParams.get('server');
      if (serverName) {
        const newRenewal = {
          appName: serverName,
          paymentHash: paymentHash,
          paymentConfirmed: true,
          type: 'renewal',
          pendingTimestamp: Date.now()
        };

        // Add to array (not replace)
        const existingRenewals = JSON.parse(localStorage.getItem('pendingRenewals') || '[]');
        existingRenewals.push(newRenewal);
        localStorage.setItem('pendingRenewals', JSON.stringify(existingRenewals));
        console.log('💾 Added pendingRenewal after payment:', paymentHash);
      }
    } else if (isDeployment && paymentHash) {
      // Not popup mode - Add to deployedServers array AFTER payment (tab mode)
      const serverName = searchParams.get('server');
      if (serverName) {
        const deploymentEntry = {
          name: serverName,
          paymentHash: paymentHash,
          stripeSessionId: stripeSessionId,
          status: 'payment_pending',
          pendingTimestamp: Date.now()
        };

        // Add to deployedServers array (not replace)
        const existingServers = JSON.parse(localStorage.getItem('deployedServers') || '[]');
        // Check if not already added (avoid duplicates)
        const exists = existingServers.some(s => s.name === serverName && s.paymentHash === paymentHash);
        if (!exists) {
          existingServers.push(deploymentEntry);
          localStorage.setItem('deployedServers', JSON.stringify(existingServers));
          console.log('💾 Added deployment to deployedServers after payment:', paymentHash);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRenewal, isDeployment, paymentHash, stripeSessionId]);

  // Countdown timer for tabs that can't close
  useEffect(() => {
    if (!canClose && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (!canClose && countdown === 0) {
      // Navigate to dashboard after countdown with refresh flag
      navigate('/dashboard?refresh=true');
    }
  }, [countdown, canClose, navigate]);

  // If opened in popup (will close) or tab (show countdown)
  if (window.opener && !window.opener.closed) {
    // If can close (popup), show minimal spinner
    if (canClose) {
      return (
        <>
          <SEO title="Payment Success" noIndex={true} />
          <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-400 mt-4 text-sm">Processing...</p>
            </div>
          </div>
        </>
      );
    }

    // Can't close (tab), show full page with countdown
    return (
      <>
        <SEO title="Payment Success" noIndex={true} />
        <div className="min-h-screen flex items-center justify-center px-4 bg-gray-900">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-8 max-w-sm w-full border border-gray-700">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold mb-3 text-white">Payment Successful!</h1>
            <p className="text-gray-400 text-sm mb-6">
              {isRenewal ? 'Your subscription has been renewed successfully.' : 'Your server is being deployed on the Flux network.'}
            </p>
            {paymentHash && (
              <div className="bg-gray-900/50 rounded-lg p-3 mb-4 border border-gray-700">
                <p className="text-xs text-gray-500 mb-1">Flux Hash</p>
                <p className="text-xs text-blue-400 font-mono break-all">{paymentHash}</p>
              </div>
            )}
            {stripeSessionId && (
              <div className="bg-gray-900/50 rounded-lg p-3 mb-4 border border-gray-700">
                <p className="text-xs text-gray-500 mb-1">Stripe Transaction ID</p>
                <p className="text-xs text-blue-400 font-mono break-all">{stripeSessionId}</p>
              </div>
            )}
            <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-sm mb-2">Redirecting in</p>
              <div className="text-5xl font-bold text-blue-400">{countdown}</div>
            </div>
            <button
              onClick={() => setCountdown(0)}
              className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Continue Now
            </button>
          </div>
        </div>
      </div>
      </>
    );
  }

  // Regular success page (when not opened from popup)
  return (
    <>
      <SEO title="Payment Success" noIndex={true} />
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
        <CheckCircle className="w-20 h-20 text-blue-500 mx-auto mb-6" />
        <h1 className="text-4xl font-bold mb-4">Payment Successful!</h1>
        <p className="text-text-secondary mb-8">
          Your server is being deployed. Check your dashboard for details.
        </p>
        <Button
          variant="primary"
          size="lg"
          onClick={() => navigate('/dashboard?refresh=true')}
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
    </>
  );
};

export default Success;
