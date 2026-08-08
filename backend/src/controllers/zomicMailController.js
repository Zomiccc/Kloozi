const db = require('../config/database');
const logger = require('../utils/logger');
const { uploadToS3 } = require('../middleware/upload');

// Get mailbox contents by folder
exports.getMailbox = async (req, res, next) => {
  try {
    const { folder = 'inbox' } = req.params;
    const { search } = req.query;
    const validFolders = ['inbox', 'sent', 'drafts', 'trash', 'starred', 'archive'];

    if (!validFolders.includes(folder)) {
      return res.status(400).json({ error: 'Invalid folder' });
    }

    let query, params;

    if (folder === 'starred') {
      query = `
        SELECT m.*, 
               fu.first_name as from_first_name, fu.last_name as from_last_name, fu.profile_image as from_profile_image,
               tu.first_name as to_first_name, tu.last_name as to_last_name, tu.profile_image as to_profile_image
        FROM zomic_mail_messages m
        LEFT JOIN users fu ON m.from_user_id = fu.id
        LEFT JOIN users tu ON m.to_user_id = tu.id
        WHERE m.workspace_id = $1 AND m.is_starred = TRUE AND m.folder != 'trash'
      `;
      params = [req.workspaceId];
    } else if (folder === 'inbox') {
      query = `
        SELECT m.*, 
               fu.first_name as from_first_name, fu.last_name as from_last_name, fu.profile_image as from_profile_image,
               tu.first_name as to_first_name, tu.last_name as to_last_name, tu.profile_image as to_profile_image
        FROM zomic_mail_messages m
        LEFT JOIN users fu ON m.from_user_id = fu.id
        LEFT JOIN users tu ON m.to_user_id = tu.id
        WHERE m.workspace_id = $1 AND m.to_user_id = $2 AND m.folder = 'inbox'
      `;
      params = [req.workspaceId, req.user.id];
    } else if (folder === 'sent') {
      query = `
        SELECT m.*, 
               fu.first_name as from_first_name, fu.last_name as from_last_name, fu.profile_image as from_profile_image,
               tu.first_name as to_first_name, tu.last_name as to_last_name, tu.profile_image as to_profile_image
        FROM zomic_mail_messages m
        LEFT JOIN users fu ON m.from_user_id = fu.id
        LEFT JOIN users tu ON m.to_user_id = tu.id
        WHERE m.workspace_id = $1 AND m.from_user_id = $2 AND m.folder = 'sent'
      `;
      params = [req.workspaceId, req.user.id];
    } else if (folder === 'drafts') {
      query = `
        SELECT m.*, 
               fu.first_name as from_first_name, fu.last_name as from_last_name, fu.profile_image as from_profile_image,
               tu.first_name as to_first_name, tu.last_name as to_last_name, tu.profile_image as to_profile_image
        FROM zomic_mail_messages m
        LEFT JOIN users fu ON m.from_user_id = fu.id
        LEFT JOIN users tu ON m.to_user_id = tu.id
        WHERE m.workspace_id = $1 AND m.from_user_id = $2 AND m.folder = 'drafts'
      `;
      params = [req.workspaceId, req.user.id];
    } else {
      // trash, archive — user-specific
      query = `
        SELECT m.*, 
               fu.first_name as from_first_name, fu.last_name as from_last_name, fu.profile_image as from_profile_image,
               tu.first_name as to_first_name, tu.last_name as to_last_name, tu.profile_image as to_profile_image
        FROM zomic_mail_messages m
        LEFT JOIN users fu ON m.from_user_id = fu.id
        LEFT JOIN users tu ON m.to_user_id = tu.id
        WHERE m.workspace_id = $1 AND (m.to_user_id = $2 OR m.from_user_id = $2) AND m.folder = $3
      `;
      params = [req.workspaceId, req.user.id, folder];
    }

    if (search) {
      query += ` AND (m.subject ILIKE $${params.length + 1} OR m.body ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY m.created_at DESC';

    const result = await db.query(query, params);

    // Get attachments for each message
    const messageIds = result.rows.map(m => m.id);
    let attachmentsMap = {};
    if (messageIds.length > 0) {
      const attRes = await db.query(
        `SELECT * FROM zomic_mail_attachments WHERE message_id = ANY($1::uuid[])`,
        [messageIds]
      );
      attRes.rows.forEach(a => {
        if (!attachmentsMap[a.message_id]) attachmentsMap[a.message_id] = [];
        attachmentsMap[a.message_id].push(a);
      });
    }

    const messages = result.rows.map(m => ({
      ...m,
      attachments: attachmentsMap[m.id] || [],
    }));

    res.json({ messages });
  } catch (err) { next(err); }
};

// Get unread count
exports.getUnreadCount = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM zomic_mail_messages 
       WHERE workspace_id = $1 AND to_user_id = $2 AND is_read = FALSE AND folder = 'inbox'`,
      [req.workspaceId, req.user.id]
    );
    res.json({ unreadCount: parseInt(result.rows[0].count) || 0 });
  } catch (err) { next(err); }
};

