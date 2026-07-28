/**
 * Zomic CRM - Webhook Setup Script
 * 
 * This script:
 * 1. Starts an ngrok tunnel to expose localhost:5000
 * 2. Tests all webhook verification endpoints
 * 3. Provides ready-to-use URLs for Meta/Facebook configuration
 * 4. Tests the webhook endpoints end-to-end
 * 
 * Usage: node webhook-setup.js
 */

const http = require('http');
const https = require('https');

const BACKEND_PORT = 5000;
const BASE_URL = `http://localhost:${BACKEND_PORT}`;

// ─── Configuration ───
const WEBHOOKS = {
  whatsapp: {
    verifyToken: 'zomic_wa_verify_2026',
    verifyEndpoint: '/api/whatsapp/webhook',
    webhookEndpoint: '/api/whatsapp/webhook',
    subscribeField: 'messages',
    description: 'WhatsApp Business Cloud API',
  },
  facebook: {
    verifyToken: 'zomic_verify_2026',
    verifyEndpoint: '/api/integrations/webhook/facebook',
    webhookEndpoint: '/api/integrations/webhook/facebook',
    subscribeField: 'leadgen',
    description: 'Facebook Lead Ads',
  },
};

// ─── Helper: HTTP request ───
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── Test WhatsApp Webhook Verification ───
async function testWhatsAppWebhookVerify() {
  console.log('\n📱 Testing WhatsApp Webhook Verification...');
  
  // Test with correct token
  const correctUrl = `/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=zomic_wa_verify_2026&hub.challenge=test_challenge_123`;
  const correctRes = await request('GET', correctUrl);
  
  if (correctRes.status === 200 && correctRes.body === 'test_challenge_123') {
    console.log('   ✅ WhatsApp webhook verification PASSED');
    console.log('      Returns challenge when mode=subscribe and token matches');
  } else {
    console.log(`   ❌ WhatsApp webhook verification FAILED (Status: ${correctRes.status})`);
    console.log(`      Response: ${correctRes.body}`);
  }

  // Test with wrong token
  const wrongUrl = `/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test`;
  const wrongRes = await request('GET', wrongUrl);
  
  if (wrongRes.status === 403) {
    console.log('   ✅ WhatsApp webhook rejects wrong token (403)');
  } else {
    console.log(`   ⚠️  WhatsApp webhook wrong token returned ${wrongRes.status} (expected 403)`);
  }
}

// ─── Test Facebook Webhook Verification ───
async function testFacebookWebhookVerify() {
  console.log('\n📘 Testing Facebook Webhook Verification...');
  
  // Test with correct token
  const correctUrl = `/api/integrations/webhook/facebook?hub.mode=subscribe&hub.verify_token=zomic_verify_2026&hub.challenge=fb_challenge_456`;
  const correctRes = await request('GET', correctUrl);
  
  if (correctRes.status === 200 && correctRes.body === 'fb_challenge_456') {
    console.log('   ✅ Facebook webhook verification PASSED');
    console.log('      Returns challenge when mode=subscribe and token matches');
  } else {
    console.log(`   ❌ Facebook webhook verification FAILED (Status: ${correctRes.status})`);
    console.log(`      Response: ${correctRes.body}`);
  }

  // Test with wrong token
  const wrongUrl = `/api/integrations/webhook/facebook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test`;
  const wrongRes = await request('GET', wrongUrl);
  
  if (wrongRes.status === 403) {
    console.log('   ✅ Facebook webhook rejects wrong token (403)');
  } else {
    console.log(`   ⚠️  Facebook webhook wrong token returned ${wrongRes.status} (expected 403)`);
  }
}

// ─── Test WhatsApp Webhook POST (simulate incoming message) ───
async function testWhatsAppWebhookPost() {
  console.log('\n📱 Testing WhatsApp Webhook POST (incoming message)...');
  
  const testPayload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: '4313679592232288',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: { phone_number_id: '1145886271951817', display_phone_number: '15551234567' },
          contacts: [{ profile: { name: 'Test User' }, wa_id: '919876543210' }],
          messages: [{
            from: '919876543210',
            id: 'wamid.test123',
            timestamp: Math.floor(Date.now() / 1000).toString(),
            text: { body: 'Hello, this is a test message' },
            type: 'text',
          }],
        },
      }],
    }],
  };

  const res = await request('POST', '/api/whatsapp/webhook', testPayload);
  
  if (res.status === 200) {
    console.log('   ✅ WhatsApp webhook POST accepted (200)');
  } else {
    console.log(`   ⚠️  WhatsApp webhook POST returned ${res.status}`);
    console.log(`      Response: ${res.body}`);
  }
}

