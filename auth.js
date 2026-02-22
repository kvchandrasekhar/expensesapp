// auth.js — Client-side authentication using localStorage
// Passwords are hashed with a simple SHA-256 for basic security practice.

const AUTH_USERS_KEY = 'kv:users';
const AUTH_SESSION_KEY = 'kv:session';

/**
 * Simple SHA-256 hash using Web Crypto API.
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const buffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Get all registered users from localStorage.
 */
function getUsers() {
    try {
        const raw = localStorage.getItem(AUTH_USERS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

/**
 * Save users to localStorage.
 */
function saveUsers(users) {
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

/**
 * Register a new user.
 * @returns {{ success: boolean, error?: string }}
 */
export async function register(email, password) {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes('@')) {
        return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password || password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' };
    }

    const users = getUsers();
    if (users[e]) {
        return { success: false, error: 'An account with this email already exists.' };
    }

    const hashed = await hashPassword(password);
    users[e] = { email: e, passwordHash: hashed, createdAt: new Date().toISOString() };
    saveUsers(users);

    // Auto-login after registration
    setSession(e);
    return { success: true };
}

/**
 * Login with email and password.
 * @returns {{ success: boolean, error?: string }}
 */
export async function login(email, password) {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes('@')) {
        return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password) {
        return { success: false, error: 'Please enter your password.' };
    }

    const users = getUsers();
    const user = users[e];
    if (!user) {
        return { success: false, error: 'No account found with this email.' };
    }

    const hashed = await hashPassword(password);
    if (hashed !== user.passwordHash) {
        return { success: false, error: 'Incorrect password.' };
    }

    setSession(e);
    return { success: true };
}

/**
 * Set session in localStorage.
 */
function setSession(email) {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
        email,
        loggedInAt: new Date().toISOString(),
    }));
}

/**
 * Get current session.
 * @returns {{ email: string, loggedInAt: string } | null}
 */
export function getSession() {
    try {
        const raw = localStorage.getItem(AUTH_SESSION_KEY);
        if (!raw) return null;
        const session = JSON.parse(raw);
        return session && session.email ? session : null;
    } catch {
        return null;
    }
}

/**
 * Logout — clear session.
 */
export function logout() {
    localStorage.removeItem(AUTH_SESSION_KEY);
}

/**
 * Check if user is logged in.
 */
export function isLoggedIn() {
    return getSession() !== null;
}
