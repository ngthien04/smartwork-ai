import { chat, json } from './openai.service.js';

export async function summarizeComments(comments = []) {
  const merged = comments
    .slice(0, 50) 
    .map((c) => `- ${c.author?.name || 'User'}: ${c.content}`)
    .join('\n');

  const system = 'Bạn là trợ lý tóm tắt góp ý/bình luận ngắn gọn.';
  const user = `
Hãy tóm tắt các bình luận dưới đây thành 3-5 gạch đầu dòng dễ hiểu, trung lập:
${merged}
  `.trim();

  const text = await chat({ system, user, temperature: 0.4, maxTokens: 300 });
  return { summary: text };
}

export async function summarizeActivity(activities = []) {
  const merged = activities
    .slice(0, 50)
    .map((a) => `- ${a.createdAt?.toISOString?.() || a.createdAt} | ${a.actor?.name || 'User'} | ${a.verb} | ${JSON.stringify(a.metadata || {})}`)
    .join('\n');

  const system = 'Bạn là trợ lý tóm tắt lịch sử hoạt động của nhiệm vụ.';
  const user = `
Cho log hoạt động:
${merged}

Hãy tóm tắt thành 4-6 bullet nêu các thay đổi quan trọng (trạng thái, deadline, assignee, file, comment).
Kết thúc bằng một dòng "Next step:" gợi ý bước kế tiếp.
Yêu cầu trả JSON:
{
  "bullets": ["string", ...],
  "nextStep": "string"
}
  `.trim();

  return await json({ system, user, schemaName: 'ActivitySummary', temperature: 0.3, maxTokens: 400 });
}