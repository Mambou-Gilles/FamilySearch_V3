import { useState } from "react";
import StatusBadge from "@/components/StatusBadge";

const PAGE_SIZE = 15;

export default function ContributorHistoryTab({ history }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(history.length / PAGE_SIZE);
  const paged = history.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (history.length === 0) {
    return <div className="text-center py-12 text-slate-400">No history yet.</div>;
  }
  
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left p-3 text-slate-600 font-medium">URL</th>
              <th className="text-left p-3 text-slate-600 font-medium">Status</th>
              <th className="text-right p-3 text-slate-600 font-medium">Score</th>
              <th className="text-right p-3 text-slate-600 font-medium">Corr.</th>
              <th className="text-left p-3 text-slate-600 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paged.map(t => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-3 max-w-[180px] truncate">
                  <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-mono text-xs">
                    {t.url}
                  </a>
                </td>
                <td className="p-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="p-3 text-right">
                  {/* Supabase numeric values default to null if not set */}
                  {t.total_quality_score != null ? (
                    <span className={t.total_quality_score >= 90 ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                      {t.total_quality_score}/100
                    </span>
                  ) : "—"}
                </td>
                <td className="p-3 text-right">
                  {t.correction_count || 0}
                </td>
                <td className="p-3 text-slate-500 text-xs">
                  {/* Correctly handles Supabase ISO timestamptz */}
                  {t.date_completed ? new Date(t.date_completed).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border border-slate-200 rounded-xl bg-slate-50">
          <p className="text-xs text-slate-500">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, history.length)} of {history.length}
          </p>
          <div className="flex gap-1">
            <button 
              disabled={page === 0} 
              onClick={() => setPage(p => p - 1)} 
              className="p-1.5 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition-colors"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const startPage = Math.max(0, Math.min(page - 2, totalPages - 5));
              return startPage + i;
            }).filter(p => p >= 0 && p < totalPages).map(p => (
              <button 
                key={p} 
                onClick={() => setPage(p)} 
                className={`w-7 h-7 text-xs rounded font-medium transition-all ${
                  page === p ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p + 1}
              </button>
            ))}
            <button 
              disabled={page >= totalPages - 1} 
              onClick={() => setPage(p => p + 1)} 
              className="p-1.5 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition-colors"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}