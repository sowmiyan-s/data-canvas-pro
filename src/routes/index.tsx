import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sheet,
  UploadCloud,
  Filter,
  ShoppingBasket,
  FileSpreadsheet,
  ShieldCheck,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridVault — Filter, Basket & Export Spreadsheet Data" },
      {
        name: "description",
        content:
          "Upload placement sheets, filter with Excel-style filters, stage rows across multiple filters and export custom Excel files without touching the source file.",
      },
      { property: "og:title", content: "GridVault — Filter, Basket & Export Spreadsheet Data" },
      {
        property: "og:description",
        content:
          "A spreadsheet power-user workspace: 50k-row grid, filter-aware selection baskets and a custom export pipeline.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: UploadCloud,
    title: "File vault",
    body: "Drag in .xlsx, .xls or .csv. Each upload keeps an immutable original backup plus an editable working dataset.",
  },
  {
    icon: Filter,
    title: "Excel-style filtering",
    body: "Searchable set filters for categorical columns, numeric range filters for CGPA-style data, and a global quick search.",
  },
  {
    icon: ShoppingBasket,
    title: "Selection basket",
    body: "Filter CS, stage 15 rows. Filter IT, stage 10 more. Header select-all only picks filtered rows — staged rows never get lost.",
  },
  {
    icon: FileSpreadsheet,
    title: "Custom export pipeline",
    body: "Pick columns, rename headers, reorder by drag, inject blank columns like Signature, save presets, preview 5 rows, download.",
  },
  {
    icon: Gauge,
    title: "50,000+ rows",
    body: "Virtualised grid with full keyboard navigation, in-place editing and Ctrl+Z / Ctrl+Y / Ctrl+S.",
  },
  {
    icon: ShieldCheck,
    title: "Non-destructive",
    body: "Exports are generated on the fly. The original source file and stored headers are never rewritten.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Sheet className="size-3.5" />
          </span>
          <span className="text-sm font-semibold tracking-tight">GridVault</span>
          <div className="ml-auto">
            <Button asChild size="sm">
              <Link to="/auth">Open workspace</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Placement & dataset operations
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
            Filter, basket and export spreadsheet rows — without ever corrupting the source file.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground">
            Built for spreadsheet power users who juggle student placement lists: a fast editable grid,
            multi-pass filtered selection, and an export pipeline that produces exactly the sheet a
            recruiter asked for.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Start uploading</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/vault">Go to file vault</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <article key={f.title} className="panel p-5">
                <f.icon className="size-5 text-primary" />
                <h2 className="mt-3 text-sm font-semibold">{f.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t bg-card py-6 text-center text-xs text-muted-foreground">
        GridVault — non-destructive spreadsheet operations workspace.
      </footer>
    </div>
  );
}
