import { json } from './openai.service.js';

export async function suggestChecklistAndEstimate({ title, description = '' }) {
  const system = 'Bạn là trợ lý quản lý dự án phần mềm, trả lời ngắn gọn và thực tế.';
  const user = `
Tiêu đề task: "${title}"
Mô tả: "${description}"

Hãy gợi ý:
- checklist: tối đa 5 mục, mỗi mục ngắn gọn, actionable
- estimateHours: số giờ ước lượng (0.5-40)
- priority: one of: low | normal | high | urgent
Trả JSON với schema:
{
  "checklist": [{"content": "string"}],
  "estimateHours": number,
  "priority": "low" | "normal" | "high" | "urgent",
  "notes": "string"
}
  `.trim();

  return await json({ system, user, schemaName: 'TaskSuggestion' });
}
