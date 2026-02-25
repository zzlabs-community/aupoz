import Image from "next/image";
import { Logo } from "@/src/components/Logo";
import Link from "next/link";
import WelcomeToast from "@/src/components/WelcomeToast";

export default function Home() {
  return (
    <div className="space-y-16 md:min-h-[calc(100vh-8rem)] md:flex md:flex-col md:justify-center">
      <WelcomeToast />
      <section className="grid md:grid-cols-2 gap-12 items-center md:items-center">
        <div className="space-y-6">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-sky-300 to-indigo-400 text-transparent bg-clip-text drop-shadow">AUPOZ — AI Content Studio</h1>
          <p className="text-zinc-300 max-w-xl">Genera ideas, copys y visuales premium con IA, guarda tus activos y organiza un calendario de publicaciones. Todo en un solo lugar.</p>
          <div className="flex gap-3">
            <Link href="/dashboard" className="px-5 py-2.5 rounded-md bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow">Entrar al Panel</Link>
            <Link href="/docs" className="px-5 py-2.5 rounded-md border border-white/20 text-zinc-200">Docs</Link>
          </div>
        </div>
        <div className="relative aspect-video hero-panel overflow-hidden flex items-center justify-center">
          <Image src="/Banner.PNG" alt="AUPOZ banner" fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-contain md:object-cover select-none" />
          <span className="absolute bottom-3 right-3 text-xs text-zinc-400 flex items-center gap-2">
            <img src="/logo.png" width="18" height="18" alt="AUPOZ" className="opacity-80"/>
            AUPOZ
          </span>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        {[{t:"Estrategia",d:"Prompts con intención de marca y performance."},{t:"Visuales",d:"Dirección de arte optimizada por costo y fidelidad."},{t:"Calendario",d:"Planifica y guarda tus publicaciones en la nube."}].map(c=> (
          <div key={c.t} className="rounded-xl border border-white/10 p-5 bg-white/5 backdrop-blur text-zinc-200">
            <h3 className="font-medium mb-2">{c.t}</h3>
            <p className="text-sm text-zinc-400">{c.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
