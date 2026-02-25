"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  function soon(e: React.MouseEvent) {
    e.preventDefault();
    alert("Próximamente");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setLoading(true);
    const res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, name }) });
    setLoading(false);
    if (res.ok) {
      const overlay = document.createElement('div'); overlay.className = 'page-exit'; document.body.appendChild(overlay);
      try { localStorage.setItem('aupoz_welcome', 'signup'); } catch {}
      setTimeout(()=> { location.href = "/"; }, 420);
    } else {
      setErr((await res.json()).error || "Error");
    }
  }

  return (
    <div className="min-h-screen px-4 pt-16 pb-14 md:flex md:items-center md:justify-center md:pt-0 md:pb-0">
      <div className="w-full max-w-md text-center mx-auto">
        <div className="flex items-center justify-center mb-[1cm]">
          <img src="/aupozlogo.png" alt="AUPOZ" className="opacity-100 logo-spin-y pointer-events-none select-none w-[200px] sm:w-[240px] md:w-[300px] h-auto" />
        </div>
        <h1 className="text-3xl font-semibold mb-4 text-white">Crear cuenta</h1>
        <form onSubmit={submit} className="space-y-4 meta-panel p-4 text-left max-w-md mx-auto">
          <input className="meta-input w-full" placeholder="Nombre" value={name} onChange={e=>setName(e.target.value)} />
          <input className="meta-input w-full" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input className="meta-input w-full" type="password" placeholder="Contraseña (mín. 8)" value={password} onChange={e=>setPassword(e.target.value)} required />
          {err && <p className="text-red-400 text-sm">{err}</p>}
          <button className="meta-btn-primary w-full btn-sm" disabled={loading}>{loading?"Creando…":"Crear cuenta"}</button>
        </form>
        <div className="flex items-center justify-center gap-3 mt-3">
          <a href="#" onClick={soon} className="meta-btn-ghost btn-sm inline-flex items-center gap-2" aria-label="Registrarse con Google"><img src="/icons/google.svg" alt="Google" width="16" height="16"/> Google</a>
          <a href="#" onClick={soon} className="meta-btn-ghost btn-sm inline-flex items-center gap-2" aria-label="Registrarse con GitHub"><img src="/icons/github.svg" alt="GitHub" width="16" height="16"/> GitHub</a>
          <a href="#" onClick={soon} className="meta-btn-ghost btn-sm inline-flex items-center gap-2" aria-label="Registrarse con iCloud"><img src="/icons/icloud.svg" alt="iCloud" width="16" height="16"/> iCloud</a>
        </div>
        <p className="text-sm text-zinc-400 mt-3">¿Ya tienes cuenta? <Link className="underline" href="/signin">Inicia sesión</Link></p>
        <Link href="/access" className="meta-btn-ghost btn-sm w-full inline-block text-center mt-4 max-w-md mx-auto" aria-label="Volver a acceso">Volver a acceso</Link>
      </div>
    </div>
  );
}
