import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [plans, setPlans] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (searchParams.get('success') === 'true') toast.success('Subscription activated successfully!');
    if (searchParams.get('canceled') === 'true') toast.error('Checkout was canceled.');
    loadBilling();
  }, []);

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
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to start checkout'); }
  };

  const handlePortal = async () => {
    try { const res = await API.post('/billing/portal'); window.location.href = res.data.portalUrl; }
    catch { toast.error('Failed to open billing portal'); }
  };

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full" /></div>;

  const currentPlan = subscription?.plan || 'free';
  const agentLimit = subscription?.agent_limit || (currentPlan === 'free' ? 1 : currentPlan === 'pro' ? 1 : currentPlan === 'team' ? 5 : 20);
  const usedAgents = subscription?.used_agents || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-ink-primary tracking-tight">Billing & Subscription</h1>

      {/* Current plan + usage */}
      <div className="card stagger-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm font-semibold text-ink-secondary">Current Plan</p>
            <p className="text-3xl font-extrabold text-ink-primary capitalize">{currentPlan}</p>
            <p className="text-sm text-ink-secondary mt-1">Status: <span className="badge capitalize" style={{ background: subscription?.status === 'active' ? '#34C75910' : '#FF950010', color: subscription?.status === 'active' ? '#34C759' : '#FF9500' }}>{subscription?.status || 'active'}</span></p>
          </div>
          {currentPlan !== 'free' && <button onClick={handlePortal} className="btn btn-ghost">Manage Subscription</button>}
        </div>

        {/* Usage bars */}
        <div className="mt-6 space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="font-semibold text-ink-secondary">Agents</span>
              <span className="font-bold text-ink-primary">{usedAgents} / {agentLimit}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-page overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((usedAgents / agentLimit) * 100, 100)}%`, background: 'linear-gradient(90deg, #0066FF, #AF52DE)' }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="font-semibold text-ink-secondary">Leads</span>
              <span className="font-bold text-ink-primary">{subscription?.used_leads || 0} / {subscription?.lead_limit || 'Unlimited'}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-page overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: subscription?.lead_limit ? `${Math.min(((subscription?.used_leads || 0) / subscription.lead_limit) * 100, 100)}%` : '15%', background: 'linear-gradient(90deg, #34C759, #0066FF)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {['free', 'pro', 'team', 'business'].map(plan => {
          const isCurrent = currentPlan === plan;
          return (
            <div key={plan} className={`card card-hover stagger-in ${isCurrent ? '' : ''}`} style={isCurrent ? { borderColor: '#0066FF', borderWidth: '2px' } : {}}>
              <h3 className="font-extrabold text-lg text-ink-primary capitalize">{plan}</h3>
              <p className="text-3xl font-extrabold text-ink-primary my-2">${plans[plan]?.price || 0}<span className="text-sm font-normal text-ink-tertiary">/mo</span></p>
              <ul className="space-y-2 mb-4">
                {(planFeatures[plan] || []).map((f, i) => <li key={i} className="flex items-center gap-2 text-sm text-ink-secondary"><Check size={14} style={{ color: '#34C759' }} /> {f}</li>)}
              </ul>
              {isCurrent ? <span className="btn btn-ghost w-full" style={{ cursor: 'default' }}>Current Plan</span> : plan === 'free' ? <span className="btn btn-ghost w-full" style={{ cursor: 'default' }}>Free</span> : <button onClick={() => handleUpgrade(plan)} className="btn btn-primary w-full">Upgrade to {plan}</button>}
            </div>
          );
        })}
      </div>

      {/* Invoices */}
      {invoices.length > 0 && (
        <div className="card stagger-in">
          <h3 className="text-lg font-bold text-ink-primary mb-4">Invoice History</h3>
          <div className="space-y-1">
            {invoices.map((inv, idx) => (
              <div key={inv.id || idx} className="flex items-center justify-between py-2.5 border-b border-surface-border last:border-0">
                <div><p className="text-sm font-bold text-ink-primary">${inv.amount} {inv.currency?.toUpperCase()}</p><p className="text-xs text-ink-tertiary">{new Date(inv.created_at).toLocaleDateString()}</p></div>
                <div className="flex items-center gap-2"><span className="badge capitalize" style={{ background: inv.status === 'paid' ? '#34C75910' : '#FF950010', color: inv.status === 'paid' ? '#34C759' : '#FF9500' }}>{inv.status}</span>{inv.invoice_url && <a href={inv.invoice_url} target="_blank" style={{ color: '#0066FF' }}><Download size={16} /></a>}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
