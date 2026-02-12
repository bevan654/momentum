import { supabase } from './supabase';
import { createLiveSessionRow, updateLiveSessionStatus, getLiveSession, createNotification, getMyProfile, findSessionByInviteCode, addParticipantToSession, transferSessionLeadership, removeParticipantFromSession } from './friendsDatabase';
import { registerBackgroundHeartbeat, unregisterBackgroundHeartbeat, checkParticipantDbHeartbeat } from './liveSessionBackground';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================================
// Types
// ============================================================

export type LiveStatus = 'lifting' | 'resting' | 'paused';
export type LiveReactionType = 'fire' | 'skull' | 'eyes' | 'hurry';
export type BuddySyncMode = 'strict' | 'soft';

export interface BuddyRoutineData {
  routineName: string;
  exercises: { name: string; sets: number; exercise_order: number }[];
  syncMode: BuddySyncMode;
}

export interface LiveUserState {
  userId: string;
  username: string;
  status: LiveStatus;
  currentExercise: string | null;
  currentSetIndex: number;
  totalSetsInExercise: number;
  currentSetWeight: number;
  currentSetReps: number;
  lastSetWeight: number;
  lastSetReps: number;
  restTimeRemaining?: number;
  totalVolume: number;
  setsCompleted: number;
  completedSetsInExercise: number;
  exerciseCount: number;
  exerciseSummary: { name: string; completedSets: number; totalSets: number; sets: { kg: number; reps: number; completed: boolean }[] }[];
  workoutDuration: number;
  lastUpdated: string;
  // Sync-specific fields
  routineExerciseIndex?: number;
  routineSetIndex?: number;
  setJustCompleted?: boolean;
}

export interface LiveReaction {
  fromUserId: string;
  type: LiveReactionType;
  timestamp: number;
  targetUserId?: string;
}

export interface ParticipantSummary {
  userId: string;
  username: string;
  totalVolume: number;
  setsCompleted: number;
  exerciseNames: string[];
}

