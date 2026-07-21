"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Menu, X, Search } from "lucide-react";

function setTheme(el: HTMLElement, theme: "light" | "dark") {
  const root = el.closest(".pv-root") as HTMLElement | null;
  if (root) root.setAttribute("data-theme", theme);
}

/** Comută tema pe wrapperul direcției (light/dark). */
export function ThemeToggle({ initial }: { initial: "light" | "dark" }) {
  const [theme, setThemeState] = useState<"light" | "dark">(initial);
  return (
    <button
      aria-label="Comută tema"
      onClick={(e) => {
        const next = theme === "dark" ? "light" : "dark";
        setThemeState(next);
        setTheme(e.currentTarget, next);
      }}
      className="pv-icon-btn"
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

export function SearchTrigger({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {compact ? (
        <button aria-label="Caută" className="pv-icon-btn" onClick={() => setOpen(true)}>
          <Search size={17} />
        </button>
      ) : (
        <button className="pv-search-field" onClick={() => setOpen(true)}>
          <Search size={15} />
          <span>Caută subiecte, entități, orașe…</span>
        </button>
      )}
      {open && (
        <div className="pv-search-overlay" onClick={() => setOpen(false)}>
          <div className="pv-search-panel" onClick={(e) => e.stopPropagation()}>
            <div className="pv-search-inputrow">
              <Search size={18} />
              <input autoFocus placeholder="Caută în tot ce s-a întâmplat…" />
              <button aria-label="Închide" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <p className="pv-search-hint">
              Caută după subiect, entitate, oraș sau instituție. (previzualizare de design)
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export function MobileNav({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <>
      <button aria-label="Meniu" className="pv-icon-btn pv-only-mobile" onClick={() => setOpen(true)}>
        <Menu size={19} />
      </button>
      {open && (
        <div className="pv-mobile-menu">
          <div className="pv-mobile-head">
            <span className="pv-mono pv-up" style={{ fontSize: 12 }}>Navigare</span>
            <button aria-label="Închide" className="pv-icon-btn" onClick={() => setOpen(false)}>
              <X size={19} />
            </button>
          </div>
          <nav>
            {items.map((it) => (
              <a key={it} href="#" onClick={() => setOpen(false)}>
                {it}
              </a>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
