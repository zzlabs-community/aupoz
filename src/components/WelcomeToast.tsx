"use client";
import { useEffect, useState } from "react";

export default function WelcomeToast() {
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState("Bienvenido a AUPOZ");

  useEffect(() => {
    try {
      const flag = localStorage.getItem("aupoz_welcome");
      if (flag) {
        if (flag === "signup") setMsg("Cuenta creada. ¡Bienvenido a AUPOZ!");
        setShow(true);
        localStorage.removeItem("aupoz_welcome");
        const t = setTimeout(() => setShow(false), 3000);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, []);

  if (!show) return null;

  return (
    <div className="toast-welcome">
      <div className="toast-card">{msg}</div>
    </div>
  );
}

