import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  createUserWithEmailAndPassword,
  signInAnonymously,
  updateProfile,
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase/config';
import { AppUser, UserRole } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

const googleProvider = new GoogleAuthProvider();

/**
 * Sign in with Email and Password
 */
export async function loginWithEmail(email: string, pass: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, pass);
}

/**
 * Sign in with Google (Popup)
 */
export async function loginWithGoogle(): Promise<void> {
  await signInWithPopup(auth, googleProvider);
}

/**
 * Sign out
 */
export async function logoutUser(): Promise<void> {
  localStorage.removeItem('moysklad_demo_role');
  await signOut(auth);
}

/**
 * Fetch or bootstrap user record from Firestore
 */
export async function getOrCreateUserProfile(
  uid: string,
  email: string | null,
  displayName: string | null
): Promise<AppUser> {
  const userRef = doc(db, 'users', uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid,
        email: data.email || email || '',
        displayName: data.displayName || displayName || 'Сотрудник',
        role: data.role === 'admin' ? 'admin' : 'cashier',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    }

    // Determine initial role: runtime user email 'bagratav2005@gmail.com' or admin default
    const isFirstAdmin =
      email === 'bagratav2005@gmail.com' ||
      email?.toLowerCase().includes('admin') ||
      uid.startsWith('demo-admin');

    const role: UserRole = isFirstAdmin ? 'admin' : 'cashier';
    const newUser: AppUser = {
      uid,
      email: email || `${uid.slice(0, 8)}@store.pos`,
      displayName: displayName || (isFirstAdmin ? 'Главный Администратор' : 'Кассир'),
      role,
    };

    await setDoc(userRef, {
      ...newUser,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return newUser;
  } catch (err) {
    console.error('Error fetching/creating user profile:', err);
    // Fallback profile if offline
    return {
      uid,
      email: email || 'user@store.pos',
      displayName: displayName || 'Сотрудник',
      role: email === 'bagratav2005@gmail.com' ? 'admin' : 'cashier',
    };
  }
}

/**
 * Create a new staff account without signing out the current administrator
 * Uses an isolated secondary Firebase App instance.
 */
export async function createStaffAccount(
  email: string,
  pass: string,
  displayName: string,
  role: UserRole
): Promise<AppUser> {
  // Unique secondary app name
  const secondaryAppName = `SecondaryAuthApp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    // 1. Create user in Firebase Authentication
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    const newUid = credential.user.uid;

    if (displayName.trim()) {
      try {
        await updateProfile(credential.user, { displayName: displayName.trim() });
      } catch (_) {}
    }

    // 2. Sign out secondary auth immediately so it doesn't linger
    await signOut(secondaryAuth);

    // 3. Save profile in Firestore 'users' collection using primary db
    const newUser: AppUser = {
      uid: newUid,
      email,
      displayName: displayName.trim() || email.split('@')[0],
      role,
    };

    await setDoc(doc(db, 'users', newUid), {
      ...newUser,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return newUser;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'users_creation');
  }
}

/**
 * Instant Demo Authentication for quick testing
 */
export async function loginAsDemo(role: UserRole): Promise<void> {
  localStorage.setItem('moysklad_demo_role', role);
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  } catch (e) {
    console.warn('Anonymous auth note:', e);
  }
}
