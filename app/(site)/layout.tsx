import Link from "next/link";
import { Logo } from "@/src/components/Logo";
import GlobalNav from "@/src/components/GlobalNav";
import { getSession } from "@/src/lib/auth";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const sess = await getSession();
  return (
    <div>
      <header id="global-nav" className="sticky top-0 z-40 bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between text-white">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <Logo size={32} />
            <span>AUPOZ</span>
          </Link>
          <GlobalNav signedIn={!!sess} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="mt-16 py-8 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} ZZlabz — Construido con Next.js
      </footer>
    </div>
  );
}