// ─── Test Facebook Webhook POST (simulate leadgen) ───
async function testFacebookWebhookPost() {
  console.log('\n📘 Testing Facebook Webhook POST (simulate leadgen)...');
  
  const testPayload = {
    object: 'page',
    entry: [{
      id: 'test_page_id',
      changes: [{
        field: 'leadgen',
        value: { leadgen_id: 'test_leadgen_123', page_id: 'test_page_id', form_id: 'test_form_id' },
      }],
    }],
  };

  const res = await request('POST', '/api/integrations/webhook/facebook', testPayload);
  
  if (res.status === 200) {
    console.log('   ✅ Facebook webhook POST accepted (200)');
  } else {
    console.log(`   ⚠️  Facebook webhook POST returned ${res.status}`);
    console.log(`      Response: ${res.body}`);
  }
}

// ─── Check if server is running ───
async function checkServer() {
  console.log('🔍 Checking if backend server is running...');
  try {
    const res = await request('GET', '/api/translations/en');
    if (res.status === 200) {
      console.log('   ✅ Backend server is running on port 5000');
      return true;
    }
    console.log(`   ⚠️  Server responded with status ${res.status}`);
    return true;
  } catch (err) {
    console.log(`   ❌ Cannot connect to backend server: ${err.message}`);
    console.log('   💡 Make sure to run: cd backend && npm run dev');
    return false;
  }
}

// ─── Print ngrok setup instructions ───
function printNgrokInstructions(ngrokUrl) {
  console.log('\n' + '='.repeat(70));
  console.log('🌐 NGROK TUNNEL SETUP');
  console.log('='.repeat(70));
  
  if (ngrokUrl) {
    console.log(`\n   Your ngrok URL: ${ngrokUrl}`);
    console.log(`   (Forwarding to http://localhost:${BACKEND_PORT})`);
  } else {
    console.log('\n   ⚠️  ngrok is not running. To expose your local server:');
    console.log('');
    console.log('   Option 1: Install ngrok from https://ngrok.com/download');
    console.log('   Then run in a new terminal:');
    console.log(`      ngrok http ${BACKEND_PORT}`);
    console.log('');
    console.log('   Option 2: Use the npm package (already installed):');
    console.log('      npx ngrok http 5000');
    console.log('');
    console.log('   After running ngrok, you will get a URL like:');
    console.log('      https://abc123.ngrok.io');
  }
}

// ─── Print Meta Configuration Guide ───
function printMetaConfigGuide(ngrokUrl) {
  const baseUrl = ngrokUrl || 'https://YOUR_NGROK_URL.ngrok.io';
  
  console.log('\n' + '='.repeat(70));
  console.log('⚙️  META DEVELOPER CONSOLE CONFIGURATION');
  console.log('='.repeat(70));
  
  console.log('\n📱 WhatsApp Business API Setup');
  console.log('─'.repeat(50));
  console.log(`   1. Go to: https://developers.facebook.com/apps/1750888202818247/whatsapp/business/wa-dev-console`);
  console.log(`   2. Add your phone number as a test recipient in the "To" field`);
  console.log(`   3. Configure Webhook:`);
  console.log(`      - Callback URL: ${baseUrl}/api/whatsapp/webhook`);
  console.log(`      - Verify Token: zomic_wa_verify_2026`);
  console.log(`      - Subscribe to: messages`);
  console.log(`   4. Test: Send a message to the WhatsApp test number`);
  console.log('');
  console.log(`   ✅ Webhook verification endpoint: GET ${baseUrl}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=zomic_wa_verify_2026&hub.challenge=test`);
  
  console.log('\n📘 Facebook Lead Ads Setup');
  console.log('─'.repeat(50));
  console.log(`   1. Go to: https://developers.facebook.com/apps/1750888202818247/`);
  console.log(`   2. Go to Facebook Login → Settings`);
  console.log(`      - Add OAuth redirect: ${baseUrl}/api/integrations/oauth/facebook/callback`);
  console.log(`   3. Go to Webhooks → Page → Subscribe`);
  console.log(`      - Callback URL: ${baseUrl}/api/integrations/webhook/facebook`);
  console.log(`      - Verify Token: zomic_verify_2026`);
  console.log(`      - Subscribe to: leadgen`);
  console.log('');
  console.log(`   ✅ Webhook verification endpoint: GET ${baseUrl}/api/integrations/webhook/facebook?hub.mode=subscribe&hub.verify_token=zomic_verify_2026&hub.challenge=test`);
  
  console.log('\n📊 Meta Conversions API Setup');
  console.log('─'.repeat(50));
  console.log(`   1. Go to: https://www.facebook.com/events_manager2`);
  console.log(`   2. Create a data source → Web → Meta Pixel`);
  console.log(`   3. Copy the Pixel ID`);
  console.log(`   4. In Events Manager → Settings → Conversions API → Generate Access Token`);
  console.log(`   5. Add to backend/.env:`);
  console.log(`      META_PIXEL_ID=<your-pixel-id>`);
  console.log(`      META_CONVERSIONS_ACCESS_TOKEN=<your-token>`);
  console.log(`   6. Restart the backend server`);
  console.log(`   7. In CRM → Settings → Meta Conversions API → Enter Pixel ID + Token → Enable`);
}

