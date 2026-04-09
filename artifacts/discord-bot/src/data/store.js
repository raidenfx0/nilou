/**
 * In-memory data store for bot state.
 * Persists within the same process run.
 */

export const stickyMessages = new Map();

export const reactionRoles = new Map();

export const welcomeChannels = new Map();

export const ghostPingChannels = new Map();

export const adminRoles = new Map();

export const countdowns = new Map();
