import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import API from '../lib/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await API.post('/auth/reset-password', { token, password });
      toast.success('Password reset successfully');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center page-bg px-4">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 flex items-center justify-center text-white font-bold text-xl mb-3" style={{ background: '#EDE9FF', borderRadius: '8px' }}>F</div>
          <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650, letterSpacing: '-0.01em' }}>New password</h1>
          <p className="text-ink-secondary mt-2" style={{ fontSize: '14px' }}>Pick something strong — you're back in business</p>
        </div>

        <div className="hairline pt-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="meta-label mb-1">New password</p>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Minimum 8 characters"
                  required minLength="8"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-primary transition-colors"
                  style={{ fontSize: '13px' }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div>
              <p className="meta-label mb-1">Confirm password</p>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input"
                placeholder="Type it once more"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full disabled:opacity-50 transition-opacity">
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>

          <div className="text-center pt-2 pb-4">
            <Link to="/login" className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '13px' }}>
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
