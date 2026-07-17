import { create } from 'zustand';
import API from '../lib/api';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('accessToken'),
  loading: false,

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await API.post('/auth/login', { email, password });
      if (res.data.requires2FA) {
        set({ loading: false });
        return { requires2FA: true, userId: res.data.userId };
      }
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      if (res.data.user?.workspaceId) localStorage.setItem('workspaceId', res.data.user.workspaceId);
      set({ user: res.data.user, isAuthenticated: true, loading: false });
      return res.data;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  signup: async (data) => {
    set({ loading: true });
    try {
      const res = await API.post('/auth/signup', data);
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      if (res.data.user?.workspaceId) localStorage.setItem('workspaceId', res.data.user.workspaceId);
      set({ user: res.data.user, isAuthenticated: true, loading: false });
      return res.data;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  verify2FA: async (userId, code) => {
    set({ loading: true });
    try {
      const res = await API.post('/auth/verify-2fa', { userId, code });
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      if (res.data.user?.workspaceId) localStorage.setItem('workspaceId', res.data.user.workspaceId);
      set({ user: res.data.user, isAuthenticated: true, loading: false });
      return res.data;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      await API.post('/auth/logout', { refreshToken });
    } catch {}
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('workspaceId');
    set({ user: null, isAuthenticated: false });
  },

  getProfile: async () => {
    try {
      const res = await API.get('/team/profile');
      set({ user: res.data.profile });
      return res.data.profile;
    } catch (err) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ isAuthenticated: false });
      throw err;
    }
  },
}));

export default useAuthStore;
