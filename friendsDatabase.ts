import { supabase } from './supabase';
import { getGymStreak, getNutritionStreak, getCombinedStreak } from './streakDatabase';

// ============================================================
// Types
// ============================================================

export interface Profile {
  id: string;
  email: string;
  username?: string;
  share_workouts: boolean;
  show_streak: boolean;
  notifications_enabled: boolean;
  leaderboard_opt_in: boolean;
  starting_weight?: number | null;
  is_locked?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked' | 'removed';
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface ActivityEntry {
  id: string;
  user_id: string;
  workout_id: string;
  duration: number;
  total_volume: number;
  exercise_names: string[];
  total_exercises: number;
  total_sets: number;
  created_at: string;
  profile?: Profile;
  reactions?: Reaction[];
}

export interface Reaction {
  id: string;
  activity_id: string;
  user_id: string;
  type: 'like' | 'clap' | 'fire';
  created_at: string;
}

export interface Nudge {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  read: boolean;
  created_at: string;
  sender_profile?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'friend_request' | 'friend_accepted' | 'reaction' | 'nudge' | 'leaderboard_weekly' | 'live_invite' | 'live_accepted' | 'join_request';
  title: string;
  body: string | null;
  data: any;
  read: boolean;
  created_at: string;
}

export type LeaderboardType =
  | 'weekly_volume'
  | 'workout_streak'
  | 'nutrition_streak'
  | 'combined_streak'
  | 'total_workouts'
  | 'weekly_calories'
  | 'weekly_protein'
  | 'weekly_water'
  | 'weekly_creatine';

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  type: LeaderboardType;
  value: number;
  week_start: string;
  profile?: Profile;
}

// ============================================================
// Helper
// ============================================================

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  return `${local[0]}***@${domain}`;
}

function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

// ============================================================
// Profile Functions
// ============================================================

export async function getMyProfile() {
  try {
    const userId = await getCurrentUserId();
    const { data: { user } } = await supabase.auth.getUser();

    let { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // If profile doesn't exist yet (trigger may have failed), create it
    if (error && error.code === 'PGRST116' && user) {
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .upsert({ id: userId, email: user.email || '' })
        .select()
        .single();

      if (insertError) throw insertError;
      return { success: true, data: newProfile as Profile };
    }

    if (error) throw error;
    return { success: true, data: data as Profile };
  } catch (error) {
    console.error('Error getting profile:', error);
    return { success: false, error };
  }
}

export async function updateProfile(updates: Partial<Pick<Profile, 'share_workouts' | 'show_streak' | 'notifications_enabled' | 'leaderboard_opt_in'>>) {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data: data as Profile };
  } catch (error) {
    console.error('Error updating profile:', error);
    return { success: false, error };
  }
}

export async function updateUsername(username: string) {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('profiles')
      .update({ username, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Username is already taken' };
      }
      throw error;
    }
    return { success: true, data: data as Profile };
  } catch (error: any) {
    console.error('Error updating username:', error);
    return { success: false, error: error?.message || error };
  }
}

// ============================================================
// Friend Functions
// ============================================================

export async function searchUsersByEmail(query: string) {
  try {
    const userId = await getCurrentUserId();
    if (!query || query.length < 3) return { success: true, data: [] };

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, username')
      .or(`email.ilike.%${query}%,username.ilike.%${query}%`)
      .neq('id', userId)
      .limit(10);

    if (error) throw error;

    // Mask emails and attach friendship status
    const results = await Promise.all(
      (data || []).map(async (user: any) => {
        const status = await getFriendshipStatus(user.id);
        return {
          id: user.id,
          email: user.email,
          username: user.username || null,
          maskedEmail: maskEmail(user.email),
          friendshipStatus: status.data || null,
        };
      })
    );

    return { success: true, data: results };
  } catch (error) {
    console.error('Error searching users:', error);
    return { success: false, error };
  }
}

export async function sendFriendRequest(friendId: string) {
  try {
    const userId = await getCurrentUserId();

    // Check if friendship already exists in either direction
    const { data: existing } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
      .limit(1);

    if (existing && existing.length > 0) {
      const f = existing[0];
      if (f.status === 'accepted') return { success: false, error: 'Already friends' };
      if (f.status === 'pending') return { success: false, error: 'Request already pending' };
      if (f.status === 'blocked') return { success: false, error: 'Cannot send request' };

      // Re-use existing declined/cancelled row
      const { data, error } = await supabase
        .from('friendships')
        .update({ user_id: userId, friend_id: friendId, status: 'pending' })
        .eq('id', f.id)
        .select()
        .single();

      if (error) throw error;

      const { data: myProfile } = await supabase.from('profiles').select('email, username').eq('id', userId).single();
      const myName = myProfile?.username || myProfile?.email || 'Someone';
      await createNotification(friendId, 'friend_request', 'New Friend Request', `${myName} wants to be your friend`, { friendship_id: data.id, sender_id: userId });

      return { success: true, data };
    }

    const { data, error } = await supabase
      .from('friendships')
      .insert({ user_id: userId, friend_id: friendId, status: 'pending' })
      .select()
      .single();

    if (error) throw error;

    // Create notification for receiver
    const { data: myProfile } = await supabase.from('profiles').select('email, username').eq('id', userId).single();
    const myName = myProfile?.username || myProfile?.email || 'Someone';
    await createNotification(friendId, 'friend_request', 'New Friend Request', `${myName} wants to be your friend`, { friendship_id: data.id, sender_id: userId });

    return { success: true, data };
  } catch (error) {
    console.error('Error sending friend request:', error);
    return { success: false, error };
  }
}

