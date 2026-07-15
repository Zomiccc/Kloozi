import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import { showMessage } from 'react-native-flash-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [online, setOnline] = useState(true);
  const [queueLength, setQueueLength] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { loadProfile(); checkSyncStatus(); }, []);

  const loadProfile = async () => {
    try {
      const res = await api.get('/team/profile');
      setProfile(res.data.profile);
    } catch {}
  };

  const checkSyncStatus = () => {
    setOnline(api.isOnline());
    setQueueLength(api.getQueueLength());
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.sync();
      showMessage({ message: 'Offline actions synced', type: 'success' });
    } catch {
      showMessage({ message: 'Sync failed', type: 'danger' });
    }
    setSyncing(false);
    checkSyncStatus();
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const menuItems = [
    { icon: 'account-circle', label: 'My Profile', action: () => {} },
    { icon: 'office-building', label: 'Company Settings', action: () => {} },
    { icon: 'account-group', label: 'Team Management', action: () => {} },
    { icon: 'link-variant', label: 'Connected Integrations', action: () => {} },
    { icon: 'email-settings', label: 'Email Settings', action: () => {} },
    { icon: 'whatsapp', label: 'WhatsApp Connection', action: () => {} },
    { icon: 'bell-outline', label: 'Notification Preferences', action: () => {} },
    { icon: 'translate', label: 'Language Selection', action: () => {} },
    { icon: 'credit-card-outline', label: 'Billing and Subscription', action: () => {} },
    { icon: 'help-circle-outline', label: 'Help and Support', action: () => {} },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.offlineBanner, { backgroundColor: online ? '#d1fae5' : '#fef3c7' }]}>
          <Icon name={online ? 'wifi-check' : 'wifi-off'} size={20} color={online ? '#059669' : '#b45309'} />
          <Text style={[styles.offlineText, { color: online ? '#059669' : '#b45309' }]}>
            {online ? 'Online' : 'Offline Mode'}
          </Text>
          {!online && queueLength > 0 && (
            <Text style={[styles.offlineText, { color: '#b45309' }]}>{queueLength} pending</Text>
          )}
          {!online && queueLength > 0 && (
            <TouchableOpacity onPress={handleSync} disabled={syncing} style={styles.syncBtn}>
              <Text style={styles.syncBtnText}>{syncing ? 'Syncing...' : 'Sync Now'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.first_name?.[0] || 'U'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{profile?.first_name} {profile?.last_name}</Text>
            <Text style={styles.profileEmail}>{profile?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{(profile?.role || 'agent').replace('_', ' ')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.menuContainer}>
          {menuItems.map((item, i) => (
            <TouchableOpacity key={i} style={styles.menuItem} onPress={item.action}>
              <Icon name={item.icon} size={22} color="#64748b" />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Icon name="chevron-right" size={20} color="#cbd5e1" />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="logout" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
  content: { padding: 16, paddingBottom: 40 },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginBottom: 16, gap: 8 },
  offlineText: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
  syncBtn: { marginLeft: 'auto', backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  syncBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  avatar: { width: 56, height: 56, backgroundColor: '#2563eb', borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  profileName: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
  profileEmail: { fontSize: 14, color: '#64748b', marginTop: 2 },
  roleBadge: { alignSelf: 'flex-start', backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginTop: 6 },
  roleText: { fontSize: 12, color: '#2563eb', fontWeight: '600', textTransform: 'capitalize' },
  menuContainer: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  menuLabel: { flex: 1, fontSize: 16, color: '#0f172a', marginLeft: 14 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 16, marginTop: 20, borderWidth: 1, borderColor: '#fee2e2' },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '600', marginLeft: 8 },
});
