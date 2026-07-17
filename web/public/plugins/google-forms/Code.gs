/**
 * CRM Final - Google Forms Add-on
 * Automatically sends Google Forms responses to your CRM Final account.
 *
 * Setup:
 * 1. Open your Google Form, click three dots > Script editor
 * 2. Paste this file, replace YOUR_ACCOUNT_TOKEN below
 * 3. Click Run > setupTriggers (authorize when prompted)
 * 4. Submit a test response to verify
 */

var CONFIG = {
  ACCOUNT_TOKEN: 'YOUR_ACCOUNT_TOKEN',
  API_URL: 'http://localhost:5000',
  SITE_NAME: ''
};

function setupTriggers() {
  var form = FormApp.getActiveForm();
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'onFormSubmit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onFormSubmit').forForm(form).onFormSubmit().create();
  Logger.log('CRM Final trigger installed successfully.');
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'onFormSubmit') ScriptApp.deleteTrigger(t);
  });
  Logger.log('CRM Final triggers removed.');
}

function onFormSubmit(e) {
  if (!e || !e.response) return;
  try {
    var leadData = extractLeadData(e);
    sendLeadToCRM(leadData);
  } catch (err) {
    Logger.log('CRM Final error: ' + err.message);
  }
}

function extractLeadData(e) {
  var itemResponses = e.response.getItemResponses();
  var lead = { fields: {} };
  for (var i = 0; i < itemResponses.length; i++) {
    var itemResp = itemResponses[i];
    var q = itemResp.getItem().getTitle().toLowerCase().trim();
    var a = itemResp.getResponse();
    if (Array.isArray(a)) a = a.join(', ');
    if (q.indexOf('name') !== -1 && !lead.name) lead.name = a;
    else if (q.indexOf('first') !== -1) lead.first_name = a;
    else if (q.indexOf('last') !== -1 || q.indexOf('surname') !== -1) lead.last_name = a;
    else if ((q.indexOf('phone') !== -1 || q.indexOf('mobile') !== -1 || q.indexOf('tel') !== -1) && !lead.phone) lead.phone = a;
    else if ((q.indexOf('email') !== -1 || q.indexOf('mail') !== -1) && !lead.email) lead.email = a;
    else if ((q.indexOf('city') !== -1 || q.indexOf('location') !== -1) && !lead.city) lead.city = a;
    else if ((q.indexOf('budget') !== -1 || q.indexOf('price') !== -1) && !lead.budget) lead.budget = a;
    else if (q.indexOf('message') !== -1 || q.indexOf('note') !== -1 || q.indexOf('comment') !== -1) lead.message = a;
    else lead.fields[itemResp.getItem().getTitle()] = a;
  }
  if (!lead.first_name && !lead.last_name && lead.name) {
    var parts = lead.name.trim().split(/\s+/);
    lead.first_name = parts[0] || '';
    lead.last_name = parts.slice(1).join(' ') || '';
  }
  if (CONFIG.SITE_NAME) lead.source = CONFIG.SITE_NAME;
  return lead;
}

function sendLeadToCRM(leadData) {
  var token = CONFIG.ACCOUNT_TOKEN;
  if (!token || token === 'YOUR_ACCOUNT_TOKEN') {
    Logger.log('CRM Final: No token configured. Edit CONFIG.ACCOUNT_TOKEN.');
    return;
  }
  var url = CONFIG.API_URL + '/api/integrations/lead/' + token + '/google_forms';
  var resp = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(leadData), muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  if (code >= 200 && code < 300) Logger.log('CRM Final: Lead sent OK');
  else Logger.log('CRM Final: API error ' + code + ' - ' + resp.getContentText());
}

function testConnection() {
  var testData = {
    first_name: 'Test', last_name: 'GoogleForms',
    email: 'test@googleforms.com', phone: '+10000000000',
    message: 'Test lead from Google Apps Script', source: CONFIG.SITE_NAME || 'Google Forms Test'
  };
  sendLeadToCRM(testData);
  Logger.log('Test lead sent. Check CRM Final to verify.');
}
