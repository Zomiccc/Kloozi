import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
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
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 flex items-center justify-center text-white font-bold text-xl mb-3" style={{ background: '#EDE9FF', borderRadius: '8px' }}>F</div>
          <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650, letterSpacing: '-0.01em' }}>Flazyn</h1>
          <div className="h-6 mt-2 overflow-hidden">
            <p key={taglineIndex} className="text-ink-secondary" style={{ fontSize: '14px' }}>{taglines[taglineIndex]}</p>
          </div>
        </div>

        {/* Form area */}
        <div className="hairline pt-6 space-y-6">
          {!show2FA ? (
            <>
              <div className="space-y-1">
                <h2 className="text-ink-primary" style={{ fontSize: '20px', fontWeight: 600 }}>Welcome back</h2>
                <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Sign in to your account to continue</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <p className="meta-label mb-1">Email</p>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required placeholder="you@company.com" />
                </div>
                <div>
                  <p className="meta-label mb-1">Password</p>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input pr-10"
                      required
                      placeholder="Enter your password"
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
                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '13px' }}>
                    Forgot password?
                  </Link>
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary w-full disabled:opacity-50 transition-opacity">
                  {loading ? 'Signing in...' : 'Sign in'}
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
                Continue with Google
              </button>

              <div className="text-center pt-2">
                <span className="text-ink-secondary" style={{ fontSize: '14px' }}>Don't have an account? </span>
                <Link to="/signup" className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '14px', fontWeight: 500 }}>
                  Start free trial
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2 text-center">
                <h2 className="text-ink-primary" style={{ fontSize: '20px', fontWeight: 600 }}>Two-factor authentication</h2>
                <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Enter the 6-digit code sent to your email</p>
              </div>
              <form onSubmit={handle2FA} className="space-y-4">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="input text-center mono"
                  style={{ fontSize: '20px', letterSpacing: '0.4em', fontWeight: 600 }}
                  maxLength="6"
                  placeholder="000000"
                  required
                />
                <button type="submit" disabled={loading} className="btn btn-primary w-full disabled:opacity-50 transition-opacity">
                  {loading ? 'Verifying...' : 'Verify code'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShow2FA(false); setCode(''); }}
                  className="w-full text-ink-secondary hover:text-ink-primary transition-colors"
                  style={{ fontSize: '14px' }}
                >
                  Back to sign in
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

