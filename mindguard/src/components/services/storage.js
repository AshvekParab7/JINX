import AsyncStorage from "@react-native-async-storage/async-storage";

const memoryStore = new Map();
let warnedAboutFallback = false;

const warnFallback = (error) => {
  if (warnedAboutFallback) {
    return;
  }

  warnedAboutFallback = true;
  console.warn(
    "Persistent storage is unavailable, using a temporary fallback store instead.",
    error?.message || error || "",
  );
};

const getLocalStorage = () => {
  if (typeof globalThis === "undefined") {
    return null;
  }

  const candidate = globalThis.localStorage;
  if (!candidate || typeof candidate.getItem !== "function") {
    return null;
  }

  return candidate;
};

const fallbackStorage = {
  async getItem(key) {
    const localStorage = getLocalStorage();
    if (localStorage) {
      return localStorage.getItem(key);
    }

    return memoryStore.has(key) ? memoryStore.get(key) : null;
  },

  async setItem(key, value) {
    const localStorage = getLocalStorage();
    if (localStorage) {
      localStorage.setItem(key, value);
      return;
    }

    memoryStore.set(key, value);
  },

  async removeItem(key) {
    const localStorage = getLocalStorage();
    if (localStorage) {
      localStorage.removeItem(key);
      return;
    }

    memoryStore.delete(key);
  },

  async multiRemove(keys) {
    const localStorage = getLocalStorage();
    if (localStorage) {
      keys.forEach((key) => localStorage.removeItem(key));
      return;
    }

    keys.forEach((key) => memoryStore.delete(key));
  },
};

const withStorageFallback = async (operation) => {
  const resolvedStorage =
    AsyncStorage && typeof AsyncStorage.getItem === "function"
      ? AsyncStorage
      : null;

  if (resolvedStorage) {
    try {
      return await operation(resolvedStorage);
    } catch (error) {
      warnFallback(error);
    }
  }

  return operation(fallbackStorage);
};

export const storage = {
  getItem(key) {
    return withStorageFallback((backend) => backend.getItem(key));
  },

  setItem(key, value) {
    return withStorageFallback((backend) => backend.setItem(key, value));
  },

  removeItem(key) {
    return withStorageFallback((backend) => backend.removeItem(key));
  },

  multiRemove(keys) {
    return withStorageFallback((backend) => backend.multiRemove(keys));
  },
};
