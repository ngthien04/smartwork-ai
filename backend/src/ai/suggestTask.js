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

/**
 * Phân tích 1 câu nói để xem có phải yêu cầu "tạo task" không.
 * Trả JSON dạng:
 * {
 *   "intent": "create_task" | "small_talk" | "other",
 *   "task": {
 *     "title": string | null,
 *     "projectName": string | null,
 *     "priority": "low"|"normal"|"high"|"urgent"|null,
 *     "dueDate": string | null, // ISO date, ví dụ "2025-11-28"
 *     "description": string | null
 *   },
 *   "reply": string
 * }
 */
export async function detectIntentAndTask({ utterance }) {
  const system =
    'Bạn là trợ lý trong app quản lý task. ' +
    'Nhiệm vụ: hiểu câu lệnh của user và trả về JSON mô tả intent. ' +
    'Luôn trả về JSON hợp lệ, không giải thích thêm. ' +
    'Nếu user dùng tiếng Việt thì reply tiếng Việt.';

  const user = `
Câu của user: """${utterance}"""

Hãy phân tích và trả về JSON với schema ChatIntentTask:

{
  "intent": "create_task" | "small_talk" | "other",
  "task": {
    "title": string | null,
    "projectName": string | null,
    "priority": "low" | "normal" | "high" | "urgent" | null,
    "dueDate": string | null,      // ISO 8601, ví dụ "2025-11-28" nếu suy ra được
    "description": string | null
  },
  "reply": string                  // Câu trả lời thân thiện gửi lại cho user
}

Quy tắc:
- Nếu câu nói kiểu "hãy tạo task tên X", "tạo một nhiệm vụ Y trong dự án Z" ... thì:
  - intent = "create_task"
  - task.title = tên task (bắt buộc)
  - task.projectName = tên project nếu user có nhắc
  - task.priority = nếu user có nói "ưu tiên cao/thấp/..." thì map sang high/low/...
  - task.dueDate = ISO date (YYYY-MM-DD) nếu có thời gian kiểu "ngày mai", "thứ 6 tuần này", "28/11/2025"...
  - task.description = mô tả ngắn gọn nếu có thể tóm tắt
- Nếu chỉ là hỏi han, trò chuyện bình thường: intent = "small_talk"
- Nếu không chắc là gì: intent = "other"
- Luôn trả về JSON đúng schema trên, không bao giờ trả text thuần.
  `.trim();

  return await json({ system, user, schemaName: 'ChatIntentTask' });
}
