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
  ShoppingBasket,
  Save,
  FilterX,
  Download,
  Loader2,
  Trash2,
  CircleDot,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { SetFilter } from "@/components/grid/SetFilter";
import { ExportDialog } from "@/components/ExportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  ROW_ID,
  distinctCount,
  getDataset,
  isNumericColumn,
  loadWorkingRows,
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

export const Route = createFileRoute("/_authenticated/grid/$id")({
  head: () => ({
    meta: [
      { title: "Grid workspace — GridVault" },
      {
        name: "description",
        content:
          "Edit cells, apply Excel-style set and numeric filters, stage rows in the selection basket and export custom sheets.",
      },
      { property: "og:title", content: "Grid workspace — GridVault" },
      {
        property: "og:description",
        content: "High-performance spreadsheet grid with filter-aware selection and custom exports.",
      },
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
  const [quickFilter, setQuickFilter] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterActive, setFilterActive] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [selectedCount, setSelectedCount] = useState(0);
  const [basket, setBasket] = useState<{ id: string; row_key: string; row_data: Row }[]>([]);
  const [basketOpen, setBasketOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const loadBasket = useCallback(async () => {
    const { data, error } = await supabase
      .from("basket_items")
      .select("id, row_key, row_data")
      .eq("dataset_id", id)
      .order("created_at", { ascending: true });
    if (error) return;
    setBasket((data ?? []) as unknown as { id: string; row_key: string; row_data: Row }[]);
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const ds = await getDataset(id);
        setDataset(ds);
        setRows(await loadWorkingRows(ds));
        await loadBasket();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not open dataset");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, loadBasket]);

  const columnDefs = useMemo<ColDef<Row>[]>(() => {
    if (!dataset) return [];
    return dataset.columns.map((col, i) => {
      const numeric = isNumericColumn(rows, col);
      const categorical = !numeric && distinctCount(rows, col) <= 200;
      const def: ColDef<Row> = {
        field: col,
        headerName: col,
        editable: true,
        sortable: true,
        resizable: true,
        minWidth: 130,
        flex: 1,
        filter: numeric ? "agNumberColumnFilter" : categorical ? SetFilter : "agTextColumnFilter",
      };
      if (numeric) def.type = "numericColumn";
      if (i === 0) def.minWidth = 180;
      return def;
    });
  }, [dataset, rows]);

  const refreshStatus = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    setVisibleCount(api.getDisplayedRowCount());
    setSelectedCount(api.getSelectedRows().length);
    setFilterActive(api.isAnyFilterPresent());
  }, []);

  const onGridReady = (e: GridReadyEvent<Row>) => {
    apiRef.current = e.api;
    refreshStatus();
  };

  const saveToSource = useCallback(async () => {
    if (!dataset) return;
    setSaving(true);
    try {
      await saveWorkingRows(dataset, rows);
      setDirty(false);
      toast.success("Saved to working dataset — original file untouched");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [dataset, rows]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveToSource();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveToSource]);

  const filteredRows = useCallback(() => {
    const api = apiRef.current;
    if (!api) return rows;
    const out: Row[] = [];
    api.forEachNodeAfterFilterAndSort((n) => n.data && out.push(n.data));
    return out;
  }, [rows]);

  const addToBasket = async () => {
    const api = apiRef.current;
    if (!api) return;
    const selected = api.getSelectedRows();
    if (selected.length === 0) {
      toast.error("Select rows first");
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const payload = selected.map((r) => ({
      user_id: auth.user!.id,
      dataset_id: id,
      row_key: String(r[ROW_ID]),
      row_data: r as never,
    }));
    const { error } = await supabase
      .from("basket_items")
      .upsert(payload, { onConflict: "dataset_id,row_key" });
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadBasket();
    api.deselectAll();
    refreshStatus();
    toast.success(`${selected.length} rows staged in the basket`);
  };

  const removeBasketItem = async (itemId: string) => {
    await supabase.from("basket_items").delete().eq("id", itemId);
    setBasket((b) => b.filter((x) => x.id !== itemId));
  };

  const clearBasket = async () => {
    await supabase.from("basket_items").delete().eq("dataset_id", id);
    setBasket([]);
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

  return (
    <div className="flex h-screen flex-col bg-surface">
      <AppHeader>
        <div className="flex items-center gap-3">
          <Link to="/vault" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
          </Link>
          <span className="truncate text-sm font-medium">{dataset.name}</span>
          <Badge variant="secondary">{dataset.tag}</Badge>
          {dirty ? (
            <span className="flex items-center gap-1 text-xs text-warning">
              <CircleDot className="size-3" /> Draft changes
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3 text-success" /> All changes saved
            </span>
          )}
        </div>
      </AppHeader>

      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2.5">
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
            filterActive
              ? "border-primary/40 bg-accent text-accent-foreground"
              : "bg-muted/50 text-muted-foreground"
          }`}
        >
          <span className="font-medium tabular">
            {filterActive ? "Filtered" : "Unfiltered"}: {visibleCount.toLocaleString()} /{" "}
            {rows.length.toLocaleString()} rows
          </span>
          {filterActive && (
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

        <span className="text-xs text-muted-foreground tabular">{selectedCount} selected</span>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void addToBasket()}>
            <ShoppingBasket className="mr-1.5 size-3.5" /> Add to basket
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setBasketOpen(true)}>
            Basket <span className="ml-1.5 tabular">({basket.length})</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
            <Download className="mr-1.5 size-3.5" /> Export
          </Button>
          <Button size="sm" disabled={!dirty || saving} onClick={() => void saveToSource()}>
            {saving ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 size-3.5" />
            )}
            Save to source
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 p-3">
        <div className="h-full overflow-hidden rounded-lg border bg-card">
          <AgGridReact<Row>
            ref={gridRef}
            theme={gridTheme}
            rowData={rows}
            columnDefs={columnDefs}
            getRowId={(p) => String(p.data[ROW_ID])}
            quickFilterText={quickFilter}
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
            suppressColumnVirtualisation={false}
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

      <Sheet open={basketOpen} onOpenChange={setBasketOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Selection basket — {basket.length} staged rows</SheetTitle>
          </SheetHeader>
          <p className="text-xs text-muted-foreground">
            Staged rows persist across filter changes. Filter, select, stage, repeat.
          </p>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {basket.map((item) => {
              const first = dataset.columns.slice(0, 3);
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-2 rounded-md border bg-card px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    {first.map((c) => (
                      <div key={c} className="truncate">
                        <span className="text-muted-foreground">{c}: </span>
                        {String(item.row_data[c] ?? "")}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeBasketItem(item.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              );
            })}
            {basket.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing staged yet. Select rows in the grid and click “Add to basket”.
              </p>
            )}
          </div>
          <div className="flex gap-2 border-t pt-3">
            <Button
              variant="outline"
              className="flex-1"
              disabled={basket.length === 0}
              onClick={() => void clearBasket()}
            >
              Clear basket
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setBasketOpen(false);
                setExportOpen(true);
              }}
            >
              <Download className="mr-1.5 size-4" /> Export basket
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        datasetName={dataset.name}
        columns={dataset.columns}
        filteredRows={filteredRows()}
        basketRows={basket.map((b) => b.row_data)}
      />
    </div>
  );
}
