import { useEffect } from 'react';
 
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';

/**
 * Accessible Modal Component
 * Follows WAI-ARIA best practices
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  showCloseButton = true,
  headerContent,
  noMinHeight = false,
}) => {
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Focus trap - keep focus within modal
  useEffect(() => {
    if (!isOpen) return;

    const modalElement = document.getElementById('modal-container');
    if (!modalElement) return;

    const focusableElements = modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);
    firstElement?.focus();

    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-full',
    fullscreen: 'w-screen h-screen max-w-none',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={`fixed z-50 flex items-center justify-center ${size === 'fullscreen' ? 'inset-0' : 'top-0 left-0 sm:p-4'}`}
          style={size === 'fullscreen' ? undefined : { width: '100dvw', height: '100dvh' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Backdrop with enhanced blur */}
          <motion.div
            className="fixed inset-0 bg-gradient-to-br from-black/90 via-black/85 to-black/90"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOnOverlayClick ? onClose : undefined}
            aria-hidden="true"
          />

          {/* Modal Content - optimized for performance */}
          <motion.div
            id="modal-container"
            className={`relative bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 border border-gray-700/50 ${size === 'fullscreen' ? 'rounded-none' : 'rounded-2xl sm:rounded-3xl'} shadow-2xl ${sizes[size]} w-[calc(100dvw-16px)] sm:w-full ${size === 'fullscreen' ? 'max-h-[100dvh]' : 'max-h-[90vh]'} overflow-hidden flex flex-col`}
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset'
            }}
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {/* Gradient glow effect - optimized */}
            <div className={`absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-yellow-500/10 ${size === 'fullscreen' ? 'rounded-none' : 'rounded-3xl'} opacity-50 pointer-events-none`} />

            {/* Header with gradient border - Compact */}
            <div className="relative px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-700/50 flex items-center justify-between bg-gradient-to-r from-gray-900/50 to-transparent">
              <h2 id="modal-title" className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent flex-1 min-w-0">
                {title}
              </h2>

              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/50 transition-colors duration-150 focus:outline-none"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            {/* Optional non-scrollable header content */}
            {headerContent && (
              <div className="relative px-0 py-0 border-b border-gray-700/50">
                {headerContent}
              </div>
            )}

            {/* Body with custom scrollbar - Compact */}
            <div className={`relative px-3 sm:px-6 py-4 sm:py-5 overflow-y-auto flex-1 ${size === 'fullscreen' ? '' : 'max-h-[calc(90vh-12rem)]'} modal-scroll-body ${!noMinHeight && size !== 'fullscreen' ? 'min-h-[500px]' : ''}`}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', 'full', 'fullscreen']),
  closeOnOverlayClick: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  headerContent: PropTypes.node,
  noMinHeight: PropTypes.bool,
};

export default Modal;
