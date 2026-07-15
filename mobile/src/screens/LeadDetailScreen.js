import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import api from '../services/api';
import { showMessage } from 'react-native-flash-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function LeadDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLead(); }, [id]);

  const loadLead = async () => {
    try {
      const res = await api.get(`/leads/${id}`);
      setData(res.data);
    } catch { showMessage({ message: 'Failed to load lead', type: 'danger' }); navigation.goBack(); }
    finally { setLoading(false); }
  };

  const handleCall = () => { if (data?.lead?.phone) Linking.openURL(`tel:${data.lead.phone}`); };
  const handleWhatsApp = () => {
    if (data?.lead?.phone) {
      const phone = data.lead.phone.replace(/\D/g, '');
      Linking.openURL(`https://wa.me/${phone}`);
    }
  };
  const handleEmail = () => { if (data?.lead?.email) Linking.openURL(`mailto:${data.lead.email}`); };
  const handleSMS = () => { if (data?.lead?.phone) Linking.openURL(`sms:${data.lead.phone}`); };

  const handleDelete = () => {
    Alert.alert('Delete Lead', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/leads/${id}`); showMessage({ message: 'Lead deleted', type: 'success' }); navigation.goBack(); }
        catch { showMessage({ message: 'Delete failed', type: 'danger' }); }
      }},
    ]);
  };

  if (loading || !data) return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;

  const lead = data.lead;
  const stageColors = {
    new: { bg: '#dbeafe', text: '#1d4ed8' }, contacted: { bg: '#e9d5ff', text: '#7c3aed' },
    interested: { bg: '#fef3c7', text: '#b45309' }, negotiating: { bg: '#ffedd5', text: '#c2410c' },
    won: { bg: '#d1fae5', text: '#059669' }, lost: { bg: '#fee2e2', text: '#dc2626' },
  };
  const sc = stageColors[lead.stage] || stageColors.new;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.leadName}>{lead.first_name} {lead.last_name}</Text>
          <Text style={styles.leadCity}>{lead.city} • {lead.lead_source}</Text>
        </View>
        <View style={[styles.stageBadge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.stageText, { color: sc.text }]}>{lead.stage}</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <ActionButton icon="phone" label="Call" onPress={handleCall} disabled={!lead.phone} color="#10b981" />
        <ActionButton icon="whatsapp" label="WhatsApp" onPress={handleWhatsApp} disabled={!lead.phone} color="#25D366" />
        <ActionButton icon="email" label="Email" onPress={handleEmail} disabled={!lead.email} color="#3b82f6" />
        <ActionButton icon="message-text" label="SMS" onPress={handleSMS} disabled={!lead.phone} color="#f59e0b" />
        <ActionButton icon="delete" label="Delete" onPress={handleDelete} color="#ef4444" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Details</Text>
        <DetailRow label="Phone" value={lead.phone} />
        <DetailRow label="Email" value={lead.email} />
        <DetailRow label="City" value={lead.city} />
        <DetailRow label="Budget" value={lead.budget ? `$${parseInt(lead.budget).toLocaleString()}` : '-'} />
        <DetailRow label="Source" value={lead.lead_source} />
        <DetailRow label="Agent" value={lead.agent_first_name ? `${lead.agent_first_name} ${lead.agent_last_name}` : 'Unassigned'} />
        <DetailRow label="Score" value={`${lead.score}/100`} />
        <DetailRow label="Created" value={new Date(lead.created_at).toLocaleDateString()} />
        {lead.notes && <View style={styles.notesContainer}><Text style={styles.notesLabel}>Notes</Text><Text style={styles.notesText}>{lead.notes}</Text></View>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Activity Timeline</Text>
        {(data.activities || []).map((act) => (
          <View key={act.id} style={styles.activityItem}>
            <View style={styles.activityDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activityText}>{act.description}</Text>
              <Text style={styles.activityTime}>{new Date(act.created_at).toLocaleString()}</Text>
            </View>
          </View>
        ))}
        {(!data.activities || data.activities.length === 0) && <Text style={styles.empty}>No activities yet</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Follow-ups</Text>
        {(data.followUps || []).map((fu) => (
          <View key={fu.id} style={styles.followupItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.followupType}>{fu.type}</Text>
              <Text style={styles.followupTime}>{new Date(fu.due_date).toLocaleString()}</Text>
            </View>
            <View style={[styles.followupStatus, { backgroundColor: fu.status === 'completed' ? '#d1fae5' : fu.status === 'pending' ? '#fef3c7' : '#f1f5f9' }]}>
              <Text style={{ fontSize: 11, color: fu.status === 'completed' ? '#059669' : fu.status === 'pending' ? '#b45309' : '#475569' }}>{fu.status}</Text>
            </View>
          </View>
        ))}
        {(!data.followUps || data.followUps.length === 0) && <Text style={styles.empty}>No follow-ups</Text>}
      </View>
    </ScrollView>
  );
}

function ActionButton({ icon, label, onPress, disabled, color }) {
  return (
    <TouchableOpacity style={[styles.actionButton, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled}>
      <Icon name={icon} size={22} color={color} />
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loading: { textAlign: 'center', marginTop: 40, color: '#94a3b8' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backButton: { padding: 8, marginRight: 8 },
  leadName: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  leadCity: { fontSize: 13, color: '#64748b', marginTop: 2 },
  stageBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  stageText: { fontSize: 12, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-around', padding: 16, backgroundColor: '#fff', marginBottom: 8 },
  actionButton: { alignItems: 'center', flex: 1 },
  actionLabel: { fontSize: 11, color: '#64748b', marginTop: 4 },
  card: { backgroundColor: '#fff', margin: 16, marginTop: 0, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  detailLabel: { fontSize: 14, color: '#64748b' },
  detailValue: { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  notesContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f8fafc' },
  notesLabel: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  notesText: { fontSize: 14, color: '#0f172a' },
  activityItem: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb', marginRight: 12, marginTop: 5 },
  activityText: { fontSize: 14, color: '#0f172a' },
  activityTime: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  followupItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  followupType: { fontSize: 14, fontWeight: '500', color: '#0f172a' },
  followupTime: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  followupStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  empty: { color: '#94a3b8', textAlign: 'center', paddingVertical: 16 },
});
