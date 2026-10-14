const db = require('../config/database');
const { uploadToS3, deleteFromS3, generateSignedUrl } = require('../middleware/upload');
const { logActivity } = require('../utils/activityLog');
const crypto = require('crypto');

exports.getFiles = async (req, res, next) => {
  try {
    const { folder_id } = req.query;
    let query = 'SELECT * FROM content_files WHERE workspace_id = $1';
    let params = [req.workspaceId];
    if (folder_id) {
      query += ' AND folder_id = $2';
      params.push(folder_id);
    }
    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json({ files: result.rows });
  } catch (err) { next(err); }
};

exports.uploadFile = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { folder_id, is_restricted } = req.body;
    const s3Result = await uploadToS3(req.file, 'content');
    const result = await db.query(
      `INSERT INTO content_files (workspace_id, name, original_name, s3_key, url, file_type, mime_type, size_bytes, folder_id, is_restricted, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [req.workspaceId, req.body.name || req.file.originalname, req.file.originalname,
       s3Result.key, s3Result.url, req.file.mimetype.split('/')[0], req.file.mimetype, req.file.size,
       folder_id, is_restricted || false, req.user.id]
    );
    res.status(201).json({ file: result.rows[0] });
  } catch (err) { next(err); }
};

exports.deleteFile = async (req, res, next) => {
  try {
    const result = await db.query('SELECT s3_key FROM content_files WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'File not found' });
    await deleteFromS3(result.rows[0].s3_key);
    await db.query('DELETE FROM content_files WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    res.json({ message: 'File deleted' });
  } catch (err) { next(err); }
};

exports.sendFile = async (req, res, next) => {
  try {
    const { file_id, lead_id, channel } = req.body;
    const fileResult = await db.query('SELECT * FROM content_files WHERE id = $1 AND workspace_id = $2', [file_id, req.workspaceId]);
    if (fileResult.rows.length === 0) return res.status(404).json({ error: 'File not found' });
    const file = fileResult.rows[0];

    const trackingId = crypto.randomUUID();
    const trackableUrl = `${require('../config').apiUrl}/api/content/track/${trackingId}`;

    await db.query(
      `INSERT INTO content_tracking (workspace_id, file_id, lead_id, tracking_id, sent_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.workspaceId, file_id, lead_id, trackingId, req.user.id]
    );

    await logActivity(req.workspaceId, lead_id, req.user.id, 'file_sent', `File sent: ${file.name}`, { file_id, channel, tracking_id: trackingId });

    if (channel === 'whatsapp') {
      const { sendWhatsAppToLead } = require('../services/whatsappService');
      await sendWhatsAppToLead({ workspaceId: req.workspaceId, leadId: lead_id, userId: req.user.id, message: `Here's the file you requested: ${trackableUrl}`, mediaUrl: file.url, mediaType: file.file_type });
    } else if (channel === 'email') {
      const { sendTrackedEmail } = require('../services/emailService');
      await sendTrackedEmail({ workspaceId: req.workspaceId, leadId: lead_id, userId: req.user.id, overrideSubject: `Document: ${file.name}`, overrideBody: `<p>Please find the document here: <a href="${trackableUrl}">${file.name}</a></p>` });
    } else if (channel === 'sms') {
      const { sendSMSToLead } = require('../services/smsService');
      await sendSMSToLead({ workspaceId: req.workspaceId, leadId: lead_id, userId: req.user.id, message: `Document: ${trackableUrl}` });
    }

    res.json({ message: 'File sent successfully', trackingUrl: trackableUrl });
  } catch (err) { next(err); }
};

