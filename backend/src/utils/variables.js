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

  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  result = result.replace(/\{\{Custom_Field_([^}]+)\}\}/g, (match, fieldName) => {
    const field = (data.custom_fields || []).find(
      (f) => f.name.toLowerCase() === fieldName.toLowerCase()
    );
    return field ? field.value : '';
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
