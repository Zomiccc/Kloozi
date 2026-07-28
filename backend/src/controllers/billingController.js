const db = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');
const { sendEmail } = require('../services/emailService');

const stripe = require('stripe')(config.stripe.secretKey);

const PLAN_DETAILS = {
  free: { name: 'Free', price: 0, agentLimit: 1, features: ['basic_lead_management'] },
  pro: { name: 'Pro', price: 19, agentLimit: 1, features: ['full_email_system', 'whatsapp', 'campaigns', 'content_tracking'] },
  team: { name: 'Team', price: 49, agentLimit: 5, features: ['everything_pro', 'team_management', 'manager_dashboard', 'agent_reports'] },
  business: { name: 'Business', price: 99, agentLimit: 20, features: ['everything_team', 'all_integrations', 'advanced_analytics', 'priority_support'] },
  enterprise: { name: 'Enterprise', price: null, agentLimit: null, features: ['white_label', 'dedicated_support', 'custom_integrations', 'sla'] },
};

exports.getPlans = async (req, res) => {
  res.json({ plans: PLAN_DETAILS });
};

exports.getCurrentSubscription = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT s.*, w.name as workspace_name, w.plan
       FROM subscriptions s JOIN workspaces w ON s.workspace_id = w.id
       WHERE s.workspace_id = $1`,
      [req.workspaceId]
    );
    const invoicesResult = await db.query(
      'SELECT * FROM invoices WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 10',
      [req.workspaceId]
    );
    res.json({ subscription: result.rows[0] || { plan: 'free', status: 'active' }, invoices: invoicesResult.rows });
  } catch (err) { next(err); }
};

exports.createCheckoutSession = async (req, res, next) => {
  try {
    const { plan, billing_cycle } = req.body;
    const planDetails = PLAN_DETAILS[plan];
    if (!planDetails || planDetails.price === null) return res.status(400).json({ error: 'Invalid plan' });
    if (planDetails.price === 0) return res.status(400).json({ error: 'Free plan does not require checkout' });

    let customerId;
    const subResult = await db.query('SELECT stripe_customer_id FROM subscriptions WHERE workspace_id = $1', [req.workspaceId]);

    if (subResult.rows.length > 0 && subResult.rows[0].stripe_customer_id) {
      customerId = subResult.rows[0].stripe_customer_id;
    } else {
      const workspaceResult = await db.query('SELECT name FROM workspaces WHERE id = $1', [req.workspaceId]);
      const userResult = await db.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
      const customer = await stripe.customers.create({
        email: userResult.rows[0]?.email,
        name: workspaceResult.rows[0]?.name,
        metadata: { workspace_id: req.workspaceId },
      });
      customerId = customer.id;
    }

    const cycle = billing_cycle === 'yearly' ? 'year' : 'month';
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `${planDetails.name} Plan` },
          unit_amount: planDetails.price * 100,
          recurring: { interval: cycle },
        },
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${config.webUrl}/app/billing?success=true`,
      cancel_url: `${config.webUrl}/app/billing?canceled=true`,
      metadata: { workspace_id: req.workspaceId, plan },
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    logger.error('Stripe checkout error:', err.message);
    next(err);
  }
};

exports.createPortalSession = async (req, res, next) => {
  try {
    const subResult = await db.query('SELECT stripe_customer_id FROM subscriptions WHERE workspace_id = $1', [req.workspaceId]);
    if (!subResult.rows[0]?.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found' });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: subResult.rows[0].stripe_customer_id,
      return_url: `${config.webUrl}/app/billing`,
    });
    res.json({ portalUrl: session.url });
  } catch (err) { next(err); }
};

exports.handleWebhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
  } catch (err) {
    logger.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const workspaceId = session.metadata?.workspace_id;
        const plan = session.metadata?.plan;
        if (workspaceId && plan) {
          await db.query(
            `UPDATE subscriptions SET plan = $1, status = 'active', stripe_customer_id = $2, stripe_subscription_id = $3,
                    current_period_start = NOW(), current_period_end = NOW() + INTERVAL '1 month'
             WHERE workspace_id = $4`,
            [plan, session.customer, session.subscription, workspaceId]
          );
          await db.query('UPDATE workspaces SET plan = $1, subscription_status = $2 WHERE id = $3', [plan, 'active', workspaceId]);
        }
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object;
        const workspaceResult = await db.query('SELECT workspace_id FROM subscriptions WHERE stripe_customer_id = $1', [invoice.customer]);
        if (workspaceResult.rows.length > 0) {
          await db.query(
            'INSERT INTO invoices (workspace_id, stripe_invoice_id, amount, currency, status, period_start, period_end, invoice_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [workspaceResult.rows[0].workspace_id, invoice.id, invoice.amount_paid / 100, invoice.currency, 'paid',
             new Date(invoice.period_start * 1000), new Date(invoice.period_end * 1000), invoice.hosted_invoice_url]
          );
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await db.query(
          'UPDATE subscriptions SET status = $1, current_period_start = $2, current_period_end = $3, cancel_at_period_end = $4 WHERE stripe_subscription_id = $5',
          [subscription.status, new Date(subscription.current_period_start * 1000), new Date(subscription.current_period_end * 1000), subscription.cancel_at_period_end, subscription.id]
        );
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await db.query(
          'UPDATE subscriptions SET plan = $1, status = $2 WHERE stripe_subscription_id = $3',
          ['free', 'canceled', subscription.id]
        );
        const wsResult = await db.query('SELECT workspace_id FROM subscriptions WHERE stripe_subscription_id = $1', [subscription.id]);
        if (wsResult.rows.length > 0) {
          await db.query('UPDATE workspaces SET plan = $1, subscription_status = $2 WHERE id = $3', ['free', 'canceled', wsResult.rows[0].workspace_id]);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const wsResult = await db.query('SELECT workspace_id FROM subscriptions WHERE stripe_customer_id = $1', [invoice.customer]);
        if (wsResult.rows.length > 0) {
          await db.query('UPDATE workspaces SET subscription_status = $1 WHERE id = $2', ['payment_failed', wsResult.rows[0].workspace_id]);
          const userResult = await db.query('SELECT email FROM users WHERE workspace_id = $1 AND role = $2', [wsResult.rows[0].workspace_id, 'admin']);
          if (userResult.rows.length > 0) {
            try {
              await sendEmail({
                to: userResult.rows[0].email,
                subject: 'Payment Failed - Action Required',
                text: 'Your subscription payment failed. Please update your payment method.',
                html: '<p>Your subscription payment failed. Please <a href="' + config.webUrl + '/billing">update your payment method</a>.</p>',
              });
            } catch (e) { logger.warn('Payment failed email error:', e.message); }
          }
        }
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Stripe webhook handler error:', err.message);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};

exports.getSuperAdminStats = async (req, res, next) => {
  try {
    const workspaces = await db.query('SELECT COUNT(*) as count FROM workspaces');
    const users = await db.query('SELECT COUNT(*) as count FROM users WHERE status = $1', ['active']);
    const leads = await db.query('SELECT COUNT(*) as count FROM leads');
    const byPlan = await db.query('SELECT plan, COUNT(*) as count FROM workspaces GROUP BY plan');
    res.json({
      totalWorkspaces: parseInt(workspaces.rows[0].count),
      totalUsers: parseInt(users.rows[0].count),
      totalLeads: parseInt(leads.rows[0].count),
      byPlan: byPlan.rows,
    });
  } catch (err) { next(err); }
};
