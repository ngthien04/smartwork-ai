import { json } from './openai.service.js';

export async function analyzeTaskPriority({ title, description = '', dueDate, currentStatus = 'todo' }) {
  const system = 'Bạn là hệ thống phân tích rủi ro/ưu tiên cho công việc phần mềm.';
  const user = `
Task:
- title: ${title}
- description: ${description}
- dueDate: ${dueDate || 'N/A'}
- currentStatus: ${currentStatus}

Hãy đánh giá:
- priority: low | normal | high | urgent
- riskScore: float 0..1 (gần 1 là rủi ro cao)
- reasons: mảng 2-4 gạch đầu dòng ngắn giải thích vì sao.

Schema JSON:
{
  "priority": "low" | "normal" | "high" | "urgent",
  "riskScore": number,
  "reasons": ["string", "string", "string"]
}
  `.trim();

  return await json({ system, user, schemaName: 'PriorityAnalysis' });
}