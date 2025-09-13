// src/lib/llm.ts

export type DraftInput = {
  model?: string;
  styleHint: string;      // tone, greeting/closing, length
  subject: string;
  threadContext: string;
  signature: string;
};

export type DraftOutput = {
  subject: string;
  body: string;
  needs_clarification?: boolean;
  questions?: string[];
};

function unfence(s: string) {
  return s.replace(/```json|```/g, "").trim();
}

function safeJsonPick(text: string): DraftOutput | null {
  const t = unfence(text);
  const match = t.match(/\{[\s\S]*\}$/m) || t.match(/\{[\s\S]*\}/m);
  const raw = match ? match[0] : t;
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj.body === "string") {
      if (typeof obj.subject !== "string") obj.subject = "";
      return obj as DraftOutput;
    }
  } catch { /* ignore */ }
  return null;
}

function wordCount(s: string) {
  return (s.trim().match(/\b\w+\b/g) || []).length;
}

function salvageToDraft(input: DraftInput, text: string): DraftOutput {
  // Generic, non-rule reply (no keyword branching)
  const cleaned = unfence(text);
  const body = cleaned.replace(/\r?\n/g, "\r\n").trim();
  const subject = input.subject.toLowerCase().startsWith("re:")
    ? input.subject
    : `Re: ${input.subject}`;

  if (!body) {
    return {
      subject,
      body:
        `Hello,\r\n\r\n` +
        `Thanks for your email. I’ve noted the request and will follow up with details shortly.\r\n\r\n` +
        `${input.signature}\r\n`,
    };
  }
  return { subject, body };
}

async function callLLM(
  url: string,
  headers: Record<string, string>,
  body: any,
  timeoutMs: number
) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`LLM request failed: ${resp.status} ${txt}`);
    }
    return await resp.json();
  } finally {
    clearTimeout(to);
  }
}

export async function llmDraft(input: DraftInput): Promise<DraftOutput> {
  // Prefer IPv4 to avoid ::1 issues on Windows
  const rawUrl = process.env.LLM_API_URL || "http://127.0.0.1:11434/api/chat";
  const url = rawUrl.replace("localhost", "127.0.0.1").replace("[::1]", "127.0.0.1");

  const model = input.model || process.env.LLM_MODEL || "qwen2.5:3b-instruct";
  const isLocal = /^https?:\/\/(127\.0\.0\.1)(:\d+)?/i.test(url);
  const apiKey = process.env.LLM_API_KEY; // not needed for Ollama

  const MAX_CTX = Number(process.env.LLM_NUM_CTX || 1024);
  const TIMEOUT = Number(process.env.LLM_TIMEOUT_MS || 20000);
  const MIN_WORDS = Number(process.env.LLM_MIN_WORDS || 60); // target floor

  // Keep memory usage low; clamp long threads
  const ctx = (input.threadContext || "").slice(-8000);

  const baseSystem = [
    "You are a professional email assistant.",
    "Write concise, polite, factual replies.",
    "Never invent facts; if information is missing, set needs_clarification=true and include up to 3 short questions.",
    `Style: ${input.styleHint}`,
    `If the style doesn't include a closing, add: "${input.signature}".`,
    `Return ONLY valid JSON: {"subject":"...","body":"...","needs_clarification":bool?,"questions":string[]?}`,
  ].join(" ");

  const baseUser = [
    `Original Subject: ${input.subject}`,
    "Email thread context (latest last):",
    ctx,
  ].join("\n\n");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!isLocal && apiKey) headers.Authorization = `Bearer ${apiKey}`;

  // Payload builders
  const ollamaPayload = (system: string, user: string) => ({
    model,
    format: "json", // force JSON from Ollama
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    stream: false,
    options: { num_ctx: MAX_CTX, temperature: 0.4 },
  });

  const openAiPayload = (system: string, user: string) => ({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  const buildPayload = (system: string, user: string) =>
    (url.endsWith("/api/chat") || isLocal)
      ? ollamaPayload(system, user)
      : openAiPayload(system, user);

  // --- Attempt 1 (ask ~80–140 words)
  const system1 = `${baseSystem} Write 80–140 words in the body. Include greeting and sign-off.`;
  const user1 = baseUser;

  let data: any;
  try {
    data = await callLLM(url, headers, buildPayload(system1, user1), TIMEOUT);
  } catch {
    return salvageToDraft(input, "");
  }

  const text1 =
    data?.message?.content ??
    data?.choices?.[0]?.message?.content ??
    data?.output_text ??
    data?.text ??
    "";

  let parsed = typeof text1 === "string" ? safeJsonPick(text1) : null;

  // If too short/ignored JSON, try once more
  if (!parsed || wordCount(parsed.body || "") < MIN_WORDS) {
    const system2 = `${baseSystem} Your previous body was too short. Rewrite to 100–160 words, JSON only.`;
    const user2 = baseUser;
    try {
      const data2 = await callLLM(url, headers, buildPayload(system2, user2), TIMEOUT);
      const text2 =
        data2?.message?.content ??
        data2?.choices?.[0]?.message?.content ??
        data2?.output_text ??
        data2?.text ??
        "";
      parsed = typeof text2 === "string" ? safeJsonPick(text2) : null;
    } catch {
      // fall through
    }
  }

  if (parsed && parsed.body && parsed.body.trim().length > 0) {
    parsed.body = parsed.body.replace(/\r?\n/g, "\r\n");
    parsed.subject = (parsed.subject || "").trim();
    return parsed;
  }

  // Final generic salvage (still not rule-based)
  return salvageToDraft(input, String(text1 || ""));
}
