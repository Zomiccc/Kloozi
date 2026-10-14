import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import API from '../lib/api';

export default function AcceptInvitation() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.post('/auth/accept-invitation', { token, ...form });
      toast.success('Invitation accepted! Please login');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center page-bg px-4">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 flex items-center justify-center text-white font-bold text-xl mb-3" style={{ background: '#EDE9FF', borderRadius: '8px' }}>F</div>
          <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650, letterSpacing: '-0.01em' }}>Join the team</h1>
          <p className="text-ink-secondary mt-2" style={{ fontSize: '14px' }}>You've been invited to a Flazyn workspace</p>
        </div>

        <div className="hairline pt-6 space-y-6">
          <div className="space-y-1">
            <h2 className="text-ink-primary" style={{ fontSize: '20px', fontWeight: 600 }}>Set up your account</h2>
            <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Choose a password and you're in</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="meta-label mb-1">First name</p>
                <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input" placeholder="Jane" required />
              </div>
              <div>
                <p className="meta-label mb-1">Last name</p>
                <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input" placeholder="Doe" required />
              </div>
            </div>
            <div>
              <p className="meta-label mb-1">Password</p>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
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
            <button type="submit" disabled={loading} className="btn btn-primary w-full disabled:opacity-50 transition-opacity">
              {loading ? 'Creating account…' : 'Accept & create account'}
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
