import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
 
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import PropTypes from 'prop-types';

/**
 * Custom Select Dropdown Component
 * Full control over styling with glassmorphism theme
 */
const CustomSelect = memo(({
  id,
  value,
  onChange,
  options = [],
  placeholder = 'Select option',
  required = false,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState(
    options.find(opt => opt.value === value) || null
  );
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  // Update selected option when value prop changes
  useEffect(() => {
    const option = options.find(opt => opt.value === value);
    setSelectedOption(option || null);
  }, [value, options]);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8, // 8px gap - no scrollY for fixed positioning
        left: rect.left,      // no scrollX for fixed positioning
        width: rect.width,
      });
    }
  }, [isOpen]);

  const handleSelect = (option) => {
    setSelectedOption(option);
    setIsOpen(false);

    // Call onChange with the value
    if (onChange) {
      onChange({ target: { value: option.value, id } });
    }
  };

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const displayText = selectedOption?.label || placeholder;
  const isPlaceholder = !selectedOption;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Select Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleDropdown}
        disabled={disabled}
        className={`input w-full text-left flex items-center justify-between ${
          isOpen ? 'border-blue-500/80 ring-2 ring-blue-500/30' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${
          isPlaceholder ? 'text-gray-400' : 'text-white'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={id}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Master/Standby Icon */}
          {selectedOption?.isMaster !== undefined && (
            selectedOption.isMaster ? (
              <Icon
                icon="mdi:crown"
                className="w-4 h-4 flex-shrink-0 text-blue-400"
              />
            ) : (
              <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
            )
          )}
          <span className="truncate">{displayText}</span>
        </div>

        {/* Arrow Icon */}
        <svg
          className={`w-5 h-5 text-blue-400 transition-transform duration-200 flex-shrink-0 ml-2 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 8l4 4 4-4"
          />
        </svg>
      </button>

      {/* Dropdown Menu - Rendered via Portal */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.1, ease: 'easeOut' }}
              className="fixed z-[9999] bg-gray-900 border-2 border-gray-700/50 rounded-xl shadow-xl overflow-hidden"
              style={{
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                width: `${dropdownPosition.width}px`
              }}
              role="listbox"
            >
              {/* Options List */}
              <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700/50 scrollbar-track-transparent">
                {options.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`w-full text-left px-3 py-0.5 ${
                      selectedOption?.value === option.value
                        ? 'bg-blue-900/30 text-blue-300 font-semibold'
                        : option.disabled
                        ? 'text-gray-600 cursor-not-allowed'
                        : 'text-white hover:bg-gray-800/60'
                    } ${index === options.length - 1 ? 'pb-2' : ''}`}
                    disabled={option.disabled}
                    role="option"
                    aria-selected={selectedOption?.value === option.value}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        {/* Master/Standby Icon */}
                        {option.isMaster !== undefined && (
                          option.isMaster ? (
                            <Icon
                              icon="mdi:crown"
                              className="w-4 h-4 flex-shrink-0 text-blue-400"
                            />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
                          )
                        )}
                        {option.flag && (
                          <Icon icon={option.flag} width="20" height="15" className="rounded-sm flex-shrink-0" />
                        )}
                        <span className="text-sm">{option.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {option.nodeCount !== undefined && option.nodeCount > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300">
                            {option.nodeCount} nodes
                          </span>
                        )}
                        {option.ipCount !== undefined && option.ipCount > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                            {option.ipCount} IPs
                          </span>
                        )}
                        {option.isMaster !== undefined && !option.isMaster && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-300">
                            Stand By
                          </span>
                        )}
                        {selectedOption?.value === option.value && (
                          <svg
                            className="w-4 h-4 text-blue-400 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Hidden input for form submission */}
      {required && (
        <input
          type="hidden"
          id={id}
          name={id}
          value={value || ''}
          required={required}
        />
      )}
    </div>
  );
});

CustomSelect.displayName = 'CustomSelect';

CustomSelect.propTypes = {
  id: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      disabled: PropTypes.bool,
    })
  ).isRequired,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

export default CustomSelect;
