import { ChevronLeft, ChevronRight } from "lucide-react";

export default function TablePagination({ page, total, onPage, count, size }) {
  // Calculate the sliding window of 5 pages
  let startPage = Math.max(0, page - 2);
  let endPage = Math.min(total, startPage + 5);
  
  // Adjust start if we're near the end of the total pages
  if (endPage - startPage < 5) {
    startPage = Math.max(0, endPage - 5);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm">
      {/* Result Count Info */}
      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
        Showing <span className="text-slate-900">{count === 0 ? 0 : page * size + 1}</span>
        –
        <span className="text-slate-900">{Math.min((page + 1) * size, count)}</span> of <span className="text-slate-900">{count}</span>
      </p>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1.5">
        <button 
          disabled={page === 0} 
          onClick={() => onPage(p => p - 1)} 
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: endPage - startPage }, (_, i) => startPage + i)
            .map(p => (
              <button 
                key={p} 
                onClick={() => onPage(p)}
                className={`w-8 h-8 text-xs rounded-lg font-bold transition-all shadow-sm ${
                  page === p 
                    ? "bg-indigo-600 text-white shadow-indigo-200" 
                    : "text-slate-600 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {p + 1}
              </button>
            ))}
        </div>

        <button 
          disabled={page >= total - 1} 
          onClick={() => onPage(p => p + 1)} 
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}