/**
 * Start ngrok tunnel for Flazyn webhooks
 * Usage: node start-ngrok.js
 */
const http = require('http');

const BACKEND_PORT = 5000;
const NGROK_API = 'http://127.0.0.1:4040';

async function checkNgrokApi() {
  return new Promise((resolve) => {
    const req = http.get(`${NGROK_API}/api/tunnels`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(3000, () => { req.destroy(); resolve(null); });
  });
}

async function main() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║     FLAZYN CRM - ngrok Tunnel Setup                ║');
  console.log('╚════════════════════════════════════════════════════╝');
  
  // Check if ngrok is already running
  const existing = await checkNgrokApi();
  if (existing && existing.tunnels && existing.tunnels.length > 0) {
    const tunnel = existing.tunnels.find(t => t.public_url?.startsWith('https'));
    if (tunnel) {
      console.log(`\n✅ ngrok is ALREADY running!`);
      console.log(`   URL: ${tunnel.public_url}`);
      console.log(`   Forwarding: ${tunnel.config?.addr || '-> localhost:5000'}`);
      printWebhookUrls(tunnel.public_url);
      return;
    }
  }
  
  console.log('\n🚀 Starting ngrok tunnel...');
  console.log(`   ngrok http ${BACKEND_PORT}`);
  console.log(`   (Run this in a NEW terminal window)`);
  console.log('');
  console.log('   Command:');
  console.log(`   npx ngrok http ${BACKEND_PORT}`);
  console.log('');
  console.log('   After starting, re-run this script to get URLs:');
  console.log('   node start-ngrok.js');
  
  // Print instructions with placeholder
  printWebhookUrls('https://YOUR_NGROK_URL.ngrok.io');
}

function printWebhookUrls(baseUrl) {
  console.log('\n════════════════════════════════════════════════════');
  console.log('📋 Meta Developer Console Configuration');
  console.log('════════════════════════════════════════════════════');
  
  console.log('\n📱 WhatsApp Business API:');
  console.log('─'.repeat(50));
  console.log(`   Go to: https://developers.facebook.com/apps/1750888202818247/whatsapp/business/wa-dev-console`);
  console.log(`   Callback URL: ${baseUrl}/api/whatsapp/webhook`);
  console.log(`   Verify Token: flazyn_wa_verify_2026`);
  console.log(`   Subscribe: messages`);
  
  console.log('\n📘 Facebook Lead Ads (OAuth):');
  console.log('─'.repeat(50));
  console.log(`   Go to: https://developers.facebook.com/apps/1750888202818247/facebook-login/settings/`);
  console.log(`   Valid OAuth Redirect URIs:`);
  console.log(`   ${baseUrl}/api/integrations/oauth/facebook/callback`);
  
  console.log('\n📘 Facebook Lead Ads (Webhook):');
  console.log('─'.repeat(50));
  console.log(`   Go to: https://developers.facebook.com/apps/1750888202818247/webhooks/`);
  console.log(`   Callback URL: ${baseUrl}/api/integrations/webhook/facebook`);
  console.log(`   Verify Token: flazyn_verify_2026`);
  console.log(`   Subscribe: leadgen`);
  
  console.log('\n🧪 Webhook Verification Tests:');
  console.log('─'.repeat(50));
  console.log(`   WhatsApp: curl -G "${baseUrl}/api/whatsapp/webhook" --data-urlencode "hub.mode=subscribe" --data-urlencode "hub.verify_token=flazyn_wa_verify_2026" --data-urlencode "hub.challenge=test123"`);
  console.log(`   Facebook: curl -G "${baseUrl}/api/integrations/webhook/facebook" --data-urlencode "hub.mode=subscribe" --data-urlencode "hub.verify_token=flazyn_verify_2026" --data-urlencode "hub.challenge=test456"`);
  console.log(`   OAuth:    ${baseUrl}/api/integrations/oauth/config`);
  
  console.log('\n✅ Webhook URLs ready for Meta Developer Console configuration!');
}

main().catch(console.error);