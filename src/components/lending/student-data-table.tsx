'use client';
import { StudentEmptyState } from './student-empty-state';
import type { StudentEmptyKind } from './student-empty-model';
import { useMemo, type ReactNode } from 'react';
import { useTable, type ColumnDef } from '@tanstack/react-table';
import { studentTableFeatures } from './student-table-features';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardFooter } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { StudentSelect } from './student-controls';

export type StudentColumn<T> = {
  id: string;
  title: string;
  value: (row: T) => string | number;
  cell?: (row: T) => ReactNode;
  numeric?: boolean;
  sortable?: boolean;
};
export function StudentDataTable<T extends object>({
  data,
  columns,
  recordId,
  selectedId,
  query = '',
  label,
  emptyKind = 'requests',
  filtered = false,
  onReset,
}: {
  data: T[];
  columns: StudentColumn<T>[];
  recordId: (row: T) => string;
  selectedId?: string;
  query?: string;
  label: string;
  emptyKind?: StudentEmptyKind;
  filtered?: boolean;
  onReset?: () => void;
}) {
  const definitions = useMemo(
    () =>
      columns.map((column) => ({
        id: column.id,
        accessorFn: column.value,
        header: column.title,
        sortFn: column.numeric ? 'basic' : 'alphanumeric',
        filterFn: 'includesString',
        enableSorting: column.sortable !== false,
        cell: ({ row }: { row: { original: T } }) =>
          column.cell?.(row.original) ?? column.value(row.original),
      })) as ColumnDef<typeof studentTableFeatures, T>[],
    [columns]
  );
  const table = useTable({
    features: studentTableFeatures,
    data,
    columns: definitions,
    getRowId: recordId,
    state: { columnFilters: query ? [{ id: columns[0].id, value: query }] : [] },
  });
  if (!table.getFilteredRowModel().rows.length)
    return (
      <StudentEmptyState
        kind={emptyKind}
        filtered={filtered || Boolean(query)}
        onReset={() => {
          table.resetColumnFilters();
          table.setPageIndex(0);
          onReset?.();
        }}
      />
    );
  return (
    <>
      <div className="student-result-bar">
        <span>{table.getFilteredRowModel().rows.length} matching records</span>
        <label>
          Sort by
          <StudentSelect
            value={table.state.sorting[0]?.id ?? ''}
            onChange={(event) =>
              table.setSorting(event.target.value ? [{ id: event.target.value, desc: false }] : [])
            }
          >
            <option value="">Original order</option>
            {columns
              .filter((column) => column.sortable !== false)
              .map((column) => (
                <option key={column.id} value={column.id}>
                  {column.title}
                </option>
              ))}
          </StudentSelect>
        </label>
      </div>
      <div
        className="table-region"
        role="region"
        aria-label={label + '; horizontal scrolling available'}
        tabIndex={0}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      header.column.getIsSorted() === 'asc'
                        ? 'ascending'
                        : header.column.getIsSorted() === 'desc'
                          ? 'descending'
                          : 'none'
                    }
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <table.FlexRender header={header} />
                        <ArrowUpDown size={12} />
                      </Button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={selectedId === row.id ? 'selected' : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <CardFooter className="pagination">
        <span>{table.getFilteredRowModel().rows.length} matching records</span>
        <label>
          Rows per page
          <StudentSelect
            value={table.state.pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {[10, 20, 50].map((size) => (
              <option key={size}>{size}</option>
            ))}
          </StudentSelect>
        </label>
        <Button
          variant="outline"
          size="sm"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        >
          Previous
        </Button>
        <span>
          Page {table.state.pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
        </span>
        {Array.from(
          { length: Math.min(5, Math.max(1, table.getPageCount())) },
          (_, i) =>
            Math.min(
              Math.max(0, table.state.pagination.pageIndex - 2),
              Math.max(0, table.getPageCount() - 5)
            ) + i
        ).map((index) => (
          <Button
            key={index}
            variant={table.state.pagination.pageIndex === index ? 'secondary' : 'outline'}
            size="sm"
            aria-label={`Page ${index + 1}`}
            aria-current={table.state.pagination.pageIndex === index ? 'page' : undefined}
            onClick={() => table.setPageIndex(index)}
          >
            {index + 1}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
        >
          Next
        </Button>
      </CardFooter>
    </>
  );
}