export interface LiveSessionSummary {
  timeTogether: number;
  host: { username: string; totalVolume: number; setsCompleted: number; exerciseNames: string[] };
  buddy: { username: string; totalVolume: number; setsCompleted: number; exerciseNames: string[] };
  participants?: ParticipantSummary[];
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface LiveSessionInfo {
  sessionId: string;
  hostId: string;
  leaderId: string;
  buddyId: string | null;
  participantIds: string[];
  inviteCode?: string;
  maxParticipants: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  routineData?: BuddyRoutineData | null;
}

// ============================================================
// Module State (singleton, follows presenceManager.ts pattern)
// ============================================================

let channel: RealtimeChannel | null = null;
let currentSession: LiveSessionInfo | null = null;
let currentUserId: string | null = null;
let myState: LiveUserState | null = null;
// Multi-participant state: Maps keyed by userId
let participantStates: Map<string, LiveUserState> = new Map();
let lastParticipantHeartbeats: Map<string, number> = new Map();
let participantFinished: Map<string, boolean> = new Map();

let connectionStatus: ConnectionStatus = 'disconnected';
let disconnectedSince: number | null = null;
let reconnectCheckInterval: ReturnType<typeof setInterval> | null = null;
let leaveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

const stateListeners = new Set<(my: LiveUserState | null, participants: Map<string, LiveUserState>) => void>();
const reactionListeners = new Set<(reaction: LiveReaction) => void>();
const sessionListeners = new Set<(session: LiveSessionInfo | null) => void>();
const connectionListeners = new Set<(status: ConnectionStatus) => void>();
const syncEventListeners = new Set<(event: string, payload: any) => void>();
const sessionEventListeners = new Set<(event: string, userId?: string) => void>();

// ============================================================
// Internal Helpers
// ============================================================

function notifyStateListeners() {
  stateListeners.forEach(cb => cb(myState, participantStates));
}

function notifyReactionListeners(reaction: LiveReaction) {
  reactionListeners.forEach(cb => cb(reaction));
}

function notifySessionListeners() {
  sessionListeners.forEach(cb => cb(currentSession));
}

function notifyConnectionListeners() {
  connectionListeners.forEach(cb => cb(connectionStatus));
}

function setConnectionStatus(status: ConnectionStatus) {
  if (connectionStatus !== status) {
    connectionStatus = status;
    notifyConnectionListeners();
  }
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================================
// Core Functions
// ============================================================

export async function createLiveSession(buddyIds: string[], routineOptions?: {
  routineData: { name: string; sets: number; exercise_order: number }[];
  syncMode: BuddySyncMode;
  routineName: string;
}, groupOptions?: {
  generateInviteCode?: boolean;
}): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const inviteCode = generateInviteCode();
  const maxParticipants = 10;

  // Always soft sync for group sessions
  const effectiveSyncMode: BuddySyncMode | undefined = routineOptions ? 'soft' : undefined;

  const result = await createLiveSessionRow(buddyIds, routineOptions ? {
    routineData: routineOptions.routineData,
    syncMode: effectiveSyncMode,
    routineName: routineOptions.routineName,
  } : undefined, {
    inviteCode,
    maxParticipants,
  });
  if (!result.success || !result.data) return null;

  currentUserId = user.id;
  currentSession = {
    sessionId: result.data.id,
    hostId: user.id,
    leaderId: user.id,
    buddyId: buddyIds[0] || null,
    participantIds: buddyIds,
    inviteCode,
    maxParticipants,
    status: 'pending',
    routineData: routineOptions ? {
      routineName: routineOptions.routineName,
      exercises: routineOptions.routineData,
      syncMode: effectiveSyncMode!,
    } : null,
  };
  notifySessionListeners();
  return result.data.id;
}

export async function acceptInvite(sessionId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { console.error('acceptInvite: no user'); return false; }

  // Only set started_at if the session is still pending (first accept)
  const preCheck = await getLiveSession(sessionId);
  const isPending = preCheck.success && preCheck.data?.status === 'pending';
  const result = await updateLiveSessionStatus(sessionId, 'active',
    isPending ? { started_at: new Date().toISOString() } : {}
  );
  if (!result.success) { console.error('acceptInvite: updateStatus failed', result); return false; }

  // Ensure we're in participant_ids (atomic add handles concurrent accepts)
  await addParticipantToSession(sessionId, user.id);

  // Fetch session to get host info
  const sessionResult = await getLiveSession(sessionId);
  if (!sessionResult.success || !sessionResult.data) { console.error('acceptInvite: getLiveSession failed', sessionResult); return false; }

  currentUserId = user.id;
  const sessionData = sessionResult.data;
  currentSession = {
    sessionId,
    hostId: sessionData.host_id,
    leaderId: sessionData.leader_id || sessionData.host_id,
    buddyId: sessionData.buddy_id,
    participantIds: sessionData.participant_ids || [],
    inviteCode: sessionData.invite_code || undefined,
    maxParticipants: sessionData.max_participants || 10,
    status: 'active',
    routineData: sessionData.routine_data && sessionData.sync_mode ? {
      routineName: sessionData.routine_name || 'Routine',
      exercises: sessionData.routine_data,
      syncMode: sessionData.sync_mode as BuddySyncMode,
    } : null,
  };

  // Notify host — non-blocking so it doesn't break the join flow
  try {
    const myProfileResult = await getMyProfile();
    const myName = (myProfileResult.success && myProfileResult.data?.username) || user.email || 'Buddy';
    await createNotification(sessionResult.data.host_id, 'live_accepted', 'Invite Accepted',
      `${myName} joined your live workout!`,
      { session_id: sessionId });
  } catch (e) {
    console.warn('acceptInvite: notification failed (non-fatal)', e);
  }

  notifySessionListeners();
  await joinSessionChannel(sessionId);
  return true;
}

export async function joinByInviteCode(code: string): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const result = await findSessionByInviteCode(code.toUpperCase().trim());
  if (!result.success || !result.data) {
    return { success: false, error: 'Invalid invite code' };
  }

  const session = result.data;

  // Check capacity
  const currentParticipants = [session.host_id, ...(session.participant_ids || [])];
  const maxP = session.max_participants || 10;
  if (!currentParticipants.includes(user.id) && currentParticipants.length >= maxP) {
    return { success: false, error: 'Session is full' };
  }

  // Atomically add self to participant_ids (handles concurrent joins safely)
  const addResult = await addParticipantToSession(session.id, user.id);
  const newParticipantIds = addResult.participantIds;