exports.trackFile = async (req, res, next) => {
  try {
    const { trackingId } = req.params;
    const trackingResult = await db.query('SELECT * FROM content_tracking WHERE tracking_id = $1', [trackingId]);
    if (trackingResult.rows.length === 0) return res.status(404).send('Not found');

    const tracking = trackingResult.rows[0];
    await db.query(
      'UPDATE content_tracking SET first_opened_at = COALESCE(first_opened_at, NOW()), last_opened_at = NOW(), open_count = open_count + 1 WHERE id = $1',
      [tracking.id]
    );

    const fileResult = await db.query('SELECT url, name, workspace_id FROM content_files WHERE id = $1', [tracking.file_id]);
    if (fileResult.rows.length === 0) return res.status(404).send('File not found');

    const file = fileResult.rows[0];
    const brandingResult = await db.query('SELECT * FROM workspace_branding WHERE workspace_id = $1', [file.workspace_id]);
    const branding = brandingResult.rows[0];

    if (branding && branding.logo_url && branding.show_branding) {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${file.name}</title><style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;min-height:100vh;display:flex;flex-direction:column}
        .header{background:#fff;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.05)}
        .logo{display:flex;align-items:center;gap:10px}
        .logo img{max-height:36px;max-width:160px;object-fit:contain}
        .logo .company-name{font-size:18px;font-weight:600;color:#0f172a}
        .download-btn{background:#2563eb;color:#fff;border:none;padding:8px 20px;border-radius:8px;font-size:14px;cursor:pointer;text-decoration:none}
        .content{flex:1;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto}
        .content img,.content video,.content embed{max-width:100%;max-height:calc(100vh - 120px);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1)}
        .content iframe{width:100%;height:calc(100vh - 120px);border:none;border-radius:8px}
      </style></head><body>
        <div class="header">
          <div class="logo">
            ${branding.logo_url ? `<img src="${branding.logo_url}" alt="${branding.company_name || 'Logo'}">` : ''}
            ${branding.company_name ? `<span class="company-name">${branding.company_name}</span>` : ''}
          </div>
          <a href="${file.url}" download class="download-btn">Download</a>
        </div>
        <div class="content">
          ${file.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? `<img src="${file.url}" alt="${file.name}">` :
            file.url.match(/\.(mp4|webm|ogg)$/i) ? `<video src="${file.url}" controls></video>` :
            file.url.match(/\.(pdf)$/i) ? `<iframe src="${file.url}"></iframe>` :
            `<iframe src="${file.url}"></iframe>`}
        </div>
      </body></html>`;
      res.set('Content-Type', 'text/html');
      return res.send(html);
    }

    res.redirect(file.url);
  } catch (err) { next(err); }
};

exports.getFileAnalytics = async (req, res, next) => {
  try {
    const { file_id } = req.params;
    const stats = await db.query(
      `SELECT COUNT(*) as total_sends,
              COUNT(CASE WHEN first_opened_at IS NOT NULL THEN 1 END) as total_opens,
              ROUND(COUNT(CASE WHEN first_opened_at IS NOT NULL THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as open_rate
       FROM content_tracking WHERE file_id = $1 AND workspace_id = $2`,
      [file_id, req.workspaceId]
    );
    res.json({ analytics: stats.rows[0] });
  } catch (err) { next(err); }
};

exports.getFolders = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM content_folders WHERE workspace_id = $1 ORDER BY name', [req.workspaceId]);
    res.json({ folders: result.rows });
  } catch (err) { next(err); }
};

exports.createFolder = async (req, res, next) => {
  try {
    const { name, parent_id } = req.body;
    const result = await db.query(
      'INSERT INTO content_folders (workspace_id, name, parent_id) VALUES ($1, $2, $3) RETURNING *',
      [req.workspaceId, name, parent_id]
    );
    res.status(201).json({ folder: result.rows[0] });
  } catch (err) { next(err); }
};

exports.getBranding = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM workspace_branding WHERE workspace_id = $1', [req.workspaceId]);
    res.json({ branding: result.rows[0] || null });
  } catch (err) { next(err); }
};

exports.updateBranding = async (req, res, next) => {
  try {
    const { logo_url, company_name, primary_color, show_branding, custom_css } = req.body;
    const existing = await db.query('SELECT id FROM workspace_branding WHERE workspace_id = $1', [req.workspaceId]);
    if (existing.rows.length > 0) {
      const result = await db.query(
        `UPDATE workspace_branding SET logo_url = COALESCE($1, logo_url), company_name = COALESCE($2, company_name),
         primary_color = COALESCE($3, primary_color), show_branding = COALESCE($4, show_branding),
         custom_css = COALESCE($5, custom_css), updated_at = NOW() WHERE workspace_id = $6 RETURNING *`,
        [logo_url, company_name, primary_color, show_branding, custom_css, req.workspaceId]
      );
      res.json({ branding: result.rows[0] });
    } else {
      const result = await db.query(
        `INSERT INTO workspace_branding (workspace_id, logo_url, company_name, primary_color, show_branding, custom_css)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [req.workspaceId, logo_url, company_name, primary_color || '#2563eb', show_branding !== false, custom_css]
      );
      res.status(201).json({ branding: result.rows[0] });
    }
  } catch (err) { next(err); }
};
