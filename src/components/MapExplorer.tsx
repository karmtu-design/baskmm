"use client";

import { useMemo, useState } from "react";
import LicensesMap from "./LicensesMap";
import { mineralColor, mineralGroup, type Company, type License } from "@/lib/types";

export default function MapExplorer({ licenses, companies }: { licenses: License[]; companies: Company[] }) {
  const [company, setCompany] = useState("");
  const [type, setType] = useState("");
  const [group, setGroup] = useState("");
  const [labels, setLabels] = useState(true);

  const groups = useMemo(() => Array.from(new Set(licenses.map((l) => mineralGroup(l.mineral)))), [licenses]);
  const shown = useMemo(
    () =>
      licenses.filter(
        (l) =>
          (!company || String(l.company_id) === company) &&
          (!type || l.license_type === type) &&
          (!group || mineralGroup(l.mineral) === group)
      ),
    [licenses, company, type, group]
  );
  const missing = shown.filter((l) => !l.contour);

  const select = "rounded-md border border-line bg-surface px-3 py-2 text-sm";
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select aria-label="Компания" className={select} value={company} onChange={(e) => setCompany(e.target.value)}>
          <option value="">Все компании</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select aria-label="Вид лицензии" className={select} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Разведка и добыча</option>
          <option value="Разведка">Разведка</option>
          <option value="Добыча">Добыча</option>
        </select>
        <select aria-label="Полезное ископаемое" className={select} value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">Все полезные ископаемые</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <label className="ml-1 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
          Подписи участков
        </label>
        <span className="ml-auto text-sm text-muted">Показано участков: {shown.length - missing.length}</span>
      </div>

      <LicensesMap key={`${company}|${type}|${group}|${labels}`} licenses={shown} height={680} showLabels={labels} />

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        {groups.map((g) => (
          <span key={g} className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-5 rounded-sm"
              style={{ background: mineralColor(licenses.find((l) => mineralGroup(l.mineral) === g)!.mineral) }}
            />
            {g}
          </span>
        ))}
      </div>
      {missing.length > 0 && (
        <p className="mt-3 text-sm text-ochre">
          Без контура: {missing.map((l) => l.deposit_name).join(", ")}. Добавьте координаты в карточке лицензии.
        </p>
      )}
    </>
  );
}
