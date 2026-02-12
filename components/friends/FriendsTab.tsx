import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDragDismiss } from '../../hooks/useDragDismiss';
import { s } from '../../responsive';
import { Friendship } from '../../friendsDatabase';
import { ActivityFeed } from './ActivityFeed';
import { FriendList } from './FriendList';
import { FriendSearch } from './FriendSearch';
import { Leaderboards } from './Leaderboards';
import { NotificationBell } from './NotificationBell';
import { NotificationList } from './NotificationList';
import { FriendProfileModal } from './FriendProfileModal';
import { useTheme, Colors } from '../../theme';

type SubTab = 'feed' | 'friends' | 'leaderboards' | 'notifications';

interface FriendsTabProps {
  currentUserId: string;
  unreadNotifications: number;
  onUnreadCountChange: (count: number) => void;
  onInviteLive?: () => void;
}

export const FriendsTab: React.FC<FriendsTabProps> = ({
  currentUserId,
  unreadNotifications,
  onUnreadCountChange,
  onInviteLive,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('friends');
  const [selectedFriendship, setSelectedFriendship] = useState<Friendship | null>(null);
  const [friendProfileVisible, setFriendProfileVisible] = useState(false);
  const [friendListKey, setFriendListKey] = useState(0);
  const [searchVisible, setSearchVisible] = useState(false);
  const { panHandlers: searchPanHandlers, animatedStyle: searchAnimatedStyle } = useDragDismiss(() => setSearchVisible(false));

  const handlePressFriend = useCallback((friendship: Friendship) => {
    setSelectedFriendship(friendship);
    setFriendProfileVisible(true);
  }, []);

  const handleFriendRemoved = useCallback(() => {
    setFriendListKey(prev => prev + 1);
  }, []);

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'friends', label: 'Friends' },
    { key: 'feed', label: 'Feed' },
    { key: 'leaderboards', label: 'Board' },
  ];

  return (
    <View style={styles.container}>
      {/* Sub-tab navigation */}
      <View style={styles.tabBarRow}>
        <View style={styles.tabBar}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeSubTab === tab.key && styles.tabActive]}
              onPress={() => setActiveSubTab(tab.key)}
            >
              <Text style={[styles.tabText, activeSubTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.headerIcon} onPress={() => setSearchVisible(true)}>
          <Ionicons name="search" size={s(20)} color={colors.text} />
        </TouchableOpacity>
        <NotificationBell
          unreadCount={unreadNotifications}
          onPress={() => setActiveSubTab('notifications')}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeSubTab === 'feed' && (
          <ActivityFeed currentUserId={currentUserId} />
        )}
        {activeSubTab === 'friends' && (
          <FriendList key={friendListKey} onPressFriend={handlePressFriend} />
        )}
        {activeSubTab === 'notifications' && (
          <NotificationList onUnreadCountChange={onUnreadCountChange} />
        )}
        {activeSubTab === 'leaderboards' && (
          <Leaderboards currentUserId={currentUserId} />
        )}
      </View>

      {/* Search Modal */}
      <Modal
        animationType="none"
        transparent={true}
        visible={searchVisible}
        onRequestClose={() => setSearchVisible(false)}
      >
        <View style={styles.searchOverlay}>
          <Animated.View style={[styles.searchSheet, searchAnimatedStyle]}>
            <View style={styles.searchDragHandleContainer} {...searchPanHandlers}>
              <View style={styles.searchDragHandle} />
            </View>
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>Find Friends</Text>
              <TouchableOpacity onPress={() => setSearchVisible(false)}>
                <Ionicons name="close" size={s(24)} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FriendSearch />
          </Animated.View>
        </View>
      </Modal>

      {/* Friend Profile Modal */}
      <FriendProfileModal
        visible={friendProfileVisible}
        friendship={selectedFriendship}
        onClose={() => setFriendProfileVisible(false)}
        onFriendRemoved={handleFriendRemoved}
      />
    </View>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: s(12),
    paddingRight: s(4),
    paddingTop: s(8),
    paddingBottom: s(4),
    backgroundColor: c.card,
    borderBottomWidth: s(1),
    borderBottomColor: c.border,
  },
  tabBar: {
    flex: 1,
    flexDirection: 'row',
    gap: s(4),
  },
  tab: {
    paddingHorizontal: s(10),
    paddingVertical: s(7),
    borderRadius: s(8),
  },
  tabActive: {
    backgroundColor: '#38BDF8',
  },
  tabText: {
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.textSecondary,
  },
  tabTextActive: {
    color: c.bg,
  },
  headerIcon: {
    padding: s(8),
  },
  content: {
    flex: 1,
    backgroundColor: c.bg,
  },
  // Search modal
  searchOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  searchSheet: {
    backgroundColor: c.bg,
    borderTopLeftRadius: s(20),
    borderTopRightRadius: s(20),
    maxHeight: '85%',
    flex: 1,
  },
  searchDragHandleContainer: {
    alignItems: 'center',
    paddingTop: s(10),
    paddingBottom: s(4),
  },
  searchDragHandle: {
    width: s(36),
    height: s(4),
    borderRadius: s(2),
    backgroundColor: c.border,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(20),
    paddingTop: s(20),
    paddingBottom: s(8),
  },
  searchTitle: {
    fontSize: s(18),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
});
