import { json } from './openai.service.js';

function safeJson(v, max = 6000) {
  try {
    const s = JSON.stringify(v ?? null);
    return s.length > max ? s.slice(0, max) + '…' : s;
  } catch {
    return 'N/A';
  }
}

export async function triageBuglist({ buglist, context = {}, todayISO }) {
  const system = `
Bạn là AI Triage cho bug tracker trong ứng dụng quản lý công việc.

BẮT BUỘC:
- CHỈ dựa trên dữ liệu được cung cấp (buglist + context). Không bịa.
- Output 100% TIẾNG VIỆT. Không dùng tiếng Anh trong rationale/topRisks.
- Trả về JSON đúng schema, KHÔNG thêm text ngoài JSON.
- Mỗi item rationale phải nêu "tín hiệu cụ thể" từ input: platform/browser, route/page, API endpoint, HTTP status, error message, logs, keyword (crash/login/timeout...).
- Nếu thiếu dữ liệu quan trọng (route/status/logs/repro), confidence phải giảm và nêu rõ thiếu gì.

QUY TẮC SEVERITY:
- S1: crash/blank screen, không đăng nhập được, production down, payment fail, data loss, security/incident
- S2: core feature hỏng, regression lớn, API 5xx ở luồng chính, không có workaround
- S3: có workaround, ảnh hưởng vừa, lỗi UI/UX không chặn luồng chính
- S4: cosmetic/minor, hiếm gặp

QUY TẮC PRIORITY:
- urgent: S1 trên prod, hoặc S1/S2 sát releaseDate, hoặc có security/data loss
- high: S2 trên staging/prod, hoặc S2 có repro rõ, hoặc ảnh hưởng nhiều người
- normal: S3 hoặc S2 nhưng thiếu dữ liệu
- low: S4 hoặc S3 rất nhẹ/hiếm

LABEL TAXONOMY (suggestedLabels):
- area: frontend|backend|api|auth|ui|perf|security|mobile|email|storage
- platform: chrome|safari|firefox|edge|ios|android
- route:/xxx nếu biết (từ bug text hoặc context.routes)
- api:/xxx nếu biết (GET/POST + endpoint)
- status:500|status:401|timeout nếu biết
- type:crash|regression|flaky|config|ux
`.trim();

  const user = `
NGÀY HIỆN TẠI (todayISO): ${todayISO || 'N/A'}

CONTEXT:
${safeJson(context, 8000)}

BUGLIST (mỗi dòng 1 bug, raw):
${buglist}

YÊU CẦU:
1) Parse buglist thành items (nếu 1 dòng chứa nhiều bug thì tách hợp lý).
2) Với mỗi item:
- title: ngắn gọn, thêm prefix area nếu suy ra được (VD: "[Auth] Không nhận email reset password")
- description: tóm tắt + đính kèm tín hiệu (route/platform/api/status/error) nếu có
- severity: S1|S2|S3|S4
- priority: urgent|high|normal|low
- order: 1..n theo thứ tự xử lý đề xuất
- confidence: 0..1
- rationale: 2-4 bullet TIẾNG VIỆT, mỗi bullet phải gắn với tín hiệu cụ thể từ input
- suggestedLabels: 2-6 labels theo taxonomy (ưu tiên có area + platform/route/api nếu suy ra được)

3) summary.topRisks:
- 2-5 dòng TIẾNG VIỆT, dựa trên items thực tế (VD: "Có 2 lỗi S1 liên quan đăng nhập" / "Có API 500 ở /tasks").

Trả về đúng JSON schema BugTriageResponse.
`.trim();

  return json({ system, user, schemaName: 'BugTriageResponse' });
}