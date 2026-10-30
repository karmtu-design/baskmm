"use client";

import { tr } from "@/i18n";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { latin, searchable } from "@/lib/translit";
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
  type ColumnVisibilityState,
  type RowData,
} from "@tanstack/react-table";
import { Icon, Row, Text } from "@once-ui-system/core";

/** The table behaviours used across the site: sorting by any column, search across all, hiding columns. */
export const tableFeatureSet = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, datetime: sortFn_datetime },
  filterFns: { includesString: filterFn_includesString },
});
type F = typeof tableFeatureSet;
export type DataColumn<T extends RowData> = ColumnDef<F, T, any> & { meta?: { label?: string; hideable?: boolean } };

export default function DataTable<T extends RowData>({
  data,
  columns,
  search,
  initialSorting = [],
  initialHidden = {},
  toolbar,
  rowsRef,
  emptyText,
  searchText,
}: {
  data: T[];
  columns: DataColumn<T>[];
  search: string;
  initialSorting?: SortingState;
  initialHidden?: ColumnVisibilityState;
  toolbar?: React.ReactNode;
  /** filled with the rows as currently filtered and sorted, e.g. for export */
  rowsRef?: React.RefObject<T[]>;
  emptyText?: string;
  /** the text a row is found by; by default all its text and number fields */
  searchText?: (row: T) => string;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(initialHidden);

  // search: each word of the query must match, in Cyrillic or Latin, forgiving a typo or two (Fuse.js)
  const texts = useMemo(() => data.map((row) => searchable((searchText ?? defaultText)(row))), [data, searchText]);
  const index = useMemo(
    () =>
      new Fuse(
        texts.map((text, i) => ({ i, text })),
        { keys: ["text"], threshold: 0.3, ignoreLocation: true, minMatchCharLength: 2, includeScore: false }
      ),
    [texts]
  );
  const shown = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    if (!words.length) return data;
    let keep: Set<number> | null = null;
    for (const w of words) {
      // short words (Au, Cu, 12…) must match exactly; longer ones may have a typo
      // the word as typed and in Latin letters: «байжер» also finds «Baijer»
      const hit = new Set<number>();
      for (const v of new Set([w, latin(w)]))
        for (const i of v.length < 4 ? texts.flatMap((t, i) => (t.includes(v) ? [i] : [])) : index.search(v).map((r) => r.item.i)) hit.add(i);
      const prev: Set<number> | null = keep;
      keep = prev ? new Set([...prev].filter((i: number) => hit.has(i))) : hit;
    }
    return data.filter((_, i) => keep!.has(i));
  }, [data, texts, index, search]);

  const table = useTable({
    features: tableFeatureSet,
    columns,
    data: shown,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    enableSortingRemoval: true,
  });

  const rows = table.getRowModel().rows;
  if (rowsRef) rowsRef.current = rows.map((r) => r.original);
  const hideable = table.getAllLeafColumns().filter((c) => (c.columnDef as DataColumn<T>).meta?.hideable !== false);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Row wrap gap="8" vertical="center">
        {toolbar}
        <details className="col-menu">
          <summary>
            <Icon name="adjustments" size="s" />{" "}{tr("Столбцы")}</summary>
          <div className="col-menu-list">
            {hideable.map((c) => (
              <label key={c.id}>
                <input type="checkbox" checked={c.getIsVisible()} onChange={() => c.toggleVisibility()} />
                {(c.columnDef as DataColumn<T>).meta?.label ?? c.id}
              </label>
            ))}
          </div>
        </details>
      </Row>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th key={header.id} aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button type="button" className="sort-btn" onClick={header.column.getToggleSortingHandler()}>
                          <table.FlexRender header={header} />
                          <span aria-hidden className="sort-mark">
                            {sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : "↕"}
                          </span>
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={table.getVisibleLeafColumns().length}>
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    {emptyText ?? tr("Ничего не найдено. Измените условия поиска.")}
                  </Text>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Text variant="body-default-xs" onBackground="neutral-weak">{tr("Строк:")}{" "}{rows.length}{" "}{tr("из")}{" "}{data.length}{tr(". Нажмите на заголовок столбца, чтобы отсортировать.")}</Text>
    </div>
  );
}

function defaultText(row: unknown): string {
  return Object.values(row as Record<string, unknown>)
    .filter((v) => typeof v === "string" || typeof v === "number")
    .join(" ");
}
