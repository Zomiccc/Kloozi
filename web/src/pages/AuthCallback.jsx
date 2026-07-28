import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../stores/authStore';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const getProfile = useAuthStore((s) => s.getProfile);

  useEffect(() => {
    const token = params.get('token');
    const refresh = params.get('refresh');
    if (token && refresh) {
      localStorage.setItem('accessToken', token);
      localStorage.setItem('refreshToken', refresh);
      useAuthStore.setState({ isAuthenticated: true });
      getProfile().then(() => {
        navigate('/app');
      }).catch(() => {
        navigate('/login');
      });
    } else {
      navigate('/login');
    }
  }, []);

  return <div className="min-h-screen flex items-center justify-center bg-surface-page"><p className="text-ink-secondary font-semibold">Processing authentication...</p></div>;
}
