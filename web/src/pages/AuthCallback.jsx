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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center page-bg">
      <div className="w-12 h-12 flex items-center justify-center text-white font-bold text-xl mb-4" style={{ background: '#EDE9FF', borderRadius: '8px' }}>F</div>
      <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Signing you in…</p>
      <div className="skeleton h-0.5 w-40 mt-4" />
    </div>
  );
}
