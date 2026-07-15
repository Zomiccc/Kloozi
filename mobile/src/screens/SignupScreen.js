import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import useAuthStore from '../stores/authStore';
import { showMessage } from 'react-native-flash-message';

export default function SignupScreen({ navigation }) {
  const { signup, loading } = useAuthStore();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', companyName: '', phone: '' });

  const handleSignup = async () => {
    if (!form.firstName || !form.email || !form.password || !form.companyName) {
      showMessage({ message: 'Please fill required fields', type: 'danger' }); return;
    }
    if (form.password.length < 8) { showMessage({ message: 'Password must be 8+ characters', type: 'danger' }); return; }
    try {
      await signup(form);
      showMessage({ message: 'Account created!', type: 'success' });
    } catch (err) {
      showMessage({ message: err.response?.data?.error || 'Signup failed', type: 'danger' });
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Start your 14-day free trial</Text>
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} placeholder="First Name *" value={form.firstName} onChangeText={(v) => setForm({ ...form, firstName: v })} />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Last Name" value={form.lastName} onChangeText={(v) => setForm({ ...form, lastName: v })} />
        </View>
        <TextInput style={styles.input} placeholder="Company Name *" value={form.companyName} onChangeText={(v) => setForm({ ...form, companyName: v })} />
        <TextInput style={styles.input} placeholder="Email *" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="Password (min 8 chars) *" value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} secureTextEntry />
        <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create Account'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2563eb' },
  content: { padding: 24, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: 60, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#0f172a', marginTop: 20 },
  subtitle: { fontSize: 16, color: '#64748b', marginBottom: 24 },
  row: { flexDirection: 'row' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#2563eb', textAlign: 'center', fontSize: 14 },
});
