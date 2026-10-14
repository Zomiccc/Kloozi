import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../lib/api';
import { CountUp } from '../lib/motion';
import toast from 'react-hot-toast';
import { pillStyle } from '../components/ui';

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

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-ink-tertiary border-t-transparent rounded-full" /></div>;

  const currentPlan = subscription?.plan || 'free';
  const agentLimit = subscription?.agent_limit || (currentPlan === 'free' ? 1 : currentPlan === 'pro' ? 1 : currentPlan === 'team' ? 5 : 20);
  const usedAgents = subscription?.used_agents || 0;
  const isActive = subscription?.status === 'active';

  return (
    <div className="space-y-6">
      <h1 className="text-ink-primary" style={{ fontSize: '28px', fontWeight: 650, letterSpacing: '-0.01em' }}>Billing & subscription</h1>

      {/* Current plan */}
      <div className="hairline pt-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <p className="meta-label">Current plan</p>
            <p className="text-ink-primary capitalize" style={{ fontSize: '24px', fontWeight: 650 }}>{currentPlan}</p>
            <span className=" flex-shrink-0" style={pillStyle(isActive ? '#0E8A5F' : '#EDE9FF')}> {subscription?.status || 'active'}
            </span>
          </div>
          {currentPlan !== 'free' && <button onClick={handlePortal} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>Manage subscription</button>}
        </div>

        {/* Usage */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-ink-secondary" style={{ fontSize: '13px' }}>Agents</span>
              <span className="text-ink-primary mono" style={{ fontSize: '13px', fontWeight: 500 }}>{usedAgents} / {agentLimit}</span>
            </div>
            <div className="h-1 bg-surface-border overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${Math.min((usedAgents / agentLimit) * 100, 100)}%`, background: '#EDE9FF' }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-ink-secondary" style={{ fontSize: '13px' }}>Leads</span>
              <span className="text-ink-primary mono" style={{ fontSize: '13px', fontWeight: 500 }}>{subscription?.used_leads || 0} / {subscription?.lead_limit || 'Unlimited'}</span>
            </div>
            <div className="h-1 bg-surface-border overflow-hidden">
              <div className="h-full transition-all" style={{ width: subscription?.lead_limit ? `${Math.min(((subscription?.used_leads || 0) / subscription.lead_limit) * 100, 100)}%` : '15%', background: '#EDE9FF' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Plans — hairline rows instead of card grid */}
      <div className="hairline pt-4 space-y-4">
        <p className="meta-label">Available plans</p>
        <div className="space-y-0">
          {['free', 'pro', 'team', 'business'].map((plan, idx) => {
            const isCurrent = currentPlan === plan;
            return (
              <motion.div key={plan} initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: Math.min(idx * 0.08, 0.3), duration: 0.2 }} className="py-4 hairline-row">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-ink-primary capitalize" style={{ fontSize: '16px', fontWeight: 600 }}>{plan}</h3>
                      {isCurrent && <span className="text-ink-tertiary" style={{ fontSize: '12px' }}>· Current</span>}
                    </div>
                    <p className="text-ink-primary mono mt-1" style={{ fontSize: '20px', fontWeight: 500 }}><CountUp value={Number(plans[plan]?.price) || 0} prefix="$" /><span className="text-ink-tertiary" style={{ fontSize: '13px', fontWeight: 400 }}> /mo</span></p>
                  </div>
                  <div className="flex-shrink-0">
                    {isCurrent ? <span className="text-ink-tertiary" style={{ fontSize: '13px' }}>Current plan</span> : plan === 'free' ? <span className="text-ink-tertiary" style={{ fontSize: '13px' }}>Free</span> : <button onClick={() => handleUpgrade(plan)} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>Upgrade to {plan}</button>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  {(planFeatures[plan] || []).map((f, i) => (
                    <span key={i} className="flex items-center gap-1.5 text-ink-secondary" style={{ fontSize: '13px' }}>
                      <span className="w-1 h-1 rounded-full" style={{ background: '#EDE9FF' }} /> {f}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Invoices */}
      {invoices.length > 0 && (
        <div className="hairline pt-4 space-y-3">
          <p className="meta-label">Invoice history</p>
          <div>
            {invoices.map((inv, idx) => (
              <motion.div key={inv.id || idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }} className="flex items-center justify-between py-2.5 hairline-row">
                <div>
                  <p className="text-ink-primary mono" style={{ fontSize: '14px', fontWeight: 500 }}>${inv.amount} {inv.currency?.toUpperCase()}</p>
                  <p className="text-ink-tertiary" style={{ fontSize: '12px' }}>{new Date(inv.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className=" flex-shrink-0" style={pillStyle(inv.status === 'paid' ? '#0E8A5F' : '#EDE9FF')}> {inv.status}
                  </span>
                  {inv.invoice_url && <a href={inv.invoice_url} target="_blank" rel="noreferrer" className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '13px' }}>Download</a>}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
