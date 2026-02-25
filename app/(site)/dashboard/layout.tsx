import { getSession } from "@/src/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sess = await getSession();
  if (!sess) redirect("/access");
  return <>{children}</>;
}

