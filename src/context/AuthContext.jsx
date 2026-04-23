import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import authService from '../services/authService';
import { auth, onAuthStateChanged } from '../utils/firebase';
import secureStorage from '../utils/secureStorage';
import SessionTimer from '../components/auth/SessionTimer';

const AuthContext = createContext(null);

/**
 * Auth Context Provider
 * Manages global authentication state for both Firebase and ZelCore auth
 * Includes auto-logout after 90 minutes (1.5 hours) from login
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [contextReady, setContextReady] = useState(true); // Start as true to prevent blocking

  // Auto-logout state - simple 1.5h timer from login time
  const [loginTime, setLoginTime] = useState(() => {
    // Restore loginTime from localStorage on mount
    const stored = localStorage.getItem('loginTime');
    return stored ? parseInt(stored, 10) : null;
  });

  // Ref to store timeout IDs for cleanup
  const timeoutsRef = useRef([]);

  // Helper to set login time and persist to localStorage
  const updateLoginTime = (time) => {
    setLoginTime(time);
    if (time === null) {
      localStorage.removeItem('loginTime');
    } else {
      localStorage.setItem('loginTime', time.toString());
    }
  };

  // Initialize auth state from Firebase or ZelCore
  useEffect(() => {
    console.log('🔔 AuthContext: Setting up auth state listener');

    let unsubscribe;
    let fallbackTimeout;

    const initAuth = async () => {
      // Check for existing ZelCore session first
      const loginType = localStorage.getItem('loginType');
      const zelidauth = await secureStorage.getItem('zelidauth');

      if (loginType === 'zelcore' && zelidauth) {
        // User has ZelCore session
        if (zelidauth.zelid && zelidauth.signature && zelidauth.loginPhrase) {
          console.log('🔔 AuthContext: Found ZelCore session:', zelidauth.zelid);
          setUser({
            zelid: zelidauth.zelid,
            loginType: 'zelcore',
          });
          setIsAuthenticated(true);
          // Only set new loginTime if not already stored (preserves timer across refreshes)
          const storedLoginTime = localStorage.getItem('loginTime');
          if (!storedLoginTime) {
            updateLoginTime(Date.now());
          }
          setLoading(false);
          // Don't return - still set up Firebase listener for future logins
        }
      }

      // ALWAYS listen to Firebase auth state (needed for Google/email login to work)
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        console.log('🔔 AuthContext: Auth state changed, user:', firebaseUser?.email || 'null');

        // Check if user is currently using ZelCore login
        const currentLoginType = localStorage.getItem('loginType');

        if (firebaseUser) {
          // Show logged-in UI immediately (name, avatar) but keep loading until zelid ready
          setIsAuthenticated(true);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            loginType: 'firebase',
          });

          // Store zelidauth for Flux API — reuse existing on refresh, only re-fetch on new login
          // Refreshing always re-fetches a new loginPhrase which can cause 401s on nodes
          // with clock drift (fresh phrase timestamp appears future-dated to behind-clock nodes)
          const existingZelidauth = await secureStorage.getItem('zelidauth');
          const storedLoginTime = localStorage.getItem('loginTime');
          const isPageRefresh = !!storedLoginTime && !!existingZelidauth;

          if (isPageRefresh) {
            // Reuse stored zelidauth — session is still active, no need for new loginPhrase
            console.log('🔔 AuthContext: Page refresh — reusing stored zelidauth');
            localStorage.setItem('loginType', 'firebase');
            setUser(prev => ({ ...prev, zelid: existingZelidauth?.zelid }));
          } else {
            console.log('🔔 AuthContext: New login — calling storeZelidAuth');
            try {
              const zelidauth = await authService.storeZelidAuth(firebaseUser);
              console.log('🔔 AuthContext: storeZelidAuth completed, zelid:', zelidauth?.zelid);

              localStorage.setItem('loginType', 'firebase');
              setUser(prev => ({ ...prev, zelid: zelidauth?.zelid }));
              if (!storedLoginTime) {
                updateLoginTime(Date.now());
              }
            } catch (error) {
              console.error('❌ AuthContext: Failed to store zelidauth — logging out:', error);
              setIsAuthenticated(false);
              setUser(null);
              await authService.logout();
              setTimeout(() => {
                toast.error('Login failed. Please check your connection and try again.', { id: 'login-failed' });
              }, 500);
              return;
            }
          }
          if (!storedLoginTime) {
            updateLoginTime(Date.now());
          }
        } else {
          // Only clear user if not using ZelCore login
          // This prevents Firebase from overriding ZelCore session
          if (currentLoginType !== 'zelcore') {
            // Delay clearing to give Firebase time to restore from persistence
            // This prevents premature logout when opening new windows
            const timeoutId = setTimeout(() => {
              const loginType = localStorage.getItem('loginType');
              // Only clear if no Firebase user AND no active login session (firebase or zelcore)
              if (!auth.currentUser && loginType !== 'zelcore' && loginType !== 'firebase') {
                console.log('🔔 AuthContext: No Firebase user after delay, clearing session');
                setUser(null);
                setIsAuthenticated(false);
                updateLoginTime(null); // Clear timer and localStorage
              } else if (loginType === 'firebase') {
                console.log('🔔 AuthContext: Firebase login active, keeping session during window operations');
              }
            }, 500); // 500ms delay to allow persistence to restore
            timeoutsRef.current.push(timeoutId);
          } else {
            console.log('🔔 AuthContext: No Firebase user but ZelCore login active, keeping session');
          }
        }
        setLoading(false);
      });

      // Fallback: Force loading to false after 2 seconds if still loading
      fallbackTimeout = setTimeout(() => {
        setLoading(false);
        setContextReady(true);
      }, 2000);

      // Mark context as ready immediately (prevents HMR race conditions)
      setContextReady(true);
    };

    initAuth();

    // Cleanup subscription on unmount - returned directly from useEffect
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
      }
      // Clear all pending timeouts from auth state changes
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, []);

  const login = async (email, password) => {
    try {
      await authService.loginWithEmail(email, password);
      // Firebase listener will update user state automatically
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const register = async (email, password, name) => {
    try {
      await authService.registerWithEmail(email, password, name);
      // Firebase listener will update user state automatically
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const loginWithZelCore = (zelCoreData) => {
    // Update state with ZelCore user data
    setUser({
      zelid: zelCoreData.zelid,
      privilege: zelCoreData.privilege,
      loginType: 'zelcore',
    });
    setIsAuthenticated(true);
    updateLoginTime(Date.now()); // Start 1.5h timer and persist to localStorage
  };

  const logout = async () => {
    console.log('🚪 AuthContext: Logout initiated');

    // Check login type
    const loginType = localStorage.getItem('loginType');

    if (loginType === 'zelcore') {
      // Clear ZelCore session from encrypted storage
      await secureStorage.removeItem('zelidauth');
    } else if (loginType === 'firebase') {
      // Clear Firebase session
      await authService.logout();
    }

    // Clear all localStorage items for both login types
    localStorage.removeItem('loginType');

    setUser(null);
    setIsAuthenticated(false);
    updateLoginTime(null); // Clear timer and localStorage
    // Note: Dashboard page handles navigation to home via useEffect
  };

  const resendVerification = async (email, password) => {
    try {
      const result = await authService.resendVerificationEmail(email, password);
      return { success: true, message: result.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const checkEmailVerified = async () => {
    try {
      const result = await authService.checkEmailVerified();
      return result;
    } catch {
      return { verified: false, user: null };
    }
  };

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated,
    loginTime,
    login,
    loginWithZelCore,
    register,
    logout,
    resendVerification,
    checkEmailVerified,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, loading, isAuthenticated, loginTime]);

  return (
    <AuthContext.Provider value={value}>
      {contextReady ? (
        <>
          {children}
          {/* Session Timer UI - only show when authenticated */}
          {isAuthenticated && loginTime && (
            <SessionTimer
              lastActivity={loginTime}
              onLogout={logout}
            />
          )}
        </>
      ) : (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * useAuth Hook
 * Access auth context in components
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export default AuthContext;
