import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { s } from '../../responsive';
import { useTheme, Colors } from '../../theme';

interface NotificationBellProps {
  unreadCount: number;
  onPress: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ unreadCount, onPress }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Ionicons name="notifications" size={s(22)} color={colors.text} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    padding: s(8),
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: s(2),
    right: s(2),
    backgroundColor: '#FF3B30',
    borderRadius: s(10),
    minWidth: s(18),
    height: s(18),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s(4),
  },
  badgeText: {
    color: '#fff',
    fontSize: s(10),
    fontFamily: 'Inter_700Bold',
  },
});
