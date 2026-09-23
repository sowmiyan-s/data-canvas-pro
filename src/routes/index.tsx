import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridVault — Spreadsheet Projects" },
      {
        name: "description",
        content:
          "Manage spreadsheet projects, edit source data, and export customized Excel files.",
      },
      { property: "og:title", content: "GridVault — Spreadsheet Projects" },
      {
        property: "og:description",
        content: "Edit, filter, select and export spreadsheet data securely.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
