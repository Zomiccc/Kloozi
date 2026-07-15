import { useState } from 'react';
import { Link } from 'react-router-dom';
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-900 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">C</div>
          <span className="font-bold text-2xl text-dark-900">CRM Final</span>
        </div>
        {sent ? (
          <>
            <h1 className="text-2xl font-bold text-dark-900 mb-2">Check your email</h1>
            <p className="text-dark-400 mb-6">If an account exists with that email, a reset link has been sent.</p>
            <Link to="/login" className="btn btn-primary w-full block text-center">Back to login</Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-dark-900 mb-2">Forgot password?</h1>
            <p className="text-dark-400 mb-6">Enter your email to receive a reset link</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required placeholder="you@company.com" />
              <button type="submit" disabled={loading} className="btn btn-primary w-full">{loading ? 'Sending...' : 'Send reset link'}</button>
            </form>
            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-primary-600 hover:underline">Back to login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
