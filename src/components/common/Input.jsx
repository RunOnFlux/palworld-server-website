import PropTypes from 'prop-types';
import { forwardRef, useEffect, useRef } from 'react';

/**
 * Reusable Input Component
 * Supports text, email, password, number types
 * Handles autofill styling issues with JavaScript detection
 */
const Input = forwardRef(({
  type = 'text',
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  fullWidth = true,
  className = '',
  ...props
}, ref) => {
  const internalRef = useRef(null);
  const inputRef = ref || internalRef;

  const baseStyles = 'bg-background-alt border border-border rounded-lg px-4 py-2.5 text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all';

  const errorStyles = error ? 'border-red-500 focus:ring-red-500' : '';

  const widthClass = fullWidth ? 'w-full' : '';

  const inputClasses = `${baseStyles} ${errorStyles} ${widthClass} ${className}`;

  // Force styles on autofill using JavaScript
  useEffect(() => {
    const inputElement = inputRef?.current;
    if (!inputElement) return;

    const forceStyles = () => {
      // Force our styles to override autofill
      inputElement.style.setProperty('background-color', '#1a1a1a', 'important');
      inputElement.style.setProperty('color', '#ffffff', 'important');
      inputElement.style.setProperty('border-color', error ? '#ef4444' : '#2a2a0a', 'important');
      inputElement.style.setProperty('font-family', "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif", 'important');
      inputElement.style.setProperty('font-size', '0.875rem', 'important');
      inputElement.style.setProperty('font-weight', '400', 'important');
      inputElement.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
      inputElement.style.setProperty('-webkit-box-shadow', '0 0 0 1000px #1a1a1a inset', 'important');
      inputElement.style.setProperty('box-shadow', '0 0 0 1000px #1a1a1a inset', 'important');
    };

    // Detect autofill using multiple methods
    const checkAutofill = () => {
      if (inputElement.matches(':-webkit-autofill')) {
        forceStyles();
      }
    };

    // Check immediately and on animation events
    checkAutofill();

    // Listen for animation events (Chrome fires animationstart on autofill)
    const handleAnimationStart = (e) => {
      if (e.animationName === 'onAutoFillStart') {
        forceStyles();
      }
    };
    inputElement.addEventListener('animationstart', handleAnimationStart);

    // Also check periodically for the first second
    const intervals = [10, 50, 100, 200, 500, 1000].map(delay =>
      setTimeout(checkAutofill, delay)
    );

    // Listen for input events
    inputElement.addEventListener('input', checkAutofill);
    inputElement.addEventListener('change', checkAutofill);

    return () => {
      inputElement.removeEventListener('animationstart', handleAnimationStart);
      inputElement.removeEventListener('input', checkAutofill);
      inputElement.removeEventListener('change', checkAutofill);
      intervals.forEach(clearTimeout);
    };
  }, [inputRef, error]);

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-2">
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
            {leftIcon}
          </div>
        )}

        <input
          ref={inputRef}
          type={type}
          className={`${inputClasses} ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''}`}
          autoComplete={type === 'password' ? 'current-password' : props.autoComplete || 'on'}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-muted">
            {rightIcon}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}

      {helperText && !error && (
        <p className="mt-1 text-sm text-text-muted">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

Input.propTypes = {
  type: PropTypes.oneOf(['text', 'email', 'password', 'number', 'tel', 'url']),
  label: PropTypes.string,
  error: PropTypes.string,
  helperText: PropTypes.string,
  leftIcon: PropTypes.node,
  rightIcon: PropTypes.node,
  fullWidth: PropTypes.bool,
  className: PropTypes.string,
};

export default Input;
