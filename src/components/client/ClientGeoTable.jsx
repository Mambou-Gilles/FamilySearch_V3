export default function ClientGeoTable({ geoData }) {
  if (!geoData.length) return null;

  // Use total_urls for sorting
  const sorted = [...geoData].sort((a, b) => (b.total_urls || 0) - (a.total_urls || 0));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-xs uppercase">
              <th className="text-left px-5 py-3">Geography</th>
              <th className="text-right px-5 py-3">Total</th>
              <th className="text-right px-5 py-3">Completed</th>
              <th className="text-right px-5 py-3">Reviewed</th>
              <th className="text-right px-5 py-3">Remaining</th>
              <th className="text-right px-5 py-3">Review %</th>
              <th className="text-center px-5 py-3">Progress</th>
              
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map(g => {
              // Priority 1: Direct total from DB. Priority 2: Math fallback.
              const total = g.total_urls || (g.worked + g.remaining + (g.assigned || 0));
              const progressPct = total > 0 ? Math.round((g.worked / total) * 100) : 0;
              const reviewPct = g.worked > 0 ? Math.round((g.reviewed / g.worked) * 100) : 0;

              return (
                <tr key={g.geography} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 font-semibold text-slate-900">{g.geography}</td>
                  
                  {/* Now shows 100 */}
                  <td className="px-5 py-3.5 text-right font-bold text-slate-800 bg-slate-50/30">
                    {(total).toLocaleString()}
                  </td>
                  
                  <td className="px-5 py-3.5 text-right text-indigo-700 font-medium">
                    {g.worked.toLocaleString()}
                  </td>
                  
                  <td className="px-5 py-3.5 text-right text-green-700 font-medium">
                    {g.reviewed.toLocaleString()}
                  </td>
                  
                  {/* Now shows 90 */}
                  <td className="px-5 py-3.5 text-right text-slate-400">
                    {g.remaining.toLocaleString()}
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <span className={`text-sm font-semibold ${reviewPct >= 20 ? "text-green-600" : "text-amber-600"}`}>
                      {reviewPct}%
                    </span>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500" 
                          style={{ width: `${progressPct}%` }} 
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">{progressPct}%</span>
                    </div>
                  </td>

                  
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

