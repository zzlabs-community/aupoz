"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function Access() {
  const seoRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = seoRef.current; if (!el) return;
    // Show immediately; keep smooth fade if it enters viewport later
    el.classList.remove("opacity-0"); el.classList.add("opacity-100");
  }, []);

  return (
    <div className="min-h-screen px-4 pt-16 pb-14 touch-manipulation md:flex md:items-center md:justify-center md:pt-0 md:pb-0">
      <div className="w-full max-w-5xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center justify-items-center">
        {/* Héroe de acceso (izquierda) */}
        <section className="text-center py-10 animate-fadeIn">
          <div className="flex items-center justify-center mb-[1cm]">
            <img src="/aupozlogo.png" alt="AUPOZ" className="logo-spin-y pointer-events-none select-none w-[200px] sm:w-[240px] md:w-[300px] h-auto" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight bg-gradient-to-r from-cyan-300 via-sky-300 to-teal-400 text-transparent bg-clip-text mb-3">
            Accede a AUPOZ
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-md mx-auto leading-relaxed">Únete y desbloquea la plataforma.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 mt-6">
            <Link href="/signup" className="w-full max-w-[220px] sm:w-auto meta-btn-primary btn-sm text-center">Registrarse</Link>
            <Link href="/signin" className="w-full max-w-[220px] sm:w-auto meta-btn-ghost btn-sm text-center">Iniciar sesión</Link>
          </div>
        </section>

        {/* SEO AUPOZ by ZZlabz (derecha en desktop, abajo en móvil) */}
        <section
          ref={seoRef}
          className="opacity-100 transition-opacity duration-700 ease-out w-full max-w-md sm:max-w-lg lg:max-w-none mx-auto lg:mx-0 text-center lg:text-left lg:justify-self-start"
          role="region"
          aria-labelledby="seo-aupoz"
        >
          <p className="text-sm text-zinc-400 mt-2 mb-0 lg:hidden">
            <button
              type="button"
              className="underline"
              aria-expanded={expanded}
              aria-controls="aupoz-info"
              onClick={() => setExpanded(!expanded)}
              id="seo-aupoz"
            >
              ¿Qué es AUPOZ?
            </button>
          </p>
          <div
            id="aupoz-info"
            className={`overflow-hidden transition-[max-height,opacity,margin] duration-500 ease-in-out ${expanded ? 'max-h-[1200px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'} lg:max-h-[1200px] lg:opacity-100 lg:mt-3`}
          >
            <div className="meta-panel p-5 lg:p-6 text-zinc-200 rounded-2xl text-left lg:justify-self-center lg:max-w-md">
              <p className="text-sm leading-relaxed mb-3">AUPOZ es un estudio de contenido con IA para marcas y creadores: redacta, crea visuales y organiza publicaciones desde un solo lugar. Creado por <span className="text-white font-semibold">ZZlabz</span>.</p>

              <h4 className="text-white font-medium mb-1">¿Qué hace AUPOZ?</h4>
              <ul className="list-disc pl-5 space-y-1.5 text-sm">
                <li>Genera copys optimizados para cada red (IG, X, LinkedIn, TikTok).</li>
                <li>Crea imágenes y artes con dirección de marca.</li>
                <li>Guarda activos y posts en la nube, listos para publicar.</li>
                <li>Integra catálogo (opcional) para convertir productos en contenido.</li>
              </ul>

              <h4 className="text-white font-medium mt-4 mb-1">¿Por qué usarlo?</h4>
              <ul className="list-disc pl-5 space-y-1.5 text-sm">
                <li>Velocidad: campañas y piezas en minutos, no días.</li>
                <li>Calidad consistente: prompts y estilos curados para performance.</li>
                <li>Orden: calendario y librería de activos en un solo panel.</li>
                <li>Costos bajos: produce más con menos.</li>
              </ul>
            </div>
          </div>

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'SoftwareApplication',
                name: 'AUPOZ',
                applicationCategory: 'CreativeWork/ContentCreation',
                operatingSystem: 'Web',
                creator: { '@type': 'Organization', name: 'ZZlabz' },
                description: 'Estudio de contenido con IA: textos, visuales y calendario de publicaciones para marcas y creadores.',
              }),
            }}
          />
        </section>
      </div>
    </div>
  );
}
