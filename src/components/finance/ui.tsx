"use client";

// Small shared pieces of the «Финансы» screens: a dialog window, summary tiles, saving helpers.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { tr } from "@/i18n";
import { createClient } from "@/lib/supabase/client";
import { dn } from "@/lib/translit";

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = o;
    };
  }, [onClose]);
  return createPortal(
    <div className="fin-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`fin-modal${wide ? " is-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="fin-modal-head">
          <b>{title}</b>
          <button type="button" className="nav-close" onClick={onClose} aria-label={tr("Закрыть")}>×</button>
        </div>
        <div className="fin-modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function Tiles({ items }: { items: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "warn" | "bad" | "good" }[] }) {
  return (
    <div className="fin-tiles">
      {items.map((t) => (
        <div key={t.label} className={`fin-tile${t.tone ? ` is-${t.tone}` : ""}`}>
          <span>{t.label}</span>
          <b>{t.value}</b>
          {t.hint && <small>{t.hint}</small>}
        </div>
      ))}
    </div>
  );
}

export const companyName = (companies: { id: number; name: string }[], id: number | null | undefined) => {
  const c = companies.find((x) => x.id === id);
  return c ? dn(c.name) : "—";
};

export async function me() {
  const { data } = await createClient().auth.getSession();
  return data.session?.user.email ?? null;
}

/** Turns empty strings into nulls and numbers typed with spaces or a comma into numbers. */
export function clean<T extends Record<string, unknown>>(o: T, numbers: (keyof T)[] = []): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string") {
      const s = v.trim();
      if (numbers.includes(k as keyof T)) out[k] = s === "" ? null : Number(s.replace(/\s/g, "").replace(",", "."));
      else out[k] = s === "" ? null : s;
    } else out[k] = v;
  }
  return out as T;
}

export const errText = (m: string) => (/row-level security|permission|42501/i.test(m) ? tr("Нет прав на изменение: у вас доступ к финансам только для просмотра.") : m);
