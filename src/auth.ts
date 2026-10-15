import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Accounts (v0.13) — local-prototype auth.
 *
 * Honest scope: there is no FindIt server yet, so accounts live on
 * this device. Passwords are never stored in plain text: they are
 * salted with the email and hashed (SHA-256 via expo-crypto where the
 * build provides it, with a documented FNV-1a fallback for previews).
 * When the backend lands, this module becomes the API client and the
 * screens do not change.
 *
 * A session is either an account email or 'guest' — guest mode keeps
 * the app fully usable and is how the prototype is explored.
 */

export interface AuthUser {
  name: string;
  email: string;
  passHash: string;
  createdAt: string;
}

export type Session = { kind: 'user'; email: string } | { kind: 'guest' } | null;

const USER_KEY = '@findit/auth-user/v1';
const SESSION_KEY = '@findit/auth-session/v1';

/* ------------------------------ Validation ------------------------------ */

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Password strength 0..4 with a label — drives the animated meter. */
export function passwordStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['Too short', 'Weak', 'Okay', 'Good', 'Strong'];
  if (password.length < 8) return { score: Math.min(score, 1), label: labels[Math.min(score, 1)] };
  return { score, label: labels[score] };
}

export function validateCredentials(input: {
  mode: 'login' | 'signup';
  name: string;
  email: string;
  password: string;
}): { name?: string; email?: string; password?: string } {
  const errors: { name?: string; email?: string; password?: string } = {};
  if (input.mode === 'signup' && input.name.trim().length < 2) {
    errors.name = 'Tell us your name — two letters or more.';
  }
  if (!isValidEmail(input.email)) errors.email = 'That email does not look right.';
  if (input.mode === 'signup' && input.password.length < 8) {
    errors.password = 'Use at least 8 characters.';
  } else if (input.mode === 'login' && input.password.length === 0) {
    errors.password = 'Enter your password.';
  }
  return errors;
}

/* ------------------------------- Hashing -------------------------------- */

/** FNV-1a — fallback only (preview builds without expo-crypto). Not for production. */
function fnvHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv:${h.toString(16)}`;
}

export async function hashPassword(email: string, password: string): Promise<string> {
  const salted = `${email.trim().toLowerCase()}::${password}`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Crypto = require('expo-crypto') as {
      digestStringAsync: (algo: string, text: string) => Promise<string>;
      CryptoDigestAlgorithm: { SHA256: string };
    };
    if (Crypto?.digestStringAsync) {
      return `sha256:${await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salted)}`;
    }
  } catch {
    // Fall through to the preview fallback.
  }
  return fnvHash(salted);
}

/* ------------------------------- Storage -------------------------------- */

export async function loadUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    return parsed && typeof parsed.email === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveUser(user: AuthUser): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function loadSession(): Promise<Session> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (parsed && (parsed.kind === 'guest' || (parsed.kind === 'user' && typeof parsed.email === 'string'))) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveSession(session: Exclude<Session, null>): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // Signing out must never crash.
  }
}

/* ------------------------------ Auth flows ------------------------------ */

export type SignUpResult = { ok: true; user: AuthUser } | { ok: false; error: string };

export async function signUp(name: string, email: string, password: string): Promise<SignUpResult> {
  const existing = await loadUser();
  const cleanEmail = email.trim().toLowerCase();
  if (existing && existing.email === cleanEmail) {
    return { ok: false, error: 'An account with this email already exists on this device — log in instead.' };
  }
  const user: AuthUser = {
    name: name.trim(),
    email: cleanEmail,
    passHash: await hashPassword(cleanEmail, password),
    createdAt: new Date().toISOString(),
  };
  await saveUser(user);
  await saveSession({ kind: 'user', email: cleanEmail });
  return { ok: true, user };
}

export async function logIn(email: string, password: string): Promise<SignUpResult> {
  const user = await loadUser();
  const cleanEmail = email.trim().toLowerCase();
  if (!user || user.email !== cleanEmail) {
    return { ok: false, error: 'No account found for this email on this device. Create one first.' };
  }
  const hash = await hashPassword(cleanEmail, password);
  if (hash !== user.passHash) {
    return { ok: false, error: 'That password is not right. Try again.' };
  }
  await saveSession({ kind: 'user', email: cleanEmail });
  return { ok: true, user };
}

export async function continueAsGuest(): Promise<void> {
  await saveSession({ kind: 'guest' });
}
