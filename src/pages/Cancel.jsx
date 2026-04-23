import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { XCircle } from 'lucide-react';
import { SEO } from '../components/common';
import Button from '../components/common/Button';

const Cancel = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRenewal = searchParams.get('renewal') === 'true';
  const isDeployment = searchParams.get('deployment') === 'true';
  const [countdown, setCountdown] = useState(4);
  const [canClose, setCanClose] = useState(true);

  useEffect(() => {
    // Check if opened from another window
    if (window.opener && !window.opener.closed) {
      try {
        // Validate opener is same origin for security
        if (window.opener.location.origin === window.location.origin) {
          // Send message to parent immediately
          window.opener.postMessage({
            type: 'PAYMENT_CANCELLED',
            renewal: isRenewal,
            deployment: isDeployment,
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
          console.warn('Payment cancelled: Opener origin mismatch, blocking postMessage');
        }
      } catch (e) {
        console.error('Payment cancelled: Cannot access opener origin (cross-origin blocked)', e);
      }
    }
  }, [isRenewal, isDeployment]);

  // Countdown timer - always runs for tabs/popups opened from parent
  useEffect(() => {
    if (!canClose && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (!canClose && countdown === 0) {
      // After countdown, try to close or navigate
      window.close();
      // If can't close (tab), navigate to dashboard
      setTimeout(() => {
        if (!window.closed) {
          navigate('/dashboard');
        }
      }, 100);
    }
  }, [countdown, canClose, navigate]);

  // If opened in popup (will close) or tab (show countdown)
  if (window.opener && !window.opener.closed) {
    // If can close (popup), show minimal spinner
    if (canClose) {
      return (
        <>
          <SEO title="Payment Cancelled" noIndex={true} />
          <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
              <p className="text-gray-400 mt-4 text-sm">Processing...</p>
            </div>
          </div>
        </>
      );
    }

    // Can't close (tab), show full page with countdown
    return (
      <>
        <SEO title="Payment Cancelled" noIndex={true} />
        <div className="min-h-screen flex items-center justify-center px-4 bg-gray-900">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-8 max-w-sm w-full border border-gray-700">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-yellow-500" />
            </div>
            <h1 className="text-2xl font-bold mb-3 text-white">Payment Cancelled</h1>
            <p className="text-gray-400 text-sm mb-6">
              No charges were made. You can try again whenever you're ready.
            </p>
            <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-sm mb-2">Redirecting in</p>
              <div className="text-5xl font-bold text-orange-400">{countdown}</div>
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

  // Regular cancel page (when not opened from popup)
  return (
    <>
      <SEO title="Payment Cancelled" noIndex={true} />
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
        <XCircle className="w-20 h-20 text-yellow-500 mx-auto mb-6" />
        <h1 className="text-4xl font-bold mb-4">Payment Cancelled</h1>
        <p className="text-text-secondary mb-8">
          No worries! You can try again whenever you're ready.
        </p>
        <div className="flex gap-4 justify-center">
          <Button
            variant="primary"
            onClick={() => navigate('/')}
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
    </>
  );
};

export default Cancel;
