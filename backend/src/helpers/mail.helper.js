// src/helpers/mail.helper.js
// ESM helper to send emails via Mailjet v3.1
// Usage: import { sendEmail, sendWelcomeEmail, sendResetPasswordEmail, sendTaskAssignedEmail } from './helpers/mail.helper.js'

import { getClient } from '../config/mail.config.js';

const mailjet = getClient(); // create once per process

/** Normalize many input formats into Mailjet {Email, Name} objects */
function normalizeRecipients(recipient) {
  if (!recipient) return [];
  const arr = Array.isArray(recipient) ? recipient : [recipient];
  return arr
    .filter(Boolean)
    .map((it) => {
      if (typeof it === 'string') return { Email: it };
      const { email, name, Email, Name } = it;
      return { Email: email || Email, Name: name || Name };
    })
    .filter((x) => x?.Email);
}

/**
 * Base low-level sender for Mailjet v3.1
 * @param {Object} opts
 * @param {string|{email:string,name?:string}} opts.from - sender
 * @param {string|string[]|{email:string,name?:string}|Array} opts.to - recipients
 * @param {string} opts.subject
 * @param {string} [opts.html]
 * @param {string} [opts.text]
 * @param {Array<{filename:string, content: string, contentType?: string}>} [opts.attachments] - content is base64
 * @param {Array} [opts.cc]
 * @param {Array} [opts.bcc]
 * @param {string} [opts.replyTo]
 * @param {number} [opts.templateId] - Mailjet TemplateID; if set, uses template
 * @param {Object} [opts.variables] - variables for TemplateLanguage
 * @returns {Promise<{messageId?:string, response:any}>}
 */
export async function sendEmail(opts) {
  const {
    from,
    to,
    subject,
    html,
    text,
    attachments,
    cc,
    bcc,
    replyTo,
    templateId,
    variables,
  } = opts || {};

  if (!from) throw new Error('sendEmail: missing `from`');
  if (!to) throw new Error('sendEmail: missing `to`');
  if (!templateId && !html && !text) throw new Error('sendEmail: need `html` or `text` or `templateId`');

  const fromObj =
    typeof from === 'string' ? { Email: from } : { Email: from.email || from.Email, Name: from.name || from.Name };

  const message = {
    From: fromObj,
    To: normalizeRecipients(to),
    Subject: subject || undefined,
  };

  const ccList = normalizeRecipients(cc);
  const bccList = normalizeRecipients(bcc);
  if (ccList.length) message.Cc = ccList;
  if (bccList.length) message.Bcc = bccList;
  if (replyTo) message['ReplyTo'] = typeof replyTo === 'string' ? { Email: replyTo } : { Email: replyTo.email || replyTo.Email, Name: replyTo.name || replyTo.Name };

  if (attachments?.length) {
    message.Attachments = attachments.map((a) => ({
      ContentType: a.contentType || 'application/octet-stream',
      Filename: a.filename,
      Base64Content: a.content,
    }));
  }

  if (templateId) {
    message.TemplateID = Number(templateId);
    message.TemplateLanguage = true;
    if (variables) message.Variables = variables;
    // When using TemplateID, Subject can be defined inside the template; keep provided subject to allow override
  } else {
    if (html) message.HTMLPart = html;
    if (text) message.TextPart = text;
  }

  try {
    const { body } = await mailjet.post('send', { version: 'v3.1' }).request({ Messages: [message] });
    const messageId = body?.Messages?.[0]?.To?.[0]?.MessageID || body?.Messages?.[0]?.MessageID;
    return { messageId, response: body };
  } catch (err) {
    // Unwrap Mailjet error for easier debugging
    const status = err?.statusCode || err?.response?.status;
    const reason = err?.message || err?.response?.text || 'Mailjet error';
    const details = err?.response?.body || err?.response?.data;
    const error = new Error(`Mailjet send failed (${status}): ${reason}`);
    error.details = details;
    throw error;
  }
}

