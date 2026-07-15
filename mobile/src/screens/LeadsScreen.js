import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, RefreshControl, Modal } from 'react-native';
import api from '../services/api';
import { showMessage } from 'react-native-flash-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function LeadsScreen({ navigation }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { loadLeads(1); }, []);

  const loadLeads = async (pageNum = 1, append = false) => {
    try {
      const res = await api.get('/leads', { params: { page: pageNum, limit: 50, search } });
      setLeads(append ? [...leads, ...res.data.leads] : res.data.leads);
      setTotal(res.data.pagination.total);
      setPage(pageNum);
    } catch { showMessage({ message: 'Failed to load leads', type: 'danger' }); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = useCallback(() => { setRefreshing(true); loadLeads(1); }, [search]);

  const loadMore = () => {
    if (leads.length < total) loadLeads(page + 1, true);
  };

  const stageColors = {
    new: { bg: '#dbeafe', text: '#1d4ed8' },
    contacted: { bg: '#e9d5ff', text: '#7c3aed' },
    interested: { bg: '#fef3c7', text: '#b45309' },
    negotiating: { bg: '#ffedd5', text: '#c2410c' },
    won: { bg: '#d1fae5', text: '#059669' },
    lost: { bg: '#fee2e2', text: '#dc2626' },
  };

  const scoreColor = (score) => score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';

  const renderLead = ({ item }) => {
    const sc = stageColors[item.stage] || stageColors.new;
    return (
      <TouchableOpacity
        style={styles.leadCard}
        onPress={() => navigation.navigate('LeadDetail', { id: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.leadHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.leadName}>{item.first_name} {item.last_name}</Text>
            <Text style={styles.leadPhone}>{item.phone || 'No phone'}</Text>
          </View>
          <View style={[styles.stageBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.stageText, { color: sc.text }]}>{item.stage}</Text>
          </View>
        </View>
        <View style={styles.leadFooter}>
          <Text style={styles.leadMeta}>{item.city || 'No city'} • {item.lead_source}</Text>
          <View style={[styles.scoreBadge, { backgroundColor: scoreColor(item.score) }]}>
            <Text style={styles.scoreText}>{item.score}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leads</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.addButton}>
          <Icon name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color="#94a3b8" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search leads..."
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => loadLeads(1)}
          returnKeyType="search"
        />
      </View>
      <FlatList
        data={leads}
        keyExtractor={(item) => item.id}
        renderItem={renderLead}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!loading && <Text style={styles.empty}>No leads found</Text>}
      />
      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); loadLeads(1); }} />}
    </View>
  );
}

function AddLeadModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', city: '', budget: '', notes: '' });

  const handleSave = async () => {
    if (!form.first_name) { showMessage({ message: 'First name required', type: 'danger' }); return; }
    try {
      await api.post('/leads', form);
      showMessage({ message: 'Lead created', type: 'success' });
      onCreated();
    } catch (err) {
      showMessage({ message: err.response?.data?.error || 'Failed to create lead', type: 'danger' });
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add New Lead</Text>
          <TouchableOpacity onPress={onClose}><Icon name="close" size={24} color="#64748b" /></TouchableOpacity>
        </View>
        <View style={styles.modalBody}>
          <View style={styles.modalRow}>
            <TextInput style={[styles.modalInput, { flex: 1, marginRight: 8 }]} placeholder="First Name *" value={form.first_name} onChangeText={(v) => setForm({ ...form, first_name: v })} />
            <TextInput style={[styles.modalInput, { flex: 1 }]} placeholder="Last Name" value={form.last_name} onChangeText={(v) => setForm({ ...form, last_name: v })} />
          </View>
          <View style={styles.modalRow}>
            <TextInput style={[styles.modalInput, { flex: 1, marginRight: 8 }]} placeholder="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
            <TextInput style={[styles.modalInput, { flex: 1 }]} placeholder="Email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" />
          </View>
          <View style={styles.modalRow}>
            <TextInput style={[styles.modalInput, { flex: 1, marginRight: 8 }]} placeholder="City" value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} />
            <TextInput style={[styles.modalInput, { flex: 1 }]} placeholder="Budget" value={form.budget} onChangeText={(v) => setForm({ ...form, budget: v })} keyboardType="numeric" />
          </View>
          <TextInput style={[styles.modalInput, { height: 80 }]} placeholder="Notes" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} multiline />
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Create Lead</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
  addButton: { width: 40, height: 40, backgroundColor: '#2563eb', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, fontSize: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  leadCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  leadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  leadName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  leadPhone: { fontSize: 13, color: '#64748b', marginTop: 2 },
  stageBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  stageText: { fontSize: 12, fontWeight: '600' },
  leadFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  leadMeta: { fontSize: 12, color: '#94a3b8' },
  scoreBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  scoreText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  empty: { textAlign: 'center', color: '#94a3b8', paddingVertical: 40 },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginTop: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  modalBody: { padding: 20 },
  modalRow: { flexDirection: 'row', marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 12 },
  saveButton: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
