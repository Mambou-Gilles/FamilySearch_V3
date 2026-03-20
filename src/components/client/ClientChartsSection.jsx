import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from "recharts";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];
const ESC_PAGE = 15;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-semibold">{p.value?.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
};

function EscalationsTable({ escalations: initialEscalations }) {
  const [page, setPage] = useState(0);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortDir, setSortDir] = useState("desc"); // newest first
  const [dismissed, setDismissed] = useState(new Set());

  const visible = initialEscalations.filter(t => !dismissed.has(t.id));

  const filtered = visible.filter(t => {
    const d = t.date_completed ? new Date(t.date_completed) : null;
    if (dateFrom && d && d < new Date(dateFrom)) return false;
    if (dateTo && d && d > new Date(dateTo + "T23:59:59")) return false;
    return true;
  }).sort((a, b) => {
    const da = a.date_completed ? new Date(a.date_completed) : 0;
    const db = b.date_completed ? new Date(b.date_completed) : 0;
    return sortDir === "desc" ? db - da : da - db;
  });

  const totalPages = Math.ceil(filtered.length / ESC_PAGE);
  const paged = filtered.slice(page * ESC_PAGE, (page + 1) * ESC_PAGE);

  function dismiss(id) {
    setDismissed(prev => new Set([...prev, id]));
    setPage(0);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Escalations</h3>
          <p className="text-xs text-slate-400">{filtered.length} of {visible.length} tasks requiring FamilySearch review</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">From</span>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          <span className="text-xs text-slate-500">To</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); setPage(0); }}
              className="text-xs text-slate-400 hover:text-slate-700 underline">Clear</button>
          )}
          <button onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center gap-1">
            Date {sortDir === "desc" ? "↓" : "↑"}
          </button>
          <span className="text-xs bg-red-100 text-red-600 font-semibold px-2.5 py-1 rounded-full">{filtered.length}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">URL</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contributor</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contributor Reason</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reviewer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reviewer Notes</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paged.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-slate-400">No escalations match the selected date range</td></tr>
            )}
            {paged.map(t => (
              <tr key={t.id} className="hover:bg-red-50 transition-colors">
                <td className="px-4 py-3 max-w-[160px]">
                  <a href={t.url} target="_blank" rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline text-xs font-mono block truncate max-w-[150px]" title={t.url}>
                    {t.url}
                  </a>
                </td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{t.contributor_name || "—"}</td>
                <td className="px-4 py-3 text-xs text-red-700 font-medium max-w-[160px]">
                  <span className="block truncate" title={t.hint_result || t.duplicate_result || ""}>
                    {t.hint_result || t.duplicate_result || "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{t.reviewer_name || "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-600 max-w-[160px]">
                  <span className="block truncate" title={t.reviewer_notes || t.tree_work_review || ""}>
                    {t.reviewer_notes || t.tree_work_review || "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {t.date_completed ? new Date(t.date_completed).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => dismiss(t.id)}
                    className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 border border-red-200 rounded-lg px-2.5 py-1 transition-colors">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-500">{page * ESC_PAGE + 1}–{Math.min((page + 1) * ESC_PAGE, filtered.length)} of {filtered.length}</p>
          <div className="flex gap-1">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-40">‹</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => Math.max(0, page - 2) + i).filter(p => p < totalPages).map(p => (
              <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 text-xs rounded font-medium ${page === p ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-200"}`}>{p + 1}</button>
            ))}
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-40">›</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientChartsSection({ geoData, tasks, projectTasks }) {
  const statusMap = {};
  projectTasks.forEach(t => {
    const k = t.status || "unknown";
    if (!statusMap[k]) statusMap[k] = { name: k.replace(/_/g, " "), value: 0 };
    statusMap[k].value++;
  });
  const statusData = Object.values(statusMap).sort((a, b) => b.value - a.value);
  const statusTotal = statusData.reduce((s, d) => s + d.value, 0);

  const typeMap = {};
  tasks.forEach(t => {
    const k = t.project_type || "unknown";
    if (!typeMap[k]) typeMap[k] = { name: k.charAt(0).toUpperCase() + k.slice(1), value: 0 };
    typeMap[k].value++;
  });
  const typeData = Object.values(typeMap);

  const escalations = projectTasks.filter(t =>
    t.hint_result?.toLowerCase().includes("escalation") ||
    t.duplicate_result?.toLowerCase().includes("escalate") ||
    t.tree_work_review?.toLowerCase().includes("escalation") ||
    t.tree_work_review?.toLowerCase().includes("fs needed")
  );

  return (
    <div className="space-y-6">
      {/* Bar chart: progress by geo */}
      {geoData.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-1">Progress by Geography</h3>
          <p className="text-xs text-slate-400 mb-5">Completed, reviewed, and remaining URLs per region</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={geoData} barSize={20} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="geography" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
              <Bar dataKey="worked" fill="#6366f1" name="Completed" radius={[4, 4, 0, 0]} />
              <Bar dataKey="reviewed" fill="#22c55e" name="Reviewed" radius={[4, 4, 0, 0]} />
              <Bar dataKey="remaining" fill="#e2e8f0" name="Remaining" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Two donuts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status breakdown donut */}
        {statusData.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Status Breakdown</h3>
            <p className="text-xs text-slate-400 mb-4">Current status of tasks in this view</p>
            <div className="flex items-center gap-6">
              <PieChart width={140} height={140}>
                <Pie data={statusData} cx={65} cy={65} innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
              <div className="flex-1 space-y-2">
                {statusData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-slate-700 capitalize">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{d.value.toLocaleString()}</span>
                      <span className="text-slate-400">{statusTotal ? Math.round(d.value / statusTotal * 100) : 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Type breakdown donut */}
        {typeData.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Tasks by Project Type</h3>
            <p className="text-xs text-slate-400 mb-4">Distribution across all system tasks</p>
            <div className="flex items-center gap-6">
              <PieChart width={140} height={140}>
                <Pie data={typeData} cx={65} cy={65} innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
              <div className="flex-1 space-y-2">
                {typeData.map((d, i) => {
                  const total = typeData.reduce((s, x) => s + x.value, 0);
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-slate-700">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{d.value.toLocaleString()}</span>
                        <span className="text-slate-400">{total ? Math.round(d.value / total * 100) : 0}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {escalations.length > 0 && <EscalationsTable escalations={escalations} />}
    </div>
  );
}