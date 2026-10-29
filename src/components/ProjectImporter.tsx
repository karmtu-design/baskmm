"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Checkbox, Column, Heading, Row, Tag, Text } from "@once-ui-system/core";
import { downloadProjectWorkbook, readProjectWorkbook, type ProjectImportRow } from "@/lib/projectsExcel";
import { formatDate } from "@/lib/types";
import { importProjects, type ProjectImportResult } from "@/app/(app)/projects/actions";

export default function ProjectImporter({ existingNames }: { existingNames: string[] }) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ProjectImportRow[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [result, setResult] = useState<ProjectImportResult | null>(null);
  const [pending, start] = useTransition();
  const existing = useMemo(() => new Set(existingNames.map((n) => n.trim().toLowerCase())), [existingNames]);

  async function onFile(file: File) {
    setResult(null);
    setReading(true);
    setFileName(file.name);
    try {
      const r = await readProjectWorkbook(file);
      setRows(r.rows);
      setProblems(r.problems);
    } catch (e) {
      setRows(null);
      setProblems([`Файл не открылся как таблица Excel (.xlsx): ${(e as Error).message}`]);
    } finally {
      setReading(false);
    }
  }

  const isOld = (r: ProjectImportRow) => existing.has(String(r.values.name ?? "").trim().toLowerCase());
  const valid = (rows ?? []).filter((r) => r.errors.length === 0);
  const willUpdate = valid.filter(isOld);
  const willCreate = valid.filter((r) => !isOld(r));
  const toSend = updateExisting ? valid : willCreate;

  function upload() {
    start(async () => setResult(await importProjects(toSend.map((r) => r.values), updateExisting)));
  }

  return (
    <Column gap="24">
      <Row gap="24" s={{ direction: "column" }}>
        <Column flex={1} background="surface" border radius="l" padding="24" gap="12">
          <Heading as="h2" variant="heading-strong-m">
            1. Возьмите шаблон
          </Heading>
          <Text variant="body-default-s" onBackground="neutral-weak">
            Один лист «Проекты», одна строка на проект. Подойдёт и выгрузка со страницы проектов: её можно поправить и
            загрузить обратно.
          </Text>
          <Row>
            <Button variant="secondary" prefixIcon="download" onClick={() => downloadProjectWorkbook(null, "Шаблон потенциальных проектов BASK.xlsx")}>
              Скачать шаблон
            </Button>
          </Row>
        </Column>
        <Column flex={1} background="surface" border radius="l" padding="24" gap="12">
          <Heading as="h2" variant="heading-strong-m">
            2. Выберите заполненный файл
          </Heading>
          <Text variant="body-default-s" onBackground="neutral-weak">
            Формат .xlsx. Названия столбцов как в шаблоне, порядок любой. Обязателен только столбец «Название проекта».
          </Text>
          <input type="file" accept=".xlsx" className="field" aria-label="Файл Excel" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
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

      {rows && rows.length > 0 && (
        <Column gap="16">
          <Heading as="h2" variant="heading-strong-l">
            3. Проверьте, что будет загружено
          </Heading>
          <Row wrap gap="8">
            <Tag scheme="success" label={`новых: ${willCreate.length}`} />
            <Tag scheme="info" label={`обновится: ${willUpdate.length}`} />
            <Tag scheme="danger" label={`с ошибками: ${rows.length - valid.length}`} />
          </Row>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Строка</th>
                  <th>Что будет</th>
                  <th>Проект</th>
                  <th>Полезное ископаемое</th>
                  <th>Область</th>
                  <th>Этап</th>
                  <th>Срок шага</th>
                  <th>Замечания</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const upd = isOld(r);
                  return (
                    <tr key={r.line}>
                      <td>{r.line}</td>
                      <td>
                        {r.errors.length ? (
                          <Tag as="span" size="s" scheme="danger" label="ошибка" />
                        ) : upd ? (
                          <Tag as="span" size="s" scheme={updateExisting ? "info" : "neutral"} label={updateExisting ? "обновится" : "пропустится"} />
                        ) : (
                          <Tag as="span" size="s" scheme="success" label="новый" />
                        )}
                      </td>
                      <td>{r.values.name ?? "—"}</td>
                      <td>{r.values.commodity ?? "—"}</td>
                      <td>{r.values.region ?? "—"}</td>
                      <td>{r.values.stage ?? "—"}</td>
                      <td>{formatDate((r.values.next_date as string) ?? null)}</td>
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
          <Checkbox label="Обновлять проекты, названия которых уже есть в системе" checked={updateExisting} onToggle={setUpdateExisting} />
          <Row wrap gap="12" vertical="center">
            <Button prefixIcon="upload" onClick={upload} loading={pending} disabled={toSend.length === 0 || !!result?.ok}>
              {`Загрузить проектов: ${toSend.length}`}
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
          {result.errors.map((e) => (
            <Text key={e} variant="body-default-s" onBackground="danger-strong">
              {e}
            </Text>
          ))}
          <Row>
            <Button href="/projects" variant="secondary" size="s" suffixIcon="arrowRight">
              Открыть проекты
            </Button>
          </Row>
        </Column>
      )}
    </Column>
  );
}
