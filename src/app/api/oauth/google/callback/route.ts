// src/app/api/oauth/google/callback/route.ts
import { NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/google";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const REDIRECT_URI = `${APP_URL}/api/oauth/google/callback`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  try {
    // 1) Exchange code (pass redirect_uri explicitly to avoid mismatch)
    const oauth2 = getOAuthClient();
    const { tokens } = await oauth2.getToken({ code, redirect_uri: REDIRECT_URI });
    oauth2.setCredentials(tokens);

    // 2) Fetch user info (requires scopes: openid, userinfo.email, userinfo.profile)
    const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
    const { data } = await oauth2Api.userinfo.get();
    if (!data.email) {
      throw new Error(
        "Google did not return email. Ensure scopes include openid, userinfo.email, userinfo.profile and re-auth."
      );
    }

    // 3) Upsert user + account
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: { email: data.email },
    });

    await prisma.account.upsert({
      where: { id: `${user.id}-google` },
      update: {
        accessToken: tokens.access_token!,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        expiryDate: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
        scope: tokens.scope,
      },
      create: {
        id: `${user.id}-google`,
        provider: "google",
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? "",
        expiryDate: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
        scope: tokens.scope ?? "",
        userId: user.id,
      },
    });

    // 4) Set cookie on the redirect response
    const res = NextResponse.redirect(new URL("/", req.url));
    res.cookies.set("uid", user.id, { httpOnly: true, sameSite: "lax", path: "/" });
    return res;
  } catch (err: any) {
    console.error("OAuth callback error:", {
      message: err?.message,
      data: err?.response?.data,
    });
    return NextResponse.json(
      { error: err?.message ?? "OAuth failed", details: err?.response?.data },
      { status: 500 }
    );
  }
}
