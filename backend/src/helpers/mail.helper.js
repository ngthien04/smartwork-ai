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
    Email: process.env.MAIL_FROM_EMAIL || 'smartwork.noreply@gmail.com',
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

export function sendTeamInviteEmail({
  to,
  inviterName = '',
  teamName = '',
  role = 'member',
  acceptUrl,
  declineUrl,
  from = defaultFrom(),
  templateId,
}) {
  if (!acceptUrl || !declineUrl) {
    throw new Error('sendTeamInviteEmail: missing urls');
  }

  if (templateId) {
    return sendEmail({
      from,
      to,
      templateId,
      variables: { inviterName, teamName, role, acceptUrl, declineUrl },
    });
  }

  const subject = `Bạn được mời tham gia team "${teamName}" trên SmartWork`;

  const html = `
  <div style="background:#f3f4f6;padding:24px 0;font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">

      <!-- Header -->
      <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb">
        <h1 style="margin:0;font-size:20px;color:#111827">
          📩 Lời mời tham gia team
        </h1>
      </div>

      <!-- Body -->
      <div style="padding:24px;color:#374151;line-height:1.6">
        <p style="margin-top:0">
          Xin chào,
        </p>

        <p>
          <strong>${escapeHtml(inviterName) || 'Một thành viên'}</strong>
          đã mời bạn tham gia team
          <strong>${escapeHtml(teamName)}</strong>
          trên <strong>SmartWork</strong>.
        </p>

        <p>
          Vai trò được đề xuất cho bạn:
          <strong>${escapeHtml(role)}</strong>
        </p>

        <div style="margin:28px 0;text-align:center">
          <a href="${encodeURI(acceptUrl)}"
             style="display:inline-block;padding:12px 20px;margin-right:12px;
                    border-radius:8px;background:#22c55e;color:#ffffff;
                    text-decoration:none;font-weight:600">
                Chấp nhận lời mời
          </a>

          <a href="${encodeURI(declineUrl)}"
             style="display:inline-block;padding:12px 20px;
                    border-radius:8px;background:#ef4444;color:#ffffff;
                    text-decoration:none;font-weight:600">
                Từ chối
          </a>
        </div>

        <p style="font-size:14px;color:#6b7280">
          Nếu bạn không mong đợi lời mời này, bạn có thể bỏ qua email này một cách an toàn.
        </p>
      </div>

      <!-- Footer -->
      <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;
                  font-size:12px;color:#6b7280;text-align:center">
        © ${new Date().getFullYear()} SmartWork • Work smarter with AI
      </div>

    </div>
  </div>
  `;

  const text = `
Bạn được mời tham gia team "${teamName}" trên SmartWork.

Người mời: ${inviterName || 'Một thành viên'}
Vai trò: ${role}

Chấp nhận: ${acceptUrl}
Từ chối: ${declineUrl}

Nếu bạn không mong đợi email này, hãy bỏ qua.
  `.trim();

  return sendEmail({ from, to, subject, html, text });
}