export async function acceptFriendRequest(friendshipId: string) {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendshipId)
      .eq('friend_id', userId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) throw error;

    // Notify the sender
    const { data: myProfile } = await supabase.from('profiles').select('email, username').eq('id', userId).single();
    const myName = myProfile?.username || myProfile?.email || 'Someone';
    await createNotification(data.user_id, 'friend_accepted', 'Friend Request Accepted', `${myName} accepted your friend request`, { friendship_id: data.id });

    return { success: true, data };
  } catch (error) {
    console.error('Error accepting friend request:', error);
    return { success: false, error };
  }
}

export async function declineFriendRequest(friendshipId: string) {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', friendshipId)
      .eq('friend_id', userId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error declining friend request:', error);
    return { success: false, error };
  }
}

export async function cancelFriendRequest(friendshipId: string) {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error cancelling friend request:', error);
    return { success: false, error };
  }
}

export async function blockUser(targetUserId: string) {
  try {
    const userId = await getCurrentUserId();

    // Find existing friendship in either direction
    const { data: existing } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id.eq.${userId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${userId})`)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing row
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'blocked', user_id: userId, friend_id: targetUserId, updated_at: new Date().toISOString() })
        .eq('id', existing[0].id);

      if (error) throw error;
    } else {
      // Create new blocked entry
      const { error } = await supabase
        .from('friendships')
        .insert({ user_id: userId, friend_id: targetUserId, status: 'blocked' });

      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error blocking user:', error);
    return { success: false, error };
  }
}

export async function removeFriend(friendshipId: string) {
  try {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('id', friendshipId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error removing friend:', error);
    return { success: false, error };
  }
}

export async function getFriends() {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('friendships')
      .select('*, profile:profiles!friendships_friend_id_fkey(*)')
      .eq('user_id', userId)
      .eq('status', 'accepted');

    if (error) {
      // Fallback: query both directions without join
      const { data: sent, error: e1 } = await supabase
        .from('friendships')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      const { data: received, error: e2 } = await supabase
        .from('friendships')
        .select('*')
        .eq('friend_id', userId)
        .eq('status', 'accepted');

      if (e1) throw e1;
      if (e2) throw e2;

      const friendIds = [
        ...(sent || []).map((f: any) => f.friend_id),
        ...(received || []).map((f: any) => f.user_id),
      ];

      if (friendIds.length === 0) return { success: true, data: [] };

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', friendIds);

      const friends = [
        ...(sent || []).map((f: any) => ({
          ...f,
          profile: (profiles || []).find((p: any) => p.id === f.friend_id),
        })),
        ...(received || []).map((f: any) => ({
          ...f,
          profile: (profiles || []).find((p: any) => p.id === f.user_id),
        })),
      ];

      return { success: true, data: friends };
    }

    // Also get friendships where I'm the friend_id
    const { data: data2 } = await supabase
      .from('friendships')
      .select('*')
      .eq('friend_id', userId)
      .eq('status', 'accepted');

    let allFriends = [...(data || [])];

    if (data2 && data2.length > 0) {
      const otherIds = data2.map((f: any) => f.user_id);
      const { data: otherProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', otherIds);

      const mapped = data2.map((f: any) => ({
        ...f,
        profile: (otherProfiles || []).find((p: any) => p.id === f.user_id),
      }));
      allFriends = [...allFriends, ...mapped];
    }

    return { success: true, data: allFriends };
  } catch (error) {
    console.error('Error getting friends:', error);
    return { success: false, error };
  }
}

export async function getPendingRequests() {
  try {
    const userId = await getCurrentUserId();

    // Incoming requests (I'm friend_id)
    const { data: incoming, error: e1 } = await supabase
      .from('friendships')
      .select('*')
      .eq('friend_id', userId)
      .eq('status', 'pending');

    // Outgoing requests (I'm user_id)
    const { data: outgoing, error: e2 } = await supabase
      .from('friendships')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (e1) throw e1;
    if (e2) throw e2;

    // Fetch profiles for all users
    const incomingIds = (incoming || []).map((f: any) => f.user_id);
    const outgoingIds = (outgoing || []).map((f: any) => f.friend_id);
    const allIds = [...incomingIds, ...outgoingIds];

    let profiles: any[] = [];
    if (allIds.length > 0) {
      const { data: p } = await supabase.from('profiles').select('*').in('id', allIds);
      profiles = p || [];
    }

    const incomingWithProfiles = (incoming || []).map((f: any) => ({
      ...f,
      profile: profiles.find((p: any) => p.id === f.user_id),
    }));

    const outgoingWithProfiles = (outgoing || []).map((f: any) => ({
      ...f,
      profile: profiles.find((p: any) => p.id === f.friend_id),
    }));

    return { success: true, data: { incoming: incomingWithProfiles, outgoing: outgoingWithProfiles } };
  } catch (error) {
    console.error('Error getting pending requests:', error);
    return { success: false, error };
  }
}

export async function getFriendshipStatus(otherUserId: string) {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id.eq.${userId},friend_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},friend_id.eq.${userId})`)
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      return { success: true, data: data[0] };
    }
    return { success: true, data: null };
  } catch (error) {
    console.error('Error getting friendship status:', error);
    return { success: false, error };
  }
}

