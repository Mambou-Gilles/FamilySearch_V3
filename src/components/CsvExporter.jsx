import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

/**
 * Converts Supabase JSON results to a CSV string.
 * Handles basic comma-escaping for strings.
 */
function toCsv(data, columns) {
  if (!data.length) return "";
  const headers = columns || Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const v = row[h] ?? "";
      // Handle commas and quotes within values to prevent column breaking
      const str = String(v);
      if (str.includes(",") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

export default function CsvExporter({ data, filename = "export.csv", columns, label = "Export CSV" }) {
  const handleExport = () => {
    if (!data?.length) return;
    const csv = toCsv(data, columns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleExport} 
      disabled={!data?.length}
      className="text-slate-600 hover:text-indigo-600 border-slate-200"
    >
      <Download className="w-4 h-4 mr-2" /> 
      {label}
    </Button>
  );
}