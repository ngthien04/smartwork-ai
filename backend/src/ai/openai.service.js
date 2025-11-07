import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export async function chat({ system, user, model = DEFAULT_MODEL, temperature = 0.7, maxTokens = 800 }) {
  const res = await openai.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
  });
  return (res.choices?.[0]?.message?.content || '').trim();
}

// Gọi chat kiểu JSON (dùng Reponse Format JSON)
export async function json({ system, user, schemaName = 'Result', model = DEFAULT_MODEL, temperature = 0.2, maxTokens = 800 }) {
  const res = await openai.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      {
        role: 'user',
        content:
          `${user}\n\n` +
          `Trả về JSON **đúng schema** ${schemaName}. Không thêm text ngoài JSON.`,
      },
    ],
  });

  const text = (res.choices?.[0]?.message?.content || '').trim();
  try {
    return JSON.parse(text);
  } catch (e) {
    return { error: 'Invalid JSON from model', raw: text };
  }
}