// ------------------------------------------------------------
// Convenience helpers for common product emails
// ------------------------------------------------------------

/**
 * Send a welcome email.
 * @param {Object} p
 * @param {string|object|Array} p.to
 * @param {string} [p.name]
 * @param {string|object} [p.from]
 * @param {number} [p.templateId] - Use MJ template if provided
 */
export function sendWelcomeEmail({ to, name = '', from = defaultFrom(), templateId }) {
  if (templateId) {
    return sendEmail({
      from,
      to,
      templateId,
      variables: { name },
    });
  }
  const subject = 'Chào mừng bạn đến với SmartWork ✨';
  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <h2>Xin chào ${escapeHtml(name) || 'bạn'}!</h2>
      <p>Cảm ơn bạn đã đăng ký SmartWork. Bắt đầu tạo task, mời đồng đội và để AI giúp bạn sắp xếp công việc thông minh hơn.</p>
      <p>— Đội ngũ SmartWork</p>
    </div>`;
  const text = `Xin chào ${name || 'bạn'}!\nCảm ơn bạn đã đăng ký SmartWork.`;
  return sendEmail({ from, to, subject, html, text });
}

/**
 * Send password reset email
 * @param {Object} p
 * @param {string|object|Array} p.to
 * @param {string} p.resetUrl - fully qualified URL containing token
 * @param {string} [p.name]
 * @param {string|object} [p.from]
 * @param {number} [p.templateId]
 */
export function sendResetPasswordEmail({ to, resetUrl, name = '', from = defaultFrom(), templateId }) {
  if (!resetUrl) throw new Error('sendResetPasswordEmail: missing resetUrl');
  if (templateId) {
    return sendEmail({ from, to, templateId, variables: { name, resetUrl } });
  }
  const subject = 'Đặt lại mật khẩu SmartWork';
  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <p>Xin chào ${escapeHtml(name) || 'bạn'},</p>
      <p>Nhấn vào nút dưới đây để đặt lại mật khẩu:</p>
      <p><a href="${encodeURI(resetUrl)}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#2563eb;color:#fff;text-decoration:none">Đặt lại mật khẩu</a></p>
      <p>Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email.</p>
    </div>`;
  const text = `Xin chào ${name || 'bạn'},\nHãy mở liên kết để đặt lại mật khẩu: ${resetUrl}`;
  return sendEmail({ from, to, subject, html, text });
}

/**
 * Notify when a task is assigned to a user
 * @param {Object} p
 * @param {string|object|Array} p.to
 * @param {string} p.taskTitle
 * @param {string} [p.taskUrl]
 * @param {string} [p.projectKey]
 * @param {string} [p.from]
 * @param {number} [p.templateId]
 */
export function sendTaskAssignedEmail({ to, taskTitle, taskUrl = '#', projectKey = '', from = defaultFrom(), templateId }) {
  if (!taskTitle) throw new Error('sendTaskAssignedEmail: missing taskTitle');
  if (templateId) {
    return sendEmail({ from, to, templateId, variables: { taskTitle, taskUrl, projectKey } });
  }
  const subject = `[${projectKey || 'TASK'}] Bạn được giao: ${taskTitle}`;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <p>Bạn vừa được giao task: <strong>${escapeHtml(taskTitle)}</strong>.</p>
      <p><a href="${encodeURI(taskUrl)}">Mở task</a></p>
    </div>`;
  const text = `Bạn vừa được giao task: ${taskTitle}. Mở: ${taskUrl}`;
  return sendEmail({ from, to, subject, html, text });
}

// ------------------------------------------------------------
// Utils
// ------------------------------------------------------------

function defaultFrom() {
  return {
    Email: process.env.MAIL_FROM_EMAIL || 'no-reply@smartwork.local',
    Name: process.env.MAIL_FROM_NAME || 'SmartWork',
  };
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