// ============================================================
// Activity Feed Functions
// ============================================================

export async function createActivityEntry(workoutData: {
  workout_id: string;
  duration: number;
  total_volume: number;
  exercise_names: string[];
  total_exercises: number;
  total_sets: number;
}) {
  try {
    const userId = await getCurrentUserId();

    // Check if sharing is enabled
    const { data: profile } = await supabase
      .from('profiles')
      .select('share_workouts')
      .eq('id', userId)
      .single();

    if (!profile?.share_workouts) {
      return { success: true, data: null }; // Sharing disabled, skip
    }

    const { data, error } = await supabase
      .from('activity_feed')
      .insert({
        user_id: userId,
        workout_id: workoutData.workout_id,
        duration: workoutData.duration,
        total_volume: workoutData.total_volume,
        exercise_names: workoutData.exercise_names,
        total_exercises: workoutData.total_exercises,
        total_sets: workoutData.total_sets,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating activity entry:', error);
    return { success: false, error };
  }
}

export async function getFriendsActivityFeed(page = 0, pageSize = 20) {
  try {
    const userId = await getCurrentUserId();
    const from = page * pageSize;
    const to = from + pageSize - 1;

    // Collect friend IDs from both directions
    const { data: sent } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId)
      .eq('status', 'accepted');

    const { data: received } = await supabase
      .from('friendships')
      .select('user_id')
      .eq('friend_id', userId)
      .eq('status', 'accepted');

    const friendAndSelfIds = [
      userId,
      ...(sent || []).map((f: any) => f.friend_id),
      ...(received || []).map((f: any) => f.user_id),
    ];

    const { data, error } = await supabase
      .from('activity_feed')
      .select('*')
      .in('user_id', friendAndSelfIds)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    if (!data || data.length === 0) return { success: true, data: [] };

    // Fetch profiles for all users
    const userIds = [...new Set(data.map((a: any) => a.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    // Fetch reactions for all activities
    const activityIds = data.map((a: any) => a.id);
    const { data: reactions } = await supabase
      .from('reactions')
      .select('*')
      .in('activity_id', activityIds);

    const enriched = data.map((activity: any) => ({
      ...activity,
      profile: (profiles || []).find((p: any) => p.id === activity.user_id),
      reactions: (reactions || []).filter((r: any) => r.activity_id === activity.id),
    }));

    return { success: true, data: enriched };
  } catch (error) {
    console.error('Error getting friends activity feed:', error);
    return { success: false, error };
  }
}

export async function getActivityFeed(page = 0, pageSize = 20) {
  try {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('activity_feed')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    if (!data || data.length === 0) return { success: true, data: [] };

    // Fetch profiles for all users
    const userIds = [...new Set(data.map((a: any) => a.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    // Fetch reactions for all activities
    const activityIds = data.map((a: any) => a.id);
    const { data: reactions } = await supabase
      .from('reactions')
      .select('*')
      .in('activity_id', activityIds);

    const enriched = data.map((activity: any) => ({
      ...activity,
      profile: (profiles || []).find((p: any) => p.id === activity.user_id),
      reactions: (reactions || []).filter((r: any) => r.activity_id === activity.id),
    }));

    return { success: true, data: enriched };
  } catch (error) {
    console.error('Error getting activity feed:', error);
    return { success: false, error };
  }
}

// ============================================================
// Reaction Functions
// ============================================================

export async function toggleReaction(activityId: string, type: 'like' | 'clap' | 'fire') {
  try {
    const userId = await getCurrentUserId();

    // Check if reaction exists
    const { data: existing } = await supabase
      .from('reactions')
      .select('*')
      .eq('activity_id', activityId)
      .eq('user_id', userId)
      .limit(1);

    if (existing && existing.length > 0) {
      if (existing[0].type === type) {
        // Same type - remove reaction
        const { error } = await supabase.from('reactions').delete().eq('id', existing[0].id);
        if (error) throw error;
        return { success: true, data: null, action: 'removed' };
      } else {
        // Different type - update reaction
        const { data, error } = await supabase
          .from('reactions')
          .update({ type })
          .eq('id', existing[0].id)
          .select()
          .single();
        if (error) throw error;
        return { success: true, data, action: 'updated' };
      }
    } else {
      // No existing reaction - create
      const { data, error } = await supabase
        .from('reactions')
        .insert({ activity_id: activityId, user_id: userId, type })
        .select()
        .single();
      if (error) throw error;

      // Create notification for activity owner
      const { data: activity } = await supabase.from('activity_feed').select('user_id').eq('id', activityId).single();
      if (activity && activity.user_id !== userId) {
        const { data: myProfile } = await supabase.from('profiles').select('email, username').eq('id', userId).single();
        const myName = myProfile?.username || myProfile?.email || 'Someone';
        const emoji = type === 'like' ? '👍' : type === 'clap' ? '👏' : '🔥';
        await createNotification(activity.user_id, 'reaction', `${emoji} New Reaction`, `${myName} reacted to your workout`, { activity_id: activityId });
      }

      return { success: true, data, action: 'added' };
    }
  } catch (error) {
    console.error('Error toggling reaction:', error);
    return { success: false, error };
  }
}

export async function getReactionsForActivity(activityId: string) {
  try {
    const { data, error } = await supabase
      .from('reactions')
      .select('*')
      .eq('activity_id', activityId);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error getting reactions:', error);
    return { success: false, error };
  }
}

// ============================================================
// Nudge Functions
// ============================================================

const NUDGE_MESSAGES = [
  "Time to hit the gym! 💪",
  "Don't skip today! 🏋️",
  "Let's get moving! 🔥",
  "Your muscles miss you! 😤",
  "No excuses today! 🚀",
  "Consistency is key! 🔑",
  "Let's crush it! 💥",
  "Rise and grind! ⚡",
];

export { NUDGE_MESSAGES };

export async function sendNudge(receiverId: string, message: string) {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('nudges')
      .insert({ sender_id: userId, receiver_id: receiverId, message })
      .select()
      .single();

    if (error) throw error;

    // Create notification
    const { data: myProfile } = await supabase.from('profiles').select('email, username').eq('id', userId).single();
    const myName = myProfile?.username || myProfile?.email || 'A friend';
    await createNotification(receiverId, 'nudge', 'You got nudged!', `${myName}: ${message}`, { nudge_id: data.id, sender_id: userId });

    return { success: true, data };
  } catch (error) {
    console.error('Error sending nudge:', error);
    return { success: false, error };
  }
}

export async function canNudgeFriend(friendId: string) {
  try {
    const userId = await getCurrentUserId();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('nudges')
      .select('id')
      .eq('sender_id', userId)
      .eq('receiver_id', friendId)
      .gte('created_at', twentyFourHoursAgo)
      .limit(1);

    if (error) throw error;
    return { success: true, canNudge: !data || data.length === 0 };
  } catch (error) {
    console.error('Error checking nudge:', error);
    return { success: false, canNudge: false };
  }
}

export async function getReceivedNudges() {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('nudges')
      .select('*')
      .eq('receiver_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Fetch sender profiles
    if (data && data.length > 0) {
      const senderIds = [...new Set(data.map((n: any) => n.sender_id))];
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', senderIds);

      const enriched = data.map((nudge: any) => ({
        ...nudge,
        sender_profile: (profiles || []).find((p: any) => p.id === nudge.sender_id),
      }));
      return { success: true, data: enriched };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error getting nudges:', error);
    return { success: false, error };
  }
}

export async function markNudgeRead(nudgeId: string) {
  try {
    const { error } = await supabase
      .from('nudges')
      .update({ read: true })
      .eq('id', nudgeId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error marking nudge read:', error);
    return { success: false, error };
  }
}

// ============================================================
// Join Request Functions
// ============================================================

export async function sendJoinRequest(friendId: string, sessionId?: string) {
  try {
    const userId = await getCurrentUserId();
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('email, username')
      .eq('id', userId)
      .single();
    const myName = myProfile?.username || myProfile?.email || 'Someone';

    await createNotification(
      friendId,
      'join_request',
      `${myName} wants to join your workout`,
      `Tap to let ${myName} join your session`,
      { sender_id: userId, session_id: sessionId || null, sender_name: myName }
    );

    return { success: true };
  } catch (error) {
    console.error('Error sending join request:', error);
    return { success: false, error };
  }
}

// ============================================================
// Notification Functions
// ============================================================

export async function createNotification(
  userId: string,
  type: 'friend_request' | 'friend_accepted' | 'reaction' | 'nudge' | 'leaderboard_weekly' | 'live_invite' | 'live_accepted' | 'join_request',
  title: string,
  body: string,
  data: any = {}
) {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({ user_id: userId, type, title, body, data });

    if (error) throw error;

    // Push notification sent automatically by Edge Function via DB webhook
    return { success: true };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error };
  }
}

export async function getNotifications(limit = 30) {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error getting notifications:', error);
    return { success: false, error };
  }
}

export async function getUnreadNotificationCount() {
  try {
    const userId = await getCurrentUserId();
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;
    return { success: true, count: count || 0 };
  } catch (error) {
    console.error('Error getting unread count:', error);
    return { success: false, count: 0 };
  }
}

export async function markNotificationRead(notificationId: string) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error marking notification read:', error);
    return { success: false, error };
  }
}

export async function markAllNotificationsRead() {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    return { success: false, error };
  }
}

export async function clearAllNotifications() {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return { success: false, error };
  }
}

// ============================================================
// Leaderboard Functions
// ============================================================

async function getFriendIds(): Promise<string[]> {
  const userId = await getCurrentUserId();

  const { data: sent } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', userId)
    .eq('status', 'accepted');

  const { data: received } = await supabase
    .from('friendships')
    .select('user_id')
    .eq('friend_id', userId)
    .eq('status', 'accepted');

  return [
    userId,
    ...(sent || []).map((f: any) => f.friend_id),
    ...(received || []).map((f: any) => f.user_id),
  ];
}

export async function getLeaderboard(type: LeaderboardType, friendsOnly: boolean = false) {
  try {
    const weekStart = getWeekStart();

    let query = supabase
      .from('leaderboard_entries')
      .select('*')
      .eq('type', type)
      .eq('week_start', weekStart)
      .gt('value', 0)
      .order('value', { ascending: false })
      .limit(50);

    if (friendsOnly) {
      const friendIds = await getFriendIds();
      query = query.in('user_id', friendIds);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) return { success: true, data: [] };

    // Fetch profiles
    const userIds = data.map((e: any) => e.user_id);
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);

    const enriched = data.map((entry: any, index: number) => ({
      ...entry,
      rank: index + 1,
      profile: (profiles || []).find((p: any) => p.id === entry.user_id),
    }));

    return { success: true, data: enriched };
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return { success: false, error };
  }
}