  // Activate session if still pending
  if (session.status === 'pending') {
    await updateLiveSessionStatus(session.id, 'active', {
      started_at: new Date().toISOString(),
    });
  }

  currentUserId = user.id;
  currentSession = {
    sessionId: session.id,
    hostId: session.host_id,
    leaderId: session.leader_id || session.host_id,
    buddyId: session.buddy_id,
    participantIds: newParticipantIds,
    inviteCode: session.invite_code || undefined,
    maxParticipants: maxP,
    status: 'active',
    routineData: session.routine_data && session.sync_mode ? {
      routineName: session.routine_name || 'Routine',
      exercises: session.routine_data,
      syncMode: session.sync_mode as BuddySyncMode,
    } : null,
  };

  // Notify host
  try {
    const myProfileResult = await getMyProfile();
    const myName = (myProfileResult.success && myProfileResult.data?.username) || user.email || 'Someone';
    await createNotification(session.host_id, 'live_accepted', 'New Participant',
      `${myName} joined via invite code!`,
      { session_id: session.id });
  } catch (e) {
    console.warn('joinByInviteCode: notification failed (non-fatal)', e);
  }

  notifySessionListeners();
  await joinSessionChannel(session.id);
  return { success: true };
}

export async function joinSessionChannel(sessionId: string): Promise<void> {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }

  if (reconnectCheckInterval) { clearInterval(reconnectCheckInterval); reconnectCheckInterval = null; }
  if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }

  // Reset connection state
  disconnectedSince = null;
  participantStates.clear();
  lastParticipantHeartbeats.clear();
  participantFinished.clear();
  setConnectionStatus('reconnecting');

  // Drop presence entirely — just use broadcast for everything
  channel = supabase.channel(`live:${sessionId}`);

  // --- Broadcast: state updates ---
  channel.on('broadcast', { event: 'state_update' }, ({ payload }) => {
    if (payload && payload.userId !== currentUserId) {
      const userId = payload.userId as string;
      participantStates.set(userId, payload as LiveUserState);
      lastParticipantHeartbeats.set(userId, Date.now());
      disconnectedSince = null;
      if (currentSession && currentSession.status === 'pending') {
        currentSession = { ...currentSession, status: 'active' };
      }
      setConnectionStatus('connected');
      notifyStateListeners();
    }
  });

  // --- Broadcast: heartbeat (keeps connection alive, carries latest state) ---
  channel.on('broadcast', { event: 'heartbeat' }, ({ payload }) => {
    if (payload && payload.userId !== currentUserId) {
      const userId = payload.userId as string;
      lastParticipantHeartbeats.set(userId, Date.now());
      disconnectedSince = null;
      if (currentSession && currentSession.status === 'pending') {
        currentSession = { ...currentSession, status: 'active' };
      }
      // Heartbeat carries full state — update participantStates
      if (payload.state) {
        participantStates.set(userId, payload.state as LiveUserState);
      }
      setConnectionStatus('connected');
      notifyStateListeners();
    }
  });

  channel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
    if (payload && payload.fromUserId !== currentUserId) {
      notifyReactionListeners(payload as LiveReaction);
    }
  });

  channel.on('broadcast', { event: 'session_event' }, ({ payload }) => {
    const eventName = payload?.event;
    const eventUserId = payload?.userId;

    // Handle participant_finished (and legacy buddy_finished)
    if (eventName === 'participant_finished' || eventName === 'buddy_finished') {
      if (eventUserId) {
        participantFinished.set(eventUserId, true);
      }
      // Keep connection as 'connected' — don't let reconnect checker override
      setConnectionStatus('connected');
      if (eventUserId && participantStates.has(eventUserId)) {
        const state = participantStates.get(eventUserId)!;
        participantStates.set(eventUserId, { ...state, status: 'paused' });
      }
      notifyStateListeners();
      sessionEventListeners.forEach(cb => cb('participant_finished', eventUserId));
    }

    // Handle participant_left (and legacy buddy_left)
    if (eventName === 'participant_left' || eventName === 'buddy_left') {
      if (eventUserId) {
        // Stop tracking heartbeats — they're gone
        lastParticipantHeartbeats.delete(eventUserId);

        if (participantFinished.get(eventUserId)) {
          // Already finished their workout — keep their state visible as "finished"
          // so their buddy card stays in the UI with their summary
          if (participantStates.has(eventUserId)) {
            const state = participantStates.get(eventUserId)!;
            participantStates.set(eventUserId, { ...state, status: 'paused' });
          }
        } else {
          // Left without finishing — remove them entirely
          participantStates.delete(eventUserId);
          participantFinished.delete(eventUserId);
        }
      }
      // Check if all participants are gone
      if (participantStates.size === 0) {
        setConnectionStatus('disconnected');
      }
      notifySessionListeners();
      notifyStateListeners();
      sessionEventListeners.forEach(cb => cb('participant_left', eventUserId));
    }

    // Handle leadership transfer
    if (eventName === 'leader_changed' && payload?.newLeaderId) {
      if (currentSession) {
        currentSession = { ...currentSession, leaderId: payload.newLeaderId };
      }
      notifySessionListeners();
      sessionEventListeners.forEach(cb => cb('leader_changed', payload.newLeaderId));
    }

    // Handle participant kicked
    if (eventName === 'participant_kicked' && payload?.userId) {
      if (payload.userId === currentUserId) {
        // We were kicked — clean up locally
        cleanup();
        sessionEventListeners.forEach(cb => cb('kicked', payload.userId));
      } else {
        // Someone else was kicked — remove them
        participantStates.delete(payload.userId);
        lastParticipantHeartbeats.delete(payload.userId);
        participantFinished.delete(payload.userId);
        if (participantStates.size === 0) {
          setConnectionStatus('disconnected');
        }
        notifyStateListeners();
        sessionEventListeners.forEach(cb => cb('participant_kicked', payload.userId));
      }
    }
  });

  // --- Broadcast: sync events (buddy workout sync) ---
  channel.on('broadcast', { event: 'set_completed' }, ({ payload }) => {
    if (payload && payload.userId !== currentUserId) {
      syncEventListeners.forEach(cb => cb('set_completed', payload));
    }
  });

  channel.on('broadcast', { event: 'sync_rest_start' }, ({ payload }) => {
    if (payload && payload.userId !== currentUserId) {
      syncEventListeners.forEach(cb => cb('sync_rest_start', payload));
    }
  });

  channel.on('broadcast', { event: 'exercise_advanced' }, ({ payload }) => {
    if (payload && payload.userId !== currentUserId) {
      syncEventListeners.forEach(cb => cb('exercise_advanced', payload));
    }
  });

  await channel.subscribe((status) => {
    console.log('[LiveSession] channel status:', status);
  });

  // Register background heartbeat so the session survives app backgrounding
  if (currentUserId) {
    registerBackgroundHeartbeat(sessionId, currentUserId);
  }

  // Send heartbeat every 3s — carries full state so late joiners get it immediately
  let heartbeatCount = 0;
  const sendHeartbeat = () => {
    if (channel) {
      channel.send({ type: 'broadcast', event: 'heartbeat', payload: { userId: currentUserId, state: myState } });
    }
    // Also refresh DB heartbeat every ~60s while in foreground (every 20th WS heartbeat)
    heartbeatCount++;
    if (heartbeatCount % 20 === 0 && currentUserId && currentSession) {
      registerBackgroundHeartbeat(currentSession.sessionId, currentUserId);
    }
  };
  sendHeartbeat();
  heartbeatInterval = setInterval(sendHeartbeat, 3000);

  // Check all participants' heartbeats every 5s
  reconnectCheckInterval = setInterval(async () => {
    if (participantStates.size === 0 && lastParticipantHeartbeats.size === 0) return; // no participants yet

    let anyActive = false;
    let anyStale = false;

    for (const [userId, lastHb] of lastParticipantHeartbeats) {
      if (participantFinished.get(userId)) continue; // finished — no heartbeat expected
      const elapsed = Date.now() - lastHb;

      // If WebSocket heartbeat is stale, check DB heartbeat as fallback
      if (elapsed > 30000 && currentSession) {
        const dbHb = await checkParticipantDbHeartbeat(currentSession.sessionId, userId);
        if (dbHb) {
          const dbElapsed = Date.now() - dbHb.getTime();
          if (dbElapsed < 10 * 60 * 1000) {
            // DB heartbeat is recent — participant is still alive (app backgrounded)
            // 10 min window accounts for iOS delaying background fetch beyond the 2 min minimum
            anyActive = true;
            continue;
          }
        }
      }

      if (elapsed > 60 * 60 * 1000) {
        // Participant gone for 60min — remove them
        participantStates.delete(userId);
        lastParticipantHeartbeats.delete(userId);
        participantFinished.delete(userId);
      } else if (elapsed > 3 * 60 * 1000) {
        anyStale = true;
      } else {
        anyActive = true;
      }
    }

    if (participantStates.size === 0 && lastParticipantHeartbeats.size === 0) {
      setConnectionStatus('disconnected');
      // All participants removed — mark session complete in DB
      if (currentSession) {
        markSessionCompleteIfEmpty(currentSession.sessionId);
      }
    } else if (anyStale && !anyActive && connectionStatus === 'connected') {
      disconnectedSince = disconnectedSince || Date.now();
      console.log('[LiveSession] participants stale → reconnecting');
      setConnectionStatus('reconnecting');
    } else if (anyActive) {
      setConnectionStatus('connected');
    }
    notifyStateListeners();
  }, 5000);
}

