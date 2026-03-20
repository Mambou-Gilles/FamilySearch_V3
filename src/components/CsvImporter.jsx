import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/api/supabaseClient"; 

function parseCsv(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  // Handle header cleanup
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    // Regex to handle commas within quotes
    const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (values[i] || "").trim().replace(/^"|"$/g, "");
    });
    return obj;
  });
}

export default function CsvImporter({ tableName, label, fieldMap, onDone }) {
  const [status, setStatus] = useState(null);
  const [count, setCount] = useState(0);
  const [errors, setErrors] = useState([]);
  const inputRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatus("parsing");
    const text = await file.text();
    const rows = parseCsv(text);

    if (!rows.length) {
      setStatus("error");
      setErrors(["No data found in CSV"]);
      return;
    }

    // Map CSV columns to Supabase table columns
    const mapped = rows.map(r => {
      const obj = {};
      Object.entries(fieldMap).forEach(([csvCol, entityField]) => {
        if (r[csvCol] !== undefined) obj[entityField] = r[csvCol];
      });
      return obj;
    });

    setStatus("uploading");

    try {
      // Supabase Bulk Insert/Upsert
      // .upsert is often safer for CSV imports to avoid primary key collisions
      const { data, error } = await supabase
        .from(tableName)
        .upsert(mapped, { onConflict: 'id' }); // Adjust conflict column as needed

      if (error) throw error;

      const successCount = mapped.length;
      setCount(successCount);
      setStatus("done");
      if (onDone) onDone(successCount);
    } catch (err) {
      console.error("Import Error:", err);
      setStatus("error");
      setErrors([err.message]);
    }

    e.target.value = "";
  };

  return (
    <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center space-y-3 bg-white shadow-sm">
      <Upload className="w-8 h-8 text-slate-400 mx-auto" />
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="text-xs text-slate-500">
        Required columns: <span className="font-mono text-indigo-600">{Object.keys(fieldMap).join(", ")}</span>
      </p>
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => inputRef.current.click()} 
        disabled={status === "uploading" || status === "parsing"}
        className="mt-2"
      >
        {status === "uploading" || status === "parsing" ? "Processing..." : "Choose CSV File"}
      </Button>
      
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />

      {/* Feedback States */}
      {status === "done" && (
        <div className="flex items-center gap-2 justify-center text-green-600 text-sm font-medium animate-in fade-in slide-in-from-top-1">
          <CheckCircle className="w-4 h-4" /> {count} records imported successfully
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-1 justify-center text-red-600 text-sm animate-in shake-1">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> <span>Import Failed</span>
          </div>
          <p className="text-[10px] opacity-80 max-w-xs truncate">{errors[0]}</p>
        </div>
      )}
    </div>
  );
}