import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TASK_NAME = 'LIVE_SESSION_HEARTBEAT';
const STORAGE_KEY = 'live_session_bg_heartbeat';

// Define the background task at module level (required by expo-task-manager)
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return BackgroundFetch.BackgroundFetchResult.NoData;

    const { sessionId, userId } = JSON.parse(stored);
    if (!sessionId || !userId) return BackgroundFetch.BackgroundFetchResult.NoData;

    // Write heartbeat timestamp to the participant_heartbeats JSONB column
    const { data: session } = await supabase
      .from('live_sessions')
      .select('participant_heartbeats')
      .eq('id', sessionId)
      .single();

    const heartbeats = session?.participant_heartbeats || {};
    heartbeats[userId] = new Date().toISOString();

    await supabase
      .from('live_sessions')
      .update({ participant_heartbeats: heartbeats })
      .eq('id', sessionId);

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (e) {
    console.warn('[BGHeartbeat] error:', e);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register the background heartbeat task for a live session.
 * Call this when joining/creating a session.
 */
export async function registerBackgroundHeartbeat(sessionId: string, userId: string): Promise<void> {
  try {
    // Store session info for the background task
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, userId }));

    // Write an immediate DB heartbeat so there's no gap before the first BG fetch
    const { data: session } = await supabase
      .from('live_sessions')
      .select('participant_heartbeats')
      .eq('id', sessionId)
      .single();

    const heartbeats = session?.participant_heartbeats || {};
    heartbeats[userId] = new Date().toISOString();
    await supabase
      .from('live_sessions')
      .update({ participant_heartbeats: heartbeats })
      .eq('id', sessionId);

    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
      console.warn('[BGHeartbeat] Background fetch denied by OS');
      return;
    }

    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 120, // 2 minutes (iOS may enforce longer)
      stopOnTerminate: false,
      startOnBoot: false,
    });

    console.log('[BGHeartbeat] registered for session', sessionId);
  } catch (e) {
    console.warn('[BGHeartbeat] registration failed:', e);
  }
}

/**
 * Unregister the background heartbeat task.
 * Call this when leaving/ending a session.
 */
export async function unregisterBackgroundHeartbeat(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
    }
    console.log('[BGHeartbeat] unregistered');
  } catch (e) {
    console.warn('[BGHeartbeat] unregister failed:', e);
  }
}

/**
 * Check the DB heartbeat for a participant. Returns the timestamp or null.
 * Use this as a fallback when WebSocket heartbeats are stale.
 */
export async function checkParticipantDbHeartbeat(sessionId: string, userId: string): Promise<Date | null> {
  try {
    const { data } = await supabase
      .from('live_sessions')
      .select('participant_heartbeats')
      .eq('id', sessionId)
      .single();

    const heartbeats = data?.participant_heartbeats;
    if (heartbeats && heartbeats[userId]) {
      return new Date(heartbeats[userId]);
    }
    return null;
  } catch {
    return null;
  }
}
