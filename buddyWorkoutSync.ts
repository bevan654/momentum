import {
  subscribeToSyncEvents,
  broadcastSyncEvent,
  getCurrentUserId,
  getParticipantCount,
  type BuddySyncMode,
} from './liveSessionManager';

// ============================================================
// Types
// ============================================================

export interface BuddySyncState {
  isActive: boolean;
  syncMode: BuddySyncMode | null;
  routineExercises: { name: string; sets: number }[];
  myExerciseIndex: number;
  mySetIndex: number;
  // Backwards compat: first participant's progress
  buddyExerciseIndex: number;
  buddySetIndex: number;
  waitingForBuddy: boolean;
  buddyWaitingForMe: boolean;
  totalExercises: number;
  // Multi-participant progress
  participantProgress: Map<string, { exerciseIndex: number; setIndex: number; setDone: boolean }>;
}

interface SyncCallbacks {
  onStartSyncedRest: (duration: number) => void;
  onAdvanceExercise: (exerciseIndex: number) => void;
  onSyncStateChanged: () => void;
}

// ============================================================
// Module State (singleton)
// ============================================================

let syncMode: BuddySyncMode | null = null;
let routineExercises: { name: string; sets: number }[] = [];
let myExerciseIndex = 0;
let mySetIndex = 0;
let mySetDone = false;
// Per-participant tracking
let participantSetDone: Map<string, boolean> = new Map();
let participantExerciseIndex: Map<string, number> = new Map();
let participantSetIndex: Map<string, number> = new Map();

let callbacks: SyncCallbacks | null = null;
let unsubSyncEvents: (() => void) | null = null;
let syncTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

const SYNC_TIMEOUT_MS = 60_000; // 60s timeout for strict mode

const listeners = new Set<(state: BuddySyncState) => void>();

// ============================================================
// Internal
// ============================================================

function notifyListeners() {
  const state = getBuddySyncState();
  listeners.forEach(cb => cb(state));
  callbacks?.onSyncStateChanged();
}

function handleSyncEvent(event: string, payload: any) {
  const userId = payload?.userId;

  if (event === 'set_completed') {
    if (userId) {
      participantExerciseIndex.set(userId, payload.exerciseIdx ?? (participantExerciseIndex.get(userId) || 0));
      participantSetIndex.set(userId, payload.setIdx ?? (participantSetIndex.get(userId) || 0));
      participantSetDone.set(userId, true);
    }

    if (syncMode === 'strict' && mySetDone) {
      // Check if ALL participants have completed their set
      const allDone = Array.from(participantSetDone.values()).every(d => d);
      if (allDone) {
        triggerSyncedRest();
      } else {
        notifyListeners();
      }
    } else {
      notifyListeners();
    }
  }

  if (event === 'sync_rest_start') {
    // Rest already handled by the triggerSyncedRest call on our side
  }

  if (event === 'exercise_advanced') {
    if (userId) {
      participantExerciseIndex.set(userId, payload.exerciseIdx ?? (participantExerciseIndex.get(userId) || 0));
      participantSetIndex.set(userId, 0);
      participantSetDone.set(userId, false);
    }
    notifyListeners();
  }
}

function triggerSyncedRest() {
  if (syncTimeoutTimer) { clearTimeout(syncTimeoutTimer); syncTimeoutTimer = null; }

  const duration = 180; // default rest duration — App.tsx can override
  broadcastSyncEvent('sync_rest_start', {
    userId: getCurrentUserId(),
    startedAt: Date.now(),
    duration,
  });

  mySetDone = false;
  for (const key of participantSetDone.keys()) {
    participantSetDone.set(key, false);
  }
  notifyListeners();
  callbacks?.onStartSyncedRest(duration);
}

function startSyncTimeout() {
  if (syncTimeoutTimer) clearTimeout(syncTimeoutTimer);
  syncTimeoutTimer = setTimeout(() => {
    if (mySetDone) {
      const anyNotDone = Array.from(participantSetDone.values()).some(d => !d);
      if (anyNotDone) {
        // Participant(s) timed out — start rest anyway
        console.log('[BuddySync] Timeout — starting rest without all participants');
        triggerSyncedRest();
      }
    }
  }, SYNC_TIMEOUT_MS);
}

// ============================================================
// Public API
// ============================================================