export async function updateMyLiveState(updates: Partial<LiveUserState>): Promise<void> {
  if (!myState) {
    myState = {
      userId: currentUserId || '',
      username: '',
      status: 'lifting',
      currentExercise: null,
      currentSetIndex: 0,
      totalSetsInExercise: 0,
      currentSetWeight: 0,
      currentSetReps: 0,
      lastSetWeight: 0,
      lastSetReps: 0,
      totalVolume: 0,
      setsCompleted: 0,
      completedSetsInExercise: 0,
      exerciseCount: 0,
      exerciseSummary: [],
      workoutDuration: 0,
      lastUpdated: new Date().toISOString(),
      ...updates,
    };
  } else {
    myState = { ...myState, ...updates, lastUpdated: new Date().toISOString() };
  }

  notifyStateListeners();

  // Send state via broadcast + heartbeat so participants get it immediately
  if (channel) {
    channel.send({
      type: 'broadcast',
      event: 'state_update',
      payload: myState,
    });
    // Also send as heartbeat so late joiners pick it up
    channel.send({
      type: 'broadcast',
      event: 'heartbeat',
      payload: { userId: currentUserId, state: myState },
    });
  }
}

export function sendReaction(type: LiveReactionType, targetUserId?: string): void {
  if (!channel || !currentUserId) return;
  channel.send({
    type: 'broadcast',
    event: 'reaction',
    payload: {
      fromUserId: currentUserId,
      type,
      timestamp: Date.now(),
      ...(targetUserId ? { targetUserId } : {}),
    },
  });
}

