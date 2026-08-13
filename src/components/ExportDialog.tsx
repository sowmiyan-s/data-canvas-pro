import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Plus,
  Trash2,
  Columns3,
  ListFilter,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildExportColumns, buildMatrix, exportFile, type ExportColumn } from "@/lib/exporter";
import type { Row } from "@/lib/vault";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasetName: string;
  columns: string[];
  filteredRows: Row[];
  selectedRows: Row[];
};

export function ExportDialog({
  open,
  onOpenChange,
  datasetName,
  columns,
  filteredRows,
  selectedRows,
}: Props) {
  const [cols, setCols] = useState<ExportColumn[]>(() => buildExportColumns(columns));
  const [source, setSource] = useState<"filtered" | "selected">("selected");
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [fileName, setFileName] = useState(`${datasetName}-export`);

  useEffect(() => {
    setCols((prev) => {
      const keys = new Set(prev.map((c) => c.key));
      if (columns.every((c) => keys.has(c)) && prev.length) return prev;
      return buildExportColumns(columns);
    });
  }, [columns]);

  useEffect(() => {
    if (selectedRows.length === 0) setSource("filtered");
  }, [selectedRows.length]);

  const rows = source === "selected" ? selectedRows : filteredRows;
  const preview = useMemo(() => buildMatrix(rows.slice(0, 5), cols), [rows, cols]);
  const includedCount = cols.filter((c) => c.include).length;

  const patch = (id: string, next: Partial<ExportColumn>) =>
    setCols((cs) => cs.map((c) => (c.id === id ? { ...c, ...next } : c)));

  const move = (id: string, delta: number) =>
    setCols((cs) => {
      const from = cs.findIndex((c) => c.id === id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= cs.length) return cs;
      const next = [...cs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });

  /** Inserts an empty column at `index` (end of list when index === cols.length). */
  const insertBlank = (index: number) =>
    setCols((cs) => {
      const next = [...cs];
      next.splice(index, 0, {
        id: `blank-${Date.now()}-${index}`,
        key: null,
        label: "Signature",
        include: true,
      });
      return next;
    });

  const doExport = () => {
    if (rows.length === 0) {
      toast.error("No rows to export");
      return;
    }
    if (includedCount === 0) {
      toast.error("Include at least one column");
      return;
    }
    exportFile(rows, cols, fileName || "export", format);
    toast.success(`Exported ${rows.length} rows — stored data untouched`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            Configure top to bottom, check the preview, then download. Nothing here changes your
            stored file.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-5">
          {/* Step 1 — what to export */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ListFilter className="size-4 text-primary" /> 1. What to export
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Rows</Label>
                <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="selected">Selected rows ({selectedRows.length})</SelectItem>
                    <SelectItem value="filtered">Filtered view ({filteredRows.length})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                    <SelectItem value="csv">CSV (.csv)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">File name</Label>
                <Input
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </section>

          {/* Step 2 — columns */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Columns3 className="size-4 text-primary" /> 2. Columns
                <span className="font-normal text-muted-foreground">
                  ({includedCount} included)
                </span>
              </h3>
              <Button size="sm" variant="outline" onClick={() => insertBlank(cols.length)}>
                <Plus className="mr-1 size-3.5" /> Empty column at end
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Untick to exclude, type to rename the header, use the arrows to reorder, and “+” to
              insert an empty column above that position.
            </p>
            <div className="space-y-1 rounded-lg border p-2">
              {cols.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5"
                >
                  <span className="w-6 shrink-0 text-center text-[11px] text-muted-foreground tabular">
                    {i + 1}
                  </span>
                  <input
                    type="checkbox"
                    checked={c.include}
                    onChange={(e) => patch(c.id, { include: e.target.checked })}
                    className="size-3.5 accent-[var(--primary)]"
                    aria-label={`Include ${c.label}`}
                  />
                  <Input
                    value={c.label}
                    onChange={(e) => patch(c.id, { label: e.target.value })}
                    className="h-7 flex-1 text-sm"
                  />
                  <span className="hidden w-28 shrink-0 truncate text-right text-[11px] text-muted-foreground sm:block">
                    {c.key ?? "empty column"}
                  </span>
                  <div className="flex shrink-0 items-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      title="Move up"
                      onClick={() => move(c.id, -1)}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      title="Move down"
                      onClick={() => move(c.id, 1)}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      title="Insert empty column here"
                      onClick={() => insertBlank(i)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      title={c.key ? "Exclude column" : "Remove empty column"}
                      onClick={() =>
                        c.key
                          ? patch(c.id, { include: false })
                          : setCols((cs) => cs.filter((x) => x.id !== c.id))
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Step 3 — preview */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Download className="size-4 text-primary" /> 3. Preview — first 5 of {rows.length} rows
            </h3>
            <div className="max-h-64 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/90">
                  <tr>
                    {preview.header.map((h, i) => (
                      <th key={i} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.body.map((r, i) => (
                    <tr key={i} className="border-t">
                      {r.map((cell, j) => (
                        <td key={j} className="whitespace-nowrap px-3 py-1.5 tabular">
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {preview.body.length === 0 && (
                    <tr>
                      <td
                        className="px-3 py-4 text-muted-foreground"
                        colSpan={preview.header.length || 1}
                      >
                        No rows in the chosen source.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          <p className="text-xs text-muted-foreground">
            {rows.length} rows × {includedCount} columns
          </p>
          <Button onClick={doExport}>
            <Download className="mr-1.5 size-4" /> Download {format.toUpperCase()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
