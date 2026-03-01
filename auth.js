// auth.js — Client-side authentication using Amazon Cognito
import {
    CognitoIdentityProviderClient,
    SignUpCommand,
    InitiateAuthCommand,
    GlobalSignOutCommand
} from "https://esm.sh/@aws-sdk/client-cognito-identity-provider@3.525.0";


const COGNITO_REGION = window.APP_CONFIG ? window.APP_CONFIG.COGNITO_REGION : "";
const COGNITO_CLIENT_ID = window.APP_CONFIG ? window.APP_CONFIG.COGNITO_CLIENT_ID : "";

const client = new CognitoIdentityProviderClient({ region: COGNITO_REGION });
const AUTH_SESSION_KEY = 'kv:cognito_session';

/**
 * Register a new user with Amazon Cognito.
 * @returns {{ success: boolean, error?: string }}
 */
export async function register(email, password) {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes('@')) {
        return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password || password.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters for Cognito.' };
    }

    try {
        const command = new SignUpCommand({
            ClientId: COGNITO_CLIENT_ID,
            Username: e,
            Password: password,
            UserAttributes: [
                { Name: "email", Value: e }
            ]
        });
        await client.send(command);

        // Auto-login after registration (assuming autoVerify is true in CDK)
        return await login(e, password);
    } catch (error) {
        console.error("Cognito SignUp Error:", error);
        return { success: false, error: error.message || 'Registration failed.' };
    }
}

/**
 * Login with Amazon Cognito.
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

    try {
        const command = new InitiateAuthCommand({
            AuthFlow: "USER_PASSWORD_AUTH",
            ClientId: COGNITO_CLIENT_ID,
            AuthParameters: {
                USERNAME: e,
                PASSWORD: password,
            },
        });

        const response = await client.send(command);

        if (response.AuthenticationResult) {
            setSession({
                email: e,
                accessToken: response.AuthenticationResult.AccessToken,
                idToken: response.AuthenticationResult.IdToken,
                refreshToken: response.AuthenticationResult.RefreshToken,
                loggedInAt: new Date().toISOString()
            });
            return { success: true };
        } else {
            return { success: false, error: 'Login challenge required (not supported without UI).' };
        }
    } catch (error) {
        console.error("Cognito Login Error:", error);
        return { success: false, error: error.message || 'Incorrect email or password.' };
    }
}

/**
 * Set session in localStorage.
 */
function setSession(sessionData) {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionData));
}

/**
 * Get current session.
 * @returns {{ email: string, loggedInAt: string, accessToken: string, idToken: string } | null}
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
 * Logout — clear session and sign out from Cognito.
 */
export async function logout() {
    const session = getSession();
    if (session && session.accessToken) {
        try {
            const command = new GlobalSignOutCommand({
                AccessToken: session.accessToken
            });
            await client.send(command);
        } catch (error) {
            console.error("Cognito Logout Error:", error);
        }
    }
    localStorage.removeItem(AUTH_SESSION_KEY);
}

/**
 * Check if user is logged in.
 */
export function isLoggedIn() {
    return getSession() !== null;
}
