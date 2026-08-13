import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export const ROW_ID = "__rid";

export type Row = Record<string, unknown> & { __rid: string };

export type Dataset = {
  id: string;
  user_id: string;
  name: string;
  tag: string;
  row_count: number;
  columns: string[];
  original_path: string | null;
  working_path: string | null;
  created_at: string;
  updated_at: string;
};

export type ParsedSheet = { columns: string[]; rows: Row[] };

export function parseWorkbook(data: ArrayBuffer, fileName: string): ParsedSheet {
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) throw new Error(`No sheet found in ${fileName}`);
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const columns: string[] = [];
  for (const r of raw) {
    for (const key of Object.keys(r)) {
      if (key !== ROW_ID && !columns.includes(key)) columns.push(key);
    }
  }
  const rows: Row[] = raw.map((r, i) => ({ ...r, [ROW_ID]: `r${i + 1}` }) as Row);
  return { columns, rows };
}

export function isNumericColumn(rows: Row[], col: string): boolean {
  let seen = 0;
  for (const r of rows.slice(0, 200)) {
    const v = r[col];
    if (v === "" || v === null || v === undefined) continue;
    seen++;
    if (Number.isNaN(Number(v))) return false;
  }
  return seen > 0;
}

export function distinctCount(rows: Row[], col: string): number {
  const set = new Set<string>();
  for (const r of rows) {
    set.add(String(r[col] ?? ""));
    if (set.size > 250) break;
  }
  return set.size;
}

async function uploadJson(path: string, rows: Row[]) {
  const blob = new Blob([JSON.stringify(rows)], { type: "application/json" });
  const { error } = await supabase.storage
    .from("datasets")
    .upload(path, blob, { upsert: true, contentType: "application/json" });
  if (error) throw error;
}

export async function createDataset(file: File): Promise<Dataset> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");

  const buffer = await file.arrayBuffer();
  const { columns, rows } = parseWorkbook(buffer, file.name);

  const { data: inserted, error } = await supabase
    .from("datasets")
    .insert({
      user_id: uid,
      name: file.name.replace(/\.(xlsx|xls|csv)$/i, ""),
      tag: "Uncategorized",
      row_count: rows.length,
      columns,
    })
    .select()
    .single();
  if (error) throw error;

  const ext = file.name.split(".").pop() ?? "xlsx";
  const originalPath = `${uid}/${inserted.id}/original.${ext}`;
  const workingPath = `${uid}/${inserted.id}/working.json`;

  const up = await supabase.storage
    .from("datasets")
    .upload(originalPath, file, { upsert: true });
  if (up.error) throw up.error;
  await uploadJson(workingPath, rows);

  const { data: updated, error: uErr } = await supabase
    .from("datasets")
    .update({ original_path: originalPath, working_path: workingPath })
    .eq("id", inserted.id)
    .select()
    .single();
  if (uErr) throw uErr;
  return updated as unknown as Dataset;
}

export async function listDatasets(): Promise<Dataset[]> {
  const { data, error } = await supabase
    .from("datasets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Dataset[];
}

export async function getDataset(id: string): Promise<Dataset> {
  const { data, error } = await supabase.from("datasets").select("*").eq("id", id).single();
  if (error) throw error;
  return data as unknown as Dataset;
}

export async function loadWorkingRows(ds: Dataset): Promise<Row[]> {
  if (!ds.working_path) return [];
  const { data, error } = await supabase.storage.from("datasets").download(ds.working_path);
  if (error) throw error;
  const text = await data.text();
  return JSON.parse(text) as Row[];
}

export async function saveWorkingRows(ds: Dataset, rows: Row[]) {
  const columns: string[] = [];
  for (const r of rows) {
    for (const k of Object.keys(r)) if (k !== ROW_ID && !columns.includes(k)) columns.push(k);
  }
  await uploadJson(ds.working_path ?? `${ds.user_id}/${ds.id}/working.json`, rows);
  const { error } = await supabase
    .from("datasets")
    .update({ row_count: rows.length, columns })
    .eq("id", ds.id);
  if (error) throw error;
}

/**
 * Uses the values of `headerRid` as the new column names and drops that row
 * plus every row above it.
 */
export function applyHeaderRow(rows: Row[], columns: string[], headerRid: string): ParsedSheet {
  const index = rows.findIndex((r) => r[ROW_ID] === headerRid);
  if (index < 0) throw new Error("Header row not found");
  const headerRow = rows[index]!;
  const used = new Set<string>();
  const mapping = columns.map((col) => {
    let name = String(headerRow[col] ?? "").trim() || col;
    let n = 2;
    while (used.has(name)) name = `${name} (${n++})`;
    used.add(name);
    return { from: col, to: name };
  });
  const nextRows = rows.slice(index + 1).map((r, i) => {
    const out: Record<string, unknown> = { [ROW_ID]: `r${i + 1}` };
    for (const m of mapping) out[m.to] = r[m.from] ?? "";
    return out as Row;
  });
  return { columns: mapping.map((m) => m.to), rows: nextRows };
}

/** Overwrites the stored original spreadsheet with the current working data. */
export async function overwriteOriginal(ds: Dataset, rows: Row[], columns: string[]) {
  const aoa = [columns, ...rows.map((r) => columns.map((c) => r[c] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const path = ds.original_path ?? `${ds.user_id}/${ds.id}/original.xlsx`;
  const { error } = await supabase.storage
    .from("datasets")
    .upload(path, new Blob([out], { type: mime }), { upsert: true, contentType: mime });
  if (error) throw error;
  if (!ds.original_path) {
    await supabase.from("datasets").update({ original_path: path }).eq("id", ds.id);
  }
}

export async function renameDataset(id: string, name: string, tag?: string) {
  const { error } = await supabase
    .from("datasets")
    .update(tag === undefined ? { name } : { name, tag })
    .eq("id", id);
  if (error) throw error;
}

export async function duplicateDataset(ds: Dataset): Promise<Dataset> {
  const rows = await loadWorkingRows(ds);
  const { data: inserted, error } = await supabase
    .from("datasets")
    .insert({
      user_id: ds.user_id,
      name: `${ds.name} (copy)`,
      tag: ds.tag,
      row_count: rows.length,
      columns: ds.columns,
    })
    .select()
    .single();
  if (error) throw error;

  const workingPath = `${ds.user_id}/${inserted.id}/working.json`;
  await uploadJson(workingPath, rows);

  let originalPath: string | null = null;
  if (ds.original_path) {
    const ext = ds.original_path.split(".").pop() ?? "xlsx";
    originalPath = `${ds.user_id}/${inserted.id}/original.${ext}`;
    const copy = await supabase.storage.from("datasets").copy(ds.original_path, originalPath);
    if (copy.error) originalPath = null;
  }

  const { data: updated, error: uErr } = await supabase
    .from("datasets")
    .update({ working_path: workingPath, original_path: originalPath })
    .eq("id", inserted.id)
    .select()
    .single();
  if (uErr) throw uErr;
  return updated as unknown as Dataset;
}

export async function deleteDataset(ds: Dataset) {
  const paths = [ds.original_path, ds.working_path].filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from("datasets").remove(paths);
  const { error } = await supabase.from("datasets").delete().eq("id", ds.id);
  if (error) throw error;
}

export async function downloadOriginal(ds: Dataset) {
  if (!ds.original_path) throw new Error("No original file stored");
  const { data, error } = await supabase.storage.from("datasets").download(ds.original_path);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = ds.original_path.split("/").pop() ?? "original.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
