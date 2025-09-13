import { google, gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL } = process.env;
const REDIRECT_URI = `${process.env.APP_URL ?? "http://localhost:3000"}/api/oauth/google/callback`;

export function getOAuthClient(): OAuth2Client {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Missing Google OAuth env vars");
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthUrl(): string {
  const oauth2 = getOAuthClient();
  const scopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.compose",
    // These help fetch userinfo in the callback (google.oauth2.userinfo.get)
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];
  return oauth2.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2 = getOAuthClient();
  // Pass redirect_uri explicitly (helps avoid mismatch)
  const { tokens } = await oauth2.getToken({ code, redirect_uri: REDIRECT_URI });
  return tokens;
}

// src/lib/google.ts
export async function getCurrentAccount() {
  const uid = (await cookies()).get("uid")?.value;
  if (uid) {
    return prisma.account.findFirst({ where: { userId: uid } });
  }
  // DEV-ONLY fallback so you’re not blocked:
  return prisma.account.findFirst();
}


export async function getAuthedGmail(): Promise<gmail_v1.Gmail> {
  const account = await getCurrentAccount();
  if (!account) throw new Error("Not connected");

  const oauth2 = getOAuthClient();
  oauth2.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken || undefined,
    expiry_date: account.expiryDate?.getTime(),
  });

  // Persist refreshed tokens (access/refresh/expiry) without crashing the request
  oauth2.on("tokens", async (tokens) => {
    try {
      await prisma.account.update({
        where: { id: account.id },
        data: {
          accessToken: tokens.access_token ?? account.accessToken,
          ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
          ...(tokens.expiry_date ? { expiryDate: new Date(tokens.expiry_date) } : {}),
          scope: tokens.scope ?? account.scope ?? undefined,
        },
      });
    } catch (err) {
      console.error("Failed to persist refreshed tokens", err);
    }
  });

  return google.gmail({ version: "v1", auth: oauth2 });
}

export function b64UrlEncode(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
