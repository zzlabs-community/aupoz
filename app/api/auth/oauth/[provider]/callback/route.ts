export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

function isGoogleConfigured() {
  const id = process.env.GOOGLE_CLIENT_ID || "";
  const secret = process.env.GOOGLE_CLIENT_SECRET || "";
  return !!(id && secret);
}

function isGitHubConfigured() {
  const id = process.env.GITHUB_CLIENT_ID || "";
  const secret = process.env.GITHUB_CLIENT_SECRET || "";
  return !!(id && secret);
}

function baseUrl(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function exchangeGoogle(code: string, redirectUri: string) {
  const cid = process.env.GOOGLE_CLIENT_ID || "";
  const secret = process.env.GOOGLE_CLIENT_SECRET || "";
  const body = new URLSearchParams({ code, client_id: cid, client_secret: secret, grant_type: "authorization_code", redirect_uri: redirectUri });
  const tk = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }).then(r=>r.json());
  const info = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tk.access_token}` } }).then(r=>r.json());
  return { email: info.email as string | undefined, name: info.name as string | undefined };
}

async function exchangeGitHub(code: string, redirectUri: string) {
  const cid = process.env.GITHUB_CLIENT_ID || "";
  const secret = process.env.GITHUB_CLIENT_SECRET || "";
  const body = new URLSearchParams({ client_id: cid, client_secret: secret, code, redirect_uri: redirectUri });
  const tk = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json" }, body }).then(r=>r.json());
  const info = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${tk.access_token}`, Accept: "application/vnd.github+json" } }).then(r=>r.json());
  // fetch primary email if needed
  let email = info.email as string | undefined;
  if (!email) {
    const emails = await fetch("https://api.github.com/user/emails", { headers: { Authorization: `Bearer ${tk.access_token}`, Accept: "application/vnd.github+json" } }).then(r=>r.json()).catch(()=>[]);
    const primary = Array.isArray(emails) ? emails.find((e:any)=>e.primary && e.verified) : null;
    email = primary?.email;
  }
  return { email, name: info.name as string | undefined };
}

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const url = new URL(req.url);
  const { provider } = await params;
  const providerLower = (provider || "").toLowerCase();
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const cookie = (req.headers.get("cookie") || "").split(/; */).find(c=>c.startsWith(`oauth_state_${providerLower}=`));
  const expected = cookie?.split("=")[1] || "";
  if (!code || !state || state !== expected) return NextResponse.json({ error: "Invalid state" }, { status: 400 });

  const redirectUri = `${baseUrl(req)}/api/auth/oauth/${providerLower}/callback`;
  let profile: { email?: string, name?: string } = {};
  if (providerLower === "google") {
    if (!isGoogleConfigured()) return NextResponse.json({ error: "Servidor no configurado para Google OAuth" }, { status: 501 });
    profile = await exchangeGoogle(code, redirectUri);
  }
  else if (providerLower === "github") {
    if (!isGitHubConfigured()) return NextResponse.json({ error: "Servidor no configurado para GitHub OAuth" }, { status: 501 });
    profile = await exchangeGitHub(code, redirectUri);
  }
  else return NextResponse.json({ error: "Proveedor no soportado" }, { status: 400 });

  if (!profile.email) return NextResponse.json({ error: "No email from provider" }, { status: 400 });

  // Upsert user and create session
  const user = await prisma.user.upsert({
    where: { email: profile.email },
    update: { name: profile.name ?? undefined },
    create: { email: profile.email, name: profile.name ?? null, passwordHash: "oauth" },
  });
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const session = await prisma.session.create({ data: { userId: user.id, token, expiresAt: new Date(Date.now() + 1000*60*60*24*30) } });
  const res = NextResponse.redirect(new URL("/", baseUrl(req)));
  res.headers.set("Set-Cookie", `sid=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60*60*24*30}`);
  return res;
}
