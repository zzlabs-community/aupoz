import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone", // Deshabilitado para Railway - puede causar problemas con archivos estáticos
  images: {
    unoptimized: true, // Necesario para algunos despliegues
  },
};

export default nextConfig;
