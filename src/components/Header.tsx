"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import BrandLogo from "./BrandLogo";

const NAV_ITEMS: { label: string; buzz?: boolean }[] = [
  { label: "Actualitate" },
  { label: "Business" },
  { label: "AI & Tech" },
  { label: "Politică" },
  { label: "Geopolitică" },
  { label: "Monden", buzz: true },
  { label: "Viral", buzz: true },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header>
      <div className="masthead">
        <BrandLogo gradientId="pg-header" />
        <nav className="desktop-nav">
          <ul>
            {NAV_ITEMS.map((item, i) => (
              <Fragment key={item.label}>
                {i === 5 && <li className="nav-divider"></li>}
                <li>
                  <Link href="/" className={item.buzz ? "buzz-link" : ""}>
                    {item.label}
                  </Link>
                </li>
              </Fragment>
            ))}
          </ul>
        </nav>
        <button
          className="menu-toggle"
          aria-label="Meniu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>
      <nav className={`mobile-nav${menuOpen ? " open" : ""}`}>
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <Link
                href="/"
                className={item.buzz ? "buzz-link" : ""}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
