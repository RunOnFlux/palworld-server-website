import {
  loginWithEmail as firebaseLoginWithEmail,
  createEmailAccount as firebaseCreateEmailAccount,
  getUser,
  signOut as firebaseSignOut,
  sendVerificationEmail,
  sendPasswordReset as firebaseSendPasswordReset,
  changePassword as firebaseChangePassword,
  updateUserProfile,
  reloadUser,
} from '../utils/firebase';
import secureStorage from '../utils/secureStorage';

/**
 * Auth Service (Firebase-based - FluxOS pattern)
 */
class AuthService {
  /**
   * Register with email
   */
  async registerWithEmail(email, password, name) {
    try {
      // Create account
      const result = await firebaseCreateEmailAccount(email, password);
      const user = result.user;

      // Update display name if provided
      if (name && user) {
        await updateUserProfile(user, { displayName: name });
      }

      // Send email verification
      await sendVerificationEmail(user);

      // Get Firebase ID token and store zelidauth
      await this.storeZelidAuth(user);

      return {
        uid: user.uid,
        email: user.email,
        displayName: name || user.displayName,
        emailVerified: user.emailVerified,
      };
    } catch (error) {
      console.error('Email registration failed:', error);
      throw this.handleFirebaseError(error);
    }
  }

  /**
   * Login with email
   */
  async loginWithEmail(email, password) {
    try {
      const result = await firebaseLoginWithEmail(email, password);
      const user = result.user;

      // Check if email is verified
      if (!user.emailVerified) {
        const error = new Error('Please verify your email before logging in. Check your inbox for the verification link.');
        error.code = 'auth/email-not-verified';
        throw error;
      }

      // Get Firebase ID token and store zelidauth
      await this.storeZelidAuth(user);

      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
      };
    } catch (error) {
      console.error('Email login failed:', error);
      throw this.handleFirebaseError(error);
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    const user = getUser();
    if (!user) return null;

    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    };
  }

  /**
   * Check if authenticated
   */
  async isAuthenticated() {
    return getUser() !== null;
  }

  /**
   * Store Zelid auth for Flux API calls
   */
  async storeZelidAuth(user) {
    try {
      console.log('🔐 Storing auth credentials for Firebase user');

      // Get Firebase access token
      const token = await user.getIdToken();

      // Get login phrase from Flux API (30s timeout)
      const loginPhraseController = new AbortController();
      const loginPhraseTimeout = setTimeout(() => loginPhraseController.abort(), 30000);
      const loginPhraseResponse = await fetch('https://api.runonflux.io/id/loginphrase', { signal: loginPhraseController.signal });
      clearTimeout(loginPhraseTimeout);
      const loginPhraseData = await loginPhraseResponse.json();
      // CRITICAL: Response is {status: "success", data: "loginphrasestring"}
      // data IS the loginPhrase, not data.loginPhrase!
      const loginPhrase = loginPhraseData.data;


      // Sign in or up with FluxCore API (like FluxOS does)
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      // Sign in with FluxCore (30s timeout)
      const fluxLoginController = new AbortController();
      const fluxLoginTimeout = setTimeout(() => fluxLoginController.abort(), 30000);
      const fluxLoginResponse = await fetch('https://service.fluxcore.ai/api/signInOrUp', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ message: loginPhrase }),
        signal: fluxLoginController.signal,
      });
      clearTimeout(fluxLoginTimeout);

      const fluxLoginData = await fluxLoginResponse.json();

      if (fluxLoginData?.status !== 'success') {
        throw new Error('FluxCore login failed');
      }

      // Create zelidauth object from FluxCore response
      // CRITICAL: Only 3 fields, exactly like FluxOS!
      const zelidauth = {
        zelid: fluxLoginData.public_address,
        signature: fluxLoginData.signature,
        loginPhrase: loginPhrase,
      };

      console.log('📦 Created zelidauth object for zelid:', zelidauth.zelid);

      // Store with encrypted storage
      await secureStorage.setItem('zelidauth', zelidauth);

      // Verify it was stored
      const retrieved = await secureStorage.getItem('zelidauth');
      console.log('✅ Auth credentials storage:', retrieved ? 'SUCCESS' : 'FAILED');

      return zelidauth;
    } catch (error) {
      console.error('❌ Failed to store zelidauth:', error);
      throw error;
    }
  }

  /**
   * Get stored zelidauth
   */
  async getZelidAuth() {
    try {
      return await secureStorage.getItem('zelidauth');
    } catch (error) {
      console.error('Failed to get zelidauth:', error);
      return null;
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email, password) {
    try {
      // Login to get the user object
      const result = await firebaseLoginWithEmail(email, password);
      const user = result.user;

      // Check if already verified
      if (user.emailVerified) {
        throw new Error('Email is already verified');
      }

      // Send verification email
      await sendVerificationEmail(user);

      // Sign out after sending email (don't keep unverified user logged in)
      await firebaseSignOut();

      return { success: true, message: 'Verification email sent. Please check your inbox.' };
    } catch (error) {
      console.error('Resend verification email failed:', error);
      throw this.handleFirebaseError(error);
    }
  }

  /**
   * Send a password reset email.
   *
   * `auth/user-not-found` is swallowed on purpose: surfacing it would turn this
   * form into an oracle for which emails have an account. Every caller gets the
   * same neutral outcome whether or not the address is registered.
   */
  async sendPasswordReset(email) {
    try {
      await firebaseSendPasswordReset(email);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        console.error('Password reset email failed:', error);
        throw this.handleFirebaseError(error);
      }
    }

    return {
      success: true,
      message: 'If an account exists for that address, a reset link is on its way.',
    };
  }

  /**
   * Change the signed-in user's password, reauthenticating with the current one.
   */
  async changePassword(currentPassword, newPassword) {
    try {
      await firebaseChangePassword(currentPassword, newPassword);

      return { success: true, message: 'Your password has been changed.' };
    } catch (error) {
      // A failed reauthentication reports the same codes as a failed sign-in.
      // Here the only credential in play is the current password, so say that
      // rather than the generic "check your email and password".
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        const wrong = new Error('Current password is incorrect');
        wrong.code = error.code;
        throw wrong;
      }

      throw this.handleFirebaseError(error);
    }
  }

  /**
   * Check if current user's email is verified (FluxOS pattern)
   * Reloads user data from Firebase
   */
  async checkEmailVerified() {
    try {
      const user = await reloadUser();
      if (!user) {
        return { verified: false, user: null };
      }

      if (user.emailVerified) {
        // Store zelidauth if verified
        await this.storeZelidAuth(user);
        return {
          verified: true,
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified,
          },
        };
      }

      return { verified: false, user: null };
    } catch (error) {
      console.error('Check email verified failed:', error);
      return { verified: false, user: null };
    }
  }

  /**
   * Logout
   */
  async logout() {
    // Clear zelidauth from encrypted storage
    await secureStorage.removeItem('zelidauth');
    await firebaseSignOut();
  }

  /**
   * Handle Firebase errors
   */
  handleFirebaseError(error) {
    const errorMessages = {
      'auth/email-already-in-use': 'This email is already registered. Please log in instead.',
      'auth/invalid-email': 'Invalid email address format',
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/weak-password': 'Password must be at least 6 characters',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later',
      'auth/email-not-verified': 'Please verify your email before logging in. Check your inbox for the verification link.',
      'auth/missing-email': 'Please enter your email address',
      'auth/requires-recent-login': 'For security, please sign out and sign in again before changing your password',
      'auth/no-current-user': 'You must be signed in to change your password',
      'auth/network-request-failed': 'Network error. Please check your connection',
      'auth/invalid-credential': 'Invalid credentials. Please check your email and password',
    };

    const message = errorMessages[error.code] || error.message || 'Authentication failed';
    const customError = new Error(message);
    customError.code = error.code;
    return customError;
  }
}

export default new AuthService();
