export default function ReviewerStatsBar({ 
  pendingTotal, 
  reviewedToday, 
  totalReviewed, 
  avgScoreToday, 
  avgScore, 
  correctionRateToday, 
  corrections, 
  correctionRate, 
  contributors 
}) {
  return (
    <div className="space-y-4">
      {/* Primary KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { val: pendingTotal, label: "To Review", color: "text-amber-600", bg: "bg-amber-50/30" },
          { val: reviewedToday, label: "Done Today", color: "text-teal-600", bg: "bg-teal-50/30" },
          { val: totalReviewed, label: "Total Reviews", color: "text-slate-600", bg: "bg-slate-50/30" },
          { 
            val: avgScoreToday > 0 ? `${avgScoreToday}` : "—", 
            label: "Score (Today)", 
            color: avgScoreToday >= 90 ? "text-green-600" : "text-amber-600", 
            bg: "bg-white" 
          },
          { 
            val: avgScore > 0 ? `${avgScore}` : "—", 
            label: "Score (Weekly)", 
            color: "text-slate-700", 
            bg: "bg-white" 
          },
          { 
            val: `${correctionRateToday}%`, 
            label: "Revision Rate", 
            color: correctionRateToday > 20 ? "text-red-600" : "text-teal-600", 
            bg: "bg-white" 
          },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} border border-slate-200 rounded-2xl p-4 shadow-sm transition-transform hover:scale-[1.02]`}>
            <p className={`text-2xl font-black tabular-nums leading-tight ${s.color}`}>{s.val}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Secondary Detailed Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Revisions</p>
            <p className="text-2xl font-black text-slate-800 tabular-nums">{corrections}</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded-md">
              {correctionRate}% AVG
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Roster</p>
            <p className="text-2xl font-black text-slate-800 tabular-nums">{contributors.length}</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md uppercase">
              Contributors
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Project Health</p>
            <p className={`text-2xl font-black tabular-nums ${avgScore >= 90 ? "text-teal-600" : avgScore >= 70 ? "text-amber-600" : "text-red-600"}`}>
              {avgScore > 0 ? `${avgScore}%` : "—"}
            </p>
          </div>
          <div className="text-right">
            <div className={`w-3 h-3 rounded-full inline-block ${avgScore >= 85 ? "bg-teal-500 animate-pulse" : "bg-amber-400"}`} />
          </div>
        </div>
      </div>
    </div>
  );
}