export async function getPopularExercises(limit: number = 20) {
  try {
    const { data, error } = await supabase.rpc('get_popular_exercises', { result_limit: limit });
    if (error) throw error;
    return { success: true, data: (data || []) as { exercise_name: string; user_count: number }[] };
  } catch (error) {
    console.error('Error getting popular exercises:', error);
    return { success: false, data: [] };
  }
}

export async function getExerciseStrengthLeaderboard(exerciseName: string, friendsOnly: boolean = false) {
  try {
    const { data, error } = await supabase.rpc('get_exercise_strength_leaderboard', {
      p_exercise_name: exerciseName,
    });
    if (error) throw error;
    if (!data || data.length === 0) return { success: true, data: [] };

    let entries = data as { user_id: string; max_kg: number; exercise_type: string }[];

    if (friendsOnly) {
      const friendIds = await getFriendIds();
      entries = entries.filter(e => friendIds.includes(e.user_id));
    }

    // Fetch profiles (includes starting_weight as bodyweight)
    const userIds = entries.map(e => e.user_id);
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);

    // Compute ratio based on exercise type, filter out users without bodyweight
    // weighted:            ratio = max_kg / bodyweight
    // weighted_bodyweight: ratio = (bodyweight + max_kg) / bodyweight
    const withRatio = entries
      .map((entry) => {
        const profile = (profiles || []).find((p: any) => p.id === entry.user_id);
        const bodyweight = profile?.starting_weight;
        if (!bodyweight || bodyweight <= 0) return null;
        const kg = Number(entry.max_kg);
        const lifted = entry.exercise_type === 'weighted_bodyweight' ? bodyweight + kg : kg;
        return {
          id: entry.user_id,
          user_id: entry.user_id,
          profile,
          value: lifted / bodyweight,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 50)
      .map((entry: any, index: number) => ({
        ...entry,
        rank: index + 1,
      }));

    return { success: true, data: withRatio };
  } catch (error) {
    console.error('Error getting exercise strength leaderboard:', error);
    return { success: false, error };
  }
}

export async function updateMyLeaderboardEntry(workoutVolume: number) {
  try {
    const userId = await getCurrentUserId();
    const weekStart = getWeekStart();

    // Check if profile has leaderboard opt-in
    const { data: profile } = await supabase
      .from('profiles')
      .select('leaderboard_opt_in')
      .eq('id', userId)
      .single();

    if (!profile?.leaderboard_opt_in) {
      return { success: true, data: null };
    }

    // Update weekly volume
    const { data: existing } = await supabase
      .from('leaderboard_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'weekly_volume')
      .eq('week_start', weekStart)
      .limit(1);

    if (existing && existing.length > 0) {
      const newValue = Number(existing[0].value) + workoutVolume;
      await supabase
        .from('leaderboard_entries')
        .update({ value: newValue, updated_at: new Date().toISOString() })
        .eq('id', existing[0].id);
    } else {
      await supabase
        .from('leaderboard_entries')
        .insert({ user_id: userId, type: 'weekly_volume', value: workoutVolume, week_start: weekStart });
    }

    // Update total workouts
    const { data: existingWorkouts } = await supabase
      .from('leaderboard_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'total_workouts')
      .eq('week_start', weekStart)
      .limit(1);

    if (existingWorkouts && existingWorkouts.length > 0) {
      await supabase
        .from('leaderboard_entries')
        .update({ value: Number(existingWorkouts[0].value) + 1, updated_at: new Date().toISOString() })
        .eq('id', existingWorkouts[0].id);
    } else {
      await supabase
        .from('leaderboard_entries')
        .insert({ user_id: userId, type: 'total_workouts', value: 1, week_start: weekStart });
    }

    // Update all streaks (workout, nutrition, combined)
    await updateStreakLeaderboard();

    return { success: true };
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    return { success: false, error };
  }
}

// ============================================================
// Nutrition & Supplement Leaderboard Functions
// ============================================================

export async function updateNutritionLeaderboard(calories: number, protein: number) {
  try {
    const userId = await getCurrentUserId();
    const weekStart = getWeekStart();

    const { data: profile } = await supabase
      .from('profiles')
      .select('leaderboard_opt_in')
      .eq('id', userId)
      .single();

    if (!profile?.leaderboard_opt_in) {
      return { success: true, data: null };
    }

    // Update weekly calories
    const { data: existingCal } = await supabase
      .from('leaderboard_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'weekly_calories')
      .eq('week_start', weekStart)
      .limit(1);

    if (existingCal && existingCal.length > 0) {
      await supabase
        .from('leaderboard_entries')
        .update({ value: Number(existingCal[0].value) + calories, updated_at: new Date().toISOString() })
        .eq('id', existingCal[0].id);
    } else {
      await supabase
        .from('leaderboard_entries')
        .insert({ user_id: userId, type: 'weekly_calories', value: calories, week_start: weekStart });
    }

    // Update weekly protein
    const { data: existingProt } = await supabase
      .from('leaderboard_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'weekly_protein')
      .eq('week_start', weekStart)
      .limit(1);

    if (existingProt && existingProt.length > 0) {
      await supabase
        .from('leaderboard_entries')
        .update({ value: Number(existingProt[0].value) + protein, updated_at: new Date().toISOString() })
        .eq('id', existingProt[0].id);
    } else {
      await supabase
        .from('leaderboard_entries')
        .insert({ user_id: userId, type: 'weekly_protein', value: protein, week_start: weekStart });
    }

    // Update all streaks (nutrition streak may have changed)
    await updateStreakLeaderboard();

    return { success: true };
  } catch (error) {
    console.error('Error updating nutrition leaderboard:', error);
    return { success: false, error };
  }
}

export async function updateSupplementLeaderboard(water: number, creatine: number) {
  try {
    const userId = await getCurrentUserId();
    const weekStart = getWeekStart();

    const { data: profile } = await supabase
      .from('profiles')
      .select('leaderboard_opt_in')
      .eq('id', userId)
      .single();

    if (!profile?.leaderboard_opt_in) {
      return { success: true, data: null };
    }

    // Update weekly water
    if (water > 0) {
      const { data: existingWater } = await supabase
        .from('leaderboard_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'weekly_water')
        .eq('week_start', weekStart)
        .limit(1);

      if (existingWater && existingWater.length > 0) {
        await supabase
          .from('leaderboard_entries')
          .update({ value: Number(existingWater[0].value) + water, updated_at: new Date().toISOString() })
          .eq('id', existingWater[0].id);
      } else {
        await supabase
          .from('leaderboard_entries')
          .insert({ user_id: userId, type: 'weekly_water', value: water, week_start: weekStart });
      }
    }

    // Update weekly creatine
    if (creatine > 0) {
      const { data: existingCreatine } = await supabase
        .from('leaderboard_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'weekly_creatine')
        .eq('week_start', weekStart)
        .limit(1);

      if (existingCreatine && existingCreatine.length > 0) {
        await supabase
          .from('leaderboard_entries')
          .update({ value: Number(existingCreatine[0].value) + creatine, updated_at: new Date().toISOString() })
          .eq('id', existingCreatine[0].id);
      } else {
        await supabase
          .from('leaderboard_entries')
          .insert({ user_id: userId, type: 'weekly_creatine', value: creatine, week_start: weekStart });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating supplement leaderboard:', error);
    return { success: false, error };
  }
}

export async function updateStreakLeaderboard() {
  try {
    const userId = await getCurrentUserId();
    const weekStart = getWeekStart();

    const { data: profile } = await supabase
      .from('profiles')
      .select('leaderboard_opt_in')
      .eq('id', userId)
      .single();

    if (!profile?.leaderboard_opt_in) {
      return { success: true, data: null };
    }

    const [gym, nutrition, combined] = await Promise.all([
      getGymStreak(),
      getNutritionStreak(),
      getCombinedStreak(),
    ]);

    const streakTypes: { type: LeaderboardType; value: number }[] = [
      { type: 'workout_streak', value: gym.current },
      { type: 'nutrition_streak', value: nutrition.current },
      { type: 'combined_streak', value: combined.current },
    ];

    for (const { type, value } of streakTypes) {
      const { data: existing } = await supabase
        .from('leaderboard_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('week_start', weekStart)
        .limit(1);

      if (existing && existing.length > 0) {
        await supabase
          .from('leaderboard_entries')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('id', existing[0].id);
      } else {
        await supabase
          .from('leaderboard_entries')
          .insert({ user_id: userId, type, value, week_start: weekStart });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating streak leaderboard:', error);
    return { success: false, error };
  }
}

// ============================================================
// Streak Functions
// ============================================================

export async function getMyStreak() {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase.rpc('get_user_streak', { target_user_id: userId });

    if (error) throw error;
    return { success: true, streak: data || 0 };
  } catch (error) {
    console.error('Error getting streak:', error);
    return { success: false, streak: 0 };
  }
}

export async function getFriendActivity(friendId: string, limit = 100) {
  try {
    const { data, error } = await supabase
      .from('activity_feed')
      .select('id, user_id, duration, total_volume, exercise_names, total_exercises, total_sets, created_at')
      .eq('user_id', friendId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, data: (data || []) as ActivityEntry[] };
  } catch (error) {
    console.error('Error getting friend activity:', error);
    return { success: true, data: [] as ActivityEntry[] };
  }
}

export async function getPendingRequestCount() {
  try {
    const userId = await getCurrentUserId();
    const { count, error } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('friend_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
    return { success: true, count: count || 0 };
  } catch (error) {
    console.error('Error getting pending request count:', error);
    return { success: true, count: 0 };
  }
}

export async function getLastActivityForUser(userId: string) {
  try {
    const { data, error } = await supabase
      .from('activity_feed')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (data && data.length > 0) {
      return { success: true, lastActivity: data[0].created_at };
    }
    return { success: true, lastActivity: null };
  } catch (error) {
    console.error('Error getting last activity:', error);
    return { success: false, lastActivity: null };
  }
}

export async function getFriendStreak(friendId: string) {
  try {
    // Check if friend has show_streak enabled
    const { data: profile } = await supabase
      .from('profiles')
      .select('show_streak')
      .eq('id', friendId)
      .single();

    if (!profile?.show_streak) {
      return { success: true, streak: null, hidden: true };
    }

    const { data, error } = await supabase.rpc('get_user_streak', { target_user_id: friendId });
    if (error) throw error;
    return { success: true, streak: data || 0, hidden: false };
  } catch (error) {
    console.error('Error getting friend streak:', error);
    return { success: false, streak: 0 };
  }
}

// ============================================================
// Live Session Functions
// ============================================================

export async function createLiveSessionRow(buddyIds: string[], options?: {
  routineData?: { name: string; sets: number; exercise_order: number }[];
  syncMode?: 'strict' | 'soft';
  routineName?: string;
}, groupOptions?: {
  inviteCode?: string;
  maxParticipants?: number;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const insertPayload: Record<string, any> = {
      host_id: user.id,
      leader_id: user.id,
      buddy_id: buddyIds[0] || null,
      participant_ids: [...new Set([user.id, ...buddyIds])], // include host
      status: 'pending',
    };
    if (options?.routineData) insertPayload.routine_data = options.routineData;
    if (options?.syncMode) insertPayload.sync_mode = options.syncMode;
    if (options?.routineName) insertPayload.routine_name = options.routineName;
    insertPayload.max_participants = groupOptions?.maxParticipants || 10;

    // Try inserting with invite code, retry on collision (UNIQUE constraint)
    let data: any = null;
    if (groupOptions?.inviteCode) {
      insertPayload.invite_code = groupOptions.inviteCode;
    }
    for (let codeAttempt = 0; codeAttempt < 3; codeAttempt++) {
      const result = await supabase
        .from('live_sessions')
        .insert(insertPayload)
        .select()
        .single();
      if (!result.error) {
        data = result.data;
        break;
      }
      // If invite code collision (unique_violation), generate a new code and retry
      if (result.error.code === '23505' && insertPayload.invite_code) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let newCode = '';
        for (let i = 0; i < 6; i++) newCode += chars.charAt(Math.floor(Math.random() * chars.length));
        insertPayload.invite_code = newCode;
        continue;
      }
      throw result.error;
    }
    if (!data) throw new Error('Failed to create session after retries');

    const myProfileResult = await getMyProfile();
    const myName = (myProfileResult.success && myProfileResult.data?.username) || user.email || 'A friend';
    const notifBody = options?.routineName
      ? `${myName} wants to do ${options.routineName} together!`
      : `${myName} wants to work out together!`;

    // Send notification to ALL buddies
    for (const buddyId of buddyIds) {
      await createNotification(buddyId, 'live_invite', 'Live Workout Invite',
        notifBody,
        { session_id: data.id, host_name: myName, sender_id: user.id, routine_name: options?.routineName || null });
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error creating live session:', error);
    return { success: false, error };
  }
}

export async function inviteToExistingSession(sessionId: string, friendIds: string[]) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const myProfileResult = await getMyProfile();
    const myName = (myProfileResult.success && myProfileResult.data?.username) || user.email || 'A friend';

    // Get session info for the notification
    const sessionResult = await getLiveSession(sessionId);
    const routineName = sessionResult.success ? sessionResult.data?.routine_name : null;

    const notifBody = routineName
      ? `${myName} wants you to join their ${routineName} session!`
      : `${myName} wants you to join their workout!`;

    // Add each friend to participant_ids atomically
    for (const friendId of friendIds) {
      await addParticipantToSession(sessionId, friendId);
    }

    // Send invite notification to each friend
    for (const friendId of friendIds) {
      await createNotification(friendId, 'live_invite', 'Live Workout Invite',
        notifBody,
        { session_id: sessionId, host_name: myName, sender_id: user.id, routine_name: routineName || null });
    }

    return { success: true };
  } catch (error) {
    console.error('Error inviting to existing session:', error);
    return { success: false, error };
  }
}

export async function findSessionByInviteCode(code: string) {
  try {
    // Uses a SECURITY DEFINER function to bypass RLS for invite code lookups
    const { data, error } = await supabase
      .rpc('find_session_by_invite_code', { lookup_code: code });
    if (error) throw error;
    const session = Array.isArray(data) ? data[0] || null : data;
    return { success: true, data: session };
  } catch (error) {
    console.error('Error finding session by invite code:', error);
    return { success: false, error };
  }
}

/**
 * Add a user to participant_ids with dedup + retry to handle concurrent joins.
 */
export async function addParticipantToSession(sessionId: string, userId: string): Promise<{ success: boolean; participantIds: string[] }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: session, error: readErr } = await supabase
      .from('live_sessions')
      .select('participant_ids')
      .eq('id', sessionId)
      .single();
    if (readErr || !session) return { success: false, participantIds: [] };

    const existing: string[] = session.participant_ids || [];
    if (existing.includes(userId)) {
      return { success: true, participantIds: existing };
    }

    const updated = [...new Set([...existing, userId])];
    const { error: writeErr } = await supabase
      .from('live_sessions')
      .update({ participant_ids: updated })
      .eq('id', sessionId);
    if (writeErr) {
      await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
      continue;
    }

    // Re-read to confirm we're in the list (another writer may have overwritten)
    const { data: verify } = await supabase
      .from('live_sessions')
      .select('participant_ids')
      .eq('id', sessionId)
      .single();
    const finalIds: string[] = verify?.participant_ids || [];
    if (finalIds.includes(userId)) {
      return { success: true, participantIds: finalIds };
    }
    // Our write got overwritten — retry
    await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
  }
  // Last resort: force-add with fresh read
  const { data: fresh } = await supabase
    .from('live_sessions')
    .select('participant_ids')
    .eq('id', sessionId)
    .single();
  const ids: string[] = fresh?.participant_ids || [];
  if (!ids.includes(userId)) {
    await supabase
      .from('live_sessions')
      .update({ participant_ids: [...new Set([...ids, userId])] })
      .eq('id', sessionId);
  }
  return { success: true, participantIds: [...new Set([...ids, userId])] };
}

export async function updateLiveSessionStatus(sessionId: string, status: string, updates: Record<string, any> = {}) {
  try {
    const { error } = await supabase
      .from('live_sessions')
      .update({ status, ...updates })
      .eq('id', sessionId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error updating live session:', error);
    return { success: false, error };
  }
}

export async function getLiveSession(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error getting live session:', error);
    return { success: false, error };
  }
}

export async function getPendingLiveInvites(): Promise<{ success: boolean; session?: any; hostName?: string }> {
  try {
    const userId = await getCurrentUserId();
    const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('live_sessions')
      .select('*')
      .contains('participant_ids', [userId])
      .in('status', ['pending', 'active'])
      .neq('host_id', userId)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return { success: true };

    const session = data[0];
    const { data: hostProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', session.host_id)
      .single();

    return { success: true, session, hostName: hostProfile?.username || 'Someone' };
  } catch (error) {
    console.error('Error checking pending live invites:', error);
    return { success: false };
  }
}

export async function transferSessionLeadership(sessionId: string, newLeaderId: string) {
  try {
    const { error } = await supabase
      .from('live_sessions')
      .update({ leader_id: newLeaderId })
      .eq('id', sessionId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error transferring session leadership:', error);
    return { success: false, error };
  }
}

export async function removeParticipantFromSession(sessionId: string, userId: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data: session, error: readErr } = await supabase
        .from('live_sessions')
        .select('participant_ids')
        .eq('id', sessionId)
        .single();
      if (readErr || !session) return { success: false, participantIds: [] };

      const existing: string[] = session.participant_ids || [];
      if (!existing.includes(userId)) {
        return { success: true, participantIds: existing };
      }

      const updated = existing.filter((id: string) => id !== userId);
      const { error: writeErr } = await supabase
        .from('live_sessions')
        .update({ participant_ids: updated })
        .eq('id', sessionId);
      if (writeErr) throw writeErr;

      // Verify the removal stuck (another writer may have overwritten)
      const { data: verify } = await supabase
        .from('live_sessions')
        .select('participant_ids')
        .eq('id', sessionId)
        .single();
      const finalIds: string[] = verify?.participant_ids || [];
      if (!finalIds.includes(userId)) {
        return { success: true, participantIds: finalIds };
      }
      // Our write was overwritten — retry
      await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
    } catch (error) {
      console.error('Error removing participant from session:', error);
      if (attempt === 2) return { success: false, participantIds: [] };
      await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
    }
  }
  return { success: false, participantIds: [] };
}
