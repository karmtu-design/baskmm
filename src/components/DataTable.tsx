"use client";

import { tr } from "@/i18n";

import { useState } from "react";
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
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(initialHidden);

  const table = useTable({
    features: tableFeatureSet,
    columns,
    data,
    state: { sorting, columnVisibility, globalFilter: search },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: "includesString",
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
