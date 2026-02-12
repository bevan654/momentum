import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, Colors } from '../theme';
import { s } from '../responsive';
import { getMyProfile, updateProfile, updateUsername, Profile } from '../friendsDatabase';
import { NutritionGoals, MealSlotConfig } from '../foodDatabase';
import { SupplementGoals } from '../supplementDatabase';

export interface SettingsProps {
  onBack: () => void;
  // Nutrition
  nutritionGoals: NutritionGoals;
  setNutritionGoals: (g: NutritionGoals) => void;
  saveNutritionGoals: (g: NutritionGoals) => void;
  // Meals
  mealConfig: MealSlotConfig[];
  setMealConfig: (c: MealSlotConfig[]) => void;
  saveMealConfig: (c: MealSlotConfig[]) => void;
  // Body Stats
  startingWeightInput: string;
  setStartingWeightInput: (v: string) => void;
  handleSaveStartingWeight: () => void;
  supplementGoals: SupplementGoals;
  setSupplementGoals: (g: SupplementGoals) => void;
  saveSupplementGoals: (g: SupplementGoals) => void;
  // Streaks
  showNutritionStreak: boolean;
  setShowNutritionStreak: (v: boolean) => void;
  showCombinedStreak: boolean;
  setShowCombinedStreak: (v: boolean) => void;
}

