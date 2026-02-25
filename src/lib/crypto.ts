import crypto from "node:crypto";

function getKey() {
  const raw = process.env.ENCRYPTION_KEY || process.env.SECRET_KEY || process.env.NEXTAUTH_SECRET || "dev-secret";
  // derive 32-byte key using sha256
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptToBase64(plain: string): string {
  try {
    const key = getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString("base64");
  } catch {
    return Buffer.from(`PLAINTEXT:${plain}`, "utf8").toString("base64");
  }
}

export function decryptFromBase64(data: string): string | null {
  try {
    const buf = Buffer.from(data, "base64");
    // PLAINTEXT fallback
    const asText = buf.toString("utf8");
    if (asText.startsWith("PLAINTEXT:")) return asText.slice("PLAINTEXT:".length);
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const key = getKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    return dec;
  } catch {
    return null;
  }
}

