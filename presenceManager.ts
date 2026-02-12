import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PresenceState {
  user_id: string;
  online_at: string;
  working_out?: boolean;
  live_session?: string;
}

let channel: RealtimeChannel | null = null;
let currentUserId: string | null = null;
let currentState: Omit<PresenceState, 'user_id'> = {};
let onlineUsers = new Map<string, PresenceState>();
let lastSeenMap = new Map<string, string>(); // userId -> ISO timestamp when they went offline
let subscribed = false;
const listeners = new Set<(users: Map<string, PresenceState>) => void>();

function notifyListeners() {
  const snapshot = new Map(onlineUsers);
  listeners.forEach(cb => cb(snapshot));
}

function parsePresenceState(raw: Record<string, any[]>): Map<string, PresenceState> {
  const map = new Map<string, PresenceState>();
  for (const [key, presences] of Object.entries(raw)) {
    if (presences.length > 0) {
      // Use the last (most recent) presence entry
      map.set(key, presences[presences.length - 1] as PresenceState);
    }
  }
  return map;
}

export async function initPresence(userId: string) {
  // Always refresh the online timestamp
  currentState.online_at = new Date().toISOString();

  // If already set up for this user, just re-track
  if (channel && currentUserId === userId) {
    if (subscribed) {
      try {
        await channel.track({ user_id: userId, ...currentState });
      } catch (_) {
        // Channel likely disconnected — tear down and re-init
        subscribed = false;
        supabase.removeChannel(channel);
        channel = null;
        return initPresence(userId);
      }
    }
    // If not yet subscribed, the subscribe callback will pick up currentState
    return;
  }

  // Different user or no channel — full cleanup and re-init
  if (channel) {
    try { await channel.untrack(); } catch (_) {}
    supabase.removeChannel(channel);
    channel = null;
  }

  currentUserId = userId;
  subscribed = false;

  channel = supabase.channel('app:presence', {
    config: { presence: { key: userId } },
  });

  channel.on('presence', { event: 'sync' }, () => {
    if (!channel) return;
    const state = channel.presenceState();
    onlineUsers = parsePresenceState(state as Record<string, any[]>);
    notifyListeners();
  });

  // Track when users go offline so we can show "Active X mins ago"
  channel.on('presence', { event: 'leave' }, ({ key }) => {
    if (key) {
      lastSeenMap.set(key, new Date().toISOString());
    }
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      subscribed = true;
      if (channel && currentUserId) {
        try {
          await channel.track({ user_id: currentUserId, ...currentState });
        } catch (_) {}
      }
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      subscribed = false;
    }
  });
}

export async function cleanupPresence() {
  subscribed = false;
  if (channel) {
    try { await channel.untrack(); } catch (_) {}
    supabase.removeChannel(channel);
    channel = null;
  }
  currentUserId = null;
  currentState = {};
  onlineUsers = new Map();
  notifyListeners();
}

export async function updatePresence(updates: Partial<Omit<PresenceState, 'user_id'>>) {
  currentState = { ...currentState, ...updates };
  if (channel && currentUserId && subscribed) {
    try {
      await channel.track({ user_id: currentUserId, ...currentState });
    } catch (_) {
      // Will be re-tracked on next reconnection via subscribe callback
    }
  }
}

export function subscribeToPresence(callback: (users: Map<string, PresenceState>) => void): () => void {
  listeners.add(callback);
  // Immediately provide current state so new subscribers don't start stale
  callback(new Map(onlineUsers));
  return () => {
    listeners.delete(callback);
  };
}

export function getOnlineUsers(): Map<string, PresenceState> {
  return new Map(onlineUsers);
}

export function getLastSeen(userId: string): string | undefined {
  return lastSeenMap.get(userId);
}
