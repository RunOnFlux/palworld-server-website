import { motion } from 'framer-motion';
import PropTypes from 'prop-types';

/**
 * Reusable Card Component
 * Used for pricing plans, features, server cards, etc.
 */
const Card = ({
  children,
  hover = true,
  bordered = true,
  shadow = 'md',
  className = '',
  onClick,
  ...props
}) => {
  const baseStyles = 'bg-surface rounded-xl overflow-hidden transition-all duration-300';

  const borderStyles = bordered ? 'border border-border' : '';

  const shadows = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
  };

  const hoverStyles = hover ? 'hover:shadow-xl hover:border-border-light cursor-pointer' : '';

  const cardClasses = `${baseStyles} ${borderStyles} ${shadows[shadow]} ${hoverStyles} ${className}`;

  const MotionCard = motion.div;

  return (
    <MotionCard
      className={cardClasses}
      onClick={onClick}
      whileHover={hover ? { y: -4 } : {}}
      transition={{ duration: 0.2 }}
      {...props}
    >
      {children}
    </MotionCard>
  );
};

Card.propTypes = {
  children: PropTypes.node.isRequired,
  hover: PropTypes.bool,
  bordered: PropTypes.bool,
  shadow: PropTypes.oneOf(['none', 'sm', 'md', 'lg', 'xl']),
  className: PropTypes.string,
  onClick: PropTypes.func,
};

/**
 * Card Header
 */
export const CardHeader = ({ children, className = '' }) => (
  <div className={`px-6 py-4 border-b border-border ${className}`}>
    {children}
  </div>
);

CardHeader.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

/**
 * Card Body
 */
export const CardBody = ({ children, className = '' }) => (
  <div className={`px-6 py-4 ${className}`}>
    {children}
  </div>
);

CardBody.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

/**
 * Card Footer
 */
export const CardFooter = ({ children, className = '' }) => (
  <div className={`px-6 py-4 border-t border-border ${className}`}>
    {children}
  </div>
);

CardFooter.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

export default Card;
