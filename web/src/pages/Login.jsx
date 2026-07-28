import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, ArrowRight, Zap, Bot, BarChart3, ShieldCheck } from 'lucide-react';
import useAuthStore from '../stores/authStore';

const taglines = [
  'Close more. Chase less.',
  'Every lead, captured instantly.',
  'Your AI sales co-pilot.',
  'Analytics that make sense.',
];

export default function Login() {
  const navigate = useNavigate();
  const { login, verify2FA, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [userId, setUserId] = useState(null);
  const [code, setCode] = useState('');
  const [taglineIndex, setTaglineIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIndex((prev) => (prev + 1) % taglines.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

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
        navigate('/app');
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
      navigate('/app');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid code');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center page-bg px-4">
      {/* Decorative gradient blobs */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #FF3B5C, transparent 70%)' }} />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #0066FF, transparent 70%)' }} />

      <div className="relative z-10 w-full max-w-[440px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 animate-slide-up">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl mb-4 shadow-card"
            style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}
          >
            Z
          </div>
          <h1 className="text-3xl font-extrabold text-ink-primary tracking-tight">Zomic CRM</h1>
          <div className="h-7 mt-2 overflow-hidden">
            <p
              key={taglineIndex}
              className="text-base font-semibold text-ink-secondary animate-slide-up"
            >
              {taglines[taglineIndex]}
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="card animate-scale-in" style={{ padding: '32px' }}>
          {!show2FA ? (
            <>
              <h2 className="text-xl font-bold text-ink-primary mb-1">Welcome back</h2>
              <p className="text-sm text-ink-secondary mb-6">Sign in to your account to continue</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-ink-primary mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input pl-11"
                      required
                      placeholder="you@company.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ink-primary mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input pr-11"
                      required
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-primary transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-sm text-accent-blue hover:underline font-semibold">
                    Forgot password?
                  </Link>
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary w-full" style={{ minHeight: '48px' }}>
                  {loading ? 'Signing in...' : <>Sign In <ArrowRight size={18} /></>}
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
                Continue with Google
              </button>

              <div className="mt-6 text-center">
                <span className="text-sm text-ink-secondary">Don't have an account? </span>
                <Link to="/signup" className="text-sm text-accent-blue hover:underline font-bold">
                  Start free trial
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-accent-blue/10 flex items-center justify-center mb-4">
                  <ShieldCheck size={28} className="text-accent-blue" />
                </div>
                <h2 className="text-xl font-bold text-ink-primary mb-1">Two-Factor Authentication</h2>
                <p className="text-sm text-ink-secondary text-center">Enter the 6-digit code sent to your email</p>
              </div>
              <form onSubmit={handle2FA} className="space-y-4">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="input text-center text-2xl tracking-[0.5em] font-bold"
                  maxLength="6"
                  placeholder="000000"
                  required
                />
                <button type="submit" disabled={loading} className="btn btn-primary w-full" style={{ minHeight: '48px' }}>
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShow2FA(false); setCode(''); }}
                  className="w-full text-sm text-ink-secondary hover:text-ink-primary font-semibold transition-colors"
                >
                  Back to sign in
                </button>
              </form>
            </>
          )}
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

