// Shared definitions for the Marketing module (segments, flows, emails).

export const STAGES = ['new', 'contacted', 'interested', 'negotiating', 'won', 'lost'];

export const SOURCES = [
  'facebook', 'google', 'website', 'tiktok', 'instagram',
  'linkedin', 'wordpress', 'google_forms', 'embed_form', 'whatsapp',
  'manual', 'zapier', 'import',
];

export const LEAD_VARIABLES = [
  'First_Name', 'Last_Name', 'Phone', 'Email', 'City', 'Budget',
  'Lead_Source', 'Agent_Name', 'Agent_Phone', 'Agent_Email',
  'Company_Name', 'Today_Date', 'Day_of_Week', 'Time_Greeting',
];

// Segment condition fields — keys map to backend compileConditions()
export const SEGMENT_FIELDS = [
  { value: 'stage', label: 'Stage', valueType: 'select', options: STAGES,
    operators: [{ value: 'eq', label: 'is' }, { value: 'neq', label: 'is not' }] },
  { value: 'source', label: 'Lead source', valueType: 'select', options: SOURCES,
    operators: [{ value: 'eq', label: 'is' }, { value: 'neq', label: 'is not' }] },
  { value: 'city', label: 'City', valueType: 'text',
    operators: [{ value: 'contains', label: 'contains' }, { value: 'not_contains', label: 'does not contain' }] },
  { value: 'budget', label: 'Budget', valueType: 'number',
    operators: [
      { value: 'gte', label: '≥' }, { value: 'gt', label: '>' },
      { value: 'lte', label: '≤' }, { value: 'lt', label: '<' }, { value: 'eq', label: '=' },
    ] },
  { value: 'score', label: 'Engagement score', valueType: 'number',
    operators: [{ value: 'gte', label: '≥' }, { value: 'gt', label: '>' }, { value: 'lte', label: '≤' }, { value: 'lt', label: '<' }] },
  { value: 'tags_any', label: 'Has any tag', valueType: 'tags',
    operators: [{ value: 'in', label: 'any of' }] },
  { value: 'assigned_to', label: 'Assigned to agent', valueType: 'agent',
    operators: [{ value: 'eq', label: 'is' }] },
  { value: 'inactive_days', label: 'No activity in last', valueType: 'days',
    operators: [{ value: 'gte', label: 'days ≥' }], unit: 'days' },
  { value: 'active_within_days', label: 'Active within last', valueType: 'days',
    operators: [{ value: 'lte', label: 'days ≤' }], unit: 'days' },
  { value: 'created_within_days', label: 'Created within last', valueType: 'days',
    operators: [{ value: 'lte', label: 'days ≤' }], unit: 'days' },
  { value: 'unsubscribed', label: 'Unsubscribed', valueType: 'bool',
    operators: [{ value: 'eq', label: 'is' }] },
  { value: 'email_sent_count', label: 'Emails received', valueType: 'number',
    operators: [{ value: 'gte', label: '≥' }, { value: 'lte', label: '≤' }] },
  { value: 'email_opened', label: 'Opened an email', valueType: 'bool',
    operators: [{ value: 'eq', label: '' }] },
  { value: 'email_open_count', label: 'Total email opens', valueType: 'number',
    operators: [{ value: 'gte', label: '≥' }] },
  { value: 'email_clicked', label: 'Clicked an email link', valueType: 'bool',
    operators: [{ value: 'eq', label: '' }] },
  { value: 'email_replied_within_days', label: 'Replied within last', valueType: 'days',
    operators: [{ value: 'lte', label: 'days ≤' }], unit: 'days' },
  { value: 'opened_but_no_reply', label: 'Opened but never replied', valueType: 'bool',
    operators: [{ value: 'eq', label: '' }] },
];

export const SEGMENT_PRESETS = [
  {
    label: 'Gone quiet — no activity in 7+ days',
    match_type: 'all',
    conditions: [{ field: 'inactive_days', operator: 'gte', value: 7 }],
  },
  {
    label: 'Facebook leads with budget over 50k',
    match_type: 'all',
    conditions: [
      { field: 'source', operator: 'eq', value: 'facebook' },
      { field: 'budget', operator: 'gt', value: 50000 },
    ],
  },
  {
    label: 'Currently in "Interested"',
    match_type: 'all',
    conditions: [{ field: 'stage', operator: 'eq', value: 'interested' }],
  },
  {
    label: 'Opened an email but never replied',
    match_type: 'all',
    conditions: [{ field: 'opened_but_no_reply', operator: 'eq', value: true }],
  },
];

// Flow node catalog — drives the builder palette
export const NODE_TYPES = {
  send_email: { label: 'Send Email', color: '#1C1917', glyph: '✉',
    hint: 'Send a built or inline email to this lead' },
  wait: { label: 'Wait', color: '#57534E', glyph: '◷',
    hint: 'Pause before the next step' },
  condition: { label: 'Condition', color: '#B45309', glyph: '⑃',
    hint: 'Branch into yes / no paths' },
  add_tag: { label: 'Add Tag', color: '#2F6FDB', glyph: '#',
    hint: 'Tag the lead' },
  change_stage: { label: 'Change Stage', color: '#0E8A5F', glyph: '→',
    hint: 'Move the lead to another stage' },
  notify_agent: { label: 'Notify Agent', color: '#1C1917', glyph: '🔔',
    hint: 'Ping the assigned agent' },
  whatsapp: { label: 'WhatsApp', color: '#128C7E', glyph: '◍',
    hint: 'Send a WhatsApp message' },
  sms: { label: 'SMS', color: '#0F766E', glyph: '▤',
    hint: 'Send an SMS' },
  exit: { label: 'Exit', color: '#B45309', glyph: '■',
    hint: 'End this path of the flow' },
};

