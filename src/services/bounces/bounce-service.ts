import { Socket } from "net";
import { connect as tlsConnect, TLSSocket } from "tls";
import { AuditAction } from "@prisma/client";
import { getEnv } from "@/config/env";
import { prisma } from "@/lib/prisma/client";
import { markApiEmailTaskBounced } from "@/services/api-email/api-email-service";
import { registerAuditLog } from "@/services/audit/audit-service";
import { reconcileCampaignDeliveryStatus } from "@/services/campaigns/campaign-service";

type ImapConnection = Socket | TLSSocket;

type BounceCandidate = {
  campaignId?: string;
  recipientId?: string;
  apiEmailTaskId?: string;
  recipientEmail?: string;
  senderEmail?: string;
  reason: string;
};

type BounceResult = {
  uid: number;
  ok: boolean;
  campaignId?: string;
  recipientEmail?: string;
  message?: string;
};

function escapeImapString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function normalizeEmail(value: string | undefined): string | undefined {
  const match = value?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu);
  return match?.[0]?.toLowerCase();
}

function getTopLevelHeaderBlock(raw: string): string {
  return raw.split(/\r?\n\r?\n/, 1)[0] ?? raw;
}

function getHeaderValue(raw: string, header: string): string | undefined {
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = raw.match(new RegExp(`^${escaped}:\\s*(.+(?:\\r?\\n[ \\t].+)*)`, "im"));

  return match?.[1]?.replace(/\r?\n[ \t]+/g, " ").trim();
}

function getDeliveryStatusValue(raw: string, field: string): string | undefined {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = raw.match(new RegExp(`^${escaped}:\\s*(.+(?:\\r?\\n[ \\t].+)*)`, "im"));

  return match?.[1]?.replace(/\r?\n[ \t]+/g, " ").trim();
}

function hasBounceSignal(raw: string, subject?: string): boolean {
  const normalizedSubject = subject?.toLowerCase() ?? "";

  return (
    /report-type\s*=\s*delivery-status/i.test(raw) ||
    /content-type:\s*message\/delivery-status/i.test(raw) ||
    /^Final-Recipient:/im.test(raw) ||
    /^Diagnostic-Code:/im.test(raw) ||
    /^Action:\s*(failed|delayed)/im.test(raw) ||
    /^Status:\s*[45]\./im.test(raw) ||
    /\b(undelivered mail returned|delivery status notification|mail delivery failed|failure notice|delivery failure)\b/i.test(normalizedSubject)
  );
}

function parseBounce(raw: string): BounceCandidate | null {
  const topLevelHeaders = getTopLevelHeaderBlock(raw);
  const subject = getHeaderValue(topLevelHeaders, "Subject");

  if (!hasBounceSignal(raw, subject)) {
    return null;
  }

  const campaignId = getHeaderValue(raw, "X-Campaign-Id");
  const recipientId = getHeaderValue(raw, "X-Recipient-Id");
  const apiEmailTaskId = getHeaderValue(raw, "X-Api-Email-Task-Id");
  const xFailedRecipients = getHeaderValue(raw, "X-Failed-Recipients");
  const finalRecipient = getDeliveryStatusValue(raw, "Final-Recipient")?.split(";").at(-1);
  const originalRecipient = getDeliveryStatusValue(raw, "Original-Recipient")?.split(";").at(-1);
  const diagnosticCode = getDeliveryStatusValue(raw, "Diagnostic-Code");
  const status = getDeliveryStatusValue(raw, "Status");
  const action = getDeliveryStatusValue(raw, "Action");
  const reason = [action, status, diagnosticCode]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 1000);
  const recipientEmail =
    normalizeEmail(finalRecipient) ??
    normalizeEmail(originalRecipient) ??
    normalizeEmail(xFailedRecipients);

  if (!recipientEmail || !reason) {
    return null;
  }

  if (!campaignId && !recipientId && !apiEmailTaskId && !recipientEmail) {
    return null;
  }

  return {
    campaignId,
    recipientId,
    apiEmailTaskId,
    recipientEmail,
    reason
  };
}

