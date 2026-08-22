/**
 * Firebase auth, loaded on demand.
 *
 * Why it is lazy: the SDK is a ~148KB chunk, and importing it at module scope put it in the
 * eager graph of every route, so a visitor landing on an article page from Google downloaded
 * the whole authentication stack to read it. Anonymous visitors now never fetch it.
 *
 * How it stays correct: Firebase persists a session under a known localStorage key. If that key
 * is absent there is no session to restore, so subscribeToAuth() reports "signed out" without
 * loading anything. The moment anything needs auth, ensureSdk() loads the SDK, attaches the
 * real listener and replays it to every subscriber, so a logged-in visitor behaves exactly as
 * before, one tick later.
 */

const firebaseConfig = {
  apiKey: 'AIzaSyAtMsozWwJhhPIOd9BGkZxk5D6Wr8jVGVM',
  authDomain: 'fluxcore-prod.firebaseapp.com',
  projectId: 'fluxcore-prod',
  storageBucket: 'fluxcore-prod.appspot.com',
  messagingSenderId: '468366888401',
  appId: '1:468366888401:web:56eb34ebe93751527ea4f0',
  measurementId: 'G-SEGT3X2737',
};

// Filled in by ensureSdk(). `auth` stays null until then, which is why the synchronous helpers
// below tolerate it: before the SDK loads, "no user" is the truthful answer and the same one
// they gave on a cold page load previously.
let sdk = null;
let sdkPromise = null;
let auth = null;

/** The key Firebase writes its persisted session under. Absent means nobody is signed in. */
const sessionKey = `firebase:authUser:${firebaseConfig.apiKey}:[DEFAULT]`;
const hasStoredSession = () => {
  try {
    return localStorage.getItem(sessionKey) !== null;
  } catch {
    // Storage blocked. Assume a session might exist rather than locking someone out.
    return true;
  }
};

/** Load and initialise the SDK once. Resolves to the firebase/auth module namespace. */
async function ensureSdk() {
  if (import.meta.env.SSR) return null;
  if (sdkPromise) return sdkPromise;

  sdkPromise = (async () => {
    const [{ initializeApp }, authMod] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ]);
    const app = initializeApp(firebaseConfig);
    auth = authMod.getAuth(app);
    sdk = authMod;
    try {
      await authMod.setPersistence(auth, authMod.browserLocalPersistence);
    } catch (error) {
      console.error('Failed to set auth persistence:', error);
    }
    attachListener();
    return authMod;
  })();

  return sdkPromise;
}

// Subscribers registered before the SDK existed, plus the live unsubscribe once it does.
const subscribers = new Set();
let detach = null;

function attachListener() {
  if (detach || !auth || !sdk) return;
  detach = sdk.onAuthStateChanged(auth, (user) => {
    subscribers.forEach((cb) => cb(user));
  });
}

/**
 * Subscribe to auth state. Returns an unsubscribe function synchronously.
 *
 * With no persisted session this reports null immediately and loads nothing. Any later login
 * goes through ensureSdk(), which attaches the real listener and starts feeding this callback.
 */
export function subscribeToAuth(callback) {
  subscribers.add(callback);

  if (sdkPromise || hasStoredSession()) {
    ensureSdk().catch((error) => {
      console.error('Firebase failed to load:', error);
      callback(null);
    });
  } else {
    Promise.resolve().then(() => {
      if (subscribers.has(callback)) callback(null);
    });
  }

  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && detach) {
      detach();
      detach = null;
    }
  };
}

/**
 * Get current user
 */
export function getUser() {
  // Synchronous by contract, so callers outside React keep working. Null before the SDK loads,
  // which is the same value they saw on a cold load previously.
  try {
    return auth?.currentUser ?? null;
  } catch {
    return null;
  }
}

/**
 * Reload user to get fresh data from Firebase
 */
export async function reloadUser() {
  try {
    await ensureSdk();
    const user = auth?.currentUser;
    if (user) {
      await user.reload();
      return auth.currentUser;
    }
    return null;
  } catch (error) {
    console.error('Reload user error:', error);
    throw error;
  }
}

/**
 * Login with Google (Popup)
 */
export async function loginWithGoogle() {
  try {
    // Set persistence before login
    const { setPersistence, browserLocalPersistence, GoogleAuthProvider, signInWithPopup } = await ensureSdk();
    await setPersistence(auth, browserLocalPersistence);

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const result = await signInWithPopup(auth, provider);
    return result;
  } catch (error) {
    console.error('Google login error:', error);
    throw error;
  }
}

/**
 * Login with Email and Password
 */
export async function loginWithEmail(email, password) {
  try {
    // Set persistence before login
    const { setPersistence, browserLocalPersistence, signInWithEmailAndPassword } = await ensureSdk();
    await setPersistence(auth, browserLocalPersistence);

    const result = await signInWithEmailAndPassword(auth, email, password);
    return result;
  } catch (error) {
    console.error('Email login error:', error);
    throw error;
  }
}

/**
 * Create account with Email and Password
 */
export async function createEmailAccount(email, password) {
  try {
    const { createUserWithEmailAndPassword } = await ensureSdk();
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result;
  } catch (error) {
    console.error('Email signup error:', error);
    throw error;
  }
}

/**
 * Send email verification
 */
export async function sendVerificationEmail(user) {
  try {
    const { sendEmailVerification } = await ensureSdk();
    await sendEmailVerification(user);
    return { success: true };
  } catch (error) {
    console.error('Send verification email error:', error);
    throw error;
  }
}

/**
 * Send a password reset email.
 *
 * The link in the mail points at the Firebase project's own hosted action
 * handler, so there is no reset page to serve from this site.
 */
export async function sendPasswordReset(email) {
  try {
    const { sendPasswordResetEmail } = await ensureSdk();
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    console.error('Send password reset email error:', error);
    throw error;
  }
}

/**
 * Whether the signed-in user actually has a password to change.
 *
 * Google and ZelCore sessions have no password provider, so the change-password
 * entry point must stay hidden for them.
 */
export function hasPasswordProvider() {
  const user = getUser();

  return Boolean(user?.providerData?.some((p) => p.providerId === 'password'));
}

/**
 * Change the signed-in user's password.
 *
 * Firebase only allows this on a recent login, so the current password is used
 * to reauthenticate first. That doubles as proof the person typing is the
 * account owner and not someone who walked up to an unlocked machine.
 */
export async function changePassword(currentPassword, newPassword) {
  const user = getUser();
  if (!user?.email) {
    const error = new Error('You must be signed in to change your password');
    error.code = 'auth/no-current-user';
    throw error;
  }

  try {
    const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await ensureSdk();
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);

    return { success: true };
  } catch (error) {
    console.error('Change password error:', error);
    throw error;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(user, profile) {
  try {
    const { updateProfile } = await ensureSdk();
    await updateProfile(user, profile);
    return { success: true };
  } catch (error) {
    console.error('Update profile error:', error);
    throw error;
  }
}

/**
 * Sign out
 */
export async function signOut() {
  try {
    await ensureSdk();
    await auth.signOut();
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

// `auth` and the raw onAuthStateChanged are no longer exported: reading them synchronously
// is what forced the SDK into the eager graph. Use subscribeToAuth(), or ensureSdk() if you
// genuinely need the module namespace.
export { ensureSdk };
