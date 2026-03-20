import StatusBadge from "@/components/StatusBadge";

export default function TeamTable({ assignments, tasks }) {
  // Logic to aggregate Supabase task data by contributor email
  const statsMap = {};
  tasks.forEach(t => {
    if (!t.contributor_email) return;
    if (!statsMap[t.contributor_email]) {
      statsMap[t.contributor_email] = { completed: 0, reviewed: 0, corrections: 0, scoreSum: 0 };
    }
    
    // Workflow tracking based on Supabase status strings
    if (["completed", "in_review", "needs_correction", "reviewed"].includes(t.status)) {
      statsMap[t.contributor_email].completed++;
    }
    
    if (t.status === "reviewed") { 
      statsMap[t.contributor_email].reviewed++; 
      statsMap[t.contributor_email].scoreSum += t.total_quality_score || 0; 
    }
    
    if (t.status === "needs_correction") {
      statsMap[t.contributor_email].corrections++;
    }
  });

  const contributors = assignments.filter(a => a.role === "contributor");

  if (!contributors.length) return <div className="text-center py-8 text-slate-400">No contributors assigned</div>;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left p-3 text-slate-600 font-medium">Name</th>
            <th className="text-left p-3 text-slate-600 font-medium">Geography</th>
            <th className="text-left p-3 text-slate-600 font-medium">Status</th>
            <th className="text-right p-3 text-slate-600 font-medium">Completed</th>
            <th className="text-right p-3 text-slate-600 font-medium">Reviewed</th>
            <th className="text-right p-3 text-slate-600 font-medium">Corrections</th>
            <th className="text-right p-3 text-slate-600 font-medium">Avg Score</th>
            <th className="text-right p-3 text-slate-600 font-medium">Accuracy</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {contributors.map(a => {
            const s = statsMap[a.user_email] || { completed: 0, reviewed: 0, corrections: 0, scoreSum: 0 };
            const avgScore = s.reviewed ? Math.round(s.scoreSum / s.reviewed) : 0;
            const accuracy = s.reviewed ? Math.round(((s.reviewed - s.corrections) / s.reviewed) * 100) : 0;
            
            return (
              <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-3 font-medium text-slate-900">{a.user_name}</td>
                <td className="p-3 text-slate-600">{a.geography}</td>
                <td className="p-3">
                  <StatusBadge status={a.status} />
                </td>
                <td className="p-3 text-right tabular-nums">{s.completed}</td>
                <td className="p-3 text-right text-indigo-700 tabular-nums">{s.reviewed}</td>
                <td className="p-3 text-right text-amber-600 tabular-nums">{s.corrections}</td>
                <td className="p-3 text-right tabular-nums">
                  {s.reviewed > 0 ? (
                    <span className={avgScore >= 90 ? "text-green-600 font-medium" : avgScore >= 70 ? "text-amber-600" : "text-red-600"}>
                      {avgScore}/100
                    </span>
                  ) : "—"}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {s.reviewed > 0 ? `${accuracy}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}