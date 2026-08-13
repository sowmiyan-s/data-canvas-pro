import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
} from "ag-grid-community";
import {
  ArrowLeft,
  Search,
  Save,
  FilterX,
  Download,
  Loader2,
  Trash2,
  CircleDot,
  CheckCircle2,
  Heading,
  Eye,
  Pencil,
  ListFilter,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { SetFilter } from "@/components/grid/SetFilter";
import { ExportDialog } from "@/components/ExportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ROW_ID,
  applyHeaderRow,
  distinctCount,
  getDataset,
  isNumericColumn,
  loadWorkingRows,
  overwriteOriginal,
  saveWorkingRows,
  type Dataset,
  type Row,
} from "@/lib/vault";

ModuleRegistry.registerModules([AllCommunityModule]);

const gridTheme = themeQuartz.withParams({
  accentColor: "var(--primary)",
  browserColorScheme: "light",
  borderRadius: 6,
  fontFamily: "var(--font-sans)",
  headerBackgroundColor: "oklch(0.955 0.006 250)",
  headerFontWeight: 600,
  oddRowBackgroundColor: "oklch(0.99 0.003 250)",
  rowHeight: 34,
  headerHeight: 38,
  spacing: 6,
});

type Mode = "edit" | "filter";

export const Route = createFileRoute("/_authenticated/grid/$id")({
  head: () => ({
    meta: [
      { title: "Grid workspace — GridVault" },
      {
        name: "description",
        content:
          "Edit cells and delete rows in the edit section, set any row as the header row, or filter, select, preview and export rows.",
      },
      { property: "og:title", content: "Grid workspace — GridVault" },
      {
        property: "og:description",
        content: "Edit, filter, select, preview and export spreadsheet rows in one workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GridPage,
});

function GridPage() {
  const { id } = Route.useParams();
  const gridRef = useRef<AgGridReact<Row>>(null);
  const apiRef = useRef<GridApi<Row> | null>(null);

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("edit");
  const [quickFilter, setQuickFilter] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterActive, setFilterActive] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [selected, setSelected] = useState<Row[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmHeader, setConfirmHeader] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ds = await getDataset(id);
        setDataset(ds);
        setRows(await loadWorkingRows(ds));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not open dataset");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const columns = dataset?.columns ?? [];

  const columnDefs = useMemo<ColDef<Row>[]>(() => {
    if (!dataset) return [];
    return dataset.columns.map((col, i) => {
      const numeric = isNumericColumn(rows, col);
      const categorical = !numeric && distinctCount(rows, col) <= 200;
      const def: ColDef<Row> = {
        field: col,
        headerName: col,
        editable: mode === "edit",
        sortable: true,
        resizable: true,
        minWidth: 130,
        flex: 1,
        filter:
          mode === "filter"
            ? numeric
              ? "agNumberColumnFilter"
              : categorical
                ? SetFilter
                : "agTextColumnFilter"
            : false,
      };
      if (numeric) def.type = "numericColumn";
      if (i === 0) def.minWidth = 180;
      return def;
    });
  }, [dataset, rows, mode]);

  const refreshStatus = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    setVisibleCount(api.getDisplayedRowCount());
    setSelected(api.getSelectedRows());
    setFilterActive(api.isAnyFilterPresent());
  }, []);

  const onGridReady = (e: GridReadyEvent<Row>) => {
    apiRef.current = e.api;
    refreshStatus();
  };

  const persist = useCallback(
    async (nextRows: Row[], nextColumns: string[]) => {
      if (!dataset) return;
      setSaving(true);
      try {
        await saveWorkingRows(dataset, nextRows);
        await overwriteOriginal(dataset, nextRows, nextColumns);
        setDataset({ ...dataset, columns: nextColumns, row_count: nextRows.length });
        setDirty(false);
        toast.success("Saved — the stored spreadsheet was overwritten");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [dataset],
  );

  const save = useCallback(() => void persist(rows, columns), [persist, rows, columns]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const filteredRows = useCallback(() => {
    const api = apiRef.current;
    if (!api) return rows;
    const out: Row[] = [];
    api.forEachNodeAfterFilterAndSort((n) => n.data && out.push(n.data));
    return out;
  }, [rows]);

  const deleteSelected = () => {
    const ids = new Set(selected.map((r) => String(r[ROW_ID])));
    const next = rows.filter((r) => !ids.has(String(r[ROW_ID])));
    setRows(next);
    setSelected([]);
    setDirty(true);
    setConfirmDelete(false);
    toast.success(`${ids.size} row${ids.size === 1 ? "" : "s"} deleted — press Save to persist`);
  };

  const setAsHeader = () => {
    const target = selected[0];
    if (!target) return;
    try {
      const next = applyHeaderRow(rows, columns, String(target[ROW_ID]));
      setRows(next.rows);
      if (dataset) setDataset({ ...dataset, columns: next.columns });
      setSelected([]);
      setDirty(true);
      apiRef.current?.setFilterModel(null);
      toast.success("Header row applied — press Save to persist");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set header row");
    } finally {
      setConfirmHeader(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Dataset not found.</p>
          <Link to="/vault" className="mt-3 inline-block text-sm text-primary hover:underline">
            Back to vault
          </Link>
        </div>
      </div>
    );
  }

  const previewCols = columns.slice(0, 12);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      <AppHeader>
        <div className="flex items-center gap-3">
          <Link to="/vault" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
          </Link>
          <span className="truncate text-sm font-medium">{dataset.name}</span>
          <Badge variant="secondary">{dataset.tag}</Badge>
          {dirty ? (
            <span className="flex items-center gap-1 text-xs text-warning">
              <CircleDot className="size-3" /> Unsaved changes
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3 text-success" /> All changes saved
            </span>
          )}
        </div>
      </AppHeader>

      {/* Section switcher */}
      <div className="flex items-center gap-2 border-b bg-card px-4 pt-2.5">
        {(
          [
            { key: "edit", label: "Edit database", icon: Pencil },
            { key: "filter", label: "Filter & export", icon: ListFilter },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setMode(t.key);
              apiRef.current?.setFilterModel(null);
              setQuickFilter("");
            }}
            className={`-mb-px flex items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-2 text-sm font-medium transition-colors ${
              mode === t.key
                ? "border-border bg-surface text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Section toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2.5">
        {mode === "edit" ? (
          <>
            <p className="text-xs text-muted-foreground">
              Double-click a cell to edit. Ctrl+Z / Ctrl+Y undo & redo, Ctrl+S saves and overwrites
              the stored spreadsheet.
            </p>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular">
                {selected.length} selected
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={selected.length !== 1}
                onClick={() => setConfirmHeader(true)}
              >
                <Heading className="mr-1.5 size-3.5" /> Set row as header
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                disabled={selected.length === 0}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-1.5 size-3.5" /> Delete rows
              </Button>
              <Button size="sm" disabled={!dirty || saving} onClick={save}>
                {saving ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 size-3.5" />
                )}
                Save to file
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={quickFilter}
                onChange={(e) => setQuickFilter(e.target.value)}
                placeholder="Search across all columns…"
                className="h-9 pl-8"
              />
            </div>

            <div
              className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
                filterActive || quickFilter
                  ? "border-primary/40 bg-accent text-accent-foreground"
                  : "bg-muted/50 text-muted-foreground"
              }`}
            >
              <span className="font-medium tabular">
                {filterActive || quickFilter ? "Filtered" : "Unfiltered"}:{" "}
                {visibleCount.toLocaleString()} / {rows.length.toLocaleString()} rows
              </span>
              {(filterActive || quickFilter) && (
                <button
                  type="button"
                  className="flex items-center gap-1 font-medium hover:underline"
                  onClick={() => {
                    apiRef.current?.setFilterModel(null);
                    setQuickFilter("");
                  }}
                >
                  <FilterX className="size-3.5" /> Clear
                </button>
              )}
            </div>

            <span className="text-xs font-medium text-primary tabular">
              {selected.length} rows selected
            </span>

            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={selected.length === 0}
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="mr-1.5 size-3.5" /> Preview selected
              </Button>
              <Button size="sm" onClick={() => setExportOpen(true)}>
                <Download className="mr-1.5 size-3.5" /> Export
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Only this section scrolls */}
      <div className="min-h-0 flex-1 overflow-hidden p-3">
        <div className="h-full overflow-hidden rounded-lg border bg-card">
          <AgGridReact<Row>
            ref={gridRef}
            theme={gridTheme}
            rowData={rows}
            columnDefs={columnDefs}
            getRowId={(p) => String(p.data[ROW_ID])}
            quickFilterText={mode === "filter" ? quickFilter : ""}
            rowSelection={{
              mode: "multiRow",
              selectAll: "filtered",
              enableClickSelection: false,
            }}
            undoRedoCellEditing
            undoRedoCellEditingLimit={100}
            stopEditingWhenCellsLoseFocus
            enterNavigatesVertically
            enterNavigatesVerticallyAfterEdit
            animateRows={false}
            rowBuffer={20}
            onGridReady={onGridReady}
            onCellValueChanged={(e) => {
              setDirty(true);
              const rid = String(e.data[ROW_ID]);
              setRows((rs) => rs.map((r) => (String(r[ROW_ID]) === rid ? { ...r, ...e.data } : r)));
            }}
            onFilterChanged={refreshStatus}
            onSelectionChanged={refreshStatus}
            onModelUpdated={refreshStatus}
          />
        </div>
      </div>

      {/* Selected rows preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Selected rows — {selected.length}</DialogTitle>
            <DialogDescription>
              Selections are kept when you change filters, so you can select across several filter
              passes before exporting.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/90">
                <tr>
                  {previewCols.map((c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.map((r) => (
                  <tr key={String(r[ROW_ID])} className="border-t">
                    {previewCols.map((c) => (
                      <td key={c} className="whitespace-nowrap px-3 py-1.5 tabular">
                        {String(r[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.length} row(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              The rows are removed from the grid. Press “Save to file” afterwards to write the change
              to the stored spreadsheet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSelected}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmHeader} onOpenChange={setConfirmHeader}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Use this row as the column names?</AlertDialogTitle>
            <AlertDialogDescription>
              The selected row's values become the column headers, and that row plus every row above
              it is removed. Press “Save to file” afterwards to persist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={setAsHeader}>Set as header</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        datasetName={dataset.name}
        columns={columns}
        filteredRows={filteredRows()}
        selectedRows={selected}
      />
    </div>
  );
}
