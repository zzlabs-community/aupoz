"use client";

import { useEffect, useMemo, useState } from "react";
import CalendarView from "@/src/components/CalendarView";

type Workspace = {
  id: string;
  name: string;
  shopDomain: string;
  accessToken: string | null;
  installedAt: string | null;
};

type Post = {
  id: string;
  title: string;
  content: string;
  platform: string;
  createdAt: string;
};

type Campaign = {
  id: string;
  name: string;
  campaignType: string;
  status: string;
  createdAt: string;
};

type AutomationRule = {
  id: string;
  name: string;
  triggerType: string;
  isActive: boolean;
  lastExecutedAt: string | null;
};

type BrandProfile = {
  id: string;
  brandVoice: string;
  targetAudience: string;
  style: string;
  positioning: string;
  tone: string;
};

export default function Dashboard() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWs, setSelectedWs] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [genText, setGenText] = useState<string>("");
  const [tone, setTone] = useState("friendly");
  const [platform, setPlatform] = useState("twitter");
  const [posts, setPosts] = useState<Post[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);

  // Modo de trabajo: libre (sin Shopify) o catálogo
  const [freePrompt, setFreePrompt] = useState("");
  const [freeImage, setFreeImage] = useState<File | null>(null);
  const [freeImagePreview, setFreeImagePreview] = useState<string>("");
  const [freeUrl, setFreeUrl] = useState<string>("");
  const [genImageUrl, setGenImageUrl] = useState<string>("");
  const [genImages, setGenImages] = useState<string[]>([]);
  const [tab, setTab] = useState<"studio" | "calendar" | "library" | "campaigns" | "automations" | "analytics">("calendar");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [calendar, setCalendar] = useState<any[]>([]);
  const [imageSize, setImageSize] = useState<string>("1024x1024");
  const ws = useMemo(() => workspaces.find(w => w.id === selectedWs), [workspaces, selectedWs]);
  const [aiMode, setAiMode] = useState<"real" | "mock">("mock");
  const [me, setMe] = useState<{ email: string } | null>(null);
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyDomain, setNewCompanyDomain] = useState("");

  useEffect(() => {
    fetch("/api/workspaces", { credentials: 'include' }).then(r => r.json()).then((list: Workspace[]) => {
      const cleaned = (Array.isArray(list) ? list : []).filter(w => !!w.accessToken && !w.shopDomain.endsWith(".invalid"));
      setWorkspaces(cleaned);
    }).catch(() => {});
    fetch("/api/config", { credentials: 'include' }).then(r=>r.json()).then(d=>{ if(d?.ai === 'real' || d?.ai === 'mock') setAiMode(d.ai); }).catch(()=>{});
    fetch("/api/auth/me", { credentials: 'include' }).then(async r=> r.ok ? r.json() : null).then(u=> setMe(u? { email: u.email } : null)).catch(()=>{});
  }, []);

  useEffect(() => {
    try {
      const t = localStorage.getItem("aupoz_tab");
      if (t === "studio" || t === "calendar" || t === "library" || t === "campaigns" || t === "automations" || t === "analytics") {
        setTab(t);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const s = localStorage.getItem("cal_month");
      if (s) {
        const [y, m] = s.split("-").map(Number);
        if (!isNaN(y) && !isNaN(m)) {
          setCalendarMonth(new Date(y, m - 1, 1));
        }
      }
    } catch {}
  }, []);

  function defaultSizeFor(p: string) {
    switch (p) {
      case "twitter":
      case "linkedin":
      case "facebook":
        return "1792x1024";
      case "tiktok":
        return "1024x1792";
      case "instagram":
      default:
        return "1024x1024";
    }
  }

  useEffect(() => { setImageSize(defaultSizeFor(platform)); }, [platform]);

  useEffect(() => {
    if (!selectedWs) return;
    loadPosts();
  }, [selectedWs]);

  async function generateFree() {
    if (!freePrompt && !freeImage && !freeUrl) return;
    setLoading(true);
    try {
      const form = new FormData();
      if (freePrompt) form.append("prompt", freePrompt);
      form.append("tone", tone);
      form.append("platform", platform);
      if (freeUrl) form.append("productUrl", freeUrl);
      if (freeImage) form.append("image", freeImage);
      const res = await fetch("/api/generate", { method: "POST", body: form, credentials: 'include' });
      const data = await res.json();
      setGenText(data.text || data.error || "");
      const imgForm = new FormData();
      const promptFromModel = data.imagePrompt || freePrompt || data.text || "imagen para post";
      imgForm.append("prompt", promptFromModel);
      imgForm.append("size", imageSize);
      if (freeImage) imgForm.append("image", freeImage);
      const ir = await fetch("/api/generate-image", { method: "POST", body: imgForm, credentials: 'include' });
      const j = await ir.json().catch(()=>null);
      if (j?.url) { setGenImageUrl(j.url); setGenImages(prev=> [j.url, ...prev].slice(0,12)); }
    } finally { setLoading(false); }
  }

  async function regenerateImage() {
    const imgForm = new FormData();
    imgForm.append("prompt", freePrompt || genText || "imagen para post");
    imgForm.append("size", imageSize);
    if (freeImage) imgForm.append("image", freeImage);
    const ir = await fetch("/api/generate-image", { method: "POST", body: imgForm, credentials: 'include' });
    const j = await ir.json().catch(()=>null);
    if (j?.url) { setGenImageUrl(j.url); setGenImages(prev=> [j.url, ...prev].slice(0,12)); }
  }

  useEffect(() => { if (tab === "library") loadAssets(); }, [tab]);
  useEffect(() => { if (tab === "calendar") loadCalendar(); }, [tab, calendarMonth]);
  useEffect(() => { if (tab === "campaigns" && selectedWs) loadCampaigns(); }, [tab, selectedWs]);
  useEffect(() => { if (tab === "automations" && selectedWs) loadAutomations(); }, [tab, selectedWs]);
  useEffect(() => { if (tab === "analytics" && selectedWs) loadBrandProfile(); }, [tab, selectedWs]);
  useEffect(() => { try { localStorage.setItem('aupoz_tab', tab); } catch {} }, [tab]);
  useEffect(() => { try { const y = calendarMonth.getFullYear(); const m = String(calendarMonth.getMonth()+1).padStart(2,'0'); localStorage.setItem('cal_month', `${y}-${m}`); } catch {} }, [calendarMonth]);

  async function loadAssets() {
    const r = await fetch("/api/assets", { credentials: 'include' });
    if (r.ok) {
      const j = await r.json();
      setGenImages((j.items||[]).map((a:any)=>a.url));
    }
  }

  async function loadCalendar() {
    const from = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const to = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()+1, 0);
    const url = new URL(location.origin + "/api/calendar");
    url.searchParams.set("from", from.toISOString());
    url.searchParams.set("to", to.toISOString());
    if (selectedWs) {
      url.searchParams.set("workspaceId", selectedWs);
    }
    const r = await fetch(url, { credentials: 'include' });
    if (r.ok) {
      const j = await r.json();
      setCalendar(j.items||[]);
    }
  }

  async function createEvent(dateIso: string, title: string, notes?: string, color?: string, assetIds?: string[]) {
    const r = await fetch('/api/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: dateIso, title, notes, color, assetIds }), credentials: 'include' });
    if (r.ok) await loadCalendar();
  }

  async function deleteEvent(id: string) {
    const url = new URL(location.origin + '/api/calendar'); url.searchParams.set('id', id);
    const r = await fetch(url, { method: 'DELETE', credentials: 'include' });
    if (r.ok) await loadCalendar();
  }

  async function moveEvent(id: string, newDateIso: string) {
    const r = await fetch(`/api/calendar/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: newDateIso }), credentials: 'include' });
    if (r.ok) await loadCalendar();
  }

  function handleGenerate() {
    return generateFree();
  }

  function onSelectImage(file: File | null) {
    setFreeImage(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setFreeImagePreview(url);
    } else {
      setFreeImagePreview("");
    }
  }

  async function copyToClipboard() {
    if (!genText) return;
    try {
      await navigator.clipboard.writeText(genText);
      alert("Copiado al portapapeles");
    } catch { /* noop */ }
  }

  function downloadTxt() {
    if (!genText) return;
    const blob = new Blob([genText], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `post-${platform}.txt`;
    a.click();
  }

  async function savePost() {
    if (!ws || !genText) return;
    setLoading(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Post ${platform}`, content: genText, platform, workspaceId: ws.id }),
        credentials: 'include'
      });
      if (res.ok) alert("Post guardado");
      await loadPosts();
    } finally { setLoading(false); }
  }

  async function loadPosts() {
    if (!selectedWs) return;
    const res = await fetch(`/api/posts?companyId=${selectedWs}&take=20`, { credentials: 'include' });
    const data = await res.json();
    setPosts(Array.isArray(data) ? data : []);
  }

  async function deletePost(id: string) {
    if (!confirm("¿Eliminar este post?")) return;
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE", credentials: 'include' });
    if (res.ok) setPosts(prev => prev.filter(p => p.id !== id));
  }

  async function loadCampaigns() {
    if (!selectedWs) return;
    const res = await fetch(`/api/generate-campaign?companyId=${selectedWs}`, { credentials: 'include' });
    const data = await res.json();
    setCampaigns(Array.isArray(data) ? data : []);
  }

  async function loadAutomations() {
    if (!selectedWs) return;
    const res = await fetch(`/api/automation-rules?companyId=${selectedWs}`, { credentials: 'include' });
    const data = await res.json();
    setAutomations(Array.isArray(data) ? data : []);
  }

  async function loadBrandProfile() {
    if (!selectedWs) return;
    const res = await fetch(`/api/brand-profile?companyId=${selectedWs}`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setBrandProfile(data);
    }
  }

  async function analyzeBrand() {
    if (!ws) return;
    setLoading(true);
    try {
      const res = await fetch("/api/brand-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: ws.id }),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setBrandProfile(data);
        alert("Perfil de marca analizado");
      }
    } finally { setLoading(false); }
  }

  async function generateCampaign() {
    if (!ws) return;
    setLoading(true);
    try {
      const res = await fetch("/api/generate-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: ws.id, campaignType: "carousel", platform: "instagram" }),
        credentials: 'include'
      });
      if (res.ok) {
        await loadCampaigns();
        alert("Campaña generada");
      }
    } finally { setLoading(false); }
  }

  async function generateMonth() {
    if (!ws) return;
    setLoading(true);
    try {
      const res = await fetch("/api/generate-month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: ws.id, postCount: 10 }),
        credentials: 'include'
      });
      if (res.ok) {
        alert("Calendario mensual generado");
        loadCalendar();
      }
    } finally { setLoading(false); }
  }

  async function createAutomation() {
    if (!ws) return;
    setLoading(true);
    try {
      const res = await fetch("/api/automation-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: ws.id,
          name: "Nueva automatización",
          triggerType: "manual",
          actionConfig: { campaignType: "carousel", postCount: 3 }
        }),
        credentials: 'include'
      });
      if (res.ok) {
        await loadAutomations();
        alert("Regla de automatización creada");
      }
    } finally { setLoading(false); }
  }

  async function toggleAutomation(id: string, currentActive: boolean) {
    const res = await fetch(`/api/automation-rules?id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !currentActive }),
      credentials: 'include'
    });
    if (res.ok) loadAutomations();
  }

  async function createNewCompany() {
    if (!newCompanyName || !newCompanyDomain) return;
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCompanyName, domain: newCompanyDomain }),
        credentials: 'include'
      });
      if (res.ok) {
        const created = await res.json();
        setWorkspaces(prev => [...prev, { ...created, accessToken: null, shopDomain: created.domain, installedAt: null }]);
        setSelectedWs(created.id);
        setShowNewCompany(false);
        setNewCompanyName("");
        setNewCompanyDomain("");
      } else {
        const err = await res.json();
        alert(err.error || "Error creating company");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-zinc-200">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Panel – Aupoz</h1>
        <div className="flex items-center gap-3">
          {me && <span className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5">Sesión: {me.email}</span>}
          <span className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5">IA: {aiMode === 'real' ? 'Real' : 'Mock'}</span>
          <form action="/api/auth/signout" method="post">
            <button className="meta-btn-ghost text-xs" type="submit">Salir</button>
          </form>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-white/5 p-1 border border-white/10 overflow-x-auto">
          <button onClick={()=>setTab("studio")} className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${tab==='studio'?'bg-white/10 text-white':'text-zinc-300'}`}>Generador</button>
          <button onClick={()=>setTab("calendar")} className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${tab==='calendar'?'bg-white/10 text-white':'text-zinc-300'}`}>Calendario</button>
          <button onClick={()=>setTab("campaigns")} className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${tab==='campaigns'?'bg-white/10 text-white':'text-zinc-300'}`}>Campañas</button>
          <button onClick={()=>setTab("automations")} className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${tab==='automations'?'bg-white/10 text-white':'text-zinc-300'}`}>Automatizaciones</button>
          <button onClick={()=>setTab("analytics")} className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${tab==='analytics'?'bg-white/10 text-white':'text-zinc-300'}`}>Analytics</button>
          <button onClick={()=>setTab("library")} className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${tab==='library'?'bg-white/10 text-white':'text-zinc-300'}`}>Biblioteca</button>
        </div>
      </div>

      {tab === 'studio' && (
        <section className="space-y-4 meta-panel p-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm">Workspace</label>
            <button 
              onClick={() => setShowNewCompany(true)}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              + Nuevo workspace
            </button>
          </div>
          <select
            className="meta-input w-full max-w-md"
            value={selectedWs}
            onChange={(e)=>setSelectedWs(e.target.value)}
          >
            <option value="">Selecciona un workspace…</option>
            {workspaces.map(w=> (
              <option key={w.id} value={w.id}>{w.name} ({w.shopDomain})</option>
            ))}
          </select>
          
          {showNewCompany && (
            <div className="mt-4 p-4 border border-cyan-500/30 rounded-lg bg-cyan-500/5 space-y-3">
              <h3 className="text-sm font-medium text-cyan-400">Nuevo Workspace</h3>
              <input
                placeholder="Nombre de la empresa"
                className="meta-input w-full"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
              />
              <input
                placeholder="Dominio (ej: miempresa.com)"
                className="meta-input w-full"
                value={newCompanyDomain}
                onChange={(e) => setNewCompanyDomain(e.target.value)}
              />
              <div className="flex gap-2">
                <button 
                  onClick={createNewCompany}
                  disabled={loading || !newCompanyName || !newCompanyDomain}
                  className="meta-btn-primary"
                >
                  {loading ? 'Creando...' : 'Crear'}
                </button>
                <button 
                  onClick={() => { setShowNewCompany(false); setNewCompanyName(""); setNewCompanyDomain(""); }}
                  className="meta-btn-ghost"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          
          {/* Generador de contenido */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <div>
              <label className="block text-sm mb-2">Prompt</label>
              <textarea
                className="meta-input w-full h-24"
                placeholder="Describe el contenido que quieres generar..."
                value={freePrompt}
                onChange={(e) => setFreePrompt(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-2">URL del producto (opcional)</label>
                <input
                  type="url"
                  className="meta-input w-full"
                  placeholder="https://..."
                  value={freeUrl}
                  onChange={(e) => setFreeUrl(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm mb-2">Imagen de referencia (opcional)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="meta-input w-full"
                  onChange={(e) => onSelectImage(e.target.files?.[0] || null)}
                />
                {freeImagePreview && (
                  <img src={freeImagePreview} alt="Preview" className="mt-2 w-24 h-24 object-cover rounded" />
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-2">Plataforma</label>
                <select
                  className="meta-input w-full"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  <option value="twitter">Twitter/X</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm mb-2">Tono</label>
                <select
                  className="meta-input w-full"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                >
                  <option value="friendly">Amigable</option>
                  <option value="professional">Profesional</option>
                  <option value="casual">Casual</option>
                  <option value="humorist">Humorístico</option>
                  <option value="formal">Formal</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm mb-2">Tamaño de imagen</label>
                <select
                  className="meta-input w-full"
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value)}
                >
                  <option value="1024x1024">1024x1024 (Cuadrado)</option>
                  <option value="1792x1024">1792x1024 (Horizontal)</option>
                  <option value="1024x1792">1024x1792 (Vertical)</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={loading || (!freePrompt && !freeImage && !freeUrl)}
                className="meta-btn-primary"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generando...
                  </span>
                ) : "Generar contenido"}
              </button>
              {genImageUrl && (
                <button onClick={regenerateImage} disabled={loading} className="meta-btn-ghost">
                  Regenerar imagen
                </button>
              )}
            </div>
            
            {/* Vista previa del resultado */}
            {(genText || genImageUrl || loading) && (
              <div className="mt-6 p-4 border border-white/10 rounded-lg bg-white/5">
                <h3 className="text-sm font-medium mb-3 text-cyan-400">Vista previa</h3>
                
                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <svg className="animate-spin h-12 w-12 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="ml-3 text-zinc-400">Generando contenido e imagen...</span>
                  </div>
                )}
                
                {!loading && genText && (
                  <div className="mb-4">
                    <label className="block text-xs text-zinc-400 mb-1">Texto generado:</label>
                    <div className="p-3 bg-white/5 rounded text-sm whitespace-pre-wrap">{genText}</div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={copyToClipboard} className="meta-btn-ghost text-xs">Copiar texto</button>
                      <button onClick={downloadTxt} className="meta-btn-ghost text-xs">Descargar</button>
                      <button onClick={savePost} disabled={!ws} className="meta-btn-ghost text-xs">Guardar post</button>
                    </div>
                  </div>
                )}
                
                {!loading && genImageUrl && (
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Imagen generada:</label>
                    <img src={genImageUrl} alt="Generated" className="w-full max-w-md rounded-lg border border-white/10" />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "calendar" && (
        <section className="meta-panel p-4">
          <CalendarView
            month={calendarMonth}
            events={calendar}
            onPrev={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
            onNext={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
            onCreate={createEvent}
            onDelete={deleteEvent}
            onMove={moveEvent}
          />
        </section>
      )}

      {tab === "library" && (
        <section className="meta-panel p-4 space-y-4">
          <h2 className="text-lg font-medium">Biblioteca de imágenes</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {genImages.map((url, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-lg border border-white/10">
                <img
                  src={url}
                  alt="asset"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "campaigns" && (
        <section className="space-y-4">
          <div className="meta-panel p-4 flex justify-between items-center">
            <h2 className="text-xl font-medium">Campañas</h2>
            <div className="flex gap-2">
              <select className="meta-input" value={selectedWs} onChange={(e)=>setSelectedWs(e.target.value)}>
                <option value="">Selecciona workspace...</option>
                {workspaces.map(w=> <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <button onClick={generateCampaign} disabled={!ws || loading} className="meta-btn-primary">
                {loading ? 'Generando...' : 'Nueva Campaña'}
              </button>
            </div>
          </div>
          
          {campaigns.length === 0 ? (
            <div className="meta-panel p-8 text-center text-zinc-400">
              No hay campañas. Selecciona un workspace y crea una campaña.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map(c => (
                <div key={c.id} className="meta-panel p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{c.name || 'Campaña sin nombre'}</h3>
                    <span className={`text-xs px-2 py-1 rounded ${c.status === 'published' ? 'bg-green-600' : 'bg-yellow-600'}`}>{c.status}</span>
                  </div>
                  <p className="text-sm text-zinc-400">{c.campaignType}</p>
                  <p className="text-xs text-zinc-500 mt-2">{new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "automations" && (
        <section className="space-y-4">
          <div className="meta-panel p-4 flex justify-between items-center">
            <h2 className="text-xl font-medium">Automatizaciones</h2>
            <div className="flex gap-2">
              <select className="meta-input" value={selectedWs} onChange={(e)=>setSelectedWs(e.target.value)}>
                <option value="">Selecciona workspace...</option>
                {workspaces.map(w=> <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <button onClick={createAutomation} disabled={!ws || loading} className="meta-btn-primary">
                {loading ? 'Creando...' : 'Nueva Regla'}
              </button>
            </div>
          </div>
          
          {automations.length === 0 ? (
            <div className="meta-panel p-8 text-center text-zinc-400">
              No hay automatizaciones. Selecciona un workspace y crea una regla.
            </div>
          ) : (
            <div className="space-y-3">
              {automations.map(r => (
                <div key={r.id} className="meta-panel p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">{r.name}</h3>
                    <p className="text-sm text-zinc-400">Trigger: {r.triggerType}</p>
                    {r.lastExecutedAt && (
                      <p className="text-xs text-zinc-500">Última ejecución: {new Date(r.lastExecutedAt).toLocaleString()}</p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleAutomation(r.id, r.isActive)}
                    className={`px-3 py-1 rounded text-sm ${r.isActive ? 'bg-green-600' : 'bg-zinc-600'}`}
                  >
                    {r.isActive ? 'Activa' : 'Inactiva'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "analytics" && (
        <section className="space-y-4">
          <div className="meta-panel p-4 flex justify-between items-center">
            <h2 className="text-xl font-medium">Analytics</h2>
            <select className="meta-input" value={selectedWs} onChange={(e)=>setSelectedWs(e.target.value)}>
              <option value="">Selecciona workspace...</option>
              {workspaces.map(w=> <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          
          {!brandProfile ? (
            <div className="meta-panel p-8 text-center space-y-4">
              <p className="text-zinc-400">No hay perfil de marca analizaro.</p>
              <button onClick={analyzeBrand} disabled={!ws || loading} className="meta-btn-primary">
                {loading ? 'Analizando...' : 'Analizar Marca'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="meta-panel p-4">
                <h3 className="font-medium mb-3 text-cyan-400">Perfil de Marca</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="text-zinc-400">Voice:</span> {brandProfile.brandVoice}</div>
                  <div><span className="text-zinc-400">Audience:</span> {brandProfile.targetAudience}</div>
                  <div><span className="text-zinc-400">Style:</span> {brandProfile.style}</div>
                  <div><span className="text-zinc-400">Positioning:</span> {brandProfile.positioning}</div>
                  <div><span className="text-zinc-400">Tone:</span> {brandProfile.tone}</div>
                </div>
              </div>
              
              <div className="meta-panel p-4">
                <h3 className="font-medium mb-3 text-purple-400">Estadísticas</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-cyan-400">{posts.length}</p>
                    <p className="text-xs text-zinc-400">Posts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-purple-400">{campaigns.length}</p>
                    <p className="text-xs text-zinc-400">Campañas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-400">{automations.filter(a => a.isActive).length}</p>
                    <p className="text-xs text-zinc-400">Automatizaciones</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-yellow-400">0</p>
                    <p className="text-xs text-zinc-400">Productos</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="meta-panel p-4">
            <h3 className="font-medium mb-3">Generar Contenido</h3>
            <div className="flex gap-2">
              <button onClick={generateMonth} disabled={!ws || loading} className="meta-btn-primary">
                {loading ? 'Generando...' : 'Generar Mes'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
