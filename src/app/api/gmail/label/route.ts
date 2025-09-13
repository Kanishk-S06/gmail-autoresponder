import { NextResponse } from "next/server";
import { getAuthedGmail } from "@/lib/google";


export async function GET() {
    const gmail = await getAuthedGmail();
    const name = process.env.GMAIL_CUSTOM_LABEL || "AutoResponder";
    const labels = await gmail.users.labels.list({ userId: "me" });
    const found = (labels.data.labels ?? []).find((l) => l.name === name);
    if (found) return NextResponse.json(found);
    const created = await gmail.users.labels.create({ userId: "me", requestBody: { name } });
    return NextResponse.json(created.data);
}