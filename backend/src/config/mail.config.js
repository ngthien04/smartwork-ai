import mailjet from 'node-mailjet';

export function getClient() {
  const apiKey = process.env.MAILJET_API_KEY;
  const apiSecret = process.env.MAILJET_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Missing MAILJET_API_KEY / MAILJET_API_SECRET');
  }

  return mailjet.apiConnect(apiKey, apiSecret);
}