import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export default function SortableTableHeader({ label, field, sortField, sortDir, onSort, className = "" }) {
  const isActive = sortField === field;
  
  return (
    <th
      className={`p-3 text-slate-600 font-medium cursor-pointer select-none hover:bg-slate-100 transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {isActive ? (
          sortDir === "asc" ? (
            <ChevronUp className="w-3 h-3 text-indigo-600" />
          ) : (
            <ChevronDown className="w-3 h-3 text-indigo-600" />
          )
        ) : (
          <ChevronsUpDown className="w-3 h-3 text-slate-300" />
        )}
      </div>
    </th>
  );
}