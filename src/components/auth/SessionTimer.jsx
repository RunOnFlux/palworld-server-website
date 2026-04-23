import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, LogOut } from 'lucide-react';

/**
 * Session Timer UI Component
 * Shows countdown until auto-logout (90 minutes / 1.5 hours from login)
 * Warning modal at 2 minutes before expiry
 */
const SessionTimer = ({ lastActivity, onLogout }) => {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showWarning, setShowWarning] = useState(false);
  const [showTimer, setShowTimer] = useState(false);

  const AUTO_LOGOUT_TIME = 90 * 60 * 1000; // 90 minutes
  const WARNING_TIME = 2 * 60 * 1000; // 2 minutes warning

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivity;
      const remaining = AUTO_LOGOUT_TIME - elapsed;

      setTimeRemaining(remaining);

      // Show warning modal when 2 minutes left
      if (remaining <= WARNING_TIME && remaining > 0 && !showWarning) {
        setShowWarning(true);
      }

      // Show timer indicator when 5 minutes left
      if (remaining <= 5 * 60 * 1000 && remaining > 0) {
        setShowTimer(true);
      } else {
        setShowTimer(false);
      }

      // Auto-logout when time expires
      if (remaining <= 0) {
        onLogout();
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastActivity, onLogout]);

  const formatTime = (ms) => {
    if (ms <= 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Timer Indicator (bottom-right corner) */}
      {showTimer && timeRemaining > 0 && (
        <div className="fixed bottom-4 right-4 z-[9999] animate-fade-in">
          <div className="relative">
            <img
              src="/games/palworld/timer.webp"
              alt="Timer"
              className="w-48 h-auto"
            />
            <div className="absolute top-[52%] left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div
                className="text-lg font-bold"
                style={{
                  fontFamily: "'Share Tech Mono', 'Courier New', monospace",
                  color: '#00ff41',
                  textShadow: `
                    0 0 10px #00ff41,
                    0 0 20px #00ff41,
                    0 0 30px #00ff41,
                    0 0 40px #00ff41,
                    2px 2px 2px rgba(0, 0, 0, 0.8)
                  `,
                  letterSpacing: '0.2em',
                  fontWeight: '700',
                  WebkitFontSmoothing: 'antialiased',
                  filter: 'contrast(1.2)'
                }}
              >
                {formatTime(timeRemaining)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-800 border border-yellow-500/50 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl animate-scale-in">
            {/* Warning Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center animate-pulse">
                <AlertTriangle className="w-8 h-8 text-orange-400" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-white text-center mb-2">
              Session Expiring Soon
            </h2>

            {/* Countdown */}
            <div className="text-center mb-6">
              <div className="text-5xl font-bold text-orange-400 font-mono mb-2">
                {formatTime(timeRemaining)}
              </div>
              <p className="text-gray-400">
                Your session will expire automatically
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-700 rounded-full h-2 mb-6 overflow-hidden">
              <div
                className="bg-gradient-to-r from-orange-400 to-red-500 h-full transition-all duration-1000"
                style={{
                  width: `${(timeRemaining / WARNING_TIME) * 100}%`,
                }}
              />
            </div>

            {/* Actions */}
            <button
              onClick={onLogout}
              className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 rounded-lg font-medium text-white transition-colors shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout Now
            </button>

            {/* Info */}
            <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-400 text-center">
                ℹ️ Your authentication expires after 90 minutes for security reasons.
                Please log in again to continue.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

SessionTimer.propTypes = {
  lastActivity: PropTypes.number.isRequired,
  onLogout: PropTypes.func.isRequired,
};

export default SessionTimer;
