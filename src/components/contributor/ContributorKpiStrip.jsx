import React from 'react';

export default function ContributorKpiStrip({ queue, corrections, completedToday, history, accuracy }) {
  // Restore the exact base44 calculation logic for correctionRate
  // This ensures that only tasks in specific states are counted toward the performance ratio
  const relevantHistoryCount = history.filter(t => 
    ["completed", "reviewed", "needs_correction"].includes(t.status)
  ).length;

  const correctionRate = relevantHistoryCount
    ? Math.round((corrections.length / relevantHistoryCount) * 100)
    : 0;

  const kpis = [
    { val: queue.length, label: "In Queue", color: "text-indigo-600" },
    { val: corrections.length, label: "Corrections", color: "text-red-500" },
    { val: completedToday, label: "Completed Today", color: "text-green-600" },
    { val: `${accuracy}%`, label: "Avg Score", color: "text-amber-600" },
    { val: `${correctionRate}%`, label: "Correction Rate", color: correctionRate > 15 ? "text-red-600" : "text-emerald-600" },
  ];

  return (
    <div className="grid grid-cols-5 gap-0 border-b border-slate-200 bg-white">
      {kpis.map((kpi, i) => (
        <div key={i} className={`p-2 sm:p-3 text-center ${i < 4 ? "border-r border-slate-100" : ""}`}>
          <p className={`text-base sm:text-xl font-bold truncate ${kpi.color}`}>{kpi.val}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 leading-tight mt-0.5 truncate">{kpi.label}</p>
        </div>
      ))}
    </div>
  );
}