// src/app/api/gmail/draft/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAuthedGmail, b64UrlEncode } from "@/lib/google";
import { prisma } from "@/lib/prisma";
import { getThreadContext } from "@/lib/email";
import { llmDraft } from "@/lib/llm";

const SIGNATURE_NAME = process.env.SIGNATURE_NAME ?? "Kanishk";
const MIN_BODY_CHARS = Number(process.env.LLM_MIN_CHARS || 80); // gentle floor; still LLM-only

function extractEmailAddress(fromHeader: string): string {
  const m = fromHeader?.match(/<([^>]+)>/);
  return (m ? m[1] : fromHeader)?.trim() ?? "";
}

function buildStyleHint(profile?: {
  greeting?: string | null;
  closing?: string | null;
  preferredTone?: string | null;
  preferredLang?: string | null;
  avgLength?: number | null;
}) {
  const lang = profile?.preferredLang ?? "en";
  const tone = profile?.preferredTone ?? "concise, calm, polite";
  const greet = profile?.greeting ?? "Hi {first}";
  const close = profile?.closing ?? `Regards,\n${SIGNATURE_NAME}`;
  const len = profile?.avgLength
    ? `Target length ~${profile.avgLength} words.`
    : "Target length ~120 words.";
  return `Language: ${lang}. Tone: ${tone}. Greeting: "${greet}". Closing: "${close}". ${len}`;
}

export async function POST(req: Request) {
  try {
    const gmail = await getAuthedGmail();
    const { messageId } = (await req.json()) as { messageId?: string };
    if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

    // 1) Read original headers
    const original = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "To", "Message-ID", "References"],
    });

    const headers = Object.fromEntries(
      (original.data.payload?.headers ?? []).map((h) => [h.name!, h.value ?? ""])
    ) as Record<string, string>;

    const subject = headers["Subject"] || "(no subject)";
    const from = headers["From"] || "";
    const msgId = (headers["Message-ID"] || "").trim();
    const refs = (headers["References"] || "").trim();
    const replyTo = extractEmailAddress(from);
    const toHeader = replyTo || "undisclosed-recipients:;";
    const threadId = original.data.threadId!;

    // 2) Optional style memory
    let profile: any = null;
    try {
      if (replyTo) {
        profile = await prisma.senderProfile.findUnique({
          where: { email: replyTo.toLowerCase() },
        });
      }
    } catch { /* ignore if table missing */ }
    const styleHint = buildStyleHint(profile);

    // 3) Thread context (fallback to snippet text only if fetch fails)
    let threadContext = "";
    try {
      threadContext = await getThreadContext(gmail, threadId, 4);
    } catch {
      threadContext = original.data.snippet ?? "";
    }

    // 4) LLM-only drafting (llm.ts handles retry & generic salvage)
    const out = await llmDraft({
      subject,
      threadContext,
      styleHint,
      signature: `Regards,\n${SIGNATURE_NAME}`,
    });

    // 5) Ensure minimal length; if too short, use a generic non-rule acknowledgment
    let subjectOut = (out.subject || "").trim();
    let bodyOut = (out.body || "").replace(/\r?\n/g, "\r\n").trim();

    if (!subjectOut) {
      subjectOut = subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;
    }
    if (bodyOut.length < MIN_BODY_CHARS) {
      bodyOut =
        `Hello,\r\n\r\n` +
        `Thanks for your email. I’ve noted the request and will follow up with details shortly.\r\n\r\n` +
        `Regards,\r\n${SIGNATURE_NAME}\r\n`;
    }

    // 6) RFC822 + Draft
    const refHeader =
      refs && msgId ? `References: ${refs} ${msgId}`
      : refs         ? `References: ${refs}`
      : msgId        ? `References: ${msgId}`
      : null;

    const rfc822Lines = [
      `To: ${toHeader}`,
      `Subject: ${subjectOut}`,
      msgId ? `In-Reply-To: ${msgId}` : null,
      refHeader,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 7bit",
      "",
      bodyOut.replace(/\r?\n/g, "\r\n"),
      "",
    ].filter(Boolean) as string[];

    const raw = b64UrlEncode(rfc822Lines.join("\r\n"));

    const draft = await gmail.users.drafts.create({
      userId: "me",
      requestBody: { message: { threadId, raw } },
    });

    // 7) Label original
    const labelName = process.env.GMAIL_CUSTOM_LABEL || "AutoResponder";
    const labels = await gmail.users.labels.list({ userId: "me" });
    let labelId = labels.data.labels?.find((l) => l.name === labelName)?.id;
    if (!labelId) {
      const created = await gmail.users.labels.create({
        userId: "me",
        requestBody: { name: labelName },
      });
      labelId = created.data.id!;
    }
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: { addLabelIds: [labelId] },
    });

    return NextResponse.json({ draftId: draft.data.id, threadId });
  } catch (err: any) {
    console.error("LLM draft error:", err);
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
  }
}
