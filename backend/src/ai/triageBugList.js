import { json } from './openai.service.js';

export async function triageBuglist({
  buglist,
  teamName,
  productArea,
  releaseDate,
}) {
  const system = `
Bạn là AI Triage cho bug tracker. Mục tiêu:
- Chuẩn hoá buglist dạng text thành danh sách bug có severity/priority và thứ tự xử lý.
- Không bịa thông tin; nếu thiếu dữ liệu hãy phản ánh qua confidence thấp + rationale nêu "thiếu thông tin".
- Output đúng JSON schema.
`.trim();

  const user = `
Bối cảnh (có thể thiếu):
- team: ${teamName || 'N/A'}
- productArea: ${productArea || 'N/A'}
- releaseDate: ${releaseDate || 'N/A'}

Buglist (raw):
${buglist}

Yêu cầu:
1) Tách từng bug thành item.
2) Gán severity:
- S1: crash/data loss/security/production down
- S2: core feature broken, major regression
- S3: workaround được, ảnh hưởng vừa
- S4: cosmetic/minor
3) Gán priority: urgent|high|normal|low dựa trên severity + deadline/release + phạm vi ảnh hưởng.
4) Sắp xếp order (1..n) theo thứ tự xử lý đề xuất.
5) Với mỗi item: rationale 2-4 bullet ngắn, confidence 0..1.
6) Trả summary: đếm theo severity/priority + topRisks (2-5 dòng).

JSON Schema:
{
  "summary": {
    "total": number,
    "bySeverity": { "S1": number, "S2": number, "S3": number, "S4": number },
    "byPriority": { "urgent": number, "high": number, "normal": number, "low": number },
    "topRisks": ["string"]
  },
  "items": [
    {
      "title": "string",
      "description": "string",
      "severity": "S1"|"S2"|"S3"|"S4",
      "priority": "urgent"|"high"|"normal"|"low",
      "order": number,
      "confidence": number,
      "rationale": ["string"],
      "suggestedLabels": ["string"]
    }
  ]
}
`.trim();

  return json({ system, user, schemaName: 'BugTriageResponse' });
}