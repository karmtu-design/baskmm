import { tr, loc } from "@/i18n";
import { Column, Row, Text } from "@once-ui-system/core";
import { getMetalBoard, SOURCE_URL } from "@/lib/metals";
import { getMetalHistory, getRates } from "@/lib/data";
import MetalStudio from "./MetalStudio";

const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(loc(), { day: "numeric", month: "short" });
const daysOld = (iso: string) => Math.floor((Date.now() - new Date(iso + "T00:00:00").getTime()) / 86400000);

/** A row of metal price cards for the home page. Prices change once a day. */
export default async function MetalPrices() {
  const [board, rows, rates] = await Promise.all([getMetalBoard(), getMetalHistory().catch(() => []), getRates()]);
  const history: Record<string, { date: string; price: number }[]> = {};
  for (const r of [...rows].sort((a, b) => a.price_date.localeCompare(b.price_date))) (history[r.metal] ??= []).push({ date: r.price_date, price: r.price });
  const usdKzt = rates?.rates.find((r) => r.code === "USD")?.rate ?? null;
  if (board.quotes.length === 0) {
    return (
      <Text variant="body-default-s" onBackground="neutral-weak">{tr("Цены на металлы сейчас недоступны")}{board.error ? `: ${board.error}` : ""}{tr(". Попробуйте обновить страницу позже.")}</Text>
    );
  }
  const latest = board.quotes.map((q) => q.date).sort().at(-1)!;
  const stale = daysOld(latest) > 4;

  return (
    <Column gap="8">
      <MetalStudio quotes={board.quotes.map(({ match: _m, ...q }) => q)} history={history} usdKzt={usdKzt} />
      <Row wrap gap="8">
        <Text variant="body-default-xs" onBackground="neutral-weak">{tr("Официальные цены Лондонской биржи металлов (LME, наличные) и London Fixing по золоту, источник:")}{" "}
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
            Westmetall
          </a>{tr(". Обновляются раз в рабочий день; изменение указано к предыдущей записанной дате.")}</Text>
        {stale && (
          <Text variant="body-default-xs" onBackground="warning-strong">{tr("Внимание: последние цены от")}{" "}{fmtDate(latest)}{tr(", источник давно не обновлялся.")}</Text>
        )}
      </Row>
    </Column>
  );
}

export function MetalPricesSkeleton() {
  return (
    <div className="metal-row" aria-hidden>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="metal-card is-loading" />
      ))}
    </div>
  );
}
