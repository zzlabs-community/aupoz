export const runtime = "nodejs";

import { NextResponse } from "next/server";

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

export async function GET() {
  const providers: string[] = [];
  if (isGoogleConfigured()) providers.push("google");
  if (isGitHubConfigured()) providers.push("github");
  // Nota: Apple no está implementado en el servidor actualmente.
  return NextResponse.json({ providers });
}

