import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../stores/authStore';

export default function Login() {
  const navigate = useNavigate();
  const { login, verify2FA, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [userId, setUserId] = useState(null);
  const [code, setCode] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await login(email, password);
      if (result?.requires2FA) {
        setShow2FA(true);
        setUserId(result.userId);
        toast.success('Verification code sent to your email');
      } else {
        toast.success('Login successful');
        navigate('/');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    }
  };

  const handle2FA = async (e) => {
    e.preventDefault();
    try {
      await verify2FA(userId, code);
      toast.success('Login successful');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid code');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-900 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">C</div>
          <span className="font-bold text-2xl text-dark-900">CRM Final</span>
        </div>

        {!show2FA ? (
          <>
            <h1 className="text-2xl font-bold text-dark-900 mb-2">Welcome back</h1>
            <p className="text-dark-400 mb-6">Sign in to your account</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required placeholder="you@company.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" required placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary w-full">{loading ? 'Signing in...' : 'Sign in'}</button>
            </form>
            <div className="mt-4 text-center">
              <Link to="/forgot-password" className="text-sm text-primary-600 hover:underline">Forgot password?</Link>
            </div>
            <div className="mt-6 text-center">
              <span className="text-sm text-dark-400">Don't have an account? </span>
              <Link to="/signup" className="text-sm text-primary-600 hover:underline font-medium">Sign up</Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-dark-900 mb-2">Two-Factor Authentication</h1>
            <p className="text-dark-400 mb-6">Enter the code sent to your email</p>
            <form onSubmit={handle2FA} className="space-y-4">
              <input type="text" value={code} onChange={(e) => setCode(e.target.value)} className="input text-center text-2xl tracking-widest" maxLength="6" placeholder="000000" required />
              <button type="submit" disabled={loading} className="btn btn-primary w-full">{loading ? 'Verifying...' : 'Verify'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
