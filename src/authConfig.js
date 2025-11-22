// src/authConfig.js
// Simple in-app users for basic auth.
// IMPORTANT: change these before deploying publicly.

export const APP_USERS = [
  {
    username: "admin",
    password: "AdminStrong123!",
    role: "admin", // full access, sees Admin
  },
  {
    username: "manager",
    password: "Manager123!",
    role: "manager", // no Admin, but can see everything else
  },
  {
    username: "viewer",
    password: "Viewer123!",
    role: "viewer", // read-only, reporting & analysis focus
  },
];
