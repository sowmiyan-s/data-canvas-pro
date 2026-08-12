import { useCallback, useMemo, useState } from "react";
import { useGridFilter, type CustomFilterProps } from "ag-grid-react";
import type { IRowNode } from "ag-grid-community";
import { Search } from "lucide-react";

type SetModel = { values: string[] } | null;

export function SetFilter({ model, onModelChange, getValue, api }: CustomFilterProps<SetModel>) {
  const [search, setSearch] = useState("");
  const [allValues, setAllValues] = useState<string[]>([]);

  const doesFilterPass = useCallback(
    ({ node }: { node: IRowNode }) => {
      const values = (model as SetModel)?.values;
      if (!values) return true;
      return values.includes(String(getValue(node) ?? ""));
    },
    [model, getValue],
  );

  const collect = useCallback(() => {
    const set = new Set<string>();
    api.forEachNode((node) => set.add(String(getValue(node) ?? "")));
    setAllValues(
      [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })),
    );
  }, [api, getValue]);

  useGridFilter({ doesFilterPass, afterGuiAttached: collect, onNewRowsLoaded: collect });

  const selected = useMemo(
    () => new Set((model as SetModel)?.values ?? allValues),
    [model, allValues],
  );
  const visible = useMemo(
    () => allValues.filter((v) => v.toLowerCase().includes(search.trim().toLowerCase())),
    [allValues, search],
  );

  const apply = (next: Set<string>) => {
    if (next.size === allValues.length) onModelChange(null);
    else onModelChange({ values: [...next] });
  };

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    apply(next);
  };

  return (
    <div className="w-64 p-2 text-sm">
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search values..."
          className="w-full rounded-md border border-input bg-background py-1.5 pl-7 pr-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <button
          type="button"
          className="font-medium text-primary hover:underline"
          onClick={() => apply(new Set(visible.length ? visible : allValues))}
        >
          Select all{search ? " (found)" : ""}
        </button>
        <button
          type="button"
          className="font-medium text-muted-foreground hover:underline"
          onClick={() => onModelChange({ values: [] })}
        >
          Deselect all
        </button>
      </div>
      <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
        {visible.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">No values</p>}
        {visible.map((v) => (
          <label
            key={v}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-muted"
          >
            <input
              type="checkbox"
              className="size-3.5 accent-[var(--primary)]"
              checked={selected.has(v)}
              onChange={() => toggle(v)}
            />
            <span className="truncate">{v === "" ? "(Blanks)" : v}</span>
          </label>
        ))}
      </div>
      <p className="mt-2 border-t pt-1.5 text-[11px] text-muted-foreground">
        {(model as SetModel)?.values
          ? `${(model as SetModel)!.values.length} of ${allValues.length} selected`
          : `All ${allValues.length} values`}
      </p>
    </div>
  );
}
