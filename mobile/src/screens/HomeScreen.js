import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, useWindowDimensions } from 'react-native';
import api from '../services/api';
import { showMessage } from 'react-native-flash-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function HomeScreen() {
  const [data, setData] = useState(null);
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [dashRes, fuRes] = await Promise.all([
        api.get('/analytics/dashboard'),
        api.get('/follow-ups?date=today'),
      ]);
      setData(dashRes.data);
      setFollowUps(fuRes.data.followUps || []);
    } catch (err) {
      showMessage({ message: 'Failed to load data', type: 'danger' });
    } finally { setLoading(false); }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const stageColors = { new: '#3b82f6', contacted: '#8b5cf6', interested: '#f59e0b', negotiating: '#f97316', won: '#10b981', lost: '#ef4444' };

  const renderFollowUp = ({ item }) => (
    <TouchableOpacity style={styles.followUpCard} onPress={() => {}}>
      <View style={[styles.followUpDot, { backgroundColor: stageColors[item.stage] || '#64748b' }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.followUpName}>{item.first_name} {item.last_name}</Text>
        <Text style={styles.followUpType}>{item.type} • {new Date(item.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
      {item.status === 'pending' && new Date(item.due_date) < new Date() && <Text style={styles.overdue}>Overdue</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Home</Text>
      </View>
      <FlatList
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <StatBox label="Leads Today" value={data?.leadStats?.leadsToday || 0} color="#3b82f6" />
              <StatBox label="Calls Today" value={data?.callsToday || 0} color="#10b981" />
            </View>
            <View style={styles.statsRow}>
              <StatBox label="Emails Sent" value={data?.emailsToday || 0} color="#8b5cf6" />
              <StatBox label="Follow-ups" value={`${data?.followUpsToday?.completed || 0}/${data?.followUpsToday?.total || 0}`} color="#f59e0b" />
            </View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today's Follow-ups</Text>
              <Text style={styles.sectionCount}>{followUps.length}</Text>
            </View>
          </View>
        }
        data={followUps}
        keyExtractor={(item) => item.id}
        renderItem={renderFollowUp}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No follow-ups today</Text>}
      />
    </View>
  );
}

function StatBox({ label, value, color }) {
  return (
    <View style={[styles.statBox, { borderLeftColor: color }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
  statsContainer: { padding: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statBox: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
  sectionCount: { fontSize: 14, color: '#64748b' },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  followUpCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  followUpDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  followUpName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  followUpType: { fontSize: 12, color: '#64748b', marginTop: 2 },
  overdue: { fontSize: 12, color: '#ef4444', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#94a3b8', paddingVertical: 40 },
});
