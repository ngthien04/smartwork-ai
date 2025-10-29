import Mailjet from 'node-mailjet';

export function getClient() {
  const mailjet = Mailjet.apiConnect(
    process.env.MAILJET_API_KEY, 
    process.env.MAILJET_API_SECRET  
  );
  return mailjet;
}