/**
 * Submit your workout summary and notify participants.
 * Returns true if all participants have finished (session complete).
 * Returns false if waiting for others — channel stays alive.
 */
export async function endSession(summary?: { totalVolume: number; setsCompleted: number; exerciseNames: string[]; username?: string }): Promise<boolean> {
  if (!currentSession) return true;

  const { sessionId, hostId, participantIds } = currentSession;
  const isHost = currentUserId === hostId;

  if (summary) {
    // Write to participant_summaries JSONB
    const prefetch = await getLiveSession(sessionId);
    const existingSummaries = (prefetch.success && prefetch.data?.participant_summaries) || {};
    const updatedSummaries = { ...existingSummaries, [currentUserId!]: summary };

    const updates: Record<string, any> = {
      participant_summaries: updatedSummaries,
    };
    // Backwards compat: write host_summary/buddy_summary only for 1-on-1 sessions
    const isTwoPerson = participantIds.length <= 1;
    if (isTwoPerson) {
      const summaryField = isHost ? 'host_summary' : 'buddy_summary';
      updates[summaryField] = summary;
    } else if (isHost) {
      updates.host_summary = summary;
    }

    await updateLiveSessionStatus(sessionId, currentSession.status, updates);
  }

  // Notify all participants that we finished
  if (channel) {
    channel.send({
      type: 'broadcast',
      event: 'session_event',
      payload: { event: 'participant_finished', userId: currentUserId },
    });
  }

  // Re-read session (after our summary write) to check if all are done
  const sessionResult = await getLiveSession(sessionId);
  if (sessionResult.success && sessionResult.data) {
    const data = sessionResult.data;
    const allUserIds = [...new Set([data.host_id, ...(data.participant_ids || [])])];
    const summaries = data.participant_summaries || {};

    // Only consider users who are: (a) us, (b) still connected, or (c) have a summary
    // Users who left without finishing should not block completion
    const activeUserIds = allUserIds.filter(uid =>
      uid === currentUserId ||
      participantStates.has(uid) ||
      summaries[uid] != null ||
      (uid === data.host_id && data.host_summary) ||
      (uid === data.buddy_id && data.buddy_summary)
    );

    const allDone = activeUserIds.every(uid =>
      summaries[uid] != null ||
      (uid === data.host_id && data.host_summary) ||
      (uid === data.buddy_id && data.buddy_summary)
    );

    if (allDone) {
      await updateLiveSessionStatus(sessionId, 'completed', {
        ended_at: new Date().toISOString(),
      });
      cleanup();
      return true;
    }
  }

  // Others haven't finished — keep channel alive so we can receive their finish event
  return false;
}