export const Settings: React.FC<SettingsProps> = (props) => {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  // Username editing (absorbed from SettingsSection)
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  useEffect(() => {
    getMyProfile().then(result => {
      if (result.success && result.data) setProfile(result.data);
      setLoadingProfile(false);
    });
  }, []);

  const handleToggle = async (key: keyof Pick<Profile, 'share_workouts' | 'show_streak' | 'notifications_enabled' | 'leaderboard_opt_in'>, value: boolean) => {
    if (!profile) return;
    setProfile({ ...profile, [key]: value });
    await updateProfile({ [key]: value });
  };

  const handleSaveUsername = async () => {
    const trimmed = usernameInput.trim();
    if (trimmed.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      Alert.alert('Error', 'Username can only contain letters, numbers, and underscores');
      return;
    }
    setSavingUsername(true);
    const result = await updateUsername(trimmed);
    setSavingUsername(false);
    if (result.success && result.data) {
      setProfile(result.data);
      setEditingUsername(false);
    } else {
      Alert.alert('Error', typeof result.error === 'string' ? result.error : 'Could not update username');
    }
  };

  const socialSettings = [
    { key: 'share_workouts' as const, label: 'Share Workouts', description: 'Show your workouts in friends\' activity feed' },
    { key: 'show_streak' as const, label: 'Show Streak', description: 'Let friends see your workout streak' },
    { key: 'notifications_enabled' as const, label: 'Notifications', description: 'Receive friend and activity notifications' },
    { key: 'leaderboard_opt_in' as const, label: 'Leaderboards', description: 'Appear on weekly leaderboards' },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={st.header}>
          <TouchableOpacity onPress={props.onBack} style={st.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={s(22)} color={colors.accent} />
          </TouchableOpacity>
          <Text style={st.headerTitle}>Settings</Text>
          <View style={{ width: s(32) }} />
        </View>

        {/* ─── ACCOUNT ─── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Account</Text>
          {loadingProfile ? (
            <ActivityIndicator color={colors.accent} style={{ paddingVertical: s(12) }} />
          ) : profile ? (
            <View style={st.usernameRow}>
              {editingUsername ? (
                <>
                  <TextInput
                    style={[st.usernameInput, { borderColor: colors.border }]}
                    value={usernameInput}
                    onChangeText={setUsernameInput}
                    placeholder="Enter username"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    maxLength={20}
                    autoFocus
                  />
                  <TouchableOpacity style={[st.saveBtn, { backgroundColor: colors.accent }]} onPress={handleSaveUsername} disabled={savingUsername}>
                    <Text style={st.saveBtnText}>{savingUsername ? '...' : 'Save'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.cancelBtn} onPress={() => setEditingUsername(false)}>
                    <Text style={[st.cancelBtnText, { color: colors.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={{ flex: 1 }}>
                    <Text style={st.label}>Username</Text>
                    <Text style={[st.usernameValue, { color: colors.accent }]}>{profile.username || 'Not set'}</Text>
                  </View>
                  <TouchableOpacity
                    style={st.editBtn}
                    onPress={() => { setUsernameInput(profile.username || ''); setEditingUsername(true); }}
                  >
                    <Text style={[st.editBtnText, { color: colors.accent }]}>{profile.username ? 'Edit' : 'Set'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : null}
        </View>

        {/* ─── GOALS ─── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Daily Nutrition Goals</Text>
          {[
            { key: 'calorie_goal' as const, label: 'Calories', unit: 'cal' },
            { key: 'protein_goal' as const, label: 'Protein', unit: 'g' },
            { key: 'carbs_goal' as const, label: 'Carbs', unit: 'g' },
            { key: 'fat_goal' as const, label: 'Fat', unit: 'g' },
          ].map((item) => (
            <View key={item.key} style={st.row}>
              <Text style={st.label}>{item.label}</Text>
              <View style={st.inputRow}>
                <TextInput
                  style={st.input}
                  keyboardType="numeric"
                  value={String(props.nutritionGoals[item.key])}
                  onChangeText={(val) => {
                    const updated = { ...props.nutritionGoals, [item.key]: parseFloat(val) || 0 };
                    props.setNutritionGoals(updated);
                  }}
                  onBlur={() => props.saveNutritionGoals(props.nutritionGoals)}
                />
                <Text style={st.unit}>{item.unit}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ─── BODY STATS ─── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Body Stats</Text>
          <View style={st.row}>
            <Text style={st.label}>Starting Weight</Text>
            <View style={st.inputRow}>
              <TextInput
                style={st.input}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={props.startingWeightInput}
                onChangeText={props.setStartingWeightInput}
                onBlur={props.handleSaveStartingWeight}
              />
              <Text style={st.unit}>kg</Text>
            </View>
          </View>
          <View style={st.row}>
            <Text style={st.label}>Water Goal</Text>
            <View style={st.inputRow}>
              <TextInput
                style={st.input}
                keyboardType="numeric"
                value={String(props.supplementGoals.water_goal)}
                onChangeText={(val) => props.setSupplementGoals({ ...props.supplementGoals, water_goal: parseFloat(val) || 0 })}
                onBlur={() => props.saveSupplementGoals(props.supplementGoals)}
              />
              <Text style={st.unit}>ml</Text>
            </View>
          </View>
          <View style={[st.row, { borderBottomWidth: 0 }]}>
            <Text style={st.label}>Creatine Goal</Text>
            <View style={st.inputRow}>
              <TextInput
                style={st.input}
                keyboardType="numeric"
                value={String(props.supplementGoals.creatine_goal)}
                onChangeText={(val) => props.setSupplementGoals({ ...props.supplementGoals, creatine_goal: parseFloat(val) || 0 })}
                onBlur={() => props.saveSupplementGoals(props.supplementGoals)}
              />
              <Text style={st.unit}>g</Text>
            </View>
          </View>
        </View>

        {/* ─── MEALS ─── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Meals</Text>
          {props.mealConfig.map((slot, idx) => (
            <View key={slot.slot} style={[st.row, { flexDirection: 'column', alignItems: 'stretch', paddingVertical: s(10), opacity: slot.enabled ? 1 : 0.45 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s(6) }}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  onPress={() => {
                    const updated = [...props.mealConfig];
                    updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
                    props.setMealConfig(updated);
                    props.saveMealConfig(updated);
                  }}
                >
                  <Ionicons
                    name={slot.enabled ? 'checkbox' : 'square-outline'}
                    size={s(22)}
                    color={slot.enabled ? colors.accent : colors.textMuted}
                    style={{ marginRight: s(8) }}
                  />
                  <Text style={[st.label, { flex: 0, marginRight: s(8) }]}>Slot {idx + 1}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: s(11), color: colors.textMuted, marginBottom: s(2), fontFamily: 'Inter_500Medium' }}>Label</Text>
                  <TextInput
                    style={[st.input, { width: '100%', textAlign: 'left' }]}
                    value={slot.label}
                    onChangeText={(val) => {
                      const updated = [...props.mealConfig];
                      updated[idx] = { ...updated[idx], label: val };
                      props.setMealConfig(updated);
                    }}
                    onBlur={() => props.saveMealConfig(props.mealConfig)}
                    editable={slot.enabled}
                  />
                </View>
                <View style={{ width: s(80) }}>
                  <Text style={{ fontSize: s(11), color: colors.textMuted, marginBottom: s(2), fontFamily: 'Inter_500Medium' }}>Time</Text>
                  <TextInput
                    style={[st.input, { width: '100%', textAlign: 'left' }]}
                    value={slot.time_start}
                    onChangeText={(val) => {
                      const updated = [...props.mealConfig];
                      updated[idx] = { ...updated[idx], time_start: val };
                      props.setMealConfig(updated);
                    }}
                    onBlur={() => props.saveMealConfig(props.mealConfig)}
                    placeholder="HH:MM"
                    placeholderTextColor={colors.textMuted}
                    editable={slot.enabled}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* ─── PREFERENCES ─── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Streaks Display</Text>
          <View style={st.row}>
            <Text style={st.label}>Show Nutrition Streak</Text>
            <Switch
              value={props.showNutritionStreak}
              onValueChange={(val) => {
                props.setShowNutritionStreak(val);
                AsyncStorage.setItem('streak_show_nutrition', String(val));
              }}
              trackColor={{ false: colors.border, true: '#34C759' }}
            />
          </View>
          <View style={[st.row, { borderBottomWidth: 0 }]}>
            <Text style={st.label}>Show Overall Streak</Text>
            <Switch
              value={props.showCombinedStreak}
              onValueChange={(val) => {
                props.setShowCombinedStreak(val);
                AsyncStorage.setItem('streak_show_combined', String(val));
              }}
              trackColor={{ false: colors.border, true: '#FF3B30' }}
            />
          </View>
        </View>

        {/* ─── SOCIAL & PRIVACY ─── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Social & Privacy</Text>
          {profile && socialSettings.map((setting, i) => (
            <View key={setting.key} style={[st.row, i === socialSettings.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1, marginRight: s(12) }}>
                <Text style={st.label}>{setting.label}</Text>
                <Text style={st.description}>{setting.description}</Text>
              </View>
              <Switch
                value={profile[setting.key]}
                onValueChange={(value) => handleToggle(setting.key, value)}
                trackColor={{ false: colors.border, true: '#34C759' }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        {/* ─── SUPPORT ─── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Support</Text>
          {[
            { label: 'Privacy Policy', icon: 'shield-checkmark-outline' as const, url: 'https://example.com/privacy' },
            { label: 'Terms of Service', icon: 'document-text-outline' as const, url: 'https://example.com/terms' },
            { label: 'Contact Support', icon: 'mail-outline' as const, url: 'mailto:support@example.com' },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={item.label}
              style={[st.linkRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => Linking.openURL(item.url)}
              activeOpacity={0.6}
            >
              <Ionicons name={item.icon} size={s(18)} color={colors.textSecondary} style={{ marginRight: s(12) }} />
              <Text style={st.linkLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={s(16)} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: s(100) }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(16),
    paddingTop: s(16),
    paddingBottom: s(8),
  },
  backBtn: {
    width: s(32),
    height: s(32),
    borderRadius: s(8),
    backgroundColor: c.border + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: s(18),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  section: {
    marginHorizontal: s(16),
    marginTop: s(16),
    backgroundColor: c.card,
    borderRadius: s(12),
    padding: s(16),
  },
  sectionTitle: {
    fontSize: s(15),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
    marginBottom: s(12),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(12),
    borderBottomWidth: s(1),
    borderBottomColor: c.border,
  },
  label: {
    fontSize: s(15),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  description: {
    fontSize: s(12),
    color: c.textMuted,
    marginTop: s(2),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  input: {
    backgroundColor: c.bg,
    borderRadius: s(10),
    paddingHorizontal: s(12),
    paddingVertical: s(10),
    fontSize: s(15),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    textAlign: 'right',
    minWidth: s(80),
  },
  unit: {
    fontSize: s(13),
    color: c.textMuted,
    fontFamily: 'Inter_600SemiBold',
    width: s(28),
  },
  // Username
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(8),
    gap: s(8),
  },
  usernameValue: {
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
    marginTop: s(2),
  },
  usernameInput: {
    flex: 1,
    backgroundColor: c.bg,
    borderRadius: s(10),
    paddingHorizontal: s(12),
    paddingVertical: s(10),
    fontSize: s(15),
    color: c.text,
    borderWidth: 1,
  },
  editBtn: {
    paddingVertical: s(6),
    paddingHorizontal: s(14),
    borderRadius: s(8),
    backgroundColor: c.accent + '18',
  },
  editBtnText: {
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
  },
  saveBtn: {
    paddingVertical: s(8),
    paddingHorizontal: s(14),
    borderRadius: s(8),
  },
  saveBtnText: {
    color: '#fff',
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
  },
  cancelBtn: {
    paddingVertical: s(8),
    paddingHorizontal: s(10),
  },
  cancelBtnText: {
    fontSize: s(14),
  },
  // Support links
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(14),
    borderBottomWidth: s(1),
    borderBottomColor: c.border,
  },
  linkLabel: {
    flex: 1,
    fontSize: s(15),
    fontFamily: 'Inter_500Medium',
    color: c.text,
  },
});
