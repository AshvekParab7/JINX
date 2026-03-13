import Constants from "expo-constants";
import { Platform } from "react-native";

import { storage } from "./storage";

const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const configBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl?.trim();

const inferDevBaseUrl = () => {
  const explicitHost = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
    Constants.manifest?.debuggerHost,
  ].find(Boolean);

  if (explicitHost) {
    const hostname = explicitHost.split(",")[0].trim().split(":")[0];
    if (hostname) {
      return `http://${hostname}:8000/api`;
    }
  }

  if (typeof globalThis !== "undefined" && globalThis.location?.hostname) {
    return `http://${globalThis.location.hostname}:8000/api`;
  }

  return Platform.OS === "android"
    ? "http://10.0.2.2:8000/api"
    : "http://127.0.0.1:8000/api";
};

const BASE_URL = (envBaseUrl || configBaseUrl || inferDevBaseUrl()).replace(
  /\/+$/,
  "",
);
const TOKEN_KEY = "userToken";
const USER_KEY = "userProfile";
const ACCOUNTS_KEY = "savedAccounts";
const REQUEST_TIMEOUT_MS = 10000;

const fetchWithTimeout = async (
  url,
  options = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Helper function to retrieve the current user's auth token
 */
const getAuthToken = async () => {
  try {
    return await storage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const safeParseJson = async (response) => {
  const rawText = await response.text();
  if (!rawText) {
    return {};
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return { error: rawText };
  }
};

const readStoredAccounts = async () => {
  try {
    const rawAccounts = await storage.getItem(ACCOUNTS_KEY);
    const parsedAccounts = rawAccounts ? JSON.parse(rawAccounts) : [];
    return Array.isArray(parsedAccounts) ? parsedAccounts : [];
  } catch {
    return [];
  }
};

const writeStoredAccounts = async (accounts) => {
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
};

const buildAccountRecord = (token, user) => ({
  id: user?.email || String(user?.id || Date.now()),
  token,
  user,
  lastUsedAt: new Date().toISOString(),
});

const upsertStoredAccount = async (token, user) => {
  if (!token || !user) {
    return;
  }

  const nextAccount = buildAccountRecord(token, user);
  const accounts = await readStoredAccounts();
  const deduped = accounts.filter((account) => account.id !== nextAccount.id);
  deduped.unshift(nextAccount);
  await writeStoredAccounts(deduped);
};

const storeSession = async (token, user) => {
  if (token) {
    await storage.setItem(TOKEN_KEY, token);
  }
  if (user) {
    await storage.setItem(USER_KEY, JSON.stringify(user));
    await upsertStoredAccount(token, user);
  }
};

export const getStoredUser = async () => {
  try {
    const rawUser = await storage.getItem(USER_KEY);
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
};

export const isAuthenticated = async () => Boolean(await getAuthToken());

export const listStoredAccounts = async () => {
  const accounts = await readStoredAccounts();
  return accounts.sort((left, right) => {
    const leftTime = Date.parse(left.lastUsedAt || 0) || 0;
    const rightTime = Date.parse(right.lastUsedAt || 0) || 0;
    return rightTime - leftTime;
  });
};

export const hasStoredAccounts = async () =>
  (await readStoredAccounts()).length > 0;

export const selectStoredAccount = async (accountId) => {
  const accounts = await readStoredAccounts();
  const selected = accounts.find((account) => account.id === accountId);
  if (!selected?.token || !selected?.user) {
    return { error: "Saved account not found." };
  }

  await storeSession(selected.token, selected.user);
  return { token: selected.token, user: selected.user };
};

/**
 * Register a new user with emergency contacts
 */
export const registerUser = async (name, email, password, sms, whatsapp) => {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/users/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        emergency_sms: sms,
        emergency_whatsapp: whatsapp,
      }),
    });
    const data = await safeParseJson(response);
    if (response.ok && data.token) {
      await storeSession(data.token, data.user);
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      return { error: `Request timed out while reaching ${BASE_URL}.` };
    }

    return { error: error.message || "Unable to create account." };
  }
};

/**
 * Authenticate login
 */
export const authenticateUser = async (email, password) => {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/users/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await safeParseJson(response);
    if (response.ok && data.token) {
      await storeSession(data.token, data.user);
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      return { error: `Request timed out while reaching ${BASE_URL}.` };
    }

    return { error: error.message || "Unable to sign in." };
  }
};

