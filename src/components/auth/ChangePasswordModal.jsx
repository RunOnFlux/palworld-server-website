import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';

/**
 * Change Password Modal
 *
 * Only reachable for accounts that signed in with email and password — Google
 * and ZelCore sessions have no password, and the menu entry is hidden for them.
 */
const ChangePasswordModal = ({ isOpen, onClose }) => {
  const { changePassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  // One toggle per field: revealing the current password and checking a new one
  // you just typed are separate needs.
  const [reveal, setReveal] = useState({ current: false, next: false, confirm: false });

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm();

  useEffect(() => {
    if (!isOpen) {
      reset();
      setError('');
      setDone(false);
      setReveal({ current: false, next: false, confirm: false });
    }
  }, [isOpen, reset]);

  // Close on its own once the user has read the confirmation.
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [done, onClose]);

  const onSubmit = async (data) => {
    setIsLoading(true);
    setError('');
    try {
      const result = await changePassword(data.currentPassword, data.newPassword);
      if (result.success) {
        setDone(true);
        reset();
      } else {
        setError(result.error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const revealButton = (field) => (
    <button
      type="button"
      onClick={() => setReveal((current) => ({ ...current, [field]: !current[field] }))}
      className="text-gray-400 hover:text-gray-300 focus:outline-none"
      aria-label={reveal[field] ? 'Hide password' : 'Show password'}
      tabIndex={-1}
    >
      {reveal[field] ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change Password" size="sm">
      {done ? (
        <div className="space-y-4 text-center py-4">
          <CheckCircle className="w-12 h-12 text-primary-light mx-auto" />
          <p className="text-base font-semibold text-text">Password changed</p>
          <p className="text-sm text-text-secondary">
            Your new password is active right away. You stay signed in on this device.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <Input
            label="Current Password"
            type={reveal.current ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            leftIcon={<Lock size={18} />}
            rightIcon={revealButton('current')}
            error={errors.currentPassword?.message}
            {...registerField('currentPassword', {
              required: 'Current password is required',
            })}
          />

          <Input
            label="New Password"
            type={reveal.next ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="new-password"
            leftIcon={<Lock size={18} />}
            rightIcon={revealButton('next')}
            error={errors.newPassword?.message}
            {...registerField('newPassword', {
              required: 'New password is required',
              validate: (value) => {
                if (value.length < 8) return 'Password must be at least 8 characters';
                if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter';
                if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter';
                if (!/[0-9]/.test(value)) return 'Password must contain at least one number';
                return true;
              },
            })}
          />

          <Input
            label="Confirm New Password"
            type={reveal.confirm ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="new-password"
            leftIcon={<Lock size={18} />}
            rightIcon={revealButton('confirm')}
            error={errors.confirmPassword?.message}
            {...registerField('confirmPassword', {
              required: 'Please confirm your new password',
              // Second arg is the whole form — avoids watch(), which the React
              // Compiler lint rejects as unmemoizable.
              validate: (value, formValues) =>
                value === formValues.newPassword || 'Passwords do not match',
            })}
          />

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" size="md" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" fullWidth loading={isLoading}>
              Change Password
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

ChangePasswordModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default ChangePasswordModal;
