import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  loading: false,

  init: async () => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      try {
        const res = await api.get('/team/profile');
        set({ user: res.data.profile, isAuthenticated: true });
      } catch {
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('refreshToken');
      }
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.requires2FA) { set({ loading: false }); return { requires2FA: true, userId: res.data.userId }; }
      await AsyncStorage.setItem('accessToken', res.data.accessToken);
      await AsyncStorage.setItem('refreshToken', res.data.refreshToken);
      set({ user: res.data.user, isAuthenticated: true, loading: false });
      return res.data;
    } catch (err) { set({ loading: false }); throw err; }
  },

  signup: async (data) => {
    set({ loading: true });
    try {
      const res = await api.post('/auth/signup', data);
      await AsyncStorage.setItem('accessToken', res.data.accessToken);
      await AsyncStorage.setItem('refreshToken', res.data.refreshToken);
      set({ user: res.data.user, isAuthenticated: true, loading: false });
      return res.data;
    } catch (err) { set({ loading: false }); throw err; }
  },

  logout: async () => {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    try { await api.post('/auth/logout', { refreshToken }); } catch {}
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    set({ user: null, isAuthenticated: false });
  },
}));

export default useAuthStore;