/**
 * Logout User
 */
export const logoutUser = async () => {
  try {
    await storage.multiRemove([TOKEN_KEY, USER_KEY]);
  } catch (error) {
    console.error("Error logging out:", error);
  }
};

const buildUrl = (path) => {
  if (!BASE_URL) {
    throw new Error("Missing EXPO_PUBLIC_API_BASE_URL for backend requests");
  }

  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
};

const postJson = async (path, payload) => {
  try {
    const token = await getAuthToken();
    const response = await fetchWithTimeout(buildUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Token ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    return await safeParseJson(response);
  } catch (error) {
    return { error: error.message || "Network request failed" };
  }
};

export const isBackendConfigured = () => Boolean(BASE_URL);

export const sendChatbotMessage = async (message) => {
  return postJson("/chat", { text: message });
};

export const uploadHealthImage = async (imageUri) => {
  try {
    const formData = new FormData();
    formData.append("image", {
      uri: imageUri,
      name: "health-scan.jpg",
      type: "image/jpeg",
    });

    const response = await fetchWithTimeout(buildUrl("/health-detect/"), {
      method: "POST",
      body: formData,
    });
    return await safeParseJson(response);
  } catch (error) {
    return { error: error.message || "Upload failed" };
  }
};

export const logFallEvent = async (payload) => {
  return postJson("/fall-detect/incidents/", payload);
};

export const logActivitySnapshot = async (payload) => {
  return postJson("/fall-detect/activity/", payload);
};

export const fetchFallIncidents = async () => {
  try {
    const token = await getAuthToken();
    const response = await fetchWithTimeout(
      buildUrl("/fall-detect/incidents/"),
      {
        headers: token ? { Authorization: `Token ${token}` } : {},
      },
    );
    return await safeParseJson(response);
  } catch (error) {
    return { error: error.message || "Unable to load incidents" };
  }
};

export const getCurrentUserProfile = async () => {
  try {
    const token = await getAuthToken();
    if (!token) {
      return { error: "Not authenticated" };
    }

    const response = await fetchWithTimeout(buildUrl("/users/profile/"), {
      headers: { Authorization: `Token ${token}` },
    });
    const data = await safeParseJson(response);
    if (response.ok && data.user) {
      await storage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    return data;
  } catch (error) {
    return { error: error.message || "Unable to load profile" };
  }
};

// ─── Mental Health ────────────────────────────────────────────────────────────

export const sendMentalHealthChat = async (message, sessionId = null, history = []) => {
  // Each element: { role: 'user' | 'bot', text: string }
  return postJson("/mental-health/chat/", {
    message,
    session_id: sessionId,
    history: history.map((m) => ({ role: m.role, text: m.text })),
  });
};

export const getChatSessions = async () => {
  try {
    const response = await fetchWithTimeout(
      buildUrl("/mental-health/sessions/"),
    );
    return await safeParseJson(response);
  } catch (error) {
    return { error: error.message || "Failed to load chats" };
  }
};

export const createChatSession = async () => {
  return postJson("/mental-health/sessions/", {});
};

export const analyzeVoice = async (sessionId, audioUri) => {
  try {
    const token = await getAuthToken();
    const formData = new FormData();
    formData.append("audio", {
      uri: audioUri,
      name: "voice.m4a",
      type: "audio/m4a",
    });
    if (sessionId) {
      formData.append("session_id", sessionId);
    }
    const response = await fetchWithTimeout(buildUrl("/mental-health/voice/"), {
      method: "POST",
      headers: token ? { Authorization: `Token ${token}` } : undefined,
      body: formData,
    });
    return await safeParseJson(response);
  } catch (error) {
    return { error: error.message || "Voice upload failed" };
  }
};

export const getCopingResources = async (category = null) => {
  try {
    const query = category ? `?category=${encodeURIComponent(category)}` : "";
    const response = await fetchWithTimeout(
      buildUrl(`/mental-health/resources/${query}`),
    );
    return await response.json();
  } catch {
    return [];
  }
};

export const getChatHistory = async (sessionId) => {
  try {
    const response = await fetchWithTimeout(
      buildUrl(`/mental-health/history/${sessionId}/`),
    );
    return await response.json();
  } catch (error) {
    return { error: error.message || "Failed to load history" };
  }
};
