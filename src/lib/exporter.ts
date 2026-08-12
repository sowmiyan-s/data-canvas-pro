import * as XLSX from "xlsx";
import type { Row } from "./vault";

export type ExportColumn = {
  id: string;
  /** source column key in the dataset; null for injected blank columns */
  key: string | null;
  label: string;
  include: boolean;
};

export function buildExportColumns(columns: string[]): ExportColumn[] {
  return columns.map((c) => ({ id: c, key: c, label: c, include: true }));
}

export function buildMatrix(rows: Row[], cols: ExportColumn[]) {
  const active = cols.filter((c) => c.include);
  const header = active.map((c) => c.label);
  const body = rows.map((r) => active.map((c) => (c.key ? (r[c.key] ?? "") : "")));
  return { header, body, active };
}

export function exportFile(
  rows: Row[],
  cols: ExportColumn[],
  fileName: string,
  format: "xlsx" | "csv",
) {
  const { header, body } = buildMatrix(rows, cols);
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  ws["!cols"] = header.map((h) => ({ wch: Math.min(40, Math.max(12, String(h).length + 4)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  XLSX.writeFile(wb, `${fileName}.${format}`, { bookType: format });
}
