export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

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

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const pathParts = new URL(req.url).pathname.split("/").filter(Boolean);
  const seg = pathParts[pathParts.indexOf("oauth") + 1] || "";
  const fromPath = (seg || "").toLowerCase();
  const { provider: paramProvider } = await params;
  const provider = (paramProvider || fromPath || "").toLowerCase();
  const state = randomBytes(16).toString("hex");
  const res = new NextResponse(null, { status: 302 });
  res.headers.append("Set-Cookie", `oauth_state_${provider}=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
  const redirectUri = `${baseUrl(req)}/api/auth/oauth/${provider}/callback`;

  if (provider === "google") {
    if (!isGoogleConfigured()) {
      return NextResponse.json({ error: "Servidor no configurado para Google OAuth" }, { status: 501 });
    }
    const cid = process.env.GOOGLE_CLIENT_ID || "";
    const scope = encodeURIComponent("openid email profile");
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${cid}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}`;
    res.headers.set("Location", url);
    return res;
  }

  if (provider === "github") {
    if (!isGitHubConfigured()) {
      return NextResponse.json({ error: "Servidor no configurado para GitHub OAuth" }, { status: 501 });
    }
    const cid = process.env.GITHUB_CLIENT_ID || "";
    const url = `https://github.com/login/oauth/authorize?client_id=${cid}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user user:email&state=${state}`;
    res.headers.set("Location", url);
    return res;
  }

  // iCloud (Sign in with Apple) requiere configuración compleja; placeholder
  if (provider === "icloud" || provider === "apple") {
    return NextResponse.json({ error: "Sign in with Apple no configurado" }, { status: 501 });
  }

  return NextResponse.json({ error: "Proveedor no soportado" }, { status: 400 });
}
