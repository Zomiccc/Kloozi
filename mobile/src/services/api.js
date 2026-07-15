import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = __DEV__ ? 'http://10.0.2.2:5000/api' : 'https://api.crmfinal.com/api';

const api = axios.create({ baseURL: API_BASE, timeout: 30000 });

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

export default api;
