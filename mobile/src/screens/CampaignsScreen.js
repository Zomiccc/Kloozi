import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import api from '../services/api';
import { showMessage } from 'react-native-flash-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function CampaignsScreen() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('email');

  useEffect(() => { loadCampaigns(); }, [tab]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const res = await api.get('/campaigns');
      setCampaigns(res.data.campaigns.filter(c => c.channel === tab));
    } catch { showMessage({ message: 'Failed to load campaigns', type: 'danger' }); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = useCallback(() => { setRefreshing(true); loadCampaigns(); }, [tab]);

  const statusColors = {
    draft: { bg: '#f1f5f9', text: '#475569' },
    scheduled: { bg: '#fef3c7', text: '#b45309' },
    sending: { bg: '#dbeafe', text: '#1d4ed8' },
    completed: { bg: '#d1fae5', text: '#059669' },
    cancelled: { bg: '#fee2e2', text: '#dc2626' },
  };

  const renderCampaign = ({ item }) => {
    const sc = statusColors[item.status] || statusColors.draft;
    return (
      <View style={styles.campaignCard}>
        <View style={styles.campaignHeader}>
          <Text style={styles.campaignName}>{item.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{item.status}</Text>
          </View>
        </View>
        <View style={styles.campaignStats}>
          <View style={styles.statItem}><Text style={styles.statValue}>{item.recipients_count}</Text><Text style={styles.statLabel}>Recipients</Text></View>
          <View style={styles.statItem}><Text style={styles.statValue}>{item.sent_count}</Text><Text style={styles.statLabel}>Sent</Text></View>
          <View style={styles.statItem}><Text style={styles.statValue}>{item.opened_count || item.delivered_count || 0}</Text><Text style={styles.statLabel}>{tab === 'email' ? 'Opened' : 'Delivered'}</Text></View>
        </View>
        {item.status === 'draft' && (
          <TouchableOpacity
            style={styles.sendButton}
            onPress={async () => {
              try { await api.post(`/campaigns/${item.id}/send`); showMessage({ message: 'Campaign sending started', type: 'success' }); loadCampaigns(); }
              catch { showMessage({ message: 'Send failed', type: 'danger' }); }
            }}
          >
            <Icon name="send" size={16} color="#fff" /><Text style={styles.sendButtonText}> Send Now</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const tabs = [
    { key: 'email', label: 'Email', icon: 'email-outline' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' },
    { key: 'sms', label: 'SMS', icon: 'message-text-outline' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Campaigns</Text>
      </View>
      <View style={styles.tabBar}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Icon name={t.icon} size={18} color={tab === t.key ? '#2563eb' : '#94a3b8'} />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={campaigns}
        keyExtractor={(item) => item.id}
        renderItem={renderCampaign}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!loading && <Text style={styles.empty}>No {tab} campaigns yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12 },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  tabActive: { backgroundColor: '#eff6ff' },
  tabText: { fontSize: 14, color: '#94a3b8' },
  tabTextActive: { color: '#2563eb', fontWeight: '600' },
  list: { padding: 16 },
  campaignCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  campaignHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  campaignName: { fontSize: 16, fontWeight: '600', color: '#0f172a', flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  campaignStats: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  sendButton: { flexDirection: 'row', backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 10, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  sendButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#94a3b8', paddingVertical: 40 },
});
