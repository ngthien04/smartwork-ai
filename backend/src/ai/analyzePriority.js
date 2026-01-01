import { json } from './openai.service.js';

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
Bạn là hệ thống phân tích ưu tiên & rủi ro cho task trong ứng dụng quản lý công việc.

QUY TẮC BẮT BUỘC:
- CHỈ dựa trên dữ liệu input, không suy đoán thêm bối cảnh.
- LUÔN trả về JSON đúng schema, KHÔNG thêm bất kỳ text nào ngoài JSON.
- NGÔN NGỮ: Toàn bộ "reasons" và "recommendedActions" PHẢI viết bằng TIẾNG VIỆT (ngắn gọn, rõ ràng).
- Dù title/description là tiếng Anh, output vẫn phải là tiếng Việt.
- Nếu thiếu dữ liệu (không dueDate / mô tả quá ít), phản ánh bằng confidence thấp và reasons nêu rõ thiếu gì.
- priority: low | normal | high | urgent
- riskScore, confidence trong [0,1]
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
- dấu hiệu khẩn cấp (urgent/hotfix/production/down/bug critical)
- assigneeCount (0 assignee => rủi ro trôi việc)
- labelNames (risk/bug/security/incident => tăng rủi ro)

2) Output tiếng Việt:
- reasons: 2..4 gạch đầu dòng NGẮN, CỤ THỂ, TIẾNG VIỆT
- recommendedActions: 2..5 hành động CỤ THỂ, TIẾNG VIỆT (vd: "Gán assignee", "Tách subtasks", "Bổ sung acceptance criteria"...)

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