import { useState, useEffect } from 'react';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { Check, X, CreditCard, Download } from 'lucide-react';

const planFeatures = {
  free: ['Up to 100 leads', '1 agent', 'Basic lead management', 'No email system'],
  pro: ['Unlimited leads', '1 agent', 'Full email system', 'WhatsApp integration', 'All campaigns', 'Content tracking'],
  team: ['Unlimited leads', 'Up to 5 agents', 'Everything in Pro', 'Team management', 'Manager dashboard', 'Agent performance reports'],
  business: ['Unlimited leads', 'Up to 20 agents', 'Everything in Team', 'All integrations', 'Advanced analytics', 'Priority support'],
};

export default function Billing() {
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [plans, setPlans] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBilling(); }, []);

  const loadBilling = async () => {
    try {
      const [subRes, planRes] = await Promise.all([API.get('/billing/subscription'), API.get('/billing/plans')]);
      setSubscription(subRes.data.subscription);
      setInvoices(subRes.data.invoices || []);
      setPlans(planRes.data.plans);
    } catch { toast.error('Failed to load billing'); }
    finally { setLoading(false); }
  };

  const handleUpgrade = async (plan) => {
    try {
      const res = await API.post('/billing/checkout', { plan, billing_cycle: 'monthly' });
      window.location.href = res.data.checkoutUrl;
    } catch { toast.error('Failed to start checkout'); }
  };

  const handlePortal = async () => {
    try { const res = await API.post('/billing/portal'); window.location.href = res.data.portalUrl; }
    catch { toast.error('Failed to open billing portal'); }
  };

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-dark-900">Billing & Subscription</h1>

      <div className="card flex items-center justify-between">
        <div><p className="text-sm text-dark-400">Current Plan</p><p className="text-2xl font-bold capitalize">{subscription?.plan || 'Free'}</p><p className="text-sm text-dark-400 mt-1">Status: <span className="capitalize">{subscription?.status || 'active'}</span></p></div>
        {subscription?.plan !== 'free' && <button onClick={handlePortal} className="btn btn-secondary">Manage Subscription</button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {['free', 'pro', 'team', 'business'].map(plan => (
          <div key={plan} className={`card ${subscription?.plan === plan ? 'border-primary-500 border-2' : ''}`}>
            <h3 className="font-bold text-lg capitalize">{plan}</h3>
            <p className="text-3xl font-bold text-dark-900 my-2">${plans[plan]?.price || 0}<span className="text-sm font-normal text-dark-400">/mo</span></p>
            <ul className="space-y-2 mb-4">
              {(planFeatures[plan] || []).map((f, i) => <li key={i} className="flex items-center gap-2 text-sm text-dark-600"><Check size={14} className="text-green-500" /> {f}</li>)}
            </ul>
            {subscription?.plan === plan ? <span className="btn btn-secondary w-full block text-center">Current Plan</span> : <button onClick={() => handleUpgrade(plan)} className="btn btn-primary w-full">Upgrade to {plan}</button>}
          </div>
        ))}
      </div>

      {invoices.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4">Invoice History</h3>
          <div className="space-y-2">
            {invoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-2 border-b border-dark-50 last:border-0">
                <div><p className="text-sm font-medium">${inv.amount} {inv.currency.toUpperCase()}</p><p className="text-xs text-dark-400">{new Date(inv.created_at).toLocaleDateString()}</p></div>
                <div className="flex items-center gap-2"><span className={`badge ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{inv.status}</span>{inv.invoice_url && <a href={inv.invoice_url} target="_blank" className="text-primary-600"><Download size={16} /></a>}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