/**
 * Force end the session for this user. Notifies participants then cleans up locally.
 */
export async function forceEndSession(): Promise<void> {
  const sessionId = currentSession?.sessionId;
  if (channel) {
    channel.send({
      type: 'broadcast',
      event: 'session_event',
      payload: { event: 'participant_left', userId: currentUserId },
    });
    // Give the broadcast time to flush before tearing down the channel
    await new Promise(r => setTimeout(r, 300));
  }
  cleanup();
  if (sessionId) await markSessionCompleteIfEmpty(sessionId);
}

/**
 * Cancel a live session (host only). Sets status to 'cancelled' so pending
 * invitees won't see the invite when they come online.
 */
export async function cancelSession(): Promise<void> {
  if (!currentSession) return;
  const sessionId = currentSession.sessionId;

  if (channel) {
    channel.send({
      type: 'broadcast',
      event: 'session_event',
      payload: { event: 'participant_left', userId: currentUserId },
    });
    await new Promise(r => setTimeout(r, 300));
  }

  await updateLiveSessionStatus(sessionId, 'cancelled', { ended_at: new Date().toISOString() });
  cleanup();
}

/**
 * Leave a live session without ending it for others.
 * If the current user is the leader, auto-transfers leadership to a random participant.
 * Notifies participants that we left, then cleans up locally.
 */
export async function leaveSession(): Promise<void> {
  if (!currentSession) return;
  const sessionId = currentSession.sessionId;

  // Auto-transfer leadership if we're the leader and others are still active
  if (currentUserId === currentSession.leaderId && participantStates.size > 0) {
    const remainingIds = Array.from(participantStates.keys());
    const newLeaderId = remainingIds[Math.floor(Math.random() * remainingIds.length)];
    await transferSessionLeadership(sessionId, newLeaderId);
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'session_event',
        payload: { event: 'leader_changed', newLeaderId },
      });
    }
  }

  // Remove ourselves from participant_ids in DB
  if (currentUserId) {
    await removeParticipantFromSession(sessionId, currentUserId);
  }

  // Notify participants that we left
  if (channel) {
    channel.send({
      type: 'broadcast',
      event: 'session_event',
      payload: { event: 'participant_left', userId: currentUserId },
    });
    await new Promise(r => setTimeout(r, 300));
  }

  cleanup();
  await markSessionCompleteIfEmpty(sessionId);
}

export async function declineInvite(sessionId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  const sessionResult = await getLiveSession(sessionId);
  if (!sessionResult.success || !sessionResult.data) return;

  const session = sessionResult.data;
  const allParticipants = [...new Set([session.host_id, ...(session.participant_ids || [])])];

  // Only cancel the entire session if this was a 1-on-1 invite (host + this user only)
  // For group sessions, just remove ourselves from participant_ids
  if (allParticipants.length <= 2 && session.status === 'pending') {
    await updateLiveSessionStatus(sessionId, 'cancelled');
  } else if (user) {
    await removeParticipantFromSession(sessionId, user.id);
  }

  // Notify host
  if (user) {
    const myProfileResult = await getMyProfile();
    const myName = (myProfileResult.success && myProfileResult.data?.username) || user.email || 'Buddy';
    await createNotification(session.host_id, 'live_accepted', 'Invite Declined',
      `${myName} declined the live workout invite.`,
      { session_id: sessionId, declined_by: user.id, decliner_name: myName });
  }
}

