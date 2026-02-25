import { cookies } from "next/headers";
import { prisma } from "@/src/lib/prisma";

export async function getSession() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("sid")?.value;
  if (!sid) return null;
  const now = new Date();
  const session = await prisma.session.findUnique({ where: { token: sid } }).catch(()=>null);
  if (!session || session.expiresAt < now) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true, name: true } });
  if (!user) return null;
  return { user, session };
}