// Get a single thread
exports.getThread = async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const result = await db.query(
      `SELECT m.*, 
              fu.first_name as from_first_name, fu.last_name as from_last_name, fu.profile_image as from_profile_image,
              tu.first_name as to_first_name, tu.last_name as to_last_name, tu.profile_image as to_profile_image
       FROM zomic_mail_messages m
       LEFT JOIN users fu ON m.from_user_id = fu.id
       LEFT JOIN users tu ON m.to_user_id = tu.id
       WHERE m.workspace_id = $1 AND m.thread_id = $2 AND (m.to_user_id = $3 OR m.from_user_id = $3)
       ORDER BY m.created_at ASC`,
      [req.workspaceId, threadId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Get attachments
    const messageIds = result.rows.map(m => m.id);
    let attachmentsMap = {};
    if (messageIds.length > 0) {
      const attRes = await db.query(
        `SELECT * FROM zomic_mail_attachments WHERE message_id = ANY($1::uuid[])`,
        [messageIds]
      );
      attRes.rows.forEach(a => {
        if (!attachmentsMap[a.message_id]) attachmentsMap[a.message_id] = [];
        attachmentsMap[a.message_id].push(a);
      });
    }

    const messages = result.rows.map(m => ({
      ...m,
      attachments: attachmentsMap[m.id] || [],
    }));

    res.json({ thread: messages });
  } catch (err) { next(err); }
};

// Compose a new message
exports.compose = async (req, res, next) => {
  try {
    const { to_user_id, cc_user_ids, bcc_user_ids, subject, body, is_draft } = req.body;

    if (!is_draft && !to_user_id) {
      return res.status(400).json({ error: 'Recipient is required' });
    }

    // Verify recipient is in the same workspace
    if (to_user_id) {
      const recipientCheck = await db.query(
        'SELECT id FROM users WHERE id = $1 AND workspace_id = $2 AND status = $3',
        [to_user_id, req.workspaceId, 'active']
      );
      if (recipientCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Recipient not found in your workspace' });
      }
    }

    const folder = is_draft ? 'drafts' : 'sent';
    const threadId = require('crypto').randomUUID();

    const result = await db.query(
      `INSERT INTO zomic_mail_messages (workspace_id, from_user_id, to_user_id, cc_user_ids, bcc_user_ids, subject, body, thread_id, folder)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        req.workspaceId, req.user.id, to_user_id || null,
        JSON.stringify(cc_user_ids || []), JSON.stringify(bcc_user_ids || []),
        subject || '', body || '', threadId, folder
      ]
    );

    const message = result.rows[0];

    // If not a draft, also create an inbox copy for the recipient
    if (!is_draft && to_user_id) {
      await db.query(
        `INSERT INTO zomic_mail_messages (workspace_id, from_user_id, to_user_id, cc_user_ids, bcc_user_ids, subject, body, thread_id, folder, is_read)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'inbox', FALSE)`,
        [
          req.workspaceId, req.user.id, to_user_id,
          JSON.stringify(cc_user_ids || []), JSON.stringify(bcc_user_ids || []),
          subject || '', body || '', threadId
        ]
      );

      // Send real-time notification via socket.io
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${to_user_id}`).emit('zomic-mail:new', {
          id: message.id,
          subject: message.subject,
          from: `${req.user.first_name} ${req.user.last_name}`,
        });
      }
    }

    res.status(201).json({ message });
  } catch (err) { next(err); }
};

// Reply to a message
exports.reply = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { body } = req.body;

    if (!body) {
      return res.status(400).json({ error: 'Reply body is required' });
    }

    // Get the original message
    const originalRes = await db.query(
      `SELECT * FROM zomic_mail_messages WHERE id = $1 AND workspace_id = $2 AND (to_user_id = $3 OR from_user_id = $3)`,
      [messageId, req.workspaceId, req.user.id]
    );

    if (originalRes.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const original = originalRes.rows[0];
    const replyToUserId = original.from_user_id === req.user.id ? original.to_user_id : original.from_user_id;
    const threadId = original.thread_id;
    const subject = original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`;

    // Create sent copy
    const sentRes = await db.query(
      `INSERT INTO zomic_mail_messages (workspace_id, from_user_id, to_user_id, subject, body, thread_id, parent_message_id, folder)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent') RETURNING *`,
      [req.workspaceId, req.user.id, replyToUserId, subject, body, threadId, messageId]
    );

    // Create inbox copy for recipient
    await db.query(
      `INSERT INTO zomic_mail_messages (workspace_id, from_user_id, to_user_id, subject, body, thread_id, parent_message_id, folder, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'inbox', FALSE)`,
      [req.workspaceId, req.user.id, replyToUserId, subject, body, threadId, messageId]
    );

    // Real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${replyToUserId}`).emit('zomic-mail:new', {
        id: sentRes.rows[0].id,
        subject,
        from: `${req.user.first_name} ${req.user.last_name}`,
      });
    }

    res.status(201).json({ message: sentRes.rows[0] });
  } catch (err) { next(err); }
};

