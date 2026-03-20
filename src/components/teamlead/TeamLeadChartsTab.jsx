import { useState, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend, CartesianGrid
} from "recharts";
import { AlertTriangle, TrendingUp, TrendingDown, CheckCircle, Star, Users, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 12;

function InsightCard({ icon: Icon, color, title, text }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${color}`}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs font-semibold">{title}</p>
        <p className="text-xs mt-0.5 opacity-80">{text}</p>
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, highlight }) {
  return (
    <div className={`rounded-xl p-4 text-center border ${highlight || "bg-slate-50 border-slate-200"}`}>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

export default function TeamLeadAnalyticsTab({ tasks, contributors, getContribStats, getReviewerStats }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const analytics = useMemo(() => {
    const now = new Date();

    // --- 1. Daily throughput last 21 days (Static Team View) ---
    const dailyMap = {};
    for (let i = 20; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = {
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        completed: 0, reviewed: 0
      };
    }
    tasks.forEach(t => {
      if (t.date_completed) {
        const key = t.date_completed.split("T")[0];
        if (dailyMap[key]) {
          if (["completed","in_review","needs_correction","reviewed"].includes(t.status)) dailyMap[key].completed++;
          if (t.status === "reviewed") dailyMap[key].reviewed++;
        }
      }
    });
    const dailyData = Object.values(dailyMap);

    const thisWeek = dailyData.slice(14).reduce((s, d) => s + d.completed, 0);
    const lastWeek = dailyData.slice(7, 14).reduce((s, d) => s + d.completed, 0);
    const wowPct = lastWeek ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;

    // --- 2. Per-member data calculation ---
    const allContribData = contributors.map(a => {
      const isReviewer = a.role === "reviewer";
      const s = getContribStats(a.user_email);
      const r = typeof getReviewerStats === 'function' ? getReviewerStats(a.user_email) : { reviewed: 0 };
      const displayActivity = isReviewer ? (r.reviewed || s.completed) : s.completed;

      return {
        name: a.user_name?.split(" ")[0] || a.user_email,
        fullName: a.user_name || "",
        email: a.user_email,
        role: a.role,
        completed: displayActivity,
        avgQ: s.avgQ ?? 0,
        errorRate: s.errorRate ?? 0,
        target: 10,
        reviewed: s.reviewed
      };
    }).sort((a, b) => b.completed - a.completed);

    // --- 3. Insights (Calculated on full team) ---
    const totalCompleted = allContribData.reduce((s, c) => s + c.completed, 0);
    const avgDaily = dailyData.filter(d => d.completed > 0).length
      ? Math.round(totalCompleted / dailyData.filter(d => d.completed > 0).length)
      : 0;
    const teamAvgScore = allContribData.filter(c => c.avgQ > 0).length
      ? Math.round(allContribData.filter(c => c.avgQ > 0).reduce((s, c) => s + c.avgQ, 0) / allContribData.filter(c => c.avgQ > 0).length)
      : 0;
    const teamAvgError = allContribData.filter(c => c.reviewed > 0).length
      ? Math.round(allContribData.filter(c => c.reviewed > 0).reduce((s, c) => s + c.errorRate, 0) / allContribData.filter(c => c.reviewed > 0).length)
      : 0;

    const insights = [];
    const atRisk = allContribData.filter(c => c.errorRate > 20 && c.reviewed > 3);
    if (atRisk.length > 0) insights.push({ icon: AlertTriangle, color: "bg-red-50 border-red-200 text-red-800", title: "Quality Alert", text: `${atRisk.map(c => c.name).join(", ")} above 20% error rate.` });
    if (wowPct > 20) insights.push({ icon: TrendingUp, color: "bg-green-50 border-green-200 text-green-800", title: "Team Output Rising", text: `Output increased ${wowPct}% this week.` });
    if (teamAvgScore >= 90) insights.push({ icon: Star, color: "bg-indigo-50 border-indigo-200 text-indigo-800", title: "High Quality Team", text: `Avg quality score is ${teamAvgScore}%!` });

    return { dailyData, allContribData, totalCompleted, avgDaily, teamAvgScore, teamAvgError, wowPct, insights };
  }, [tasks, contributors, getContribStats, getReviewerStats]);

  // --- 4. Filtering & Pagination Logic (The "Manager" Logic) ---
  const { paginatedData, totalPages, totalFiltered } = useMemo(() => {
    let filtered = analytics.allContribData;
    if (searchQuery.trim()) {
      filtered = filtered.filter(c => 
        c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return {
      paginatedData: filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
      totalPages: Math.ceil(filtered.length / PAGE_SIZE),
      totalFiltered: filtered.length
    };
  }, [analytics.allContribData, currentPage, searchQuery]);

  if (!contributors.length) return (
    <div className="text-center py-12 text-slate-400 text-sm">No contributors assigned to your team yet.</div>
  );

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Total Completed" value={analytics.totalCompleted} sub="in range" highlight="bg-indigo-50 border-indigo-100" />
        <StatBox label="Avg Daily (Team)" value={analytics.avgDaily} sub="active days" />
        <StatBox label="Team Avg Score" value={analytics.teamAvgScore > 0 ? `${analytics.teamAvgScore}%` : "—"} sub="quality" />
        <StatBox label="Team Error Rate" value={analytics.teamAvgError > 0 ? `${analytics.teamAvgError}%` : "—"} sub="target <10%" />
      </div>

      {/* Daily Area Chart (Full Team) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Team Daily Output</h3>
            <p className="text-[11px] text-slate-400">Activity trends for the last 21 days</p>
          </div>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${analytics.wowPct > 0 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
            {analytics.wowPct > 0 ? "↑" : "↓"} {Math.abs(analytics.wowPct)}% WoW
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={analytics.dailyData}>
            <defs>
              <linearGradient id="tlComp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 10, fontSize: 11, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            <Area type="monotone" dataKey="completed" stroke="#6366f1" strokeWidth={2} fill="url(#tlComp)" name="Tasks Completed" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <hr className="border-slate-100" />

      {/* SEARCH & PAGINATION (The Refined Controls) */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200 gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" /> Student Performance Charts
          </h3>
          <p className="text-[11px] text-slate-500">
            {searchQuery ? `Found ${totalFiltered} students` : `Viewing ${paginatedData.length} students`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search student..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(0); }}
              className="pl-9 h-9 text-xs bg-white"
            />
            {searchQuery && <X className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 cursor-pointer" onClick={() => setSearchQuery("")} />}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 0} className="h-8 w-8 p-0"><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-[10px] font-bold w-12 text-center">{currentPage + 1}/{totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages - 1} className="h-8 w-8 p-0"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </div>
      </div>

      {/* INDIVIDUAL PERFORMANCE CHARTS */}
      {paginatedData.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {/* Bar Chart: Output & Quality */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Volume & Quality Comparison</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={paginatedData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 11 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                <Bar dataKey="completed" fill="#6366f1" name="Completed" radius={[4, 4, 0, 0]} barSize={15} />
                <Bar dataKey="avgQ" fill="#10b981" name="Avg Score %" radius={[4, 4, 0, 0]} barSize={15} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Line Chart: Error Rates */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Student Error Rates</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={paginatedData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis unit="%" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 11 }} />
                <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Target", fill: "#f59e0b", fontSize: 9 }} />
                <Line type="monotone" dataKey="errorRate" name="Error Rate" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: "#ef4444" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="p-10 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-xs">
          No students match your search.
        </div>
      )}

      {/* Insights Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Insights & Coaching Cues</h3>
        <div className="space-y-2">
          {analytics.insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
        </div>
      </div>
    </div>
  );
}










// import { useMemo } from "react";
// import {
//   AreaChart, Area, BarChart, Bar,
//   XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend
// } from "recharts";
// import { AlertTriangle, TrendingUp, TrendingDown, CheckCircle, Star, Users } from "lucide-react";

// function InsightCard({ icon: Icon, color, title, text }) {
//   return (
//     <div className={`flex items-start gap-3 p-3 rounded-lg border ${color}`}>
//       <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
//       <div>
//         <p className="text-xs font-semibold">{title}</p>
//         <p className="text-xs mt-0.5 opacity-80">{text}</p>
//       </div>
//     </div>
//   );
// }

// function StatBox({ label, value, sub, highlight }) {
//   return (
//     <div className={`rounded-xl p-4 text-center border ${highlight || "bg-slate-50 border-slate-200"}`}>
//       <p className="text-2xl font-bold text-slate-800">{value}</p>
//       {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
//       <p className="text-xs text-slate-500 mt-1">{label}</p>
//     </div>
//   );
// }

// export default function TeamLeadAnalyticsTab({ tasks, contributors, getContribStats, getReviewerStats }) {
//   const analytics = useMemo(() => {
//     const now = new Date();

//     // --- Daily throughput last 21 days ---
//     const dailyMap = {};
//     for (let i = 20; i >= 0; i--) {
//       const d = new Date(now);
//       d.setDate(d.getDate() - i);
//       const key = d.toISOString().split("T")[0];
//       dailyMap[key] = {
//         label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
//         completed: 0, reviewed: 0
//       };
//     }
//     tasks.forEach(t => {
//       if (t.date_completed) {
//         const key = t.date_completed.split("T")[0];
//         if (dailyMap[key]) {
//           if (["completed","in_review","needs_correction","reviewed"].includes(t.status)) dailyMap[key].completed++;
//           if (t.status === "reviewed") dailyMap[key].reviewed++;
//         }
//       }
//     });
//     const dailyData = Object.values(dailyMap);

//     const thisWeek = dailyData.slice(14).reduce((s, d) => s + d.completed, 0);
//     const lastWeek = dailyData.slice(7, 14).reduce((s, d) => s + d.completed, 0);
//     const wowPct = lastWeek ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;

//     // --- Per-member data ---
//     const contribData = contributors.map(a => {
//       const isReviewer = a.role === "reviewer";
//       const s = getContribStats(a.user_email);
//       const r = typeof getReviewerStats === 'function' ? getReviewerStats(a.user_email) : { reviewed: 0 };
//       const displayActivity = isReviewer ? (r.reviewed || s.completed) : s.completed;

//       return {
//         name: a.user_name?.split(" ")[0] || a.user_email,
//         fullName: a.user_name,
//         email: a.user_email,
//         role: a.role,
//         completed: displayActivity,
//         avgQ: s.avgQ ?? 0,
//         errorRate: s.errorRate ?? 0,
//         corrections: s.corrections,
//         reviewed: s.reviewed, 
//       };
//     }).sort((a, b) => b.completed - a.completed);

//     const totalCompleted = contribData.reduce((s, c) => s + c.completed, 0);
//     const avgDaily = dailyData.filter(d => d.completed > 0).length
//       ? Math.round(totalCompleted / dailyData.filter(d => d.completed > 0).length)
//       : 0;
//     const teamAvgScore = contribData.filter(c => c.avgQ > 0).length
//       ? Math.round(contribData.filter(c => c.avgQ > 0).reduce((s, c) => s + c.avgQ, 0) / contribData.filter(c => c.avgQ > 0).length)
//       : 0;
//     const teamAvgError = contribData.filter(c => c.reviewed > 0).length
//       ? Math.round(contribData.filter(c => c.reviewed > 0).reduce((s, c) => s + c.errorRate, 0) / contribData.filter(c => c.reviewed > 0).length)
//       : 0;

//     const atRisk = contribData.filter(c => c.errorRate > 20 && c.reviewed > 3);

//     const insights = [];
//     if (atRisk.length > 0) insights.push({ icon: AlertTriangle, color: "bg-red-50 border-red-200 text-red-800", title: "Quality Alert", text: `${atRisk.map(c => c.name).join(", ")} ${atRisk.length === 1 ? "has" : "have"} error rates above 20%. Consider one-on-one coaching.` });
//     if (wowPct > 20) insights.push({ icon: TrendingUp, color: "bg-green-50 border-green-200 text-green-800", title: "Team Output Rising", text: `Team completed ${wowPct}% more tasks this week vs last. Great momentum!` });
//     else if (wowPct < -20 && lastWeek > 0) insights.push({ icon: TrendingDown, color: "bg-amber-50 border-amber-200 text-amber-800", title: "Output Declining", text: `Team output dropped ${Math.abs(wowPct)}% vs last week. Check for blockers.` });
//     if (teamAvgScore > 0 && teamAvgScore >= 90) insights.push({ icon: Star, color: "bg-indigo-50 border-indigo-200 text-indigo-800", title: "High Quality Team", text: `Team avg quality score is ${teamAvgScore}/100. Your students are performing at a high level.` });
    
//     if (contribData.length > 1) {
//       const max = contribData[0].completed;
//       const min = contribData[contribData.length - 1].completed;
//       if (max > 0 && min < max * 0.3) insights.push({ icon: Users, color: "bg-violet-50 border-violet-200 text-violet-800", title: "Uneven Workload", text: `Top contributor has ${max} tasks vs ${min} for the lowest. Consider redistributing assignments.` });
//     }
//     if (!insights.length) insights.push({ icon: CheckCircle, color: "bg-slate-50 border-slate-200 text-slate-700", title: "All Looking Good", text: "No critical issues detected. Keep monitoring as your team continues working." });

//     return { dailyData, contribData, totalCompleted, avgDaily, teamAvgScore, teamAvgError, wowPct, insights };
//   }, [tasks, contributors, getContribStats, getReviewerStats]);

//   if (!contributors.length) return (
//     <div className="text-center py-12 text-slate-400 text-sm">No contributors assigned to your team yet.</div>
//   );

//   return (
//     <div className="flex flex-col gap-5">
//       {/* Summary stats */}
//       <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
//         <StatBox label="Total Completed" value={analytics.totalCompleted} sub="in date range" highlight="bg-indigo-50 border-indigo-100" />
//         <StatBox label="Avg Daily (Team)" value={analytics.avgDaily} sub="active days" />
//         <StatBox label="Team Avg Score" value={analytics.teamAvgScore > 0 ? `${analytics.teamAvgScore}%` : "—"} sub="reviewed tasks" />
//         <StatBox label="Team Error Rate" value={analytics.teamAvgError > 0 ? `${analytics.teamAvgError}%` : "—"} sub="target <10%" />
//       </div>

//       {/* Daily throughput */}
//       <div className="bg-white border border-slate-200 rounded-xl p-5">
//         <div className="flex items-center justify-between mb-1">
//           <p className="text-sm font-semibold text-slate-800">Team Daily Output — Last 21 Days</p>
//           <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${analytics.wowPct > 0 ? "bg-green-100 text-green-700" : analytics.wowPct < 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>
//             {analytics.wowPct > 0 ? "↑" : analytics.wowPct < 0 ? "↓" : "→"} {Math.abs(analytics.wowPct)}% WoW
//           </span>
//         </div>
//         <p className="text-xs text-slate-400 mb-4">Completed & reviewed tasks per day across the whole team</p>
//         <ResponsiveContainer width="100%" height={170}>
//           <AreaChart data={analytics.dailyData}>
//             <defs>
//               <linearGradient id="tlComp" x1="0" y1="0" x2="0" y2="1">
//                 <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
//                 <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
//               </linearGradient>
//               <linearGradient id="tlRev" x1="0" y1="0" x2="0" y2="1">
//                 <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
//                 <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
//               </linearGradient>
//             </defs>
//             <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} axisLine={false} tickLine={false} />
//             <YAxis tick={{ fontSize: 9 }} allowDecimals={false} width={22} axisLine={false} tickLine={false} />
//             <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
//             <Legend wrapperStyle={{ fontSize: 10 }} />
//             <Area type="monotone" dataKey="completed" stroke="#7c3aed" strokeWidth={2} fill="url(#tlComp)" name="Completed" />
//             <Area type="monotone" dataKey="reviewed" stroke="#22c55e" strokeWidth={2} fill="url(#tlRev)" name="Reviewed" />
//           </AreaChart>
//         </ResponsiveContainer>
//       </div>

//       {/* Output Chart - Full Width & No Grid */}
//       <div className="bg-white border border-slate-200 rounded-xl p-5">
//         <p className="text-sm font-semibold text-slate-800 mb-1">Output vs Quality by Student</p>
//         <p className="text-xs text-slate-400 mb-4">Tasks completed & avg score in date range</p>
//         <ResponsiveContainer width="100%" height={220}>
//           <BarChart data={analytics.contribData} barSize={12}>
//             <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
//             <YAxis yAxisId="left" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
//             <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" axisLine={false} tickLine={false} />
//             <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
//             <Legend wrapperStyle={{ fontSize: 10 }} />
//             <Bar yAxisId="left" dataKey="completed" fill="#7c3aed" name="Completed" radius={[3,3,0,0]} />
//             <Bar yAxisId="right" dataKey="avgQ" fill="#22c55e" name="Avg Score %" radius={[3,3,0,0]} />
//           </BarChart>
//         </ResponsiveContainer>
//       </div>

//       {/* Error Rate Chart - Full Width & No Grid */}
//       <div className="bg-white border border-slate-200 rounded-xl p-5">
//         <p className="text-sm font-semibold text-slate-800 mb-1">Error Rate by Student</p>
//         <p className="text-xs text-slate-400 mb-4">% of reviewed tasks requiring correction — target &lt;10%</p>
//         <ResponsiveContainer width="100%" height={220}>
//           <BarChart data={analytics.contribData} barSize={16}>
//             <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
//             <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" width={28} axisLine={false} tickLine={false} />
//             <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} formatter={(v) => [`${v}%`, ""]} />
//             <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Target 10%", fill: "#f59e0b", fontSize: 9 }} />
//             <Bar dataKey="errorRate" name="Error Rate %" fill="#ef4444" radius={[3,3,0,0]} />
//           </BarChart>
//         </ResponsiveContainer>
//       </div>

//       {/* Insights */}
//       <div className="bg-white border border-slate-200 rounded-xl p-5">
//         <p className="text-sm font-semibold text-slate-800 mb-3">Insights & Coaching Cues</p>
//         <div className="space-y-2">
//           {analytics.insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
//         </div>
//       </div>
//     </div>
//   );
// }