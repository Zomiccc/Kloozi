/**
 * TEMPORARY REQUEST LOGGER FOR META WEBHOOK DEBUGGING
 * This middleware logs EVERY incoming request before routing
 */
function logAllRequests(req, res, next) {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔍 INCOMING REQUEST');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Timestamp:', timestamp);
  console.log('Method:', req.method);
  console.log('URL:', req.originalUrl);
  console.log('IP:', ip);
  console.log('Query Parameters:', JSON.stringify(req.query, null, 2));
  console.log('Headers:');
  Object.keys(req.headers).forEach(key => {
    console.log(`  ${key}: ${req.headers[key]}`);
  });
  console.log('Body (if present):', req.body ? JSON.stringify(req.body, null, 2) : 'none');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  next();
}

module.exports = logAllRequests;
