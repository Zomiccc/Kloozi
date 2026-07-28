import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Zap, Bot, BarChart3, Check } from 'lucide-react';
import useAuthStore from '../stores/authStore';

function getPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const strengthLabels = ['Weak', 'Fair', 'Strong', 'Very Strong'];
const strengthColors = ['#FF3B5C', '#FF9500', '#34C759', '#0066FF'];

export default function Signup() {
  const navigate = useNavigate();
  const { signup, loading } = useAuthStore();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', companyName: '', phone: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      await signup(form);
      toast.success('Account created successfully!');
      navigate('/app');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Signup failed');
    }
  };

  const strength = getPasswordStrength(form.password);

  return (
    <div className="min-h-screen flex items-center justify-center page-bg px-4 py-10">
      {/* Decorative gradient blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #0066FF, transparent 70%)' }} />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #FF3B5C, transparent 70%)' }} />

      <div className="relative z-10 w-full max-w-[480px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 animate-slide-up">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl mb-4 shadow-card"
            style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}
          >
            Z
          </div>
          <h1 className="text-3xl font-extrabold text-ink-primary tracking-tight">Create your account</h1>
          <p className="text-base font-semibold text-ink-secondary mt-2">Start your 14-day free trial — no card required</p>
        </div>

        {/* Card */}
        <div className="card animate-scale-in" style={{ padding: '32px' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-ink-primary mb-1.5">First Name</label>
                <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input" required placeholder="John" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-primary mb-1.5">Last Name</label>
                <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input" required placeholder="Doe" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-primary mb-1.5">Company Name</label>
              <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="input" required placeholder="Acme Inc." />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-primary mb-1.5">Work Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" required placeholder="you@company.com" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-primary mb-1.5">Phone <span className="text-ink-tertiary font-normal">(optional)</span></label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" placeholder="+1 555 000 0000" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-primary mb-1.5">Password</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" required minLength="8" placeholder="Min 8 characters" />
              {form.password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-1.5 flex-1 rounded-full transition-all duration-300"
                        style={{ background: i < strength ? strengthColors[strength - 1] : '#E5E5EA' }}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-semibold mt-1.5" style={{ color: strength > 0 ? strengthColors[strength - 1] : '#AEAEB2' }}>
                    {strength > 0 ? strengthLabels[strength - 1] : ''}
                  </p>
                </div>
              )}
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full" style={{ minHeight: '48px' }}>
              {loading ? 'Creating account...' : <>Create Account <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-surface-border" />
            <span className="text-xs font-semibold text-ink-tertiary uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-surface-border" />
          </div>

          <button
            onClick={() => (window.location.href = '/api/auth/google')}
            className="btn btn-ghost w-full mt-4"
            style={{ minHeight: '48px' }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
          </button>

          <p className="text-xs text-ink-tertiary mt-5 text-center">
            By signing up you agree to our Terms of Service and Privacy Policy
          </p>
        </div>

        <div className="mt-6 text-center">
          <span className="text-sm text-ink-secondary">Already have an account? </span>
          <Link to="/login" className="text-sm text-accent-blue hover:underline font-bold">Sign in</Link>
        </div>

        {/* Feature pills */}
        <div className="flex items-center justify-center gap-6 mt-8 animate-fade-in">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-tertiary">
            <Zap size={14} className="text-accent-orange" /> Instant capture
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-tertiary">
            <Bot size={14} className="text-accent-purple" /> AI follow-ups
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-tertiary">
            <BarChart3 size={14} className="text-accent-blue" /> Smart analytics
          </div>
        </div>
      </div>
    </div>
  );
}

