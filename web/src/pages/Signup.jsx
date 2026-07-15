import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../stores/authStore';

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
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Signup failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-900 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">C</div>
          <span className="font-bold text-2xl text-dark-900">CRM Final</span>
        </div>
        <h1 className="text-2xl font-bold text-dark-900 mb-2">Create your account</h1>
        <p className="text-dark-400 mb-6">Start your 14-day free trial</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">First Name</label>
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">Last Name</label>
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">Company Name</label>
            <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" required minLength="8" />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary w-full">{loading ? 'Creating account...' : 'Create account'}</button>
        </form>
        <div className="mt-6 text-center">
          <span className="text-sm text-dark-400">Already have an account? </span>
          <Link to="/login" className="text-sm text-primary-600 hover:underline font-medium">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
