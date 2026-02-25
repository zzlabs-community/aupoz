"use client";
import { useState } from "react";

export function Logo({ size = 24, className = "" }: { size?: number; className?: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <span className={`font-semibold ${className}`}>AUPOZ</span>;
  return (
    // Using <img> to avoid server-side Next/Image errors and allow onError handling
    <img
      src="/aupozlogo.png"
      width={size}
      height={size}
      alt="AUPOZ logo"
      className={`rounded ${className}`}
      onError={() => setOk(false)}
    />
  );
}
