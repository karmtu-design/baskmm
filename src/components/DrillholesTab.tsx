"use client";

import { tr, loc } from "@/i18n";

import dynamic from "next/dynamic";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Column, Heading, Row, Tag, Text } from "@once-ui-system/core";
import { bestIntercept, elementsOf, gradeBreaks, GRADE_COLORS } from "@/lib/drill";
import { downloadDrillWorkbook, readDrillWorkbook, type HoleImport } from "@/lib/drillExcel";
import type { Contour, Drillhole } from "@/lib/types";
import { saveDrillholes } from "@/app/(app)/actions";

const Viewer = dynamic(() => import("./DrillholeViewerInner"), {
  ssr: false,
  loading: () => <div className="drill-shell" style={{ height: 560, display: "grid", placeItems: "center" }}>{tr("Загружается 3D-вид…")}</div>,
});

const fmt = (n: number, d = 2) => n.toLocaleString(loc(), { maximumFractionDigits: d, minimumFractionDigits: d });

export default function DrillholesTab({
  license,
  holes,
}: {
  license: { id: number; deposit_name: string | null; license_number: string; contour: Contour | null };
  holes: Drillhole[];
}) {
  const router = useRouter();
  const elements = useMemo(() => elementsOf(holes), [holes]);
  const [element, setElement] = useState(elements[0] ?? "");
  const breaks = useMemo(() => gradeBreaks(holes, element), [holes, element]);
  const unit = holes.flatMap((h) => h.drill_intervals).find((i) => i.element === element)?.unit ?? "";
  const [cutoffText, setCutoffText] = useState("");
  const cutoff = Number((cutoffText || String(breaks[1] ?? 0)).replace(",", ".")) || 0;
  const [onlyOre, setOnlyOre] = useState(false);
  const [vex, setVex] = useState("2");

  const [parsed, setParsed] = useState<{ holes: HoleImport[]; errors: string[] } | null>(null);
  const [removeTest, setRemoveTest] = useState(true);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const hasTest = holes.some((h) => h.is_test);

  async function onFile(f: File) {
    setMsg("");
    try {
      setParsed(await readDrillWorkbook(f));
    } catch (e) {
      setParsed({ holes: [], errors: [tr("Файл не открылся как Excel (.xlsx): {0}", { 0: (e as Error).message })] });
    }
  }
  function upload() {
    if (!parsed?.holes.length) return;
    start(async () => {
      const r = await saveDrillholes(license.id, parsed.holes, removeTest && hasTest);
      setMsg(r.ok ? tr("Загружено скважин: {0}.", { 0: r.saved }) : tr("Загружено {0}, есть ошибки: {1}", { 0: r.saved, 1: r.message }));
      if (r.saved) {
        setParsed(null);
        router.refresh();
      }
    });
  }

  const stats = holes.map((h) => ({
    h,
    best: element ? bestIntercept(h.drill_intervals, element, cutoff) : null,
    max: Math.max(0, ...h.drill_intervals.filter((i) => i.element === element && i.grade != null).map((i) => i.grade!)),
  }));

  return (
    <Column gap="24">
      {holes.length === 0 ? (
        <Column background="surface" border radius="l" padding="24" gap="8" style={{ borderStyle: "dashed" }}>
          <Heading as="h3" variant="heading-strong-m">{tr("По этому участку скважин пока нет")}</Heading>
          <Text variant="body-default-s" onBackground="neutral-weak">{tr("Загрузите их из Excel ниже: устья скважин, азимут, угол и глубину, а также интервалы опробования. После загрузки здесь появится объёмный вид стволов с окраской по содержанию.")}</Text>
        </Column>
      ) : (
        <>
          {hasTest && (
            <Row background="warning-alpha-weak" border="warning-alpha-medium" radius="l" padding="12">
              <Text variant="body-default-s">{tr("Сейчас показаны тестовые скважины для демонстрации. Загрузите реальные данные из Excel.")}</Text>
            </Row>
          )}
          <Row wrap gap="12" vertical="center">
            <label className="field-label" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{tr("Элемент")}<select className="field" value={element} onChange={(e) => setElement(e.target.value)} style={{ width: "auto", minHeight: 36 }}>
                {elements.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </label>
            <label className="field-label" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{tr("Бортовое содержание")}{unit ? `, ${unit}` : ""}
              <input
                className="field"
                inputMode="decimal"
                placeholder={fmt(breaks[1] ?? 0, 2)}
                value={cutoffText}
                onChange={(e) => setCutoffText(e.target.value)}
                style={{ width: 90, minHeight: 36 }}
              />
            </label>
            <Checkbox label={tr("Только интервалы выше борта")} checked={onlyOre} onToggle={setOnlyOre} />
            <label className="field-label" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{tr("Растянуть по глубине")}<select className="field" value={vex} onChange={(e) => setVex(e.target.value)} style={{ width: "auto", minHeight: 36 }}>
                <option value="1">{tr("нет")}</option>
                <option value="2">{tr("в 2 раза")}</option>
                <option value="3">{tr("в 3 раза")}</option>
              </select>
            </label>
            <Row gap="8" vertical="center" style={{ marginLeft: "auto" }} textVariant="body-default-xs" onBackground="neutral-weak">
              {GRADE_COLORS.map((c, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span aria-hidden style={{ width: 14, height: 6, borderRadius: 2, background: `rgb(${c.join(",")})` }} />
                  {i === 0 ? tr("до {0}", { 0: fmt(breaks[0]) }) : i === 4 ? `> ${fmt(breaks[3])}` : `${fmt(breaks[i - 1])}–${fmt(breaks[i])}`}
                </span>
              ))}
            </Row>
          </Row>

          <Viewer holes={holes} contour={license.contour} element={element} cutoff={cutoff} onlyOre={onlyOre} exaggeration={Number(vex)} />

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{tr("Скважина")}</th>
                  <th>{tr("Год")}</th>
                  <th>{tr("Глубина, м")}</th>
                  <th>{tr("Азимут / угол")}</th>
                  <th>{tr("Макс.")}{" "}{element}</th>
                  <th>{tr("Лучший интервал выше борта")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(({ h, best, max }) => (
                  <tr key={h.id}>
                    <td>
                      {h.hole_id} {h.is_test && <Tag as="span" size="s" scheme="warning" label={tr("тест")} />}
                    </td>
                    <td>{h.year ?? "—"}</td>
                    <td>{fmt(h.depth_m, 0)}</td>
                    <td>
                      {fmt(h.azimuth_deg ?? 0, 0)}° / {fmt(h.dip_deg ?? -90, 0)}°
                    </td>
                    <td>{max ? `${fmt(max)} ${unit}` : "—"}</td>
                    <td>
                      {best
                        ? tr("{0} м @ {1} {2} {3} с {4} м", { 0: fmt(best.to - best.from, 0), 1: fmt(best.grade), 2: unit, 3: element, 4: fmt(best.from, 0) })
                        : tr("нет интервалов выше борта")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Column background="surface" border radius="l" padding="24" gap="12">
        <Heading as="h3" variant="heading-strong-m">{tr("Загрузка скважин из Excel")}</Heading>
        <Text variant="body-default-s" onBackground="neutral-weak">{tr("Два листа: «Скважины» (устье, азимут, угол, глубина) и «Интервалы» (от, до, элемент, содержание, порода). Скважина с тем же номером заменяется вместе с интервалами.")}</Text>
        <Row wrap gap="8">
          <Button variant="secondary" size="s" prefixIcon="download" onClick={() => downloadDrillWorkbook(null, "Шаблон скважин BASK.xlsx")}>{tr("Скачать шаблон")}</Button>
          {holes.length > 0 && (
            <Button
              variant="tertiary"
              size="s"
              prefixIcon="download"
              onClick={() => downloadDrillWorkbook(holes, `Скважины ${license.deposit_name || license.license_number}.xlsx`)}
            >{tr("Выгрузить скважины участка")}</Button>
          )}
        </Row>
        <input type="file" accept=".xlsx" className="field" aria-label={tr("Файл со скважинами")} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {parsed && (
          <Column gap="8">
            <Text variant="body-default-s">{tr("В файле: скважин")}{" "}{parsed.holes.length}{tr(", интервалов")}{" "}{parsed.holes.reduce((s, h) => s + h.intervals.length, 0)}.
            </Text>
            {parsed.errors.slice(0, 8).map((e) => (
              <Text key={e} variant="body-default-s" onBackground="danger-strong">
                {e}
              </Text>
            ))}
            {hasTest && <Checkbox label={tr("Удалить тестовые скважины этого участка")} checked={removeTest} onToggle={setRemoveTest} />}
            <Row>
              <Button size="s" prefixIcon="upload" onClick={upload} loading={pending} disabled={!parsed.holes.length}>
                {tr("Загрузить скважин: {0}", { 0: parsed.holes.length })}
              </Button>
            </Row>
          </Column>
        )}
        {msg && (
          <Text variant="body-default-s" role="status">
            {msg}
          </Text>
        )}
      </Column>
    </Column>
  );
}
