import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updateProfile,
} from 'firebase/auth';

// FluxOS Firebase Configuration
const firebaseConfig = {
  apiKey: 'AIzaSyAtMsozWwJhhPIOd9BGkZxk5D6Wr8jVGVM',
  authDomain: 'fluxcore-prod.firebaseapp.com',
  projectId: 'fluxcore-prod',
  storageBucket: 'fluxcore-prod.appspot.com',
  messagingSenderId: '468366888401',
  appId: '1:468366888401:web:56eb34ebe93751527ea4f0',
  measurementId: 'G-SEGT3X2737',
};

// Initialize Firebase.
// During the SSR prerender there is no browser: getAuth() needs window. Nothing on
// the server ever reads `auth` (AuthProvider only touches it from effects, which do
// not run during renderToString), so a null stand-in keeps the module importable in
// Node.
const app = import.meta.env.SSR ? null : initializeApp(firebaseConfig);
const auth = import.meta.env.SSR ? null : getAuth(app);

// Set persistence immediately on initialization (browser only — `auth` is null
// during the SSR prerender, and persistence is a browser concern anyway).
if (!import.meta.env.SSR) {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Failed to set auth persistence:', error);
  });
}

/**
 * Get current user
 */
export function getUser() {
  try {
    return auth.currentUser;
  } catch {
    return null;
  }
}

/**
 * Reload user to get fresh data from Firebase
 */
export async function reloadUser() {
  try {
    const user = auth.currentUser;
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
    await auth.signOut();
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

export { auth, onAuthStateChanged };
export default auth;
