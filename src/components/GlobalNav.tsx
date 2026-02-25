"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function GlobalNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();

  // No navbar en la página de acceso principal
  if (pathname === "/access") return null;

  function Item({ href, children }: { href: string, children: React.ReactNode }) {
    const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
    return (
      <Link href={href} className="relative text-sm text-white/90 hover:text-white transition-colors">
        <span>{children}</span>
        {active && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />}
      </Link>
    );
  }

  return (
    <nav className="flex items-center gap-6">
      <Item href="/">Inicio</Item>
      <Item href="/dashboard">Panel</Item>
      <Item href="/docs">Docs</Item>
      {signedIn ? (
        <form action="/api/auth/signout" method="post">
          <button className="text-sm text-white/90 hover:text-white transition-colors" type="submit">Salir</button>
        </form>
      ) : (
        <>
          <Item href="/signin">Ingresar</Item>
          <Item href="/signup">Registro</Item>
        </>
      )}
    </nav>
  );
}
