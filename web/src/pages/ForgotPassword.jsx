import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import API from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.post('/auth/forgot-password', { email });
      setSent(true);
      toast.success('Reset link sent if account exists');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center page-bg px-4">
      <motion.div className="w-full max-w-[400px]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 flex items-center justify-center text-white font-bold text-xl mb-3" style={{ background: '#EDE9FF', borderRadius: '8px' }}>F</div>
          <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650, letterSpacing: '-0.01em' }}>Flazyn</h1>
        </div>

        <div className="hairline pt-6 space-y-6">
          {sent ? (
            <>
              <div className="space-y-2">
                <h2 className="text-ink-primary" style={{ fontSize: '20px', fontWeight: 600 }}>Check your email</h2>
                <p className="text-ink-secondary" style={{ fontSize: '14px' }}>If an account exists with that email, a reset link has been sent.</p>
              </div>
              <Link to="/login" className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>Back to login</Link>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="text-ink-primary" style={{ fontSize: '20px', fontWeight: 600 }}>Forgot password?</h2>
                <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Enter your email to receive a reset link</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><p className="meta-label mb-1">Email</p><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required placeholder="you@company.com" /></div>
                <button type="submit" disabled={loading} className="btn btn-primary w-full disabled:opacity-50 transition-opacity">{loading ? 'Sending...' : 'Send reset link'}</button>
              </form>
              <Link to="/login" className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>Back to login</Link>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