/**
 * Reconnect to a live session after app restart. Fetches the session from DB,
 * verifies it's still active, restores module state, and re-joins the channel.
 * Returns the session info if successful, null if session is gone/completed.
 */
export async function reconnectToSession(sessionId: string): Promise<LiveSessionInfo | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const result = await getLiveSession(sessionId);
  if (!result.success || !result.data) return null;

  const s = result.data;
  // Only reconnect if session is still pending or active
  if (s.status !== 'pending' && s.status !== 'active') return null;

  currentUserId = user.id;
  currentSession = {
    sessionId: s.id,
    hostId: s.host_id,
    leaderId: s.leader_id || s.host_id,
    buddyId: s.buddy_id,
    participantIds: s.participant_ids || [],
    inviteCode: s.invite_code || undefined,
    maxParticipants: s.max_participants || 10,
    status: s.status,
    routineData: s.routine_data && s.sync_mode ? {
      routineName: s.routine_name || 'Routine',
      exercises: s.routine_data,
      syncMode: s.sync_mode as BuddySyncMode,
    } : null,
  };

  notifySessionListeners();
  await joinSessionChannel(sessionId);
  return currentSession;
}

export async function getSessionSummary(sessionId: string): Promise<LiveSessionSummary | null> {
  const result = await getLiveSession(sessionId);
  if (!result.success || !result.data) return null;

  const session = result.data;
  const startedAt = session.started_at ? new Date(session.started_at).getTime() : 0;
  const endedAt = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
  const timeTogether = Math.floor((endedAt - startedAt) / 1000);

  // Build participants array from participant_summaries
  const participantSummaries = session.participant_summaries || {};
  const participants: ParticipantSummary[] = Object.entries(participantSummaries).map(([userId, data]: [string, any]) => ({
    userId,
    username: data.username || 'Unknown',
    totalVolume: data.totalVolume || 0,
    setsCompleted: data.setsCompleted || 0,
    exerciseNames: data.exerciseNames || [],
  }));

  // Backwards compat: build host/buddy from old fields or from participant_summaries
  const hostSummary = session.host_summary || participantSummaries[session.host_id];
  const buddyId = session.buddy_id || (session.participant_ids || [])[0];
  const buddySummary = session.buddy_summary || (buddyId ? participantSummaries[buddyId] : null);

  if (!hostSummary && participants.length < 2) return null;

  return {
    timeTogether,
    host: hostSummary || { username: 'Host', totalVolume: 0, setsCompleted: 0, exerciseNames: [] },
    buddy: buddySummary || { username: 'Buddy', totalVolume: 0, setsCompleted: 0, exerciseNames: [] },
    participants: participants.length > 0 ? participants : undefined,
  };
}

/**
 * Check if all participants have left or finished, and mark the session completed if so.
 */
async function markSessionCompleteIfEmpty(sessionId: string): Promise<void> {
  try {
    const result = await getLiveSession(sessionId);
    if (!result.success || !result.data) return;
    const session = result.data;

    // Already completed/cancelled — nothing to do
    if (session.status === 'completed' || session.status === 'cancelled') return;

    // Check the realtime channel for remaining subscribers
    // Since we can't query that, check if all participants have summaries (finished)
    // or if there are no active heartbeats in the DB
    const allUserIds = [...new Set([session.host_id, ...(session.participant_ids || [])])];
    const summaries = session.participant_summaries || {};
    const heartbeats = session.participant_heartbeats || {};

    // Everyone has a summary → completed
    const allFinished = allUserIds.every(uid => summaries[uid] != null);
    if (allFinished) {
      await updateLiveSessionStatus(sessionId, 'completed', { ended_at: new Date().toISOString() });
      return;
    }

    // Check if all DB heartbeats are stale (>5 min old) — everyone has left
    const now = Date.now();
    const allStale = allUserIds.every(uid => {
      const hb = heartbeats[uid];
      if (!hb) return true; // no heartbeat recorded — never active or already gone
      return (now - new Date(hb).getTime()) > 5 * 60 * 1000;
    });

    if (allStale) {
      await updateLiveSessionStatus(sessionId, 'completed', { ended_at: new Date().toISOString() });
    }
  } catch (e) {
    console.warn('[LiveSession] markSessionCompleteIfEmpty error:', e);
  }
}

