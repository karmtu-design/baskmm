"use client";

import { createPortal } from "react-dom";

// Word (.docx) and Excel (.xlsx, .csv) files opened on top of the page, like PDFs: read in the browser,
// nothing is installed and nothing is sent anywhere. Old .doc/.xls cannot be read this way.
import { useEffect, useState } from "react";
import { tr } from "@/i18n";

type Sheet = { name: string; rows: string[][]; more: number };
const MAX_ROWS = 1000;
const MAX_COLS = 40;

async function readDocx(buf: ArrayBuffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
  const DOMPurify = (await import("dompurify")).default;
  return DOMPurify.sanitize(value, { USE_PROFILES: { html: true }, FORBID_TAGS: ["style", "form", "input"], ADD_ATTR: ["target"] });
}

async function readXlsx(buf: ArrayBuffer): Promise<Sheet[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb.worksheets.map((ws) => {
    const rows: string[][] = [];
    const cols = Math.min(MAX_COLS, ws.columnCount);
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      if (n > MAX_ROWS) return;
      rows.push(Array.from({ length: cols }, (_, i) => row.getCell(i + 1).text ?? ""));
    });
    return { name: ws.name, rows, more: Math.max(0, ws.rowCount - MAX_ROWS) };
  });
}

function readCsv(text: string): Sheet[] {
  const sep = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let cell = "",
    row: string[] = [],
    q = false;
  for (let i = 0; i < text.length && rows.length < MAX_ROWS; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) row.push(cell), (cell = "");
    else if (c === "\n") row.push(cell.replace(/\r$/, "")), rows.push(row), (row = []), (cell = "");
    else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return [{ name: "CSV", rows, more: 0 }];
}

export default function OfficeViewer({ url, fileName, title, onClose, onDownload }: { url: string; fileName: string; title: string; onClose: () => void; onDownload?: () => void }) {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  const [html, setHtml] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [tab, setTab] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      if (ext === "docx") {
        const h = await readDocx(await res.arrayBuffer());
        if (alive) setHtml(h);
      } else if (ext === "csv" || ext === "txt") {
        const s = ext === "csv" ? readCsv(await res.text()) : null;
        if (alive) s ? setSheets(s) : setHtml(`<pre>${(await res.text()).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</pre>`);
      } else {
        const s = await readXlsx(await res.arrayBuffer());
        if (alive) setSheets(s);
      }
    })().catch((e) => alive && setErr(tr("Файл не открылся: {0}", { 0: (e as Error).message })));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [url, ext, onClose]);

  const sheet = sheets?.[tab];
  // on top of everything, outside the page layout (the fixed header would otherwise cover the toolbar)
  return createPortal(
    <div className="pdf-overlay" role="dialog" aria-modal="true" aria-label={tr("Просмотр: {0}", { 0: title })}>
      <div className="pdf-bar">
        <span className="pdf-title" title={title}>
          {title}
        </span>
        <div className="pdf-tools">
          {onDownload && (
            <button type="button" className="chip" onClick={onDownload}>
              {tr("Скачать")}
            </button>
          )}
          <button type="button" className="nav-close" onClick={onClose} aria-label={tr("Закрыть")}>
            ×
          </button>
        </div>
      </div>
      <div className="pdf-stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {err ? (
          <p className="office-msg">{err}</p>
        ) : html != null ? (
          <article className="office-doc" dangerouslySetInnerHTML={{ __html: html }} />
        ) : sheet ? (
          <div className="office-sheet">
            {sheets!.length > 1 && (
              <div className="chip-row" role="tablist">
                {sheets!.map((s, i) => (
                  <button key={s.name + i} type="button" role="tab" aria-selected={i === tab} className={`chip${i === tab ? " is-on" : ""}`} onClick={() => setTab(i)}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            <div className="office-table-wrap">
              <table className="office-table">
                <tbody>
                  {sheet.rows.map((r, i) => (
                    <tr key={i}>
                      <th>{i + 1}</th>
                      {r.map((c, j) => (
                        <td key={j}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sheet.more > 0 && <p className="office-msg">{tr("Показаны первые {0} строк, ещё {1} — в скачанном файле.", { 0: MAX_ROWS, 1: sheet.more })}</p>}
          </div>
        ) : (
          <p className="office-msg">{tr("Открываю файл…")}</p>
        )}
      </div>
    </div>,
    document.body
  );
}

export const officeViewable = (name: string) => ["docx", "xlsx", "csv", "txt"].includes((name.split(".").pop() ?? "").toLowerCase());
