import writeXlsxFile from "write-excel-file/browser";
import { logExport } from "./mock/finance";

export interface ExportCol<R> { header: string; value: (r: R) => string | number; }
/** A real .xlsx download, recorded in the export history. */
export async function exportExcel<R>(reportName: string, filename: string, cols: ExportCol<R>[], rows: R[], filters = "") {
  const header = cols.map((c) => ({ value: c.header, fontWeight: "bold" as const }));
  const data = rows.map((r) => cols.map((c) => { const v = c.value(r); return typeof v === "number" ? { type: Number, value: v } : { type: String, value: String(v ?? "") }; }));
  await (writeXlsxFile as any)([header, ...data], { columns: cols.map(() => ({ width: 22 })) }).toFile(`${filename}.xlsx`);
  logExport(reportName, "Excel", filters, rows.length);
}
