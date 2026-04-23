 
import { motion } from 'framer-motion';
import PropTypes from 'prop-types';

/**
 * Loading Spinner Component
 * Accessible with ARIA attributes
 */
const LoadingSpinner = ({ size = 'md', text, className = '' }) => {
  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={text || 'Loading'}
    >
      <motion.div
        className={`${sizes[size]} border-4 border-primary/20 border-t-primary rounded-full`}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {text && (
        <p className="text-text-secondary text-sm font-medium">{text}</p>
      )}

      <span className="sr-only">{text || 'Loading, please wait...'}</span>
    </div>
  );
};

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  text: PropTypes.string,
  className: PropTypes.string,
};

/**
 * Full Page Loading Overlay
 */
export const LoadingOverlay = ({ text }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
    <LoadingSpinner size="xl" text={text} />
  </div>
);

LoadingOverlay.propTypes = {
  text: PropTypes.string,
};

export default LoadingSpinner;
