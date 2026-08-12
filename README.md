# Data Canvas Pro

You are an expert full-stack developer specializing in high-performance web applications, spreadsheet grid interfaces, and data pipeline tools. 

Build a web application designed for spreadsheet power users (specifically for student placement management, but flexible enough for any dataset). The application allows users to upload, edit, filter, selectively basket rows, and export custom Excel/CSV files without ever modifying or corrupting the original source file.

---

### CORE FUNCTIONAL REQUIREMENTS

#### 1. File Vault & Workspace Manager

- Users can upload `.xlsx`, `.xls`, and `.csv` files via Drag-and-Drop.

- Display a file library listing all uploaded files with metadata (File Name, Upload Date, Row Count, Tag/Category).

- Provide options to Search files, Rename, Duplicate, Delete (with confirmation), and Open in Grid View.

- Storage logic must keep two versions internally:

  1. `Original Source File` (Immutable raw backup).

  2. `Working Dataset` (Live schema where user edits persist).

#### 2. Interactive Spreadsheet Grid Interface

- Render the spreadsheet using a high-performance grid component (e.g., AG Grid Community/Enterprise or Handsontable).

- Support standard Excel keyboard navigation (`Tab`, `Enter`, arrow keys, `Ctrl+Z` undo, `Ctrl+Y` redo, `Ctrl+S` save).

- In-place cell editing with an automatic draft-saving indicator and an explicit "Save to Source" button.

- Advanced Column & Global Filtering:

  - Excel-style Set Filters ('agSetColumnFilter') for categorical columns (e.g., Department, Skills, Names) featuring a mini-search bar inside the filter popup to search values by typing, alongside "Select All" / "Deselect All" checkboxes.

  - Numeric & Date Filters: Greater Than, Less Than, Range (e.g., CGPA > 7.5).

  - Global Quick Search: A top-level search bar above the grid that searches across all columns simultaneously (`quickFilterText`).

#### 3. Multi-Filter "Selection Basket" (Staging Area)

- Allow users to select specific rows via checkboxes or range selection.

- Filter-Aware Header Selection (`selectAll: 'filtered'`): When a filter is active and the user clicks the header "Select All" checkbox, ONLY the rows matching the current filter must be selected—leaving hidden, non-matching rows unselected.

- Users can click "Add to Selection Basket" to save currently selected rows into a persistent staging drawer.

- Users can change filters multiple times (e.g., Filter 1: CS branch -> select 15 rows -> add to basket; Filter 2: IT branch -> select 10 rows -> add to basket) without losing previously staged rows.

- The Selection Basket must display total staged rows, allow removing individual entries, and serve as the direct input source for the Export Engine.

#### 4. Custom Export Pipeline Engine

Users can export either the currently filtered view or the Selection Basket into a customized Excel file. The export interface must allow:

1. Column Selection: Toggle checkboxes to include or exclude specific columns.

2. Column Renaming: Rename headers for export (e.g., map `Student_Name` -> `Candidate Full Name`) without modifying the stored database header.

3. Column Reordering: Drag-and-drop handles to rearrange columns in any custom order.

4. Blank Column Insertion: Option to inject empty dummy columns with custom names (e.g., "Signature", "Interview Time Slot", "HR Comments").

5. Export Templates/Presets: Option to save column configurations as reusable presets (e.g., "TCS Format Preset").

6. Live Export Preview: A 5-row preview modal showing how the final exported sheet will look before downloading `.xlsx`.

---

### UX & GUARDRAILS

- Non-Destructive Exports: Exporting data MUST generate a download on the fly and never overwrite or alter the active file's source schema.

- Performance: Grid must render smoothly for up to 50,000+ rows without UI lagging (using virtual scrolling).

- UI Theme: Modern, clean, enterprise dashboard look (Tailwind CSS, clean tables, distinct visual cues for filtered state vs unfiltered state).

---

use supabase and required tools to do it

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5c5458a4-81ae-4e29-a925-3eed5abfbff6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
