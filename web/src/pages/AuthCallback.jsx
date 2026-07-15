import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    const refresh = params.get('refresh');
    if (token && refresh) {
      localStorage.setItem('accessToken', token);
      localStorage.setItem('refreshToken', refresh);
      navigate('/');
    } else {
      navigate('/login');
    }
  }, []);

  return <div className="min-h-screen flex items-center justify-center"><p className="text-dark-400">Processing authentication...</p></div>;
}
