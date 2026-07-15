import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import API from '../lib/api';

export default function AcceptInvitation() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post('/auth/accept-invitation', { token, ...form });
      toast.success('Invitation accepted! Please login');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid invitation');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-900 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-dark-900 mb-2">Accept Invitation</h1>
        <p className="text-dark-400 mb-6">Set up your account</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input" placeholder="First name" required />
          <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input" placeholder="Last name" required />
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" placeholder="Password (min 8 chars)" required minLength="8" />
          <button type="submit" className="btn btn-primary w-full">Accept & Create Account</button>
        </form>
      </div>
    </div>
  );
}
