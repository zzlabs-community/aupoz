"use client";
import { useEffect, useMemo, useState } from "react";

type Event = { id: string; date: string; title: string; color: string; assets?: { id: string; url: string }[] };

function colorClasses(color: string) {
  switch (color) {
    case 'indigo': return 'bg-indigo-500/20 border-indigo-500/30';
    case 'rose': return 'bg-rose-500/20 border-rose-500/30';
    case 'emerald': return 'bg-emerald-500/20 border-emerald-500/30';
    case 'amber': return 'bg-amber-500/20 border-amber-500/30';
    case 'sky':
    default: return 'bg-sky-500/20 border-sky-500/30';
  }
}

function platformLimit(platform: string) {
  switch (platform) {
    case 'twitter': return 280;
    case 'instagram': return 2200;
    case 'linkedin': return 3000;
    case 'facebook': return 63206;
    case 'tiktok': return 2200;
    case 'youtube': return 5000;
    case 'pinterest': return 500;
    default: return 2000;
  }
}

function charCount(platform: string, text: string) {
  const max = platformLimit(platform);
  return `${text.length}/${max}`;
}

function formatMonthEs(dt: Date) {
  try { return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dt); }
  catch { return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`; }
}
function formatFullDateEs(dt: Date) {
  try { return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dt); }
  catch { return dt.toISOString().slice(0,10); }
}
function dotBg(c: string) {
  switch (c) {
    case 'indigo': return 'bg-indigo-500 border-indigo-400';
    case 'rose': return 'bg-rose-500 border-rose-400';
    case 'emerald': return 'bg-emerald-500 border-emerald-400';
    case 'amber': return 'bg-amber-500 border-amber-400';
    case 'sky':
    default: return 'bg-sky-500 border-sky-400';
  }
}

export default function CalendarView({ month, onPrev, onNext, events, onCreate, onDelete, onMove }: {
  month: Date,
  onPrev: ()=>void,
  onNext: ()=>void,
  events: Event[],
  onCreate: (dateIso: string, title: string, notes?: string, color?: string, assetIds?: string[])=>void,
  onDelete: (id: string)=>void,
  onMove?: (id: string, newDateIso: string)=>void,
}) {
  const [draft, setDraft] = useState<{date: string, title: string, color: string, notes: string}>({ date: "", title: "", color: "sky", notes: "" });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [miniTitle, setMiniTitle] = useState("");
  const [miniColor, setMiniColor] = useState("sky");
  const [miniNotes, setMiniNotes] = useState("");
  const [filters, setFilters] = useState<string[]>(["sky","indigo","rose","emerald","amber"]);
  
  // Hydrate from localStorage after mount (avoid SSR mismatch)
  useEffect(() => {
    try { 
      const s = localStorage.getItem('cal_filters'); 
      if (s) setFilters(JSON.parse(s)); 
    } catch {}
  }, []);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const days = useMemo(()=> buildDays(month), [month]);
  const grouped = useMemo(()=> groupByDate(events||[]), [events]);
  const selectedDate = useMemo(()=> days.find(d=> d.key === selectedKey)?.date || null, [days, selectedKey]);
  const labelSuggestions = useMemo(()=> {
    const set = new Set<string>();
    (events||[]).forEach((e:any)=> (e.labels||[]).forEach((l:string)=> set.add(l)));
    return Array.from(set);
  }, [events]);

  // persist filters (sin efectos dentro de useMemo)
  useEffect(()=> { try { localStorage.setItem('cal_filters', JSON.stringify(filters)); } catch {} }, [filters]);

  function submit() {
    if (!draft.date || !draft.title) return;
    onCreate(draft.date, draft.title, draft.notes || undefined, draft.color, []);
    setDraft({ date: "", title: "", color: "sky", notes: "" });
  }

  return (
    <div className="space-y-3">
      {/* Filtros de color */}
      <div className="flex items-center gap-2 flex-nowrap overflow-x-auto text-[11px]">
        <button className="px-2 py-1 rounded border border-white/10 bg-white/5" onClick={()=> setFilters(["sky","indigo","rose","emerald","amber"]) }>Todos</button>
        {["sky","indigo","rose","emerald","amber"].map((c)=> (
          <button key={c} onClick={()=> setFilters(prev=> prev.includes(c) ? prev.filter(x=>x!==c) : [...prev, c])} className={`px-2 py-1 rounded border ${filters.includes(c)? 'border-white/30 bg-white/10' : 'border-white/10 bg-white/5 opacity-60'}`}>
            <span className={`inline-block w-3 h-3 rounded-full mr-1 align-middle ${dotBg(c)}`}></span>{c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 items-center gap-2">
        <button className="meta-btn-ghost p-0 w-8 h-8 rounded-full inline-flex items-center justify-center" onClick={onPrev} aria-label="Mes anterior">‹</button>
        <h3 className="text-center text-base md:text-lg font-medium">{formatMonthEs(month)}</h3>
        <button className="meta-btn-ghost p-0 w-8 h-8 rounded-full inline-flex items-center justify-center" onClick={onNext} aria-label="Mes siguiente">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=> <div key={d} className="text-[10px] md:text-xs text-zinc-400 text-center">{d}</div>)}
        {days.map(d=> (
          <div
            key={d.key}
            className={`min-h-16 md:min-h-28 border border-white/10 rounded p-1 md:p-2 ${d.inMonth? 'bg-white/5' : 'bg-white/[0.03] opacity-60'} cursor-pointer ${dragKey===d.key || selectedKey===d.key ? 'ring-2 ring-cyan-400/60' : ''}`}
            onClick={()=> { setSelectedKey(d.key); setDraft({ date: d.date.toISOString(), title: draft.title||'', notes: draft.notes||'', color: draft.color||'sky' }); }}
            onDragEnter={()=> { if (onMove) setDragKey(d.key); }}
            onDragOver={(e)=> { if (onMove) e.preventDefault(); }}
            onDragLeave={()=> { if (onMove) setDragKey(null); }}
            onDrop={(e)=> {  if (!onMove) return; e.preventDefault(); const id=e.dataTransfer.getData('text/event-id'); if(id){ onMove(id, d.date.toISOString()); }  setDragKey(null); }}
          >
            <div className="text-[10px] md:text-xs text-zinc-400 flex items-center justify-between">
              <span>{d.date.getDate()}</span>
              <button className="hidden md:inline text-[10px] underline" onClick={(e)=> { e.stopPropagation(); setDraft({ date: d.date.toISOString(), title: `Publicación ${d.date.getDate()}`, color: 'sky', notes: '' }); }}>+ agregar</button>
            </div>
            <div className="mt-1 space-y-1">
              {(grouped[d.key]||[]).filter(ev=> filters.includes((ev as any).color||'sky')).map(ev=> (
                <EventBadge key={ev.id} ev={ev as any} onDelete={onDelete} draggable={!!onMove} />
              ))}
              {selectedKey === d.key && (
                <div className="hidden md:block rounded border border-white/10 bg-black/40 p-1 space-y-1">
                  <input className="meta-input !px-2 !py-1 text-[12px]" placeholder="Título…" value={miniTitle} onChange={(e)=> setMiniTitle(e.target.value)} onClick={(e)=>e.stopPropagation()} />
                  <div className="flex items-center gap-1">
                    {['sky','indigo','rose','emerald','amber'].map(c=> (
                      <button key={c} onClick={(e)=> { e.stopPropagation(); setMiniColor(c); }} className={`w-4 h-4 rounded-full border ${miniColor===c?'ring-2 ring-white':''} ${dotBg(c)}`} aria-label={c} />
                    ))}
                    <button className="meta-btn-primary ml-auto !px-2 !py-1 text-[12px]" onClick={(e)=> { e.stopPropagation(); if (!miniTitle) return; onCreate(d.date.toISOString(), miniTitle, miniNotes||undefined, miniColor, []); setMiniTitle(''); setMiniNotes(''); setMiniColor('sky'); setSelectedKey(null); }}>Crear</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Hoja móvil para crear evento */}

      {selectedKey && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={()=> setSelectedKey(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
          <div className="absolute inset-0 p-3 grid place-items-center" onClick={(e)=> e.stopPropagation()}>
            <div className="meta-panel p-4 rounded-2xl bg-black/70 space-y-2 w-full max-w-sm sm:max-w-md" role="dialog" aria-modal="true">
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-300">{selectedDate ? formatFullDateEs(selectedDate) : selectedKey}</div>
                <button className="meta-btn-ghost btn-sm" onClick={()=> setSelectedKey(null)}>Cerrar</button>
              </div>
              <input className="meta-input w-full" placeholder="Título…" value={miniTitle} onChange={(e)=> setMiniTitle(e.target.value)} />
              <textarea className="meta-input w-full h-20" placeholder="Notas (opcional)" value={miniNotes} onChange={(e)=> setMiniNotes(e.target.value)} />
              <div className="flex items-center gap-2">
                {["sky","indigo","rose","emerald","amber"].map(c=> (
                  <button key={c} onClick={()=> setMiniColor(c)} className={"w-6 h-6 rounded-full border " + (miniColor===c?"ring-2 ring-white ":"") + dotBg(c)} aria-label={c} />
                ))}
                <button className="meta-btn-primary ml-auto" onClick={()=> { if (!miniTitle || !selectedDate) return; onCreate(selectedDate.toISOString(), miniTitle, miniNotes||undefined, miniColor, []); setMiniTitle(''); setMiniNotes(''); setMiniColor('sky'); setSelectedKey(null); }}>Crear</button>
              </div>
            </div>
          </div>
        </div>

      )}

      <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 items-end gap-2">
        <input className="meta-input" type="date" value={draft.date ? draft.date.slice(0,10) : ''} onChange={(e)=> setDraft(prev=> ({...prev, date: new Date(e.target.value).toISOString()}))} />
        <input className="meta-input" placeholder="Título" value={draft.title} onChange={(e)=> setDraft(prev=> ({...prev, title: e.target.value}))} />
        <input className="meta-input md:col-span-2" placeholder="Notas (opcional)" value={draft.notes} onChange={(e)=> setDraft(prev=> ({...prev, notes: e.target.value}))} />
        <select className="meta-input" value={draft.color} onChange={(e)=> setDraft(prev=> ({...prev, color: e.target.value}))}>
          {['sky','indigo','rose','emerald','amber'].map(c=> <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="meta-btn-primary" onClick={submit}>Crear</button>
      </div>
    </div>
  );
}

function EventBadge({ ev, onDelete, draggable }: { ev: any, onDelete: (id: string)=>void, draggable?: boolean }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(ev.title);
  const [notes, setNotes] = useState(ev.notes||"");
  const [color, setColor] = useState(ev.color);
  const [assets, setAssets] = useState<{id:string, url:string}[]>(ev.assets||[]);
  const [lastTap, setLastTap] = useState(0);
  const [platform, setPlatform] = useState(ev.platform||"instagram");
  const [status, setStatus] = useState(ev.status||"draft");
  const [caption, setCaption] = useState(ev.caption||"");
  const [time, setTime] = useState(ev.time||"");
  const [linkUrl, setLinkUrl] = useState(ev.linkUrl||"");
  const [hashtags, setHashtags] = useState(ev.hashtags||"");
  const [labels, setLabels] = useState<string[]>(ev.labels||[]);
  const [labelInput, setLabelInput] = useState("");

  async function loadDetails() {
    const r = await fetch(`/api/calendar/${ev.id}`);
    if (r.ok) {
      const j = await r.json();
      setTitle(j.title||""); setNotes(j.notes||""); setColor(j.color||"sky"); setAssets(j.assets||[]);
    }
  }

  async function save() {
    setSaving(true);
    const r = await fetch(`/api/calendar/${ev.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, caption, notes, color, platform, status, time, linkUrl, hashtags, labels, assetIds: assets.map(a=>a.id) }) });
    setSaving(false);
    if (r.ok) setOpen(false);
  }

  function onTouchEnd() {
    const now = Date.now();
    if (now - lastTap < 300) { setOpen(true); loadDetails(); }
    setLastTap(now);
  }

  return (
    <div className={`text-[10px] md:text-xs px-1.5 py-1 rounded ${colorClasses(color)} flex items-center justify-between`}
         onClick={(e)=> e.stopPropagation()} onTouchEnd={onTouchEnd}
         draggable={!!draggable}
         onDragStart={(e)=> { if (!draggable) { e.preventDefault(); return; } e.dataTransfer.setData('text/event-id', ev.id); e.dataTransfer.effectAllowed='move'; }}>
      <button className="truncate text-left" onClick={(e)=>{ e.stopPropagation(); setOpen(!open); if (!open) loadDetails(); }}>{title}</button>
      <div className="flex items-center gap-1 ml-2">
        <button className="text-[10px]" onClick={(e)=>{ e.stopPropagation(); setOpen(!open); }}>✎</button>
        <button className="text-[10px]" onClick={(e)=>{ e.stopPropagation(); onDelete(ev.id); }}>✕</button>
      </div>
      {open && (
          <>
        <div className="hidden md:block mt-2 p-2 rounded border border-white/10 bg-black/50 space-y-2 w-full">
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            <select className="meta-input" value={platform} onChange={(e)=>setPlatform(e.target.value)}>
              {['instagram','twitter','linkedin','facebook','tiktok','youtube','pinterest'].map(p=> <option key={p} value={p}>{p}</option>)}
            </select>
            <select className="meta-input" value={status} onChange={(e)=>setStatus(e.target.value)}>
              {['idea','draft','ready','scheduled','published','archived'].map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="meta-input" type="date" value={(ev.date||'').slice(0,10)} onChange={(e)=>{/* handled on parent create/move; here keep date view-only for now */}} disabled />
            <input className="meta-input" type="time" value={time} onChange={(e)=> setTime(e.target.value)} />
          </div>

          <textarea className="meta-input w-full h-24" placeholder="Caption…" value={caption} onChange={(e)=>setCaption(e.target.value)} />
          <div className="text-[10px] text-zinc-400">{charCount(platform, caption)} caracteres</div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            <input className="meta-input md:col-span-2" placeholder="Link (opcional)" value={linkUrl} onChange={(e)=> setLinkUrl(e.target.value)} />
            <input className="meta-input md:col-span-2" placeholder="#hashtags separados por espacios" value={hashtags} onChange={(e)=> setHashtags(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {labels.map(l=> (
                <span key={l} className="px-2 py-1 text-[11px] rounded-full bg-white/10 border border-white/20">{l} <button onClick={()=> setLabels(prev=> prev.filter(x=>x!==l))}>×</button></span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input className="meta-input flex-1" placeholder="Agregar etiqueta" value={labelInput} onChange={(e)=> setLabelInput(e.target.value)} list={`label-suggest-${ev.id}`} />
              <button className="meta-btn-ghost" onClick={()=> { const v=labelInput.trim(); if(v && !labels.includes(v)) setLabels([...labels, v]); setLabelInput(""); }}>Añadir</button>
              <datalist id={`label-suggest-${ev.id}`}>
                {Array.from(new Set((ev.labels as string[] || []))).map((s:string)=>(<option key={s} value={s} />))}
              </datalist>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select className="meta-input" value={color} onChange={(e)=>setColor(e.target.value)}>
              {['sky','indigo','rose','emerald','amber'].map(c=> <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-[10px] text-zinc-400">{status==='scheduled' && time ? 'Scheduled' : status}</span>
            <button className="meta-btn-ghost" onClick={async()=>{ const r=await fetch('/api/assets'); if(r.ok){ const j=await r.json(); setAssets(j.items||[]);} }}>Adjuntar imágenes</button>
            <button className="meta-btn-primary" disabled={saving} onClick={save}>{saving? 'Guardando…':'Guardar'}</button>
          </div>

          {assets.length>0 && (
            <div className="grid grid-cols-3 gap-2">
              {assets.map(a=> (
                <div key={a.id} className="relative group">
                  <img src={a.url} alt="asset" className="w-full h-20 object-cover rounded" />
                  <button className="absolute top-1 right-1 text-[10px] px-1 rounded bg-black/60" onClick={()=> setAssets(prev=> prev.filter(x=>x.id!==a.id))}>Quitar</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="md:hidden fixed inset-0 z-50" onClick={()=> { setOpen(false); }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
          <div className="absolute inset-0 p-3 grid place-items-center" onClick={(e)=> e.stopPropagation()}>
            <div className="meta-panel p-4 rounded-2xl bg-black/70 w-full max-w-sm space-y-2" role="dialog" aria-modal="true">
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-300">Editar evento</div>
                <button className="meta-btn-ghost btn-sm" onClick={()=> setOpen(false)}>Cerrar</button>
              </div>
              <input className="meta-input w-full" placeholder="Título…" value={title} onChange={(e)=> setTitle(e.target.value)} />
              <textarea className="meta-input w-full h-24" placeholder="Notas (opcional)" value={notes} onChange={(e)=> setNotes(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <select className="meta-input" value={platform} onChange={(e)=>setPlatform(e.target.value)}>
                  {["instagram","twitter","linkedin","facebook","tiktok","youtube","pinterest"].map(p=> <option key={p} value={p}>{p}</option>)}
                </select>
                <select className="meta-input" value={status} onChange={(e)=>setStatus(e.target.value)}>
                  {["idea","draft","ready","scheduled","published","archived"].map(s=> <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                {["sky","indigo","rose","emerald","amber"].map(c=> (
                  <button key={c} onClick={()=> setColor(c)} className={`w-6 h-6 rounded-full border ${color===c?'ring-2 ring-white':''} ${dotBg(c)}`} />
                ))}
                <button className="meta-btn-primary ml-auto" disabled={saving} onClick={save}>{saving?'Guardando…':'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
          </>

      )}
    </div>
  );
}

function buildDays(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth()+1, 0);
  const startDay = (start.getDay()+6)%7; // make Monday=0
  const days: { key: string, date: Date, inMonth: boolean }[] = [];
  const gridStart = new Date(start); gridStart.setDate(start.getDate() - startDay);
  for (let i=0; i<42; i++) {
    const d = new Date(gridStart); d.setDate(gridStart.getDate()+i);
    const key = d.toISOString().slice(0,10);
    days.push({ key, date: d, inMonth: d.getMonth() === month.getMonth() });
  }
  return days;
}

function groupByDate(items: Event[]) {
  const map: Record<string, Event[]> = {};
  for (const ev of items) {
    const key = ev.date.slice(0,10);
    (map[key] ||= []).push(ev);
  }
  return map;
}