// ─── Print Webhook Test Commands ───
function printTestCommands(ngrokUrl) {
  const baseUrl = ngrokUrl || 'http://localhost:5000';
  
  console.log('\n' + '='.repeat(70));
  console.log('🧪 WEBHOOK TEST COMMANDS');
  console.log('='.repeat(70));
  
  console.log('\n📱 Test WhatsApp Webhook Verification:');
  console.log(`   curl -G "${baseUrl}/api/whatsapp/webhook" --data-urlencode "hub.mode=subscribe" --data-urlencode "hub.verify_token=zomic_wa_verify_2026" --data-urlencode "hub.challenge=test123"`);
  
  console.log('\n📱 Test WhatsApp Incoming Message:');
  console.log(`   curl -X POST "${baseUrl}/api/whatsapp/webhook" -H "Content-Type: application/json" -d '{"object":"whatsapp_business_account","entry":[{"id":"4313679592232288","changes":[{"value":{"messaging_product":"whatsapp","metadata":{"phone_number_id":"1145886271951817","display_phone_number":"15551234567"},"contacts":[{"profile":{"name":"Test User"},"wa_id":"919876543210"}],"messages":[{"from":"919876543210","id":"wamid.test123","timestamp":"${Math.floor(Date.now()/1000)}","text":{"body":"Hello test"},"type":"text"}]}}]}]}'`);
  
  console.log('\n📘 Test Facebook Webhook Verification:');
  console.log(`   curl -G "${baseUrl}/api/integrations/webhook/facebook" --data-urlencode "hub.mode=subscribe" --data-urlencode "hub.verify_token=zomic_verify_2026" --data-urlencode "hub.challenge=test456"`);
  
  console.log('\n📘 Test Facebook Leadgen Webhook:');
  console.log(`   curl -X POST "${baseUrl}/api/integrations/webhook/facebook" -H "Content-Type: application/json" -d '{"object":"page","entry":[{"id":"test_page_id","changes":[{"field":"leadgen","value":{"leadgen_id":"test_leadgen_123","page_id":"test_page_id","form_id":"test_form_id"}}]}]}'`);
  
  console.log('\n📊 Test OAuth Config Endpoint:');
  console.log(`   curl "${baseUrl}/api/integrations/oauth/config"`);
}

// ─── Main ───
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           ZOMIC CRM - Webhook Setup Utility                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`   Backend URL: ${BASE_URL}`);
  console.log(`   Time: ${new Date().toLocaleString()}`);
  
  // Check server
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('\n❌ Cannot proceed without backend server. Start it with:');
    console.log('   cd backend && npm run dev');
    process.exit(1);
  }
  
  // Test webhook verification endpoints
  await testWhatsAppWebhookVerify();
  await testFacebookWebhookVerify();
  
  // Test webhook POST endpoints
  await testWhatsAppWebhookPost();
  await testFacebookWebhookPost();
  
  // Try to detect ngrok
  let ngrokUrl = null;
  try {
    const ngrokRes = await request('GET', 'http://127.0.0.1:4040/api/tunnels');
    if (ngrokRes.status === 200) {
      const tunnels = JSON.parse(ngrokRes.body);
      const httpsTunnel = tunnels.tunnels?.find(t => t.public_url?.startsWith('https'));
      if (httpsTunnel) {
        ngrokUrl = httpsTunnel.public_url;
      }
    }
  } catch (e) {
    // ngrok not running locally
  }
  
  // Print instructions
  printNgrokInstructions(ngrokUrl);
  printMetaConfigGuide(ngrokUrl);
  printTestCommands(ngrokUrl);
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ Webhook setup check complete!');
  console.log('='.repeat(70));
  console.log('\n📋 Next Steps:');
  console.log('   1. If ngrok is not running, start it: npx ngrok http 5000');
  console.log('   2. Copy the ngrok URL and configure in Meta Developer Console');
  console.log('   3. Test webhook verification using the commands above');
  console.log('   4. Once verified, real leads/messages will flow into the CRM');
  console.log('');
}

main().catch(console.error);