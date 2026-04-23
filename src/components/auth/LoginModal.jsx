import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Mail, Lock, Eye, EyeOff, Shield, Wifi } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import GoogleLoginButton from './GoogleLoginButton';
// import ZelCoreLoginButton from './ZelCoreLoginButton';

/**
 * Login/Register Modal
 * Supports Email and Google authentication
 */
const LoginModal = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [isLoading, setIsLoading] = useState(false);
  const [isExternalAuthLoading, setIsExternalAuthLoading] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [lastAttemptedEmail, setLastAttemptedEmail] = useState('');
  const [showVerificationScreen, setShowVerificationScreen] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const verificationCheckInterval = useRef(null);
  const { login, /* loginWithZelCore, */ register, resendVerification, checkEmailVerified, user, loading: authLoading } = useAuth();

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm();

  // Close modal once zelidauth is stored (zelid available)
  useEffect(() => {
    if (waitingForAuth && !authLoading && user?.zelid) {
      setWaitingForAuth(false);
      setIsLoading(false);
      reset();
      onClose();
    }
    // Also close if login failed (user set to null while waiting)
    if (waitingForAuth && !authLoading && !user) {
      setWaitingForAuth(false);
      setIsLoading(false);
      reset();
    }
  }, [waitingForAuth, authLoading, user, reset, onClose]);

  // Fallback: close after 10s if zelid never arrives
  useEffect(() => {
    if (!waitingForAuth) return;
    const timeout = setTimeout(() => {
      if (waitingForAuth) {
        setWaitingForAuth(false);
        setIsLoading(false);
        reset();
        onClose();
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, [waitingForAuth, reset, onClose]);

  // Reset waiting state when modal opens/closes
  useEffect(() => {
    if (!isOpen) setWaitingForAuth(false);
  }, [isOpen]);

  // Auto-check email verification (FluxOS pattern)
  useEffect(() => {
    if (!showVerificationScreen) {
      // Clear interval when verification screen is not shown
      if (verificationCheckInterval.current) {
        clearInterval(verificationCheckInterval.current);
        verificationCheckInterval.current = null;
      }
      return;
    }

    const checkVerification = async () => {
      console.log('Checking email verification...');
      const result = await checkEmailVerified();

      if (result.verified) {
        console.log('Email verified!');

        // Clear interval
        if (verificationCheckInterval.current) {
          clearInterval(verificationCheckInterval.current);
          verificationCheckInterval.current = null;
        }

        // Reset state and close modal
        setShowVerificationScreen(false);
        setVerificationEmail('');
        reset();
        onClose();
      }
    };

    // Start polling every 5 seconds (FluxOS pattern)
    verificationCheckInterval.current = setInterval(checkVerification, 5000);

    // Check immediately
    checkVerification();

    // Cleanup on unmount
    return () => {
      if (verificationCheckInterval.current) {
        clearInterval(verificationCheckInterval.current);
        verificationCheckInterval.current = null;
      }
    };
  }, [showVerificationScreen, checkEmailVerified, onClose, reset]);

  const handleModeSwitch = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setShowResendVerification(false);
    setShowVerificationScreen(false);
    reset();
  };

  const onSubmit = async (data) => {
    setIsLoading(true);
    setShowResendVerification(false);

    try {
      let result;

      if (mode === 'login') {
        result = await login(data.email, data.password);
        if (result.success) {
          setWaitingForAuth(true);
        } else {
          // Check if error is about email verification
          if (result.error && result.error.includes('verify your email')) {
            setShowResendVerification(true);
            setLastAttemptedEmail(data.email);
          }
        }
      } else {
        result = await register(data.email, data.password);
        if (result.success) {
          // Show verification screen (FluxOS pattern)
          setVerificationEmail(data.email);
          setShowVerificationScreen(true);
          reset();
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const password = document.getElementById('password')?.value;
    if (!password) {
      console.error('Password required');
      return;
    }

    setIsLoading(true);
    try {
      const result = await resendVerification(lastAttemptedEmail, password);
      if (result.success) {
        setShowResendVerification(false);
      }
    } catch (error) {
      console.error('Resend verification error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelVerification = () => {
    setShowVerificationScreen(false);
    setVerificationEmail('');
    if (verificationCheckInterval.current) {
      clearInterval(verificationCheckInterval.current);
      verificationCheckInterval.current = null;
    }
    onClose();
  };

  // const handleZelCoreSuccess = (zelCoreData) => {
  //   loginWithZelCore(zelCoreData);
  //   onClose();
  // };

  // Show connecting state while zelidauth is being stored
  if (waitingForAuth) {
    return (
      <Modal isOpen={isOpen} onClose={() => {}} title={<span className="flex items-center gap-2.5"><Wifi className="w-8 h-8 text-blue-400" />Connecting...</span>} size="sm">
        <div className="flex flex-col items-center justify-center gap-4 min-h-[400px]">
          <div className="w-24 h-24 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400/50 animate-spin" style={{ animationDuration: '1.5s' }} />
            <Shield className="w-12 h-12 text-blue-400" />
          </div>
          <p className="text-base font-semibold relative overflow-hidden px-4 py-1.5 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(33,150,243,0.1), rgba(25,118,210,0.05))', border: '1px solid rgba(33,150,243,0.15)' }}>
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/10 to-transparent animate-[shimmer_2s_infinite]" />
            <span className="relative text-blue-300">Setting up your secure session<span className="inline-block w-6 text-left animate-[dots_1.5s_steps(4,end)_infinite]">...</span></span>
          </p>
          <style>{`.animate-\\[dots_1\\.5s_steps\\(4\\,end\\)_infinite\\]{display:inline-block;clip-path:inset(0 100% 0 0);animation:dots 1.5s steps(4,end) infinite}@keyframes dots{to{clip-path:inset(0 0 0 0)}}`}</style>
        </div>
      </Modal>
    );
  }

  // Show verification screen (FluxOS pattern)
  if (showVerificationScreen) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Verify Your Email"
        size="sm"
      >
        <div className="space-y-6 text-center">
          {/* Email Icon */}
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500/20 to-yellow-500/20 rounded-full flex items-center justify-center">
            <Mail className="w-10 h-10 text-blue-400" />
          </div>

          {/* Message */}
          <div className="space-y-3">
            <h3 className="text-xl font-bold text-white">Check Your Email</h3>
            <p className="text-sm text-gray-400">
              We've sent a verification link to:
            </p>
            <p className="text-base font-semibold text-blue-400">{verificationEmail}</p>
            <p className="text-sm text-gray-400">
              Click the link in the email to verify your account. This page will automatically update when verified.
            </p>
          </div>

          {/* Auto-checking indicator */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <span>Auto-checking verification status...</span>
          </div>

          {/* Cancel button */}
          <Button
            type="button"
            variant="secondary"
            size="md"
            fullWidth
            onClick={handleCancelVerification}
          >
            Cancel
          </Button>

          {/* Help text */}
          <p className="text-xs text-gray-500">
            Didn't receive the email? Check your spam folder or close this and try again.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'login' ? 'Welcome Back' : 'Create Account'}
      size="sm"
    >
      <div className="space-y-6">
        {/* Wallet Login Options */}
        <div className="space-y-3">
          {/* <ZelCoreLoginButton onSuccess={handleZelCoreSuccess} disabled={isLoading || isExternalAuthLoading} /> */}
          <GoogleLoginButton onClose={() => setWaitingForAuth(true)} onLoadingChange={setIsExternalAuthLoading} disabled={isLoading || isExternalAuthLoading} />
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 text-text-secondary font-semibold">Or continue with email</span>
          </div>
        </div>

        {/* Email Login/Register Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            leftIcon={<Mail size={18} />}
            error={errors.email?.message}
            {...registerField('email', {
              required: 'Email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address',
              },
            })}
          />

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            leftIcon={<Lock size={18} />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-300 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
            error={errors.password?.message}
            {...registerField('password', {
              required: 'Password is required',
              minLength: {
                value: mode === 'register' ? 8 : 1,
                message: 'Password must be at least 8 characters',
              },
              validate: mode === 'register' ? (value) => {
                if (value.length < 8) return 'Password must be at least 8 characters';
                if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter';
                if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter';
                if (!/[0-9]/.test(value)) return 'Password must contain at least one number';
                return true;
              } : undefined,
            })}
          />

          {mode === 'login' && (
            <div className="flex justify-between items-center">
              {showResendVerification && (
                <button
                  type="button"
                  className="text-sm text-blue-400 hover:text-blue-300 font-medium"
                  onClick={handleResendVerification}
                  disabled={isLoading}
                >
                  Resend Verification Email
                </button>
              )}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth
            loading={isLoading}
            disabled={isExternalAuthLoading}
          >
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        {/* Switch Mode */}
        <div className="text-center text-sm text-text-secondary">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={handleModeSwitch}
            className="text-primary hover:text-primary-light font-medium"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>

        {/* Terms */}
        {mode === 'register' && (
          <p className="text-xs text-text-muted text-center">
            By creating an account, you agree to our{' '}
            <a
              href="https://cdn.runonflux.io/Flux_Terms_of_Service.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Terms of Service
            </a>
          </p>
        )}
      </div>
    </Modal>
  );
};

LoginModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default LoginModal;
