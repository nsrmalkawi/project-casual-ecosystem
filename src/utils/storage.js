// src/utils/storage.js

export function loadData(key, defaultValue = []) {
  if (typeof window === "undefined") return defaultValue;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse stored data for key:", key, e);
    return defaultValue;
  }
}

export function saveData(key, value) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Failed to save data for key:", key, e);
  }
}
