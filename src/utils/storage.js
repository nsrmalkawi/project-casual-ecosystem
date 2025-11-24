// src/utils/storage.js

// -------- basic local storage helpers (existing behaviour) --------

export function loadData(key, defaultValue = null) {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.error("loadData failed for key", key, e);
    return defaultValue;
  }
}

export function saveData(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("saveData failed for key", key, e);
  }
}

// -------- cloud snapshot helpers (for backup / multi-device) --------

// Collect all pc_* keys from localStorage into one object
export function getAllPcLocalData() {
  const all = {};
  if (typeof window === "undefined") return all;
  try {
    const { localStorage } = window;
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith("pc_")) continue;
      const raw = localStorage.getItem(key);
      try {
        all[key] = JSON.parse(raw);
      } catch {
        all[key] = raw;
      }
    }
  } catch (e) {
    console.error("Failed to collect pc_* data", e);
  }
  return all;
}

// Write a snapshot object back into localStorage
export function applyAllPcLocalData(data) {
  if (typeof window === "undefined") return;
  if (!data || typeof data !== "object") return;
  try {
    for (const [key, value] of Object.entries(data)) {
      if (!key.startsWith("pc_")) continue;
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (e) {
    console.error("Failed to apply snapshot to localStorage", e);
  }
}

// Save to server-side "cloud" snapshot
export async function saveSnapshotToCloud() {
  const API_BASE = import.meta.env.VITE_API_BASE || "";
  const url = API_BASE
    ? `${API_BASE}/api/snapshot`.replace(/([^:]\/)\/+/g, "$1")
    : "/api/snapshot";

  const payload = getAllPcLocalData();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: payload }),
  });
  if (!res.ok) {
    throw new Error(`Snapshot save failed: ${res.status}`);
  }
  return true;
}

// Load from server-side "cloud" snapshot
export async function loadSnapshotFromCloud() {
  const API_BASE = import.meta.env.VITE_API_BASE || "";
  const url = API_BASE
    ? `${API_BASE}/api/snapshot`.replace(/([^:]\/)\/+/g, "$1")
    : "/api/snapshot";

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Snapshot load failed: ${res.status}`);
  }
  const json = await res.json();
  if (json && json.data) {
    applyAllPcLocalData(json.data);
    return json.data;
  }
  return {};
}
