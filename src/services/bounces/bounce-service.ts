import { Socket } from "net";
import { connect as tlsConnect, TLSSocket } from "tls";
import { AuditAction } from "@prisma/client";
import { getEnv } from "@/config/env";
import { prisma } from "@/lib/prisma/client";
import { registerAuditLog } from "@/services/audit/audit-service";
import { reconcileCampaignDeliveryStatus } from "@/services/campaigns/campaign-service";

type ImapConnection = Socket | TLSSocket;

type BounceCandidate = {
  campaignId?: string;
  recipientId?: string;
  recipientEmail?: string;
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

function getHeaderValue(raw: string, header: string): string | undefined {
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = raw.match(new RegExp(`^${escaped}:\\s*(.+(?:\\r?\\n[ \\t].+)*)`, "im"));

  return match?.[1]?.replace(/\r?\n[ \t]+/g, " ").trim();
}

function parseBounce(raw: string): BounceCandidate | null {
  const campaignId = getHeaderValue(raw, "X-Campaign-Id");
  const recipientId = getHeaderValue(raw, "X-Recipient-Id");
  const finalRecipient = raw.match(/^Final-Recipient:\s*[^;]+;\s*(.+)$/im)?.[1];
  const originalRecipient = raw.match(/^Original-Recipient:\s*[^;]+;\s*(.+)$/im)?.[1];
  const diagnosticCode = raw.match(/^Diagnostic-Code:\s*(.+(?:\r?\n[ \t].+)*)$/im)?.[1];
  const status = raw.match(/^Status:\s*(.+)$/im)?.[1];
  const action = raw.match(/^Action:\s*(.+)$/im)?.[1];
  const subject = getHeaderValue(raw, "Subject");
  const reason = [action, status, diagnosticCode, subject]
    .filter(Boolean)
    .join(" | ")
    .replace(/\r?\n[ \t]+/g, " ")
    .slice(0, 1000);
  const recipientEmail = normalizeEmail(finalRecipient) ?? normalizeEmail(originalRecipient) ?? normalizeEmail(raw);

  if (!campaignId && !recipientId && !recipientEmail) {
    return null;
  }

  return {
    campaignId,
    recipientId,
    recipientEmail,
    reason: reason || "Bounce detectado na caixa de retorno."
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

async function applyBounce(candidate: BounceCandidate): Promise<BounceResult> {
  const recipient =
    candidate.recipientId
      ? await prisma.campaignRecipient.findUnique({
          where: { id: candidate.recipientId },
          include: { campaign: true }
        })
      : await prisma.campaignRecipient.findFirst({
          where: {
            email: candidate.recipientEmail,
            ...(candidate.campaignId ? { campaignId: candidate.campaignId } : {}),
            status: { in: ["SENT", "PENDING"] }
          },
          include: { campaign: true },
          orderBy: { updatedAt: "desc" }
        });

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
      const candidate = parseBounce(extractFetchBody(fetchResponse));

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
