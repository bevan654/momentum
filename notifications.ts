import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

let restTimerNotificationId: string | null = null;
let lastTokenRegistration = 0;
const TOKEN_REGISTER_COOLDOWN = 30_000; // 30 seconds

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    // Always show social notifications in foreground; suppress rest timer (the app UI handles it)
    const isRestTimer = data?.type === 'rest_timer';
    return {
      shouldShowAlert: !isRestTimer,
      shouldPlaySound: !isRestTimer,
      shouldSetBadge: false,
      shouldShowBanner: !isRestTimer,
      shouldShowList: !isRestTimer,
    };
  },
});

export async function initNotifications(): Promise<boolean> {
  if (!Device.isDevice) {
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  // Android notification channels
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('social', {
      name: 'Social',
      description: 'Friend requests, reactions, live workout invites',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }

  return true;
}

export async function scheduleRestTimerNotification(seconds: number): Promise<void> {
  await cancelRestTimerNotification();

  try {
    restTimerNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest Complete!',
        body: 'Time for your next set.',
        data: { type: 'rest_timer' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
      },
    });
  } catch (error) {
    console.error('Error scheduling rest timer notification:', error);
  }
}

export async function cancelRestTimerNotification(): Promise<void> {
  if (restTimerNotificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(restTimerNotificationId);
    } catch {
      // Already fired or cancelled
    }
    restTimerNotificationId = null;
  }
}

export async function showSocialNotification(title: string, body: string, data: Record<string, any> = {}): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'social', ...data },
        sound: 'default',
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.error('Error showing social notification:', error);
  }
}

export async function registerPushToken(userId: string): Promise<void> {
  // Debounce — avoid redundant writes from overlapping callers
  if (Date.now() - lastTokenRegistration < TOKEN_REGISTER_COOLDOWN) return;

  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: '9aa3909a-d1ee-4fbd-ba1a-520512f75d7f',
      });

      if (!token?.data) return;

      // Update token — use .select() to detect if the profile row exists yet
      const { data, error } = await supabase
        .from('profiles')
        .update({ push_token: token.data })
        .eq('id', userId)
        .select('id');

      if (error) {
        throw new Error(`Supabase update failed: ${error.message}`);
      }
      if (!data || data.length === 0) {
        // Profile row doesn't exist yet (signup trigger hasn't completed) — retry
        throw new Error('Profile not found — may not be created yet');
      }

      lastTokenRegistration = Date.now();
      console.log('[Push] Token registered:', token.data.substring(0, 30) + '...');
      return; // Success — exit retry loop
    } catch (error) {
      console.warn(`[Push] Token registration attempt ${attempt}/${MAX_RETRIES} failed:`, error);
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 2s, 4s
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }
}

export async function clearPushToken(userId: string): Promise<void> {
  try {
    await supabase
      .from('profiles')
      .update({ push_token: null })
      .eq('id', userId);
  } catch (error) {
    console.warn('[Push] Failed to clear token:', error);
  }
}

