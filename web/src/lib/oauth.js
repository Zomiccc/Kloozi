import toast from 'react-hot-toast';
import API from './api';

// Starts the "Connect" flow for an ad platform. App ids, scopes and the API
// version come from the backend, and the state is a signed, short-lived token
// so a callback can only ever land in the workspace that started it.
export async function startOAuth(provider) {
  try {
    const [{ data: cfg }, { data: st }] = await Promise.all([
      API.get('/integrations/oauth/config'),
      API.get('/integrations/oauth/state', { params: { provider } }),
    ]);
    const redirectUri = encodeURIComponent(`${cfg.apiUrl}/api/integrations/oauth/${provider}/callback`);
    const state = encodeURIComponent(st.state);

    if (provider === 'facebook') {
      if (!cfg.facebook?.appId) return toast.error('Facebook App ID is not configured on the server (FACEBOOK_APP_ID).');
      // Facebook Login for Business uses a dashboard Configuration (config_id) that holds the permissions;
      // classic Facebook Login takes them as `scope`.
      const permissions = cfg.facebook.configId
        ? `config_id=${encodeURIComponent(cfg.facebook.configId)}&override_default_response_type=true`
        : `scope=${encodeURIComponent(cfg.facebook.scopes.join(','))}`;
      window.location.href = `https://www.facebook.com/${cfg.facebook.graphVersion}/dialog/oauth?client_id=${cfg.facebook.appId}&redirect_uri=${redirectUri}&${permissions}&response_type=code&state=${state}`;
    } else if (provider === 'linkedin') {
      if (!cfg.linkedin?.clientId || cfg.linkedin.clientId === 'add_later') return toast.error('LinkedIn integration is awaiting API approval.');
      const scope = encodeURIComponent(cfg.linkedin.scopes.join(' '));
      window.location.href = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${cfg.linkedin.clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
    } else if (provider === 'tiktok') {
      if (!cfg.tiktok?.appId || cfg.tiktok.appId === 'add_later') return toast.error('TikTok integration is awaiting API approval.');
      window.location.href = `https://business-api.tiktok.com/portal/auth?app_id=${cfg.tiktok.appId}&redirect_uri=${redirectUri}&state=${state}`;
    }
  } catch (err) {
    toast.error(err.response?.data?.error || 'Could not start the connection — only admins can connect ad accounts.');
  }
}
