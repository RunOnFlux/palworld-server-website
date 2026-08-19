import { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, User, LogOut, LayoutDashboard, ChevronDown, CircleDollarSign, HelpCircle, CreditCard, Globe, TicketCheck, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { gameConfig } from '../../config/gameConfig';
import stripeService from '../../services/stripeService';
import Button from '../common/Button';
import ChangePasswordModal from '../auth/ChangePasswordModal';
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

// ── Finding your servers after logging in ───────────────────────────────────────────
// The account control carries the customer's OWN name, which reads as a label rather than
// as a menu, so the servers they had just paid for sat one unexplained click inside it.
// Two fixes: "My Servers" is its own button now, at the same weight "Get Started" has
// before logging in, and a first-time customer gets exactly one pointer at it.
//
// Seen-state is per account AND per browser: a shared machine must not swallow the hint
// for the next person, and it is only recorded once the hint has actually been on screen
// for a while — a reload two seconds after logging in should not burn it.
const HINT_STORE = 'flux:seenDashboardHint';
const HINT_LIFETIME_MS = 20000;

const hintKeyFor = (user) => user?.zelid || user?.email || user?.uid || 'anon';

const hasSeenHint = (user) => {
  try {
    return JSON.parse(localStorage.getItem(HINT_STORE) || '{}')[hintKeyFor(user)] === true;
  } catch { return false; }
};

const markHintSeen = (user) => {
  try {
    const store = JSON.parse(localStorage.getItem(HINT_STORE) || '{}');
    store[hintKeyFor(user)] = true;
    localStorage.setItem(HINT_STORE, JSON.stringify(store));
  } catch { /* storage disabled — the hint simply shows again next time */ }
};

/**
 * The pointer itself. Rendered twice (desktop and mobile anchor their own copy) and each
 * copy is hidden at the other breakpoint, so only one is ever on screen.
 */
const DashboardHint = ({ onDismiss, className = '' }) => (
  <div
    role="status"
    className={`absolute right-0 top-full mt-3 w-64 z-50 rounded-xl border border-primary/40 bg-surface shadow-xl shadow-black/40 p-3 animate-fade-in ${className}`}
  >
    <span className="absolute -top-1.5 right-6 w-3 h-3 rotate-45 border-l border-t border-primary/40 bg-surface" />
    <div className="flex items-start gap-2.5">
      <span className="flex w-7 h-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15 border border-primary/30">
        <LayoutDashboard className="w-3.5 h-3.5 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">Your servers are here</p>
        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
          Manage, configure and renew everything you have deployed.
        </p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex-shrink-0 -mt-1 -mr-1 p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover/50 transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

DashboardHint.propTypes = {
  onDismiss: PropTypes.func.isRequired,
  className: PropTypes.string,
};

/**
 * Header/Navbar Component
 * Shows logo, navigation, and user menu
 */
const Header = ({ onLoginClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [showHint, setShowHint] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  // Only email/password accounts have a password to change. Google and ZelCore
  // sessions never see the entry.
  const canChangePassword = user?.loginType === 'firebase' && user?.hasPassword;

  const openChangePassword = useCallback(() => {
    setChangePasswordOpen(true);
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  }, []);

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

  const dismissHint = useCallback(() => {
    setShowHint(false);
    markHintSeen(user);
  }, [user]);

  const goToDashboard = useCallback(() => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    dismissHint();
    navigate('/dashboard');
  }, [navigate, dismissHint]);

  // Show the pointer once, shortly after a session appears, and never on the dashboard
  // itself — there is nothing to point at once the customer is already there.
  useEffect(() => {
    if (loading || !isAuthenticated || location.pathname.startsWith('/dashboard') || hasSeenHint(user)) {
      setShowHint(false);
      return undefined;
    }
    // A hint that animates in during the login redirect is read as page furniture and
    // ignored, so it waits for the page to settle. It then retires itself: an undismissed
    // card following someone around the site is worse than never having pointed at all.
    const appear = setTimeout(() => setShowHint(true), 900);
    const retire = setTimeout(() => { setShowHint(false); markHintSeen(user); }, 900 + HINT_LIFETIME_MS);
    return () => { clearTimeout(appear); clearTimeout(retire); };
  }, [loading, isAuthenticated, location.pathname, user]);

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

            {/* My Servers — the destination a logged-in customer actually wants, at the
                same weight "Get Started" carries before logging in. It used to live only
                inside the account menu, behind a control labelled with the customer's own
                name, which is not a place anyone thinks to look for their servers. */}
            {!loading && isAuthenticated && (
              <div className="relative">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={goToDashboard}
                  leftIcon={<LayoutDashboard size={16} />}
                >
                  My Servers
                </Button>
                {showHint && <DashboardHint onDismiss={dismissHint} />}
              </div>
            )}

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
                        {canChangePassword && (
                          <button
                            className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:text-text flex items-center gap-2.5 transition-all duration-200 cursor-pointer rounded-lg border border-transparent hover:border-border/30 hover:bg-surface-hover/50"
                            onClick={openChangePassword}
                          >
                            <span className="w-6 h-6 flex items-center justify-center rounded-md bg-primary/10">
                              <KeyRound className="w-3.5 h-3.5" />
                            </span>
                            Change Password
                          </button>
                        )}
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

          {/* Mobile: the same shortcut, outside the hamburger. Everything a customer
              owns was one unlabelled menu away on the smaller screen. */}
          <div className="lg:hidden flex items-center gap-1">
            {!loading && isAuthenticated && (
              <div className="relative">
                <button
                  onClick={goToDashboard}
                  aria-label="My servers"
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-primary text-white font-semibold text-sm transition-colors cursor-pointer"
                >
                  <LayoutDashboard size={18} />
                  <span className="hidden sm:inline">My Servers</span>
                </button>
                {showHint && <DashboardHint onDismiss={dismissHint} />}
              </div>
            )}
            <button
              onClick={toggleMobileMenu}
              className="p-2 rounded-lg hover:bg-surface transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
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
                  { icon: <LayoutDashboard size={18} />, label: 'My Servers', onClick: goToDashboard, primary: true },
                  { icon: <CreditCard size={18} />, label: billingLoading ? 'Opening...' : 'Billing Portal', onClick: handleBillingPortal, disabled: billingLoading },
                  ...(canChangePassword ? [{ icon: <KeyRound size={18} />, label: 'Change Password', onClick: openChangePassword }] : []),
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

      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </header>
  );
};

Header.propTypes = {
  onLoginClick: PropTypes.func.isRequired,
};

export default Header;
