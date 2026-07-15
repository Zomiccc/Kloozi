import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import api from '../services/api';
import { showMessage } from 'react-native-flash-message';

const { width } = Dimensions.get('window');

export default function ReportsScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    try {
      const res = await api.get('/analytics/dashboard');
      setData(res.data);
    } catch { showMessage({ message: 'Failed to load reports', type: 'danger' }); }
    finally { setLoading(false); }
  };

  if (loading) return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;

  const stats = data?.leadStats || {};

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.grid}>
          <ReportCard label="Total Leads" value={stats.totalLeads || 0} color="#3b82f6" />
          <ReportCard label="Won" value={stats.won || 0} color="#10b981" />
          <ReportCard label="Lost" value={stats.lost || 0} color="#ef4444" />
          <ReportCard label="Conversion" value={`${data?.conversionRate || 0}%`} color="#8b5cf6" />
          <ReportCard label="Calls Today" value={data?.callsToday || 0} color="#f59e0b" />
          <ReportCard label="Emails Today" value={data?.emailsToday || 0} color="#06b6d4" />
        </View>

        <Text style={styles.sectionTitle}>Pipeline</Text>
        <View style={styles.pipelineContainer}>
          <PipelineBar label="New" count={stats.newLeads || 0} color="#3b82f6" max={stats.totalLeads || 1} />
          <PipelineBar label="Contacted" count={stats.contacted || 0} color="#8b5cf6" max={stats.totalLeads || 1} />
          <PipelineBar label="Interested" count={stats.interested || 0} color="#f59e0b" max={stats.totalLeads || 1} />
          <PipelineBar label="Negotiating" count={stats.negotiating || 0} color="#f97316" max={stats.totalLeads || 1} />
          <PipelineBar label="Won" count={stats.won || 0} color="#10b981" max={stats.totalLeads || 1} />
          <PipelineBar label="Lost" count={stats.lost || 0} color="#ef4444" max={stats.totalLeads || 1} />
        </View>

        <Text style={styles.sectionTitle}>Leads by Source</Text>
        <View style={styles.sourcesContainer}>
          {(data?.leadsBySource || []).map((s, i) => (
            <View key={i} style={styles.sourceRow}>
              <View style={[styles.sourceDot, { backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][i % 6] }]} />
              <Text style={styles.sourceName}>{s.lead_source}</Text>
              <Text style={styles.sourceCount}>{parseInt(s.count)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Follow-ups Today</Text>
        <View style={styles.followupCard}>
          <Text style={styles.followupText}>Completed: {data?.followUpsToday?.completed || 0} / {data?.followUpsToday?.total || 0}</Text>
          <Text style={styles.followupRate}>Rate: {data?.followUpsToday?.total ? Math.round(((data.followUpsToday.completed / data.followUpsToday.total) * 100)) : 0}%</Text>
        </View>

        <Text style={styles.sectionTitle}>Stuck Leads</Text>
        <View style={styles.stuckCard}>
          <Text style={styles.stuckText}>{data?.stuckLeads || 0} leads with no activity in 7+ days</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function ReportCard({ label, value, color }) {
  return (
    <View style={[styles.reportCard, { borderLeftColor: color }]}>
      <Text style={styles.reportValue}>{value}</Text>
      <Text style={styles.reportLabel}>{label}</Text>
    </View>
  );
}

function PipelineBar({ label, count, color, max }) {
  const pct = Math.round((count / max) * 100);
  return (
    <View style={styles.pipelineRow}>
      <Text style={styles.pipelineLabel}>{label}</Text>
      <View style={styles.pipelineBarBg}>
        <View style={[styles.pipelineBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.pipelineCount}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
  content: { padding: 16, paddingBottom: 40 },
  loading: { textAlign: 'center', marginTop: 40, color: '#94a3b8' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginTop: 20, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  reportCard: { width: (width - 56) / 2, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  reportValue: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
  reportLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  pipelineContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  pipelineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  pipelineLabel: { width: 80, fontSize: 13, color: '#64748b' },
  pipelineBarBg: { flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, marginHorizontal: 8 },
  pipelineBarFill: { height: 8, borderRadius: 4 },
  pipelineCount: { width: 30, fontSize: 13, fontWeight: '600', color: '#0f172a', textAlign: 'right' },
  sourcesContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  sourceDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  sourceName: { flex: 1, fontSize: 14, color: '#0f172a', textTransform: 'capitalize' },
  sourceCount: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  followupCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  followupText: { fontSize: 16, color: '#0f172a' },
  followupRate: { fontSize: 16, fontWeight: '600', color: '#2563eb', marginTop: 4 },
  stuckCard: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 16 },
  stuckText: { fontSize: 14, color: '#dc2626' },
});
