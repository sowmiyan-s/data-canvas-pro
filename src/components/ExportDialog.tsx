import { useEffect, useMemo, useState } from "react";
import { GripVertical, Plus, Download, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

type Preset = { id: string; name: string; config: { columns: ExportColumn[] } };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasetName: string;
  columns: string[];
  filteredRows: Row[];
  basketRows: Row[];
};

export function ExportDialog({
  open,
  onOpenChange,
  datasetName,
  columns,
  filteredRows,
  basketRows,
}: Props) {
  const [cols, setCols] = useState<ExportColumn[]>(() => buildExportColumns(columns));
  const [source, setSource] = useState<"filtered" | "basket">("basket");
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [fileName, setFileName] = useState(`${datasetName}-export`);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setCols((prev) => (prev.length ? prev : buildExportColumns(columns)));
  }, [open, columns]);

  useEffect(() => {
    if (!open) return;
    void supabase
      .from("export_presets")
      .select("id, name, config")
      .order("created_at", { ascending: false })
      .then(({ data }) => setPresets((data ?? []) as unknown as Preset[]));
  }, [open]);

  useEffect(() => {
    if (basketRows.length === 0) setSource("filtered");
  }, [basketRows.length]);

  const rows = source === "basket" ? basketRows : filteredRows;
  const preview = useMemo(() => buildMatrix(rows.slice(0, 5), cols), [rows, cols]);
  const includedCount = cols.filter((c) => c.include).length;

  const patch = (id: string, next: Partial<ExportColumn>) =>
    setCols((cs) => cs.map((c) => (c.id === id ? { ...c, ...next } : c)));

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setCols((cs) => {
      const from = cs.findIndex((c) => c.id === dragId);
      const to = cs.findIndex((c) => c.id === targetId);
      if (from < 0 || to < 0) return cs;
      const next = [...cs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
    setDragId(null);
  };

  const addBlank = () =>
    setCols((cs) => [
      ...cs,
      { id: `blank-${Date.now()}`, key: null, label: "New Column", include: true },
    ]);

  const savePreset = async () => {
    if (!presetName.trim()) {
      toast.error("Name your preset first");
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("export_presets")
      .insert({ user_id: auth.user!.id, name: presetName.trim(), config: { columns: cols } })
      .select("id, name, config")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setPresets((p) => [data as unknown as Preset, ...p]);
    setPresetName("");
    toast.success("Preset saved");
  };

  const deletePreset = async (id: string) => {
    await supabase.from("export_presets").delete().eq("id", id);
    setPresets((p) => p.filter((x) => x.id !== id));
  };

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
    toast.success(`Exported ${rows.length} rows — source file untouched`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Custom export pipeline</DialogTitle>
          <DialogDescription>
            Build a bespoke sheet. Nothing here modifies the stored dataset.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Columns <span className="text-muted-foreground">({includedCount} included)</span>
              </h3>
              <Button size="sm" variant="outline" onClick={addBlank}>
                <Plus className="mr-1 size-3.5" /> Blank column
              </Button>
            </div>
            <div className="max-h-[340px] space-y-1 overflow-y-auto rounded-lg border p-2">
              {cols.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={() => setDragId(c.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => drop(c.id)}
                  className={`flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 ${
                    dragId === c.id ? "opacity-50" : ""
                  }`}
                >
                  <GripVertical className="size-4 cursor-grab text-muted-foreground" />
                  <input
                    type="checkbox"
                    checked={c.include}
                    onChange={(e) => patch(c.id, { include: e.target.checked })}
                    className="size-3.5 accent-[var(--primary)]"
                  />
                  <Input
                    value={c.label}
                    onChange={(e) => patch(c.id, { label: e.target.value })}
                    className="h-7 flex-1 text-sm"
                  />
                  <span className="w-32 shrink-0 truncate text-right text-[11px] text-muted-foreground">
                    {c.key ?? "blank column"}
                  </span>
                  {!c.key && (
                    <button
                      type="button"
                      onClick={() => setCols((cs) => cs.filter((x) => x.id !== c.id))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Row source</Label>
                <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basket">Selection basket ({basketRows.length})</SelectItem>
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
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">File name</Label>
              <Input value={fileName} onChange={(e) => setFileName(e.target.value)} className="h-9" />
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <Label className="text-xs">Presets</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. TCS Format Preset"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="h-8"
                />
                <Button size="sm" variant="outline" onClick={() => void savePreset()}>
                  <Save className="mr-1 size-3.5" /> Save
                </Button>
              </div>
              <div className="space-y-1">
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <button
                      type="button"
                      className="flex-1 truncate text-left text-primary hover:underline"
                      onClick={() => {
                        setCols(p.config.columns);
                        toast.success(`Applied "${p.name}"`);
                      }}
                    >
                      {p.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deletePreset(p.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
                {presets.length === 0 && (
                  <p className="text-xs text-muted-foreground">No presets saved yet.</p>
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Live preview — first 5 rows</h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/70">
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
                    <td className="px-3 py-4 text-muted-foreground" colSpan={preview.header.length || 1}>
                      No rows in the selected source.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {rows.length} rows × {includedCount} columns will be generated on the fly.
          </p>
          <Button onClick={doExport}>
            <Download className="mr-1.5 size-4" /> Download {format.toUpperCase()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