function createImapConnection(input: {
  host: string;
  port: number;
  secure: boolean;
}): Promise<ImapConnection> {
  return new Promise((resolve, reject) => {
    const socket = input.secure
      ? tlsConnect({ host: input.host, port: input.port })
      : new Socket().connect(input.port, input.host);

    socket.once("connect", () => resolve(socket));
    socket.once("secureConnect", () => resolve(socket));
    socket.once("error", reject);
  });
}

class SimpleImapClient {
  private buffer = "";
  private tagCounter = 0;

  constructor(private readonly socket: ImapConnection) {
    this.socket.setEncoding("utf8");
    this.socket.on("data", (chunk) => {
      this.buffer += chunk;
    });
  }

  async waitForGreeting() {
    await this.waitForPattern(/\* OK/i);
  }

  async command(command: string): Promise<string> {
    const tag = `A${String(++this.tagCounter).padStart(4, "0")}`;
    this.socket.write(`${tag} ${command}\r\n`);
    return this.waitForPattern(new RegExp(`${tag} (OK|NO|BAD)`, "i"));
  }

  close() {
    this.socket.end();
  }

  private waitForPattern(pattern: RegExp): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Tempo esgotado ao comunicar com IMAP."));
      }, 30000);

      const cleanup = () => {
        clearTimeout(timeout);
        this.socket.off("data", check);
        this.socket.off("error", onError);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const check = () => {
        if (!pattern.test(this.buffer)) {
          return;
        }

        const value = this.buffer;
        this.buffer = "";
        cleanup();
        resolve(value);
      };

      this.socket.on("data", check);
      this.socket.on("error", onError);
      check();
    });
  }
}

