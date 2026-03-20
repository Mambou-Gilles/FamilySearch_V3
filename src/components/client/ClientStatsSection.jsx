function StatCard({ label, value, sub, color = "indigo", warning, icon }) {
  const palette = {
    indigo: { bg: "bg-indigo-600", light: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-100" },
    green:  { bg: "bg-green-600",  light: "bg-green-50",  text: "text-green-700",  border: "border-green-100" },
    amber:  { bg: "bg-amber-500",  light: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-100" },
    red:    { bg: "bg-red-600",    light: "bg-red-50",    text: "text-red-700",    border: "border-red-100" },
    slate:  { bg: "bg-slate-500",  light: "bg-slate-50",  text: "text-slate-600",  border: "border-slate-200" },
    purple: { bg: "bg-purple-600", light: "bg-purple-50", text: "text-purple-700", border: "border-purple-100" },
  };
  const p = palette[color] || palette.indigo;

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${p.border} ${p.light} p-5 flex flex-col gap-2`}>
      <div className="flex items-start justify-between">
        <p className={`text-xs font-semibold uppercase tracking-wider ${p.text} opacity-80`}>{label}</p>
        {warning && (
          <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">⚠ {warning}</span>
        )}
      </div>
      <p className={`text-3xl font-extrabold ${p.text} leading-none`}>{value ?? "—"}</p>
      {sub && <p className={`text-xs ${p.text} opacity-60`}>{sub}</p>}
      {/* Decorative corner accent */}
      <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full ${p.bg} opacity-10`} />
    </div>
  );
}

export default function ClientStatsSection({ isHints, worked, projectTasks, remaining, reviewRate, avgScore, qualsCreated, newPersonsAdded, hintsNeedingFSReview, hintsUnableAccess, dupsNeedingFSReview, dupsIncorrectMerge, reviewed=[] }) {
  const pct = projectTasks.length ? Math.round((worked.length / projectTasks.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress strip */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-slate-800">Overall Project Completion</p>
            <p className="text-xs text-slate-400">{worked.length} of {projectTasks.length} URLs worked</p>
          </div>
          <span className={`text-2xl font-extrabold ${pct >= 80 ? "text-green-600" : pct >= 50 ? "text-indigo-600" : "text-amber-600"}`}>{pct}%</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isHints ? (
          <>
            <StatCard label="Qualifications Created" value={qualsCreated.toLocaleString()} color="green" />
            <StatCard label="URLs Completed" value={worked.length.toLocaleString()} sub={`of ${projectTasks.length} total`} color="indigo" />
            <StatCard label="URLs Remaining" value={remaining.length.toLocaleString()} color="slate" />
            <StatCard label="New Persons Added" value={newPersonsAdded.toLocaleString()} color="green" />
            <StatCard label="% Reviewed" value={`${reviewRate}%`} sub="Target: 20%+" color={reviewRate >= 20 ? "green" : "amber"} warning={reviewRate < 20 ? "Below target" : null} />
            <StatCard label="Avg Quality Score" value={`${avgScore}%`} sub="Target: 90%+" color={avgScore >= 90 ? "green" : avgScore > 0 ? "amber" : "slate"} warning={avgScore < 90 && reviewed.length > 0 ? "Below target" : null} />
            <StatCard label="Needs FS Review" value={hintsNeedingFSReview.length} color="red" sub="Escalations" />
            <StatCard label="Unable to Access" value={hintsUnableAccess.length} color="amber" sub="Result code 6" />
          </>
        ) : (
          <>
            <StatCard label="Qualifications Created" value={qualsCreated.toLocaleString()} color="green" />
            <StatCard label="URLs Worked" value={worked.length.toLocaleString()} sub={`of ${projectTasks.length} total`} color="indigo" />
            <StatCard label="URLs Remaining" value={remaining.length.toLocaleString()} color="slate" />
            <StatCard label="% Reviewed" value={`${reviewRate}%`} sub="Target: 20%+" color={reviewRate >= 20 ? "green" : "amber"} warning={reviewRate < 20 ? "Below target" : null} />
            <StatCard label="Avg Quality Score" value={`${avgScore}%`} sub="Target: 90%+" color={avgScore >= 90 ? "green" : avgScore > 0 ? "amber" : "slate"} warning={avgScore < 90 && reviewed.length > 0 ? "Below target" : null} />
            <StatCard label="Needs FS Review" value={dupsNeedingFSReview.length} color="red" sub="Escalations" />
            <StatCard label="Incorrectly Merged" value={dupsIncorrectMerge.length} color="red" sub="Not same person" />
          </>
        )}
      </div>
    </div>
  );
}