export function initBuddySync(
  exercises: { name: string; sets: number }[],
  mode: BuddySyncMode,
  cbs: SyncCallbacks,
): void {
  cleanupBuddySync();

  // Force soft sync for groups (> 2 participants including host)
  const participantCount = getParticipantCount();
  syncMode = participantCount > 1 ? 'soft' : mode;

  routineExercises = exercises;
  callbacks = cbs;
  myExerciseIndex = 0;
  mySetIndex = 0;
  mySetDone = false;
  participantSetDone.clear();
  participantExerciseIndex.clear();
  participantSetIndex.clear();

  unsubSyncEvents = subscribeToSyncEvents(handleSyncEvent);
  notifyListeners();
}

export function joinBuddySync(
  exercises: { name: string; sets: number }[],
  mode: BuddySyncMode,
  cbs: SyncCallbacks,
): void {
  // Same as init — buddy side
  initBuddySync(exercises, mode, cbs);
}

export function onLocalSetCompleted(exerciseIdx: number, setIdx: number): void {
  if (!syncMode) return;

  myExerciseIndex = exerciseIdx;
  mySetIndex = setIdx;

  if (syncMode === 'strict') {
    mySetDone = true;

    broadcastSyncEvent('set_completed', {
      userId: getCurrentUserId(),
      exerciseIdx,
      setIdx,
    });

    const allParticipantsDone = participantSetDone.size > 0 && Array.from(participantSetDone.values()).every(d => d);
    if (allParticipantsDone) {
      // All done — start rest
      triggerSyncedRest();
    } else {
      // Wait for others
      startSyncTimeout();
      notifyListeners();
    }
  } else {
    // Soft mode — broadcast position so others can track progress
    broadcastSyncEvent('set_completed', {
      userId: getCurrentUserId(),
      exerciseIdx,
      setIdx,
    });
    notifyListeners();
  }
}

export function onLocalExerciseDone(exerciseIdx: number): void {
  if (!syncMode) return;

  const nextIdx = exerciseIdx + 1;
  if (nextIdx < routineExercises.length) {
    myExerciseIndex = nextIdx;
    mySetIndex = 0;
    mySetDone = false;
    for (const key of participantSetDone.keys()) {
      participantSetDone.set(key, false);
    }

    broadcastSyncEvent('exercise_advanced', {
      userId: getCurrentUserId(),
      exerciseIdx: nextIdx,
    });

    callbacks?.onAdvanceExercise(nextIdx);
    notifyListeners();
  }
}

export function getBuddySyncState(): BuddySyncState {
  // First participant values for backwards compat
  const firstUserId = participantExerciseIndex.keys().next().value;
  const buddyExIdx = firstUserId ? (participantExerciseIndex.get(firstUserId) || 0) : 0;
  const buddySetIdx = firstUserId ? (participantSetIndex.get(firstUserId) || 0) : 0;
  const firstBuddyDone = firstUserId ? (participantSetDone.get(firstUserId) || false) : false;

  const anyParticipantNotDone = participantSetDone.size > 0 && Array.from(participantSetDone.values()).some(d => !d);
  const anyParticipantDone = participantSetDone.size > 0 && Array.from(participantSetDone.values()).some(d => d);

  return {
    isActive: syncMode !== null,
    syncMode,
    routineExercises,
    myExerciseIndex,
    mySetIndex,
    buddyExerciseIndex: buddyExIdx,
    buddySetIndex: buddySetIdx,
    waitingForBuddy: syncMode === 'strict' && mySetDone && anyParticipantNotDone,
    buddyWaitingForMe: syncMode === 'strict' && anyParticipantDone && !mySetDone,
    totalExercises: routineExercises.length,
    participantProgress: new Map(
      Array.from(participantExerciseIndex.entries()).map(([uid, exIdx]) => [
        uid,
        {
          exerciseIndex: exIdx,
          setIndex: participantSetIndex.get(uid) || 0,
          setDone: participantSetDone.get(uid) || false,
        },
      ])
    ),
  };
}

export function isBuddySyncActive(): boolean {
  return syncMode !== null;
}

export function subscribeToBuddySync(cb: (state: BuddySyncState) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function cleanupBuddySync(): void {
  if (unsubSyncEvents) { unsubSyncEvents(); unsubSyncEvents = null; }
  if (syncTimeoutTimer) { clearTimeout(syncTimeoutTimer); syncTimeoutTimer = null; }
  syncMode = null;
  routineExercises = [];
  myExerciseIndex = 0;
  mySetIndex = 0;
  mySetDone = false;
  participantSetDone.clear();
  participantExerciseIndex.clear();
  participantSetIndex.clear();
  callbacks = null;
  notifyListeners();
}
