import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_BASE = __DEV__ ? 'http://10.0.2.2:5000/api' : 'https://api.crmfinal.com/api';

const api = axios.create({ baseURL: API_BASE, timeout: 30000 });

let isOnline = true;

try {
  const NetInfo = require('@react-native-community/netinfo').default;
  NetInfo.addEventListener((state) => {
    isOnline = state.isConnected;
  });
} catch (e) {
  // NetInfo not available, assume online
}

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        const res = await axios.post(`${API_BASE}/auth/refresh-token`, { refreshToken });
        await AsyncStorage.setItem('accessToken', res.data.accessToken);
        await AsyncStorage.setItem('refreshToken', res.data.refreshToken);
        original.headers.Authorization = `Bearer ${res.data.accessToken}`;
        return api(original);
      } catch {
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('refreshToken');
      }
    }
    return Promise.reject(error);
  }
);

const offlineQueue = [];

async function queueOfflineAction(method, url, data) {
  const action = { method, url, data, timestamp: Date.now() };
  offlineQueue.push(action);
  await AsyncStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
}

async function syncOfflineQueue() {
  if (!isOnline || offlineQueue.length === 0) return;
  const stored = await AsyncStorage.getItem('offlineQueue');
  if (!stored) return;
  const queue = JSON.parse(stored);
  const remaining = [];
  for (const action of queue) {
    try {
      await api({ method: action.method, url: action.url, data: action.data });
    } catch (err) {
      remaining.push(action);
    }
  }
  offlineQueue.length = 0;
  offlineQueue.push(...remaining);
  await AsyncStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
}

async function getCachedData(key) {
  const cached = await AsyncStorage.getItem(`cache:${key}`);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }
  return null;
}

async function setCachedData(key, data) {
  await AsyncStorage.setItem(`cache:${key}`, JSON.stringify({ data, timestamp: Date.now() }));
}

const offlineApi = {
  get: async (url, config) => {
    if (isOnline) {
      try {
        const res = await api.get(url, config);
        const cacheKey = url + JSON.stringify(config?.params || {});
        await setCachedData(cacheKey, res.data);
        return res;
      } catch (err) {
        if (!err.response) {
          const cacheKey = url + JSON.stringify(config?.params || {});
          const cached = await getCachedData(cacheKey);
          if (cached) return { data: cached.data };
        }
        throw err;
      }
    } else {
      const cacheKey = url + JSON.stringify(config?.params || {});
      const cached = await getCachedData(cacheKey);
      if (cached) return { data: cached.data };
      throw { response: { status: 0, data: { error: 'Offline mode - no cached data' } } };
    }
  },

  post: async (url, data, config) => {
    if (isOnline) {
      return api.post(url, data, config);
    } else {
      await queueOfflineAction('post', url, data);
      return { data: { message: 'Action queued for sync', offline: true } };
    }
  },

  put: async (url, data, config) => {
    if (isOnline) {
      return api.put(url, data, config);
    } else {
      await queueOfflineAction('put', url, data);
      return { data: { message: 'Action queued for sync', offline: true } };
    }
  },

  delete: async (url, config) => {
    if (isOnline) {
      return api.delete(url, config);
    } else {
      await queueOfflineAction('delete', url, null);
      return { data: { message: 'Action queued for sync', offline: true } };
    }
  },

  isOnline: () => isOnline,

  sync: syncOfflineQueue,

  getQueueLength: () => offlineQueue.length,
};

export default offlineApi;
