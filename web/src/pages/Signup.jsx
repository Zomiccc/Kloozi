import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import useAuthStore from '../stores/authStore';

function getPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const strengthLabels = ['Weak', 'Fair', 'Strong', 'Very strong'];

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
      <motion.div className="w-full max-w-[460px]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 flex items-center justify-center text-white font-bold text-xl mb-3" style={{ background: '#EDE9FF', borderRadius: '8px' }}>F</div>
          <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650, letterSpacing: '-0.01em' }}>Create your account</h1>
          <p className="text-ink-secondary mt-2" style={{ fontSize: '14px' }}>Start your 14-day free trial — no card required</p>
        </div>

        {/* Form area */}
        <div className="hairline pt-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="meta-label mb-1">First name</p>
                <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input" required placeholder="John" />
              </div>
              <div>
                <p className="meta-label mb-1">Last name</p>
                <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input" required placeholder="Doe" />
              </div>
            </div>
            <div>
              <p className="meta-label mb-1">Company name</p>
              <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="input" required placeholder="Acme Inc." />
            </div>
            <div>
              <p className="meta-label mb-1">Work email</p>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" required placeholder="you@company.com" />
            </div>
            <div>
              <p className="meta-label mb-1">Phone <span className="text-ink-tertiary">(optional)</span></p>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input mono" placeholder="+1 555 000 0000" />
            </div>
            <div>
              <p className="meta-label mb-1">Password</p>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" required minLength="8" placeholder="Min 8 characters" />
              {form.password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 transition-all duration-300"
                        style={{ background: i < strength ? (strength <= 1 ? '#B45309' : strength === 2 ? '#EDE9FF' : '#0E8A5F') : '#E7E5E4' }}
                      />
                    ))}
                  </div>
                  <p className="text-ink-tertiary mt-1" style={{ fontSize: '12px' }}>
                    {strength > 0 ? strengthLabels[strength - 1] : ''}
                  </p>
                </div>
              )}
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full disabled:opacity-50 transition-opacity">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-surface-border" />
            <span className="text-ink-tertiary" style={{ fontSize: '12px' }}>or</span>
            <div className="flex-1 h-px bg-surface-border" />
          </div>

          <button
            onClick={() => (window.location.href = '/api/auth/google')}
            className="btn btn-ghost w-full"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" className="mr-2">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
          </button>

          <p className="text-ink-tertiary text-center" style={{ fontSize: '12px' }}>
            By signing up you agree to our <Link to="/terms" className="underline">Terms of Service</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>
          </p>
        </div>

        <div className="mt-6 text-center">
          <span className="text-ink-secondary" style={{ fontSize: '14px' }}>Already have an account? </span>
          <Link to="/login" className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '14px', fontWeight: 500 }}>Sign in</Link>
        </div>
      </motion.div>
    </div>
  );
}

