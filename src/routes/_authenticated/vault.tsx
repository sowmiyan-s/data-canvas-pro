import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  UploadCloud,
  Search,
  MoreHorizontal,
  Copy,
  Trash2,
  Pencil,
  TableProperties,
  FileDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createDataset,
  deleteDataset,
  downloadOriginal,
  duplicateDataset,
  listDatasets,
  renameDataset,
  type Dataset,
} from "@/lib/vault";

export const Route = createFileRoute("/_authenticated/vault")({
  head: () => ({
    meta: [
      { title: "File Vault — GridVault" },
      {
        name: "description",
        content:
          "Upload xlsx, xls and csv files, keep an immutable original backup and open working datasets in the grid.",
      },
      { property: "og:title", content: "File Vault — GridVault" },
      {
        property: "og:description",
        content: "Manage your spreadsheet library: search, rename, duplicate and open in grid view.",
      },
    ],
  }),
  component: VaultPage,
});

function VaultPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const [toDelete, setToDelete] = useState<Dataset | null>(null);
  const [toRename, setToRename] = useState<Dataset | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [tagValue, setTagValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setFiles(await listDatasets());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    for (const file of Array.from(list)) {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
        toast.error(`${file.name}: only .xlsx, .xls and .csv are supported`);
        continue;
      }
      try {
        const ds = await createDataset(file);
        toast.success(`${ds.name}: ${ds.row_count.toLocaleString()} rows imported`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Failed to import ${file.name}`);
      }
    }
    setUploading(false);
    void refresh();
  };

  const visible = files.filter(
    (f) =>
      f.name.toLowerCase().includes(query.toLowerCase()) ||
      f.tag.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">File vault</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every upload keeps an immutable original plus an editable working dataset.
            </p>
          </div>
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files or tags"
              className="pl-8"
            />
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`mt-6 cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            dragging ? "border-primary bg-accent/60" : "border-border bg-card hover:bg-muted/50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          {uploading ? (
            <Loader2 className="mx-auto size-7 animate-spin text-primary" />
          ) : (
            <UploadCloud className="mx-auto size-7 text-primary" />
          )}
          <p className="mt-3 text-sm font-medium">
            {uploading ? "Importing…" : "Drag & drop spreadsheets here"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">.xlsx, .xls or .csv — or click to browse</p>
        </div>

        <div className="panel mt-8 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">File</th>
                <th className="px-4 py-3 text-left font-semibold">Tag</th>
                <th className="px-4 py-3 text-right font-semibold">Rows</th>
                <th className="px-4 py-3 text-right font-semibold">Columns</th>
                <th className="px-4 py-3 text-left font-semibold">Uploaded</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Loading vault…
                  </td>
                </tr>
              )}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No files yet. Drop a spreadsheet above to get started.
                  </td>
                </tr>
              )}
              {visible.map((f) => (
                <tr key={f.id} className="border-t hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <button
                      className="font-medium hover:text-primary hover:underline"
                      onClick={() => void navigate({ to: "/grid/$id", params: { id: f.id } })}
                    >
                      {f.name}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{f.tag}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular">{f.row_count.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular">{f.columns.length}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(f.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void navigate({ to: "/grid/$id", params: { id: f.id } })}
                      >
                        <TableProperties className="mr-1.5 size-3.5" /> Open
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setToRename(f);
                              setRenameValue(f.name);
                              setTagValue(f.tag);
                            }}
                          >
                            <Pencil className="mr-2 size-3.5" /> Rename / retag
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await duplicateDataset(f);
                                toast.success("Duplicated");
                                void refresh();
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Duplicate failed");
                              }
                            }}
                          >
                            <Copy className="mr-2 size-3.5" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await downloadOriginal(f);
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Download failed");
                              }
                            }}
                          >
                            <FileDown className="mr-2 size-3.5" /> Download original
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setToDelete(f)}
                          >
                            <Trash2 className="mr-2 size-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <Dialog open={!!toRename} onOpenChange={(o) => !o && setToRename(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>File name</Label>
              <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tag / category</Label>
              <Input value={tagValue} onChange={(e) => setTagValue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!toRename) return;
                await renameDataset(toRename.id, renameValue.trim() || toRename.name, tagValue.trim() || "Uncategorized");
                setToRename(null);
                toast.success("Saved");
                void refresh();
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the original backup, the working dataset and any staged basket
              rows for this file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!toDelete) return;
                try {
                  await deleteDataset(toDelete);
                  toast.success("Deleted");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Delete failed");
                }
                setToDelete(null);
                void refresh();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
