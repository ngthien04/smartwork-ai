import { json } from './openai.service.js';

export async function detectIntentAndTaskFull({ utterance, todayISO }) {
  const system =
    'Bạn là trợ lý trong app quản lý task. ' +
    'Nhiệm vụ: hiểu câu lệnh và trả về JSON đúng schema. ' +
    'Không giải thích thêm. Nếu user dùng tiếng Việt thì reply tiếng Việt.';

  const user = `
Hôm nay (ISO date): ${todayISO}

Câu của user: """${utterance}"""

Hãy phân tích và trả về JSON với schema ChatIntentTaskFull:

{
  "intent": "create_task" | "small_talk" | "other",
  "task": {
    "title": string | null,
    "description": string | null,

    "teamName": string | null,
    "projectName": string | null,
    "sprintName": string | null,

    "type": "task" | "bug" | "story" | "epic" | null,
    "status": "backlog" | "todo" | "in_progress" | "review" | "blocked" | "done" | null,
    "priority": "low" | "normal" | "high" | "urgent" | null,

    "dueDate": string | null,
    "startDate": string | null,

    "estimate": number | null,
    "storyPoints": number | null,

    "checklist": [{"content":"string"}],

    "labelNames": string[],

    "assigneeEmails": string[],
    "assigneeNames": string[],

    "watcherEmails": string[],
    "watcherNames": string[]
  },
  "reply": string
}

Quy tắc:
- Nếu câu nói kiểu "hãy tạo task...", "tạo task...", "tạo một nhiệm vụ..." thì:
  - intent="create_task"
  - task.title bắt buộc có
- Nếu user có nói "trong team X" thì task.teamName = "X"
- Nếu user có nói "trong project Y" thì task.projectName = "Y"
- Nếu user có nói "giao việc cho A", "assign cho A", "người phụ trách A" thì:
  - Nếu là email => assigneeEmails
  - Nếu là tên => assigneeNames
  - Nếu nhiều người => mảng (tách bằng dấu phẩy)
- Nếu chỉ hỏi han: intent="small_talk"
- Nếu không chắc: intent="other"
- checklist tối đa 5, actionable.
- dueDate/startDate: suy luận từ "ngày mai", "thứ 6 tuần này", "28/11/2025"...
- labelNames: 0-3 nhãn nếu hợp lý.
- Không bịa ObjectId.
- Luôn trả JSON đúng schema, không bao giờ trả text thuần.
  `.trim();

  return await json({ system, user, schemaName: 'ChatIntentTaskFull' });
}