function parseSearchUids(response: string): number[] {
  const match = response.match(/\* SEARCH\s+([0-9\s]+)/i);

  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .trim()
    .split(/\s+/)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function extractFetchBody(response: string): string {
  const literalStart = response.indexOf("\r\n");
  const taggedIndex = response.search(/\r\nA\d{4} (OK|NO|BAD)/i);

  if (literalStart === -1 || taggedIndex === -1 || taggedIndex <= literalStart) {
    return response;
  }

  return response.slice(literalStart + 2, taggedIndex);
}

async function findBounceRecipient(candidate: BounceCandidate) {
  if (candidate.recipientEmail) {
    const recipientByEmail = await prisma.campaignRecipient.findFirst({
      where: {
        email: candidate.recipientEmail,
        ...(candidate.campaignId ? { campaignId: candidate.campaignId } : {}),
        status: { in: ["SENT", "PENDING"] }
      },
      include: { campaign: true },
      orderBy: { updatedAt: "desc" }
    });

    if (recipientByEmail) {
      return recipientByEmail;
    }
  }

  if (!candidate.recipientId) {
    return null;
  }

  return prisma.campaignRecipient.findFirst({
    where: {
      id: candidate.recipientId,
      ...(candidate.campaignId ? { campaignId: candidate.campaignId } : {}),
      ...(candidate.recipientEmail ? { email: candidate.recipientEmail } : {})
    },
    include: { campaign: true }
  });
}

async function applyBounce(candidate: BounceCandidate): Promise<BounceResult> {
  if (candidate.apiEmailTaskId) {
    const apiTask = await markApiEmailTaskBounced({
      taskId: candidate.apiEmailTaskId,
      recipientEmail: candidate.recipientEmail,
      senderEmail: candidate.senderEmail,
      reason: candidate.reason
    });

    if (apiTask) {
      return {
        uid: 0,
        ok: true,
        recipientEmail: apiTask.toEmail,
        message: "Bounce via API registrado."
      };
    }
  }

  const recipient = await findBounceRecipient(candidate);

  if (!recipient && !candidate.campaignId && !candidate.recipientId) {
    const apiTask = await markApiEmailTaskBounced({
      recipientEmail: candidate.recipientEmail,
      senderEmail: candidate.senderEmail,
      reason: candidate.reason
    });

    if (apiTask) {
      return {
        uid: 0,
        ok: true,
        recipientEmail: apiTask.toEmail,
        message: "Bounce via API registrado."
      };
    }
  }

  if (!recipient) {
    return {
      uid: 0,
      ok: false,
      recipientEmail: candidate.recipientEmail,
      message: "Destinatário do bounce não localizado."
    };
  }

  const existingBounce = await prisma.emailLog.findFirst({
    where: {
      campaignId: recipient.campaignId,
      recipientEmail: recipient.email,
      status: "BOUNCED"
    }
  });

  if (existingBounce) {
    return {
      uid: 0,
      ok: true,
      campaignId: recipient.campaignId,
      recipientEmail: recipient.email,
      message: "Bounce já registrado."
    };
  }

  await prisma.$transaction([
    prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: {
        status: "FAILED",
        errorMessage: candidate.reason
      }
    }),
    prisma.emailLog.create({
      data: {
        campaignId: recipient.campaignId,
        recipientEmail: recipient.email,
        senderEmail: recipient.campaign.senderEmail,
        status: "BOUNCED",
        errorMessage: candidate.reason,
        attempts: 0
      }
    })
  ]);

  await registerAuditLog({
    userId: recipient.campaign.ownerUserId,
    userEmail: recipient.campaign.senderEmail,
    action: AuditAction.EMAIL_SEND_FAILURE,
    entityType: "campaign_recipient",
    entityId: recipient.id,
    metadata: {
      campaignId: recipient.campaignId,
      recipientEmail: recipient.email,
      reason: candidate.reason,
      kind: "bounce"
    }
  });

  await reconcileCampaignDeliveryStatus(recipient.campaignId);

  return {
    uid: 0,
    ok: true,
    campaignId: recipient.campaignId,
    recipientEmail: recipient.email,
    message: "Bounce registrado."
  };
}

export async function processBounceMailbox(input: { email: string; password: string }): Promise<BounceResult[]> {
  const env = getEnv();

  if (!env.ZIMBRA_IMAP_HOST) {
    throw new Error("Configure ZIMBRA_IMAP_HOST para checar bounces.");
  }

  if (!input.password) {
    throw new Error("Informe a senha para checar os retornos da caixa do usuário logado.");
  }

  const socket = await createImapConnection({
    host: env.ZIMBRA_IMAP_HOST,
    port: env.ZIMBRA_IMAP_PORT,
    secure: env.ZIMBRA_IMAP_SECURE
  });
  const client = new SimpleImapClient(socket);

  try {
    await client.waitForGreeting();
    await client.command(`LOGIN "${escapeImapString(input.email)}" "${escapeImapString(input.password)}"`);
    await client.command(`SELECT "${escapeImapString(env.BOUNCE_IMAP_MAILBOX)}"`);

    const searchResponse = await client.command("UID SEARCH UNSEEN");
    const uids = parseSearchUids(searchResponse).slice(0, 50);
    const results: BounceResult[] = [];

    for (const uid of uids) {
      const fetchResponse = await client.command(`UID FETCH ${uid} BODY.PEEK[]`);
      const parsed = parseBounce(extractFetchBody(fetchResponse));
      const candidate = parsed ? { ...parsed, senderEmail: input.email.toLowerCase() } : null;

      if (!candidate) {
        results.push({ uid, ok: false, message: "Mensagem ignorada: não parece ser bounce rastreável." });
        continue;
      }

      const result = await applyBounce(candidate);
      results.push({ ...result, uid });
      await client.command(`UID STORE ${uid} +FLAGS (\\Seen)`);
    }

    await client.command("LOGOUT");
    return results;
  } finally {
    client.close();
  }
}
