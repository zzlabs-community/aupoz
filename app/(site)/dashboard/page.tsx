"use client";

import { useEffect, useMemo, useState } from "react";
import CalendarView from "@/src/components/CalendarView";

type Workspace = {
  id: string;
  name: string;
  domain: string;
  description: string | null;
  industry: string | null;
  isScanned: boolean;
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
  content: any;
  status: string;
  createdAt: string;
  updatedAt: string;
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

  // Campaign management state
  const [campaignType, setCampaignType] = useState<string>("carousel");
  const [campaignPlatform, setCampaignPlatform] = useState<string>("instagram");
  const [currentCampaign, setCurrentCampaign] = useState<any>(null);
  const [campaignPrompt, setCampaignPrompt] = useState<string>("");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignFilter, setCampaignFilter] = useState<"all" | "draft" | "published" | "archived">("all");
  const [campaignSearch, setCampaignSearch] = useState<string>("");
  
  // Automation trigger types
  const [automationTriggerType, setAutomationTriggerType] = useState<string>("manual");

  // Analytics state
  const [analytics, setAnalytics] = useState<any>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);

  useEffect(() => {
    fetch("/api/workspaces", { credentials: 'include' }).then(r => r.json()).then((list: Workspace[]) => {
      const cleaned = (Array.isArray(list) ? list : []);
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

  async function loadAnalytics() {
    if (!selectedWs) return;
    const res = await fetch(`/api/analytics?companyId=${selectedWs}&type=all`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setAnalytics(data);
    }
  }

  async function loadAIAnalysis() {
    if (!ws) return;
    setAiAnalysisLoading(true);
    try {
      const res = await fetch(`/api/analytics?companyId=${ws.id}&type=trends`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
        alert("Analisis de tendencias completado");
      }
    } finally {
      setAiAnalysisLoading(false);
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
    setCurrentCampaign(null);
    setSelectedCampaign(null);
    try {
      const res = await fetch("/api/generate-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          companyId: ws.id, 
          campaignType, 
          platform: campaignPlatform,
          prompt: campaignPrompt || undefined
        }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentCampaign(data);
        await loadCampaigns();
      } else {
        alert(data.error || "Error generando campaña");
      }
    } finally { setLoading(false); }
  }

  async function updateCampaignStatus(id: string, status: string) {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
      credentials: 'include'
    });
    if (res.ok) {
      await loadCampaigns();
      alert("Estado actualizado");
    }
  }

  async function deleteCampaign(id: string) {
    if (!confirm("¿Eliminar esta campaña?")) return;
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "DELETE",
      credentials: 'include'
    });
    if (res.ok) {
      await loadCampaigns();
      setSelectedCampaign(null);
    }
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
        setWorkspaces(prev => [...prev, { ...created, accessToken: null, domain: created.domain, installedAt: null }]);
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

  async function deleteCompany(id: string) {
    if (!confirm("¿Estás seguro de que quieres eliminar este workspace? Esta acción no se puede deshacer.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces?id=${id}`, { method: "DELETE", credentials: 'include' });
      if (res.ok) {
        setWorkspaces(prev => prev.filter(w => w.id !== id));
        if (selectedWs === id) setSelectedWs("");
        alert("Workspace eliminado");
      }
    } finally { setLoading(false); }
  }

  // Filter and search campaigns
  const filteredCampaigns = useMemo(() => {
    let result = campaigns;
    if (campaignFilter !== "all") {
      result = result.filter(c => c.status === campaignFilter);
    }
    if (campaignSearch) {
      const search = campaignSearch.toLowerCase();
      result = result.filter(c => 
        c.name?.toLowerCase().includes(search) || 
        c.campaignType?.toLowerCase().includes(search)
      );
    }
    return result;
  }, [campaigns, campaignFilter, campaignSearch]);

  // Get campaign stats
  const campaignStats = useMemo(() => ({
    total: campaigns.length,
    draft: campaigns.filter(c => c.status === 'draft').length,
    published: campaigns.filter(c => c.status === 'published').length,
    archived: campaigns.filter(c => c.status === 'archived').length,
  }), [campaigns]);

  // Format campaign type for display
  const formatCampaignType = (type: string) => {
    const types: Record<string, string> = {
      carousel: 'Carrusel',
      single_post: 'Post Individual',
      story: 'Historia',
      reel: 'Reel',
      video: 'Video'
    };
    return types[type] || type;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-600';
      case 'draft': return 'bg-yellow-600';
      case 'archived': return 'bg-gray-600';
      default: return 'bg-zinc-600';
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6 text-zinc-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-semibold">Panel – Aupoz</h1>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {me && <span className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5">Sesión: {me.email}</span>}
          <span className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5">IA: {aiMode === 'real' ? 'Real' : 'Mock'}</span>
          <form action="/api/auth/signout" method="post">
            <button className="meta-btn-ghost text-xs" type="submit">Salir</button>
          </form>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-1 rounded-lg bg-white/5 p-1 border border-white/10 min-w-max">
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
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
              <option key={w.id} value={w.id}>{w.name} ({w.domain})</option>
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
              <div className="flex flex-col sm:flex-row gap-2">
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
          
          {workspaces.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium text-zinc-400">Tus Workspaces</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {workspaces.map(w => (
                  <div 
                    key={w.id} 
                    className={`p-3 rounded-lg border ${selectedWs === w.id ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-white/10 bg-white/5'} cursor-pointer hover:bg-white/10 transition-colors`}
                    onClick={() => setSelectedWs(w.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{w.name}</p>
                        <p className="text-xs text-zinc-400 truncate">{w.domain}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteCompany(w.id); }}
                        className="text-xs text-red-400 hover:text-red-300 ml-2 px-2 py-1 rounded hover:bg-red-500/20"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
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
            
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleGenerate}
                disabled={loading || (!freePrompt && !freeImage && !freeUrl)}
                className="meta-btn-primary"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
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
                    <div className="flex flex-wrap gap-2 mt-2">
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
          {/* Campaign Generator Form */}
          <div className="meta-panel p-4">
            <h2 className="text-lg md:text-xl font-medium mb-4">Generar Campaña con IA</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div>
                <label className="block text-sm mb-2">Workspace</label>
                <select 
                  className="meta-input w-full" 
                  value={selectedWs} 
                  onChange={(e)=>setSelectedWs(e.target.value)}
                >
                  <option value="">Selecciona workspace...</option>
                  {workspaces.map(w=> <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-2">Tipo de Campaña</label>
                <select 
                  className="meta-input w-full" 
                  value={campaignType} 
                  onChange={(e)=>setCampaignType(e.target.value)}
                >
                  <option value="carousel">Carrusel</option>
                  <option value="single_post">Post Individual</option>
                  <option value="story">Historia</option>
                  <option value="reel">Reel</option>
                  <option value="video">Video</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-2">Plataforma</label>
                <select 
                  className="meta-input w-full" 
                  value={campaignPlatform} 
                  onChange={(e)=>setCampaignPlatform(e.target.value)}
                >
                  <option value="instagram">Instagram</option>
                  <option value="twitter">Twitter/X</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="facebook">Facebook</option>
                  <option value="tiktok">TikTok</option>
                  <option value="pinterest">Pinterest</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-2">Instrucciones (opcional)</label>
                <input
                  type="text"
                  className="meta-input w-full"
                  placeholder="Instrucciones especiales..."
                  value={campaignPrompt}
                  onChange={(e) => setCampaignPrompt(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4">
              <button 
                onClick={generateCampaign} 
                disabled={!ws || loading} 
                className="meta-btn-primary w-full md:w-auto"
              >
                {loading ? 'Generando con IA...' : '🚀 Generar Campaña con IA'}
              </button>
            </div>
          </div>

          {/* Generated Campaign Result */}
          {currentCampaign && (
            <div className="meta-panel p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h3 className="text-lg font-medium text-cyan-400">Campaña Generada</h3>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => { setCurrentCampaign(null); setSelectedCampaign(null); }}
                    className="meta-btn-ghost text-xs"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
              
              {/* Caption */}
              {currentCampaign.caption && (
                <div className="p-3 bg-white/5 rounded">
                  <label className="block text-xs text-zinc-400 mb-1">Caption:</label>
                  <p className="text-sm whitespace-pre-wrap">{currentCampaign.caption}</p>
                  {currentCampaign.hashtags && currentCampaign.hashtags.length > 0 && (
                    <p className="text-xs text-cyan-400 mt-2">{currentCampaign.hashtags.join(' ')}</p>
                  )}
                </div>
              )}

              {/* Slides for Carousel */}
              {currentCampaign.slides && currentCampaign.slides.length > 0 && (
                <div className="space-y-3">
                  <label className="block text-sm text-zinc-400">Slides ({currentCampaign.slides.length}):</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    {currentCampaign.slides.map((slide: any, idx: number) => (
                      <div key={idx} className="p-3 bg-white/5 rounded border border-white/10">
                        <div className="text-xs text-cyan-400 mb-1">Slide {idx + 1}</div>
                        <p className="text-sm font-medium">🎯 {slide.hook}</p>
                        <p className="text-sm mt-1"><span className="text-purple-400">📣</span> {slide.headline}</p>
                        <p className="text-xs text-zinc-400 mt-1">{slide.body}</p>
                        <p className="text-xs text-zinc-500 mt-2">🖼️ {slide.image_prompt}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              {currentCampaign.cta && (
                <div className="p-3 bg-purple-500/10 rounded border border-purple-500/30">
                  <span className="text-sm text-purple-400">CTA: </span>
                  <span className="text-sm">{currentCampaign.cta}</span>
                </div>
              )}
            </div>
          )}
          
          {/* Campaign Stats */}
          {campaigns.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="meta-panel p-3 text-center">
                <p className="text-2xl font-bold text-cyan-400">{campaignStats.total}</p>
                <p className="text-xs text-zinc-400">Total</p>
              </div>
              <div className="meta-panel p-3 text-center">
                <p className="text-2xl font-bold text-yellow-400">{campaignStats.draft}</p>
                <p className="text-xs text-zinc-400">Borradores</p>
              </div>
              <div className="meta-panel p-3 text-center">
                <p className="text-2xl font-bold text-green-400">{campaignStats.published}</p>
                <p className="text-xs text-zinc-400">Publicadas</p>
              </div>
              <div className="meta-panel p-3 text-center">
                <p className="text-2xl font-bold text-gray-400">{campaignStats.archived}</p>
                <p className="text-xs text-zinc-400">Archivadas</p>
              </div>
            </div>
          )}
          
          {/* Saved Campaigns List */}
          <div className="meta-panel p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-medium">Campañas Guardadas</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Buscar campañas..."
                  className="meta-input w-full sm:w-48"
                  value={campaignSearch}
                  onChange={(e) => setCampaignSearch(e.target.value)}
                />
                <select 
                  className="meta-input w-full sm:w-32"
                  value={campaignFilter}
                  onChange={(e) => setCampaignFilter(e.target.value as any)}
                >
                  <option value="all">Todas</option>
                  <option value="draft">Borrador</option>
                  <option value="published">Publicada</option>
                  <option value="archived">Archivada</option>
                </select>
              </div>
            </div>
            
            {filteredCampaigns.length === 0 ? (
              <div className="text-center text-zinc-400 py-8">
                {campaigns.length === 0 ? 'No hay campañas guardadas. Genera una campaña con IA.' : 'No hay campañas que coincidan con los filtros.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredCampaigns.map(c => (
                  <div 
                    key={c.id} 
                    className={`p-4 bg-white/5 rounded-lg border transition-all cursor-pointer hover:bg-white/10 ${
                      selectedCampaign?.id === c.id ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-white/10'
                    }`}
                    onClick={() => setSelectedCampaign(c)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium truncate flex-1">{c.name || 'Campaña sin nombre'}</h4>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(c.status)}`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400">{formatCampaignType(c.campaignType)}</p>
                    <p className="text-xs text-zinc-500 mt-2">{new Date(c.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Campaign Detail Panel */}
          {selectedCampaign && (
            <div className="meta-panel p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h3 className="text-lg font-medium">Detalles de Campaña</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedCampaign.status === 'draft' && (
                    <button 
                      onClick={() => updateCampaignStatus(selectedCampaign.id, 'published')}
                      className="meta-btn-primary text-xs"
                    >
                      Publicar
                    </button>
                  )}
                  {selectedCampaign.status === 'published' && (
                    <button 
                      onClick={() => updateCampaignStatus(selectedCampaign.id, 'archived')}
                      className="meta-btn-ghost text-xs"
                    >
                      Archivar
                    </button>
                  )}
                  {selectedCampaign.status === 'archived' && (
                    <button 
                      onClick={() => updateCampaignStatus(selectedCampaign.id, 'draft')}
                      className="meta-btn-ghost text-xs"
                    >
                      Restaurar
                    </button>
                  )}
                  <button 
                    onClick={() => deleteCampaign(selectedCampaign.id)}
                    className="px-3 py-1.5 text-xs rounded border border-red-500/50 text-red-400 hover:bg-red-500/20"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div><span className="text-zinc-400">Nombre:</span> {selectedCampaign.name || 'Sin nombre'}</div>
                  <div><span className="text-zinc-400">Tipo:</span> {formatCampaignType(selectedCampaign.campaignType)}</div>
                  <div><span className="text-zinc-400">Estado:</span> <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(selectedCampaign.status)}`}>{selectedCampaign.status}</span></div>
                  <div><span className="text-zinc-400">Creada:</span> {new Date(selectedCampaign.createdAt).toLocaleString()}</div>
                  <div><span className="text-zinc-400">Actualizada:</span> {new Date(selectedCampaign.updatedAt).toLocaleString()}</div>
                </div>
              </div>

              {selectedCampaign.content && (
                <div className="space-y-3 pt-3 border-t border-white/10">
                  {selectedCampaign.content.caption && (
                    <div className="p-3 bg-white/5 rounded">
                      <label className="block text-xs text-zinc-400 mb-1">Caption:</label>
                      <p className="text-sm whitespace-pre-wrap">{selectedCampaign.content.caption}</p>
                      {selectedCampaign.content.hashtags && (
                        <p className="text-xs text-cyan-400 mt-2">{selectedCampaign.content.hashtags.join(' ')}</p>
                      )}
                    </div>
                  )}

                  {selectedCampaign.content.slides && selectedCampaign.content.slides.length > 0 && (
                    <div className="space-y-2">
                      <label className="block text-sm text-zinc-400">Slides:</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {selectedCampaign.content.slides.map((slide: any, idx: number) => (
                          <div key={idx} className="p-2 bg-white/5 rounded text-sm">
                            <span className="text-cyan-400">#{idx + 1}</span> {slide.hook} - {slide.headline}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedCampaign.content.cta && (
                    <div className="p-2 bg-purple-500/10 rounded">
                      <span className="text-purple-400">CTA:</span> {selectedCampaign.content.cta}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {tab === "automations" && (
        <section className="space-y-4">
          <div className="meta-panel p-4 flex flex-col md:flex-row justify-between items-center gap-3">
            <h2 className="text-xl font-medium">Automatizaciones</h2>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <select className="meta-input" value={selectedWs} onChange={(e)=>setSelectedWs(e.target.value)}>
                <option value="">Selecciona workspace...</option>
                {workspaces.map(w=> <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <select 
                className="meta-input" 
                value={automationTriggerType} 
                onChange={(e)=>setAutomationTriggerType(e.target.value)}
              >
                <option value="manual">Manual</option>
                <option value="new_product">Nuevo Producto</option>
                <option value="schedule">Programado</option>
                <option value="low_stock">Stock Bajo</option>
                <option value="price_change">Cambio de Precio</option>
                <option value="ai_content">IA Content</option>
                <option value="engagement">Engagement</option>
                <option value="trending">Trending</option>
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
                <div key={r.id} className="meta-panel p-4 flex flex-col md:flex-row justify-between items-center gap-3">
                  <div className="flex-1">
                    <h3 className="font-medium">{r.name}</h3>
                    <p className="text-sm text-zinc-400">Trigger: {r.triggerType}</p>
                    {r.lastExecutedAt && (
                      <p className="text-xs text-zinc-500">Última ejecución: {new Date(r.lastExecutedAt).toLocaleString()}</p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleAutomation(r.id, r.isActive)}
                    className={`px-3 py-1.5 rounded text-sm w-full md:w-auto ${r.isActive ? 'bg-green-600 hover:bg-green-500' : 'bg-zinc-600 hover:bg-zinc-500'}`}
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
          <div className="meta-panel p-4 flex flex-col md:flex-row justify-between items-center gap-3">
            <h2 className="text-xl font-medium">Analytics</h2>
            <select className="meta-input w-full md:w-64" value={selectedWs} onChange={(e)=>setSelectedWs(e.target.value)}>
              <option value="">Selecciona workspace...</option>
              {workspaces.map(w=> <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          
          {!brandProfile ? (
            <div className="meta-panel p-8 text-center space-y-4">
              <p className="text-zinc-400">No hay perfil de marca analizado.</p>
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
            <div className="flex flex-col sm:flex-row gap-2">
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
