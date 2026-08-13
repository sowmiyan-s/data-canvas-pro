import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridVault — Spreadsheet Vault, Editor & Export" },
      {
        name: "description",
        content:
          "Upload spreadsheets, edit rows in place, set any row as the header row, filter and select rows, then export a custom Excel file.",
      },
      { property: "og:title", content: "GridVault — Spreadsheet Vault, Editor & Export" },
      {
        property: "og:description",
        content: "Edit, filter, select and export spreadsheet data without corrupting your data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/vault" });
  },
});
