import nodemailer from "nodemailer";
import { getEnv, isInstitutionalEmail } from "@/config/env";

type ZimbraCredentials = {
  email: string;
  password: string;
};

export type ZimbraSendInput = ZimbraCredentials & {
  to: string;
  subject: string;
  html: string;
  text: string;
  campaignId?: string;
  recipientId?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: Buffer;
  }>;
};

function createTransport(credentials: ZimbraCredentials) {
  const env = getEnv();

  return nodemailer.createTransport({
    host: env.ZIMBRA_SMTP_HOST,
    port: env.ZIMBRA_SMTP_PORT,
    secure: env.ZIMBRA_SMTP_SECURE,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: {
      user: credentials.email,
      pass: credentials.password
    }
  });
}

export async function validateZimbraCredentials(credentials: ZimbraCredentials): Promise<boolean> {
  if (!isInstitutionalEmail(credentials.email)) {
    return false;
  }

  const transport = createTransport(credentials);
  await transport.verify();
  return true;
}

export async function sendZimbraEmail(input: ZimbraSendInput) {
  if (!isInstitutionalEmail(input.email)) {
    throw new Error("Remetente fora do domínio institucional.");
  }

  const transport = createTransport(input);

  return transport.sendMail({
    from: input.email,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    headers: {
      ...(input.campaignId ? { "X-Campaign-Id": input.campaignId } : {}),
      ...(input.recipientId ? { "X-Recipient-Id": input.recipientId } : {})
    },
    attachments: input.attachments?.map((attachment) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      content: attachment.content
    }))
  });
}
