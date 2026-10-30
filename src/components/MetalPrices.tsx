import { tr, loc } from "@/i18n";
import { Column, Row, Text } from "@once-ui-system/core";
import { getMetalBoard, SOURCE_URL } from "@/lib/metals";

const fmtPrice = (v: number, unit: string) =>
  v.toLocaleString(loc(), { maximumFractionDigits: unit === "$/унц" || v < 100 ? 2 : 0, minimumFractionDigits: 0 });
const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(loc(), { day: "numeric", month: "short" });
const daysOld = (iso: string) => Math.floor((Date.now() - new Date(iso + "T00:00:00").getTime()) / 86400000);

/** A row of metal price cards for the home page. Prices change once a day. */
export default async function MetalPrices() {
  const board = await getMetalBoard();
  if (board.quotes.length === 0) {
    return (
      <Text variant="body-default-s" onBackground="neutral-weak">{tr("Цены на металлы сейчас недоступны")}{board.error ? `: ${board.error}` : ""}{tr(". Попробуйте обновить страницу позже.")}</Text>
    );
  }
  const latest = board.quotes.map((q) => q.date).sort().at(-1)!;
  const stale = daysOld(latest) > 4;

  return (
    <Column gap="8">
      <div className="metal-row">
        {board.quotes.map((q) => {
          const up = q.change != null && q.change > 0.00005;
          const down = q.change != null && q.change < -0.00005;
          return (
            <div key={q.key} className="metal-card" title={q.prevDate ? tr("{0}: цена на {1}, изменение к {2}", { 0: tr(q.name), 1: fmtDate(q.date), 2: fmtDate(q.prevDate) }) : tr("{0}: цена на {1}", { 0: tr(q.name), 1: fmtDate(q.date) })}>
              <div className="metal-head">
                <span className="metal-sym">{q.symbol}</span>
                <span className="metal-name">{tr(q.name)}</span>
              </div>
              <div className="metal-price">
                {fmtPrice(q.price, q.unit)} <span className="metal-unit">{tr(q.unit)}</span>
              </div>
              {q.history.length >= 3 && <Spark values={q.history} />}
              <div className={`metal-change${up ? " is-up" : down ? " is-down" : ""}`}>
                {q.change == null ? (
                  <span className="metal-muted">{fmtDate(q.date)}</span>
                ) : (
                  <>
                    {up ? "▲" : down ? "▼" : "•"} {Math.abs(q.change * 100).toLocaleString(loc(), { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%
                    <span className="metal-muted"> · {fmtDate(q.date)}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
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

/** A tiny trend line of the last recorded prices (shape only; the change is written below it). */
function Spark({ values }: { values: number[] }) {
  const w = 120,
    h = 24;
  const lo = Math.min(...values),
    hi = Math.max(...values);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)).toFixed(1)}`).join(" ");
  return (
    <svg className="metal-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
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
