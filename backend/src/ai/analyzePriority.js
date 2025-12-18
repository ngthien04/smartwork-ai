import { json } from './openai.service.js';

/**
 * Priority & Risk analysis for a software task.
 * Goal: stable JSON output, low hallucination, actionable suggestions.
 */
export async function analyzeTaskPriority({
  title,
  description = '',
  dueDate,
  currentStatus = 'todo',
  createdAt,
  updatedAt,
  assigneeCount,
  labelNames = [],
}) {
  const system = `
Bạn là hệ thống phân tích ưu tiên & rủi ro cho task trong ứng dụng quản lý công việc phần mềm.

Nguyên tắc:
- CHỈ dựa trên dữ liệu được cung cấp trong input. Không suy đoán bừa về bối cảnh, khách hàng, deadline, team.
- Luôn trả về JSON đúng schema. Không thêm text ngoài JSON.
- Nếu dữ liệu thiếu (ví dụ không có dueDate / mô tả quá ít), hãy phản ánh bằng confidence thấp và reasons nêu rõ thiếu dữ liệu.
- Ưu tiên theo chuẩn: low | normal | high | urgent.
- riskScore trong [0,1].
`.trim();

  const user = `
INPUT:
- title: ${String(title || '').trim()}
- description: ${String(description || '').trim()}
- dueDate: ${dueDate ? String(dueDate) : 'N/A'}
- currentStatus: ${String(currentStatus || 'todo')}
- createdAt: ${createdAt ? String(createdAt) : 'N/A'}
- updatedAt: ${updatedAt ? String(updatedAt) : 'N/A'}
- assigneeCount: ${Number.isFinite(assigneeCount) ? String(assigneeCount) : 'N/A'}
- labelNames: ${Array.isArray(labelNames) ? JSON.stringify(labelNames) : '[]'}

YÊU CẦU:
1) Chấm priority + riskScore dựa trên:
- dueDate (gần hạn / quá hạn)
- status (blocked/review/in_progress/todo/backlog/done)
- độ rõ ràng của mô tả (thiếu yêu cầu => rủi ro)
- dấu hiệu khẩn cấp trong title/description (urgent/hotfix/production/down/bug critical)
- assigneeCount (0 assignee => rủi ro trôi việc)
- labelNames (risk/bug/security/incident => tăng rủi ro)

2) Trả về:
- priority: low|normal|high|urgent
- riskScore: number 0..1
- confidence: 0..1 (mức chắc chắn từ dữ liệu hiện có)
- reasons: 2..4 gạch đầu dòng ngắn, cụ thể, không nói chung chung
- recommendedActions: 2..5 hành động cụ thể (vd: "gán assignee", "tách subtasks", "đặt deadline", "làm rõ acceptance criteria", "đổi status blocked + ghi blocker")

Schema JSON:
{
  "priority": "low" | "normal" | "high" | "urgent",
  "riskScore": number,
  "confidence": number,
  "reasons": string[],
  "recommendedActions": string[]
}
`.trim();

  return await json({
    system,
    user,
    schemaName: 'PriorityAnalysisV2',
  });
}