// Forward a message
exports.forward = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { to_user_id, body: additionalBody } = req.body;

    if (!to_user_id) {
      return res.status(400).json({ error: 'Recipient is required' });
    }

    // Verify recipient
    const recipientCheck = await db.query(
      'SELECT id FROM users WHERE id = $1 AND workspace_id = $2 AND status = $3',
      [to_user_id, req.workspaceId, 'active']
    );
    if (recipientCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Recipient not found in your workspace' });
    }

    // Get original message
    const originalRes = await db.query(
      `SELECT * FROM zomic_mail_messages WHERE id = $1 AND workspace_id = $2 AND (to_user_id = $3 OR from_user_id = $3)`,
      [messageId, req.workspaceId, req.user.id]
    );

    if (originalRes.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const original = originalRes.rows[0];
    const subject = `Fwd: ${original.subject.replace(/^(Re:|Fwd:)\s*/i, '')}`;
    const forwardedBody = `${additionalBody || ''}\n\n---------- Forwarded message ----------\nSubject: ${original.subject}\n\n${original.body}`;
    const threadId = require('crypto').randomUUID();

    // Create sent copy
    const sentRes = await db.query(
      `INSERT INTO zomic_mail_messages (workspace_id, from_user_id, to_user_id, subject, body, thread_id, parent_message_id, folder)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent') RETURNING *`,
      [req.workspaceId, req.user.id, to_user_id, subject, forwardedBody, threadId, messageId]
    );

    // Create inbox copy for recipient
    await db.query(
      `INSERT INTO zomic_mail_messages (workspace_id, from_user_id, to_user_id, subject, body, thread_id, parent_message_id, folder, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'inbox', FALSE)`,
      [req.workspaceId, req.user.id, to_user_id, subject, forwardedBody, threadId, messageId]
    );

    // Real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${to_user_id}`).emit('zomic-mail:new', {
        id: sentRes.rows[0].id,
        subject,
        from: `${req.user.first_name} ${req.user.last_name}`,
      });
    }

    res.status(201).json({ message: sentRes.rows[0] });
  } catch (err) { next(err); }
};

// Mark message as read
exports.markAsRead = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    await db.query(
      `UPDATE zomic_mail_messages SET is_read = TRUE WHERE id = $1 AND workspace_id = $2 AND to_user_id = $3`,
      [messageId, req.workspaceId, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
};

// Toggle star
exports.toggleStar = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const result = await db.query(
      `UPDATE zomic_mail_messages SET is_starred = NOT is_starred 
       WHERE id = $1 AND workspace_id = $2 AND (to_user_id = $3 OR from_user_id = $3) RETURNING is_starred`,
      [messageId, req.workspaceId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json({ is_starred: result.rows[0].is_starred });
  } catch (err) { next(err); }
};

// Move to trash
exports.moveToTrash = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    await db.query(
      `UPDATE zomic_mail_messages SET folder = 'trash' 
       WHERE id = $1 AND workspace_id = $2 AND (to_user_id = $3 OR from_user_id = $3)`,
      [messageId, req.workspaceId, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
};

// Restore from trash
exports.restoreFromTrash = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const result = await db.query(
      `SELECT from_user_id, to_user_id FROM zomic_mail_messages WHERE id = $1 AND workspace_id = $2`,
      [messageId, req.workspaceId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    const msg = result.rows[0];
    const folder = msg.from_user_id === req.user.id ? 'sent' : 'inbox';
    await db.query(
      `UPDATE zomic_mail_messages SET folder = $1 WHERE id = $2 AND workspace_id = $3 AND (to_user_id = $4 OR from_user_id = $4)`,
      [folder, messageId, req.workspaceId, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
};

// Archive a message
exports.archive = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    await db.query(
      `UPDATE zomic_mail_messages SET folder = 'archive' 
       WHERE id = $1 AND workspace_id = $2 AND (to_user_id = $3 OR from_user_id = $3)`,
      [messageId, req.workspaceId, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
};

// Permanently delete
exports.deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    await db.query(
      `DELETE FROM zomic_mail_messages WHERE id = $1 AND workspace_id = $2 AND (to_user_id = $3 OR from_user_id = $3)`,
      [messageId, req.workspaceId, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
};

// Get workspace team members (for compose recipient dropdown)
exports.getTeamMembers = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, first_name, last_name, email, role, profile_image, designation 
       FROM users WHERE workspace_id = $1 AND status = 'active' AND id != $2 ORDER BY first_name`,
      [req.workspaceId, req.user.id]
    );
    res.json({ members: result.rows });
  } catch (err) { next(err); }
};

// Upload attachment
exports.uploadAttachment = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const s3Result = await uploadToS3(req.file, 'zomic-mail-attachments');
    res.status(201).json({
      file_url: s3Result.url,
      file_name: req.file.originalname,
      file_size: req.file.size,
    });
  } catch (err) { next(err); }
};