function cleanup() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  if (reconnectCheckInterval) { clearInterval(reconnectCheckInterval); reconnectCheckInterval = null; }
  if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
  if (leaveDebounceTimer) { clearTimeout(leaveDebounceTimer); leaveDebounceTimer = null; }
  unregisterBackgroundHeartbeat();
  currentSession = null;
  myState = null;
  participantStates.clear();
  lastParticipantHeartbeats.clear();
  participantFinished.clear();
  disconnectedSince = null;
  setConnectionStatus('disconnected');
  notifySessionListeners();
  notifyStateListeners();
}

// ============================================================
// Leader Functions
// ============================================================

export async function kickParticipant(userId: string): Promise<void> {
  if (!currentSession || currentUserId !== currentSession.leaderId) return;
  const sessionId = currentSession.sessionId;

  await removeParticipantFromSession(sessionId, userId);

  if (channel) {
    channel.send({
      type: 'broadcast',
      event: 'session_event',
      payload: { event: 'participant_kicked', userId, byUserId: currentUserId },
    });
  }

  participantStates.delete(userId);
  lastParticipantHeartbeats.delete(userId);
  participantFinished.delete(userId);
  if (participantStates.size === 0) {
    setConnectionStatus('disconnected');
  }
  notifyStateListeners();
}

export async function transferLeadership(newLeaderId: string): Promise<void> {
  if (!currentSession || currentUserId !== currentSession.leaderId) return;

  await transferSessionLeadership(currentSession.sessionId, newLeaderId);
  currentSession = { ...currentSession, leaderId: newLeaderId };

  if (channel) {
    channel.send({
      type: 'broadcast',
      event: 'session_event',
      payload: { event: 'leader_changed', newLeaderId },
    });
  }

  notifySessionListeners();
}

export function isCurrentUserLeader(): boolean {
  return currentUserId != null && currentUserId === currentSession?.leaderId;
}

// ============================================================
// Subscriptions (same pattern as presenceManager.ts)
// ============================================================

export function subscribeToLiveState(callback: (my: LiveUserState | null, participants: Map<string, LiveUserState>) => void): () => void {
  stateListeners.add(callback);
  return () => { stateListeners.delete(callback); };
}

export function subscribeToReactions(callback: (reaction: LiveReaction) => void): () => void {
  reactionListeners.add(callback);
  return () => { reactionListeners.delete(callback); };
}

export function subscribeToSession(callback: (session: LiveSessionInfo | null) => void): () => void {
  sessionListeners.add(callback);
  return () => { sessionListeners.delete(callback); };
}

export function subscribeToSessionEvents(callback: (event: string, userId?: string) => void): () => void {
  sessionEventListeners.add(callback);
  return () => { sessionEventListeners.delete(callback); };
}

export function subscribeToConnectionStatus(callback: (status: ConnectionStatus) => void): () => void {
  connectionListeners.add(callback);
  return () => { connectionListeners.delete(callback); };
}

// ============================================================
// Getters
// ============================================================

export function getCurrentSession(): LiveSessionInfo | null {
  return currentSession;
}

export function getParticipantStates(): Map<string, LiveUserState> {
  return participantStates;
}

export function getParticipantFinished(): Map<string, boolean> {
  return participantFinished;
}

export function getConnectionStatus(): ConnectionStatus {
  return connectionStatus;
}

// Backwards compat helper — returns first participant's state (for 1-on-1)
export function getBuddyState(): LiveUserState | null {
  if (participantStates.size === 0) return null;
  return participantStates.values().next().value ?? null;
}

// ============================================================
// Sync Event Helpers (used by buddyWorkoutSync.ts)
// ============================================================

export function subscribeToSyncEvents(callback: (event: string, payload: any) => void): () => void {
  syncEventListeners.add(callback);
  return () => { syncEventListeners.delete(callback); };
}

export function broadcastSyncEvent(event: string, payload: any): void {
  if (channel) {
    channel.send({ type: 'broadcast', event, payload });
  }
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function getParticipantCount(): number {
  return participantStates.size;
}
