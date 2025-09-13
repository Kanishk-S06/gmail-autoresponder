import type { gmail_v1 } from "googleapis";

export function b64UrlDecode(str: string | undefined): string {
  if (!str) return "";
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(s, "base64").toString("utf8");
}

function stripHtml(html: string): string {
  // very lightweight HTML → text
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractTextFromPayload(p?: gmail_v1.Schema$MessagePart): string {
  if (!p) return "";
  if (p.mimeType === "text/plain" && p.body?.data) return b64UrlDecode(p.body.data);
  if (p.mimeType === "text/html" && p.body?.data) return stripHtml(b64UrlDecode(p.body.data));
  // multipart
  const parts = p.parts ?? [];
  let best = "";
  for (const child of parts) {
    const t = extractTextFromPayload(child);
    if (t) {
      // prefer text/plain if found
      if ((child.mimeType ?? "").startsWith("text/plain")) return t;
      best ||= t;
    }
  }
  return best;
}

export function stripQuoted(text: string): string {
  // Remove common quote patterns
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const ln of lines) {
    if (/^\s*>/.test(ln)) break;                    // quoted block
    if (/^On .*wrote:$/i.test(ln.trim())) break;    // "On Mon..., X wrote:"
    if (/^From:\s?/i.test(ln.trim())) break;        // headers block
    out.push(ln);
  }
  return out.join("\n").trim();
}

export async function getThreadContext(
  gmail: gmail_v1.Gmail,
  threadId: string,
  takeLast = 4
): Promise<string> {
  const t = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });
  const msgs = (t.data.messages ?? []).slice(-takeLast);
  const chunks: string[] = [];
  for (const m of msgs) {
    const headers = Object.fromEntries(
      (m?.payload?.headers ?? []).map((h) => [h.name!, h.value ?? ""])
    ) as Record<string, string>;
    const from = headers["From"] ?? "";
    const date = headers["Date"] ?? "";
    const text = extractTextFromPayload(m?.payload);
    const clean = stripQuoted(text);
    if (clean) {
      chunks.push(`From: ${from}\nDate: ${date}\n---\n${clean}`);
    }
  }
  return chunks.join("\n\n====================\n\n").trim();
}
