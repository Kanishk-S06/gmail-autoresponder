import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractSignals, mergeCsv, editDistance } from "@/lib/style";

export async function POST(req: Request) {
  const { sender, original, edited } = await req.json() as {sender: string; original: string; edited: string};
  if (!sender || !edited) return NextResponse.json({ error: "sender and edited required" }, { status: 400 });

  // 1) log example
  const delta = editDistance(original ?? "", edited ?? "");
  await prisma.styleExample.create({ data: { sender, original: original ?? "", edited, editDelta: delta } });

  // 2) extract signals and upsert profile
  const s = extractSignals(edited);
  const prof = await prisma.senderProfile.upsert({
    where: { email: sender.toLowerCase() },
    update: {
      preferredTone: s.tone,
      greeting: s.greeting ?? undefined,
      closing: s.closing ?? undefined,
      mustUse: mergeCsv(undefined, s.mustUse),
      avgLength: s.targetLen,
      editsCount: { increment: 1 }
    },
    create: {
      email: sender.toLowerCase(),
      preferredTone: s.tone,
      preferredLang: "en",
      greeting: s.greeting ?? undefined,
      closing: s.closing ?? undefined,
      mustUse: s.mustUse ?? undefined,
      avgLength: s.targetLen
    }
  });

  return NextResponse.json({ ok: true, profile: prof, editDelta: delta });
}
