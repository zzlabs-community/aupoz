"use client";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [last4, setLast4] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings").then(async r=> r.ok ? r.json() : Promise.reject()).then(d=>{
      setProvider(d.provider||"openai"); setModel(d.model||"gpt-4o-mini"); setLast4(d.last4||null);
    }).catch(()=>{});
  }, []);

  async function save() {
    setSaving(true); setMsg("");
    const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, model, apiKey: apiKey||undefined }) });
    setSaving(false);
    if (res.ok) { setMsg("Guardado"); if (apiKey) setLast4(apiKey.slice(-4)); setApiKey(""); } else { setMsg("Error al guardar"); }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Ajustes de IA</h1>
      <div className="meta-panel p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Proveedor</label>
            <select className="meta-input w-full" value={provider} onChange={e=>setProvider(e.target.value)}>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Modelo</label>
            <input className="meta-input w-full" value={model} onChange={e=>setModel(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">API Key (se almacena cifrada)</label>
          <input className="meta-input w-full" type="password" placeholder={last4 ? `•••••••••••••••••••••••••••••••• ${last4}` : "sk-..."} value={apiKey} onChange={e=>setApiKey(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <button className="meta-btn-primary" onClick={save} disabled={saving}>{saving?"Guardando…":"Guardar"}</button>
          {msg && <span className="text-xs text-zinc-400">{msg}</span>}
        </div>
      </div>
      <p className="text-xs text-zinc-500">Tu clave no se muestra completa por seguridad; guardamos una versión cifrada en la base de datos.</p>
    </div>
  );
}

