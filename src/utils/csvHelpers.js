// src/utils/csvHelpers.js
export function downloadCsv(rows, headers, filename) {
  // (The code I gave you previously without the "if (!rows.length)" check)
  const csvRows = [
    headers.map(h => h.label).join(","),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h.key] ?? "";
        const str = String(val);
        return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(",")
    )
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}