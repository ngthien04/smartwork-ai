import { json } from './openai.service.js';

export async function generateTitleFromDescription({ description }) {
  const system = 'Bạn là trợ lý đặt tên task ngắn gọn, rõ ràng.';
  const user = `
Mô tả công việc:
${description}

Hãy đề xuất 3 tiêu đề ngắn (tối đa 60 ký tự/tiêu đề), mang tính hành động.
JSON:
{ "titles": ["...","...","..."] }
  `.trim();

  return await json({ system, user, schemaName: 'TitleSuggestions', temperature: 0.6, maxTokens: 200 });
}