// Flow triggers
export const TRIGGER_TYPES = [
  { value: 'segment_entered', label: 'Lead enters a segment', configKey: 'segment_id' },
  { value: 'lead_created', label: 'New lead created', configKey: null },
  { value: 'stage_entered', label: 'Lead enters stage', configKey: 'stage' },
  { value: 'tagged_with', label: 'Lead tagged with', configKey: 'tag' },
  { value: 'days_inactive', label: 'Days since last activity', configKey: 'days' },
  { value: 'source_is', label: 'Lead source is', configKey: 'source' },
  { value: 'manual', label: 'Manual — added by an agent', configKey: null },
];

export const CONDITION_TYPES = [
  { value: 'email_opened', label: 'Opened previous email', needsValue: false },
  { value: 'email_clicked', label: 'Clicked previous email', needsValue: false },
  { value: 'email_replied', label: 'Replied to flow email', needsValue: false },
  { value: 'email_replied_recently', label: 'Replied recently (30d)', needsValue: false },
  { value: 'stage_is', label: 'Stage is…', needsValue: true, options: STAGES },
  { value: 'score_above', label: 'Score above…', needsValue: true, type: 'number' },
  { value: 'segment_member', label: 'Member of segment…', needsValue: true, type: 'segment' },
];

export function describeSegmentConditions(segment) {
  if (!segment || !Array.isArray(segment.conditions) || segment.conditions.length === 0) {
    return 'Any lead';
  }
  return segment.conditions.map((c) => {
    const f = SEGMENT_FIELDS.find((x) => x.value === c.field);
    const fLabel = f ? f.label : c.field;
    return `${fLabel} ${c.value ?? ''}`.trim();
  }).join(` ${segment.match_type === 'any' ? 'OR' : 'AND'} `);
}

export function fmtDate(s) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return '—'; }
}

export function fmtDateTime(s) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return '—'; }
}

/** Render block design JSON -> responsive HTML email (used by editor preview & save). */
export function renderBlocksToHtml(blocks) {
  // An imported/custom email that is a complete HTML document is sent exactly as written.
  if (Array.isArray(blocks) && blocks.length === 1 && blocks[0].type === 'html' && /<html[\s>]/i.test(blocks[0].html || '')) {
    return blocks[0].html;
  }
  const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cell = (b) => {
    switch (b.type) {
      case 'text': {
        const align = b.align || 'left';
        const size = b.size === 'large' ? '22px' : b.size === 'small' ? '13px' : '15px';
        const weight = b.weight === 'bold' ? 700 : 400;
        return `<div style="text-align:${align};font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:${size};font-weight:${weight};color:#222222;line-height:1.65;">${esc(b.text).replace(/\n/g, '<br/>')}</div>`;
      }
      case 'button': {
        const bg = b.bgColor || '#1C1917';
        const align = b.align || 'center';
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="text-align:${align};">
          <a href="${esc(b.url || '#')}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:${b.size === 'large' ? '17px' : '15px'};font-weight:bold;padding:13px 30px;border-radius:4px;">${esc(b.label || 'Click')}</a>
        </td></tr></table>`;
      }
      case 'image':
        return `<img src="${esc(b.url)}" alt="${esc(b.alt || '')}" width="100%" style="max-width:100%;height:auto;display:block;border-radius:4px;" />`;
      case 'divider':
        return `<div style="border-top:1px solid #e5e5e5;line-height:0;font-size:0;">&nbsp;</div>`;
      case 'spacer':
        return `<div style="height:${Math.max(8, Number(b.height) || 24)}px;line-height:0;font-size:0;">&nbsp;</div>`;
      case 'html':
        return String(b.html || '');
      default:
        return '';
    }
  };

  const rows = [];
  for (const row of blocks || []) {
    if (row.type === 'columns') {
      const cols = Array.isArray(row.columns) ? row.columns : [[], []];
      const tds = cols.map((colBlocks, i) => {
        const inner = colBlocks.map(cell).join('<div style="height:12px;line-height:0;">&nbsp;</div>');
        return `<td style="vertical-align:top;padding-right:${i < cols.length - 1 ? '16px' : '0'};width:${Math.floor(100 / cols.length)}%;">${inner}</td>`;
      }).join('');
      rows.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${tds}</tr></table>`);
    } else {
      rows.push(cell(row));
    }
    rows.push('<div style="height:16px;line-height:0;">&nbsp;</div>');
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f2ee;">
<div style="max-width:600px;margin:24px auto;background:#ffffff;border-radius:8px;padding:32px;">
${rows.join('\n')}
</div>
<div style="text-align:center;color:#999999;font-size:11px;font-family:Arial,sans-serif;padding:0 24px 24px;">Sent via Flazyn</div>
</body></html>`;
}
