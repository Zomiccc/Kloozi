function replaceVariables(template, data) {
  if (!template) return '';
  let result = template;

  const now = new Date();
  const hour = now.getHours();
  let greeting = 'Good Morning';
  if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
  else if (hour >= 17) greeting = 'Good Evening';

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const variables = {
    First_Name: data.first_name || '',
    Last_Name: data.last_name || '',
    Phone: data.phone || '',
    Email: data.email || '',
    City: data.city || '',
    Budget: data.budget || '',
    Lead_Source: data.lead_source || '',
    Agent_Name: data.agent_name || '',
    Agent_Phone: data.agent_phone || '',
    Agent_Email: data.agent_email || '',
    Company_Name: data.company_name || '',
    Designation: data.designation || '',
    Product_Name: data.product_name || '',
    Price: data.price || '',
    Location: data.location || '',
    Brochure_Link: data.brochure_link || '',
    Video_Link: data.video_link || '',
    Today_Date: `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`,
    Day_of_Week: days[now.getDay()],
    Time_Greeting: greeting,
    Last_Contacted: data.last_contacted || '',
    Days_Since_Inquiry: data.days_since_inquiry || '',
    Next_Followup_Date: data.next_followup_date || '',
    Last_Email_Opened: data.last_email_opened || '',
    Times_Opened: data.times_opened || '',
  };

  // Custom fields first: {{Custom_Field_Budget}} (any case)
  result = result.replace(/\{\{\s*custom_field_([^}]+?)\s*\}\}/gi, (match, fieldName) => {
    const field = (Array.isArray(data.custom_fields) ? data.custom_fields : []).find(
      (f) => String(f.name || '').toLowerCase() === fieldName.trim().toLowerCase()
    );
    return field ? String(field.value ?? '') : '';
  });

  // Case- and spacing-insensitive: {{First_Name}}, {{first_name}} and {{ First Name }} all work.
  // Unknown variables are left untouched so authors notice them.
  const norm = (k) => String(k).toLowerCase().replace(/[\s_-]+/g, '');
  const lookup = {};
  for (const [key, value] of Object.entries(variables)) {
    lookup[norm(key)] = value === null || value === undefined ? '' : String(value);
  }
  result = result.replace(/\{\{\s*([A-Za-z][A-Za-z0-9 _-]*?)\s*\}\}/g, (match, key) => {
    const k = norm(key);
    return Object.prototype.hasOwnProperty.call(lookup, k) ? lookup[k] : match;
  });

  return result;
}

function extractVariables(text) {
  if (!text) return [];
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }
  return matches;
}

module.exports = { replaceVariables, extractVariables };
