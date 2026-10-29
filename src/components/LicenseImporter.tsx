"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Checkbox, Column, Heading, Row, Tag, Text } from "@once-ui-system/core";
import { downloadLicenseWorkbook, readLicenseWorkbook, type ImportRow } from "@/lib/excel";
import { formatDate } from "@/lib/types";
import { importLicenses, type ImportResult, type LicenseImportItem } from "@/app/(app)/actions";

const key = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[«»"']/g, "").replace(/\s+/g, " ").trim();

export default function LicenseImporter({
  existingNumbers,
  companyNames,
}: {
  existingNumbers: string[];
  companyNames: string[];
}) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  const existing = useMemo(() => new Set(existingNumbers), [existingNumbers]);
  const known = useMemo(() => new Set(companyNames.map(key)), [companyNames]);

  async function onFile(file: File) {
    setResult(null);
    setReading(true);
    setFileName(file.name);
    try {
      const r = await readLicenseWorkbook(file);
      setRows(r.rows);
      setProblems(r.problems);
    } catch (e) {
      setRows(null);
      setProblems([`Файл не открылся как таблица Excel (.xlsx): ${(e as Error).message}`]);
    } finally {
      setReading(false);
    }
  }

  const valid = (rows ?? []).filter((r) => r.errors.length === 0);
  const willUpdate = valid.filter((r) => existing.has(String(r.values.license_number)));
  const willCreate = valid.filter((r) => !existing.has(String(r.values.license_number)));
  const newCompanies = [...new Set(valid.map((r) => String(r.values.company_name)).filter((n) => !known.has(key(n))))];
  const toSend = updateExisting ? valid : willCreate;

  function upload() {
    const items: LicenseImportItem[] = toSend.map((r) => ({
      ...(r.values as Omit<LicenseImportItem, "contour">),
      contour: r.contour,
    }));
    start(async () => setResult(await importLicenses(items, updateExisting)));
  }

  return (
    <Column gap="24" maxWidth="xl">
      <Row gap="24" s={{ direction: "column" }}>
        <Column flex={1} background="surface" border radius="l" padding="24" gap="12">
          <Heading as="h2" variant="heading-strong-m">
            1. Возьмите шаблон
          </Heading>
          <Text variant="body-default-s" onBackground="neutral-weak">
            В шаблоне два листа: «Лицензии» (одна строка на лицензию) и «Координаты» (одна строка на угловую точку).
            Подойдёт и выгрузка из реестра: её можно поправить и загрузить обратно.
          </Text>
          <Row>
            <Button variant="secondary" prefixIcon="download" onClick={() => downloadLicenseWorkbook(null, "Шаблон лицензий BASK.xlsx")}>
              Скачать шаблон
            </Button>
          </Row>
        </Column>
        <Column flex={1} background="surface" border radius="l" padding="24" gap="12">
          <Heading as="h2" variant="heading-strong-m">
            2. Выберите заполненный файл
          </Heading>
          <Text variant="body-default-s" onBackground="neutral-weak">
            Формат .xlsx. Названия столбцов должны быть как в шаблоне, порядок может быть любым.
          </Text>
          <input
            type="file"
            accept=".xlsx"
            className="field"
            aria-label="Файл Excel"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          {reading && <Text variant="body-default-s">Читаю файл…</Text>}
        </Column>
      </Row>

      {problems.length > 0 && (
        <Column background="warning-alpha-weak" border="warning-alpha-medium" radius="l" padding="16" gap="4">
          {problems.map((p) => (
            <Text key={p} variant="body-default-s">
              {p}
            </Text>
          ))}
        </Column>
      )}

      {rows && (
        <Column gap="16">
          <Heading as="h2" variant="heading-strong-l">
            3. Проверьте, что будет загружено
          </Heading>
          <Row wrap gap="8">
            <Tag scheme="success" label={`новых: ${willCreate.length}`} />
            <Tag scheme="info" label={`обновится: ${willUpdate.length}`} />
            <Tag scheme="danger" label={`с ошибками: ${rows.length - valid.length}`} />
            <Tag scheme="neutral" label={`с контуром: ${valid.filter((r) => r.contour).length}`} />
          </Row>
          {newCompanies.length > 0 && (
            <Text variant="body-default-s">
              Будут созданы новые компании: <b>{newCompanies.join(", ")}</b>. Если это опечатка в названии, исправьте файл и
              выберите его снова.
            </Text>
          )}

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Строка</th>
                  <th>Что будет</th>
                  <th>Номер</th>
                  <th>Участок</th>
                  <th>Компания</th>
                  <th>Вид</th>
                  <th>Действует до</th>
                  <th>Контур</th>
                  <th>Замечания</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const upd = existing.has(String(r.values.license_number));
                  return (
                    <tr key={r.line}>
                      <td>{r.line}</td>
                      <td>
                        {r.errors.length ? (
                          <Tag as="span" size="s" scheme="danger" label="ошибка" />
                        ) : upd ? (
                          <Tag as="span" size="s" scheme={updateExisting ? "info" : "neutral"} label={updateExisting ? "обновится" : "пропустится"} />
                        ) : (
                          <Tag as="span" size="s" scheme="success" label="новая" />
                        )}
                      </td>
                      <td>{r.values.license_number ?? "—"}</td>
                      <td>{r.values.deposit_name ?? "—"}</td>
                      <td>{r.values.company_name ?? "—"}</td>
                      <td>{r.values.license_type ?? "—"}</td>
                      <td>{formatDate((r.values.expiry_date as string) ?? null)}</td>
                      <td>{r.contour ? `${r.contour.type === "Polygon" ? r.contour.coordinates[0].length - 1 : "несколько"} точ.` : "—"}</td>
                      <td style={{ maxWidth: 320 }}>
                        {r.errors.map((e) => (
                          <div key={e} style={{ color: "var(--danger-on-background-strong)" }}>
                            {e}
                          </div>
                        ))}
                        {r.warnings.map((w) => (
                          <div key={w} style={{ color: "var(--neutral-on-background-weak)" }}>
                            {w}
                          </div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Row wrap gap="16" vertical="center">
            <Checkbox
              label="Обновлять лицензии, номера которых уже есть в системе"
              checked={updateExisting}
              onToggle={setUpdateExisting}
            />
          </Row>
          <Row wrap gap="12" vertical="center">
            <Button prefixIcon="upload" onClick={upload} loading={pending} disabled={toSend.length === 0 || !!result?.ok}>
              {`Загрузить ${toSend.length} ${toSend.length === 1 ? "лицензию" : "лицензий"}`}
            </Button>
            {rows.length - valid.length > 0 && (
              <Text variant="body-default-s" onBackground="neutral-weak">
                Строки с ошибками будут пропущены. Исправьте их в файле {fileName} и загрузите его ещё раз.
              </Text>
            )}
          </Row>
        </Column>
      )}

      {result && (
        <Column
          background={result.ok ? "success-alpha-weak" : "warning-alpha-weak"}
          border={result.ok ? "success-alpha-medium" : "warning-alpha-medium"}
          radius="l"
          padding="16"
          gap="8"
          role="status"
        >
          <Text variant="label-strong-m">
            Готово: добавлено {result.created}, обновлено {result.updated}
            {result.skipped ? `, пропущено ${result.skipped}` : ""}.
          </Text>
          {result.companiesCreated.length > 0 && (
            <Text variant="body-default-s">Созданы компании: {result.companiesCreated.join(", ")}.</Text>
          )}
          {result.errors.map((e) => (
            <Text key={e} variant="body-default-s" onBackground="danger-strong">
              {e}
            </Text>
          ))}
          <Row>
            <Button href="/licenses" variant="secondary" size="s" suffixIcon="arrowRight">
              Открыть реестр
            </Button>
          </Row>
        </Column>
      )}
    </Column>
  );
}
