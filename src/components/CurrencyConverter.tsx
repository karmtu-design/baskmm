"use client";

// A small converter under the National Bank rates: type an amount in any currency, see the others.
import { useState } from "react";
import { tr, loc } from "@/i18n";
import type { Rate } from "@/lib/feeds";

export default function CurrencyConverter({ rates }: { rates: Rate[] }) {
  const all = [{ code: "KZT", per: 1, rate: 1 }, ...rates];
  const [amount, setAmount] = useState(1_000_000);
  const [from, setFrom] = useState("USD");
  const src = all.find((r) => r.code === from) ?? all[0];
  const tenge = (amount * src.rate) / src.per;
  return (
    <div className="fx-conv">
      <div className="fx-row">
        <input
          type="number"
          className="field"
          min={0}
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
          aria-label={tr("Сумма")}
        />
        <select className="field" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={tr("Валюта")}>
          {all.map((r) => (
            <option key={r.code} value={r.code}>
              {r.code}
            </option>
          ))}
        </select>
      </div>
      <ul className="fx-out">
        {all
          .filter((r) => r.code !== from)
          .map((r) => (
            <li key={r.code}>
              <span>{r.code}</span>
              <b>{((tenge * r.per) / r.rate).toLocaleString(loc(), { maximumFractionDigits: 2 })}</b>
            </li>
          ))}
      </ul>
    </div>
  );
}
