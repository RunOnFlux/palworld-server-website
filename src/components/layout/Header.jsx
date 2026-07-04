import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, LayoutDashboard, ChevronDown, CircleDollarSign, HelpCircle, CreditCard, Globe, TicketCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { gameConfig } from '../../config/gameConfig';
import stripeService from '../../services/stripeService';
import Button from '../common/Button';
import PropTypes from 'prop-types';

// Move logo style outside to prevent recreation on every render
const logoStyle = {
  color: '#2196F3',
  textShadow: `
    0 0 10px rgba(33, 150, 243, 0.6),
    0 0 20px rgba(33, 150, 243, 0.4),
    0 0 30px rgba(33, 150, 243, 0.2),
    3px 3px 0px rgba(0, 0, 0, 0.5),
    1px 1px 0px rgba(0, 0, 0, 0.3)
  `,
  letterSpacing: '0.5px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontWeight: '900',
};

/**
 * Header/Navbar Component
 * Shows logo, navigation, and user menu
 */
const Header = ({ onLoginClick }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);

  // Get display name based on login type
  const getDisplayName = () => {
    if (!user) return 'User';
    if (user.loginType === 'zelcore') {
      // For ZelCore, show shortened zelid (first 8 chars)
      return user.zelid ? `${user.zelid.substring(0, 8)}...` : 'ZelCore User';
    }
    // For Firebase, show displayName or email prefix
    return user.displayName || user.email?.split('@')[0] || 'User';
  };

  // Get identifier (email for Firebase, zelid for ZelCore)
  const getIdentifier = () => {
    if (!user) return '';
    if (user.loginType === 'zelcore') {
      return user.zelid || '';
    }
    return user.email || '';
  };

  // Get avatar initial
  const getAvatarInitial = () => {
    if (!user) return 'U';
    if (user.loginType === 'zelcore') {
      return user.zelid?.[0]?.toUpperCase() || 'Z';
    }
    return user.displayName?.[0] || user.email?.[0]?.toUpperCase() || 'U';
  };

  const handleLogout = useCallback(() => {
    logout();
    setUserMenuOpen(false);
  }, [logout]);

  const handleBillingPortal = useCallback(async () => {
    if (billingLoading) return;
    setBillingLoading(true);
    setUserMenuOpen(false);
    try {
      await stripeService.openBillingPortal();
    } catch (error) {
      const msg = error.message || 'Failed to open billing portal';
      if (msg.includes('no Stripe customer')) {
        toast.error('No billing account found. Make a payment first.');
      } else {
        toast.error(msg);
      }
    } finally {
      setBillingLoading(false);
    }
  }, [billingLoading]);

  const scrollToSection = useCallback((sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const toggleUserMenu = useCallback(() => {
    setUserMenuOpen(prev => !prev);
  }, []);

  const closeUserMenu = useCallback(() => {
    setUserMenuOpen(false);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);

  const scrollToPricing = useCallback(() => {
    scrollToSection('pricing');
  }, [scrollToSection]);

  const scrollToFAQ = useCallback(() => {
    scrollToSection('faq');
  }, [scrollToSection]);

  const goToDashboard = useCallback(() => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    navigate('/dashboard');
  }, [navigate]);

  const goToSupport = useCallback(() => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    // External Flux support-ticket portal (replaces the in-app /support page
    // for public navigation); open in a new tab.
    window.open('https://support.runonflux.com', '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/20">
      <nav className="w-full px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-1 cursor-pointer ml-1 sm:ml-2" onClick={scrollToTop}>
            <img
              src={gameConfig.assets.logo}
              alt={gameConfig.serverName}
              className="h-12 sm:h-16 w-auto object-contain"
            />
            <span
              className="text-xl sm:text-3xl font-bold whitespace-nowrap"
              style={logoStyle}
            >
              {gameConfig.serverName}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-3 mr-1 sm:mr-2">
            <button
              onClick={scrollToPricing}
              className="flex items-center gap-1.5 px-3 py-2 text-text-secondary hover:text-text transition-all duration-200 cursor-pointer rounded-lg border border-transparent hover:border-border/30 hover:bg-surface/50"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 border border-primary/40">
                <CircleDollarSign className="w-5 h-5 text-primary" />
              </span>
              Pricing
            </button>
            <button
              onClick={() => document.getElementById('locations')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-1.5 px-3 py-2 text-text-secondary hover:text-text transition-all duration-200 cursor-pointer rounded-lg border border-transparent hover:border-border/30 hover:bg-surface/50"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 border border-primary/40">
                <Globe className="w-5 h-5 text-primary" />
              </span>
              Locations
            </button>
            <button
              onClick={scrollToFAQ}
              className="flex items-center gap-1.5 px-3 py-2 text-text-secondary hover:text-text transition-all duration-200 cursor-pointer rounded-lg border border-transparent hover:border-border/30 hover:bg-surface/50"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 border border-primary/40">
                <HelpCircle className="w-5 h-5 text-primary" />
              </span>
              FAQ
            </button>

            {/* User Menu or Login Button */}
            {loading ? (
              <div className="w-32 h-9 bg-surface/50 rounded-lg animate-pulse" />
            ) : isAuthenticated ? (
              <div className="relative" onMouseLeave={() => setUserMenuOpen(false)}>
                <button
                  onClick={toggleUserMenu}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border hover:bg-surface/80 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-semibold">
                    {getAvatarInitial()}
                  </div>
                  <span className="text-sm font-medium">{getDisplayName()}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={closeUserMenu}
                    />
                    {/* Menu */}
                    <div className="absolute right-0 mt-2 w-56 bg-surface border border-border/30 rounded-xl shadow-xl shadow-black/30 overflow-hidden z-50 p-1.5">
                      <div className="px-3 py-2.5 mb-1 rounded-lg bg-surface-hover/30">
                        <p className="text-sm font-medium text-text">
                          {user?.loginType === 'zelcore' ? 'ZelCore Wallet' : (user?.displayName || 'User')}
                        </p>
                        <p className="text-xs text-text-muted truncate" title={getIdentifier()}>
                          {getIdentifier()}
                        </p>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <button
                          className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:text-text flex items-center gap-2.5 transition-all duration-200 cursor-pointer rounded-lg border border-transparent hover:border-border/30 hover:bg-surface-hover/50"
                          onClick={goToDashboard}
                        >
                          <span className="w-6 h-6 flex items-center justify-center rounded-md bg-primary/10">
                            <LayoutDashboard className="w-3.5 h-3.5" />
                          </span>
                          Dashboard
                        </button>
                        <button
                          className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:text-text flex items-center gap-2.5 transition-all duration-200 cursor-pointer rounded-lg border border-transparent hover:border-border/30 hover:bg-surface-hover/50 disabled:opacity-50"
                          onClick={handleBillingPortal}
                          disabled={billingLoading}
                        >
                          <span className="w-6 h-6 flex items-center justify-center rounded-md bg-primary/10">
                            <CreditCard className="w-3.5 h-3.5" />
                          </span>
                          {billingLoading ? 'Opening...' : 'Billing Portal'}
                        </button>
                        <button
                          className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:text-text flex items-center gap-2.5 transition-all duration-200 cursor-pointer rounded-lg border border-transparent hover:border-border/30 hover:bg-surface-hover/50"
                          onClick={goToSupport}
                        >
                          <span className="w-6 h-6 flex items-center justify-center rounded-md bg-primary/10">
                            <TicketCheck className="w-3.5 h-3.5" />
                          </span>
                          Support
                        </button>
                        <button
                          className="w-full px-3 py-2 text-left text-sm text-red-400/80 hover:text-red-400 flex items-center gap-2.5 transition-all duration-200 cursor-pointer rounded-lg border border-transparent hover:border-red-500/20 hover:bg-red-500/5"
                          onClick={handleLogout}
                        >
                          <span className="w-6 h-6 flex items-center justify-center rounded-md bg-red-500/10">
                            <LogOut className="w-3.5 h-3.5" />
                          </span>
                          Logout
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={onLoginClick}
                leftIcon={<User size={16} />}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Get Started'}
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="lg:hidden p-2 rounded-lg hover:bg-surface transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-2 border-t border-border/20">
            <div className="flex flex-col">
              {[
                { icon: <CircleDollarSign size={18} />, label: 'Pricing', onClick: scrollToPricing },
                { icon: <Globe size={18} />, label: 'Locations', onClick: () => { document.getElementById('locations')?.scrollIntoView({ behavior: 'smooth' }); setMobileMenuOpen(false); } },
                { icon: <HelpCircle size={18} />, label: 'FAQ', onClick: scrollToFAQ },
                ...(loading ? [] : isAuthenticated ? [
                  { icon: <LayoutDashboard size={18} />, label: 'Dashboard', onClick: goToDashboard },
                  { icon: <CreditCard size={18} />, label: billingLoading ? 'Opening...' : 'Billing Portal', onClick: handleBillingPortal, disabled: billingLoading },
                  { icon: <TicketCheck size={18} />, label: 'Support', onClick: goToSupport },
                  { icon: <LogOut size={18} />, label: 'Logout', onClick: handleLogout, danger: true },
                ] : [
                  { icon: <User size={18} />, label: 'Get Started', onClick: () => { onLoginClick(); setMobileMenuOpen(false); }, primary: true },
                ]),
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-50 border border-border/20 ${
                    item.danger
                      ? 'text-red-400/80 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5'
                      : item.primary
                        ? 'text-primary bg-primary/5 hover:border-primary/30 hover:bg-surface/50'
                        : 'text-text-secondary hover:text-text hover:border-primary/30 hover:bg-surface/50'
                  }`}
                >
                  <span className={`w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-md ${
                    item.danger ? 'bg-red-500/10' : item.primary ? 'bg-white/20' : 'bg-primary/10'
                  }`}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

Header.propTypes = {
  onLoginClick: PropTypes.func.isRequired,
};

export default Header;
