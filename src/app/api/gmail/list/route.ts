import { NextResponse } from "next/server";
import { getAuthedGmail } from "@/lib/google";

export async function GET() {
  const gmail = await getAuthedGmail();
  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: 20,
    q: "-in:drafts",
  });
  const messages = list.data.messages ?? [];
  const full = await Promise.all(
    messages.map(async (m) => {
      const res = await gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "To", "Date", "Message-ID"],
      });
      const headers = Object.fromEntries(
        (res.data.payload?.headers ?? []).map((h) => [h.name!, h.value ?? ""])
      );
      return {
        id: res.data.id,
        threadId: res.data.threadId,
        snippet: res.data.snippet,
        subject: headers["Subject"] ?? "(no subject)",
        from: headers["From"] ?? "",
        to: headers["To"] ?? "",
        date: headers["Date"] ?? "",
        messageIdHeader: headers["Message-ID"] ?? "",
      };
    })
  );
  return NextResponse.json({ items: full });
}
