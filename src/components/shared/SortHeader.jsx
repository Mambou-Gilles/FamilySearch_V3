import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export default function SortHeader({ label, field, s, d, onSort, right = false }) {
  const active = s === field;
  
  return (
    <th 
      className={`p-3 text-slate-600 font-semibold cursor-pointer select-none transition-colors hover:bg-slate-100/80 group ${right ? "text-right" : "text-left"}`} 
      onClick={() => onSort(field)}
    >
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${right ? "flex-row-reverse" : ""}`}>
        <span className="group-hover:text-slate-900 transition-colors">
          {label}
        </span>
        {active ? (
          d === "asc" ? (
            <ChevronUp className="w-3.5 h-3.5 text-indigo-600 stroke-[3px]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-indigo-600 stroke-[3px]" />
          )
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </span>
    </th>
  );
}