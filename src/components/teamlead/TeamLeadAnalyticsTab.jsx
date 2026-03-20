import { useState, useMemo } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Legend, LineChart, Line, Cell, CartesianGrid 
} from "recharts";
import { ChevronLeft, ChevronRight, Search, X, Users, PieChart } from "lucide-react";
import GeoKpiChart from "@/components/GeoKpiChart";
import DonutChartCard from "@/components/shared/DonutChartCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 12;
const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

// Custom Tick to show Name and Role
const CustomizedAxisTick = ({ x, y, payload }) => {
  if (!payload || !payload.value) return null;
  const parts = payload.value.split(" | ");
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight="600">
        {parts[0]}
      </text>
      <text x={0} y={0} dy={24} textAnchor="middle" fill="#94a3b8" fontSize={8} fontWeight="400">
        {parts[1] || ""}
      </text>
    </g>
  );
};

export default function TeamLeadChartsTab({ tasks, contributors, getContribStats, getReviewerStats }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Calculate Status Distribution (Project Wide)
  const statusData = useMemo(() => {
    const statusMap = {};
    tasks.forEach(t => {
      const k = t.status || "unknown";
      if (!statusMap[k]) statusMap[k] = { name: k.replace(/_/g, " "), value: 0 };
      statusMap[k].value++;
    });
    return Object.values(statusMap);
  }, [tasks]);

  // 2. Filter and Paginate Contributor Data
  const { paginatedData, totalPages, totalFiltered } = useMemo(() => {
    let allData = contributors.map(a => {
      const isReviewer = a.role === "reviewer";
      const s = getContribStats(a.user_email);
      const r = typeof getReviewerStats === 'function' ? getReviewerStats(a.user_email) : { reviewed: 0 };
      
      const displayActivity = isReviewer ? (r.reviewed || s.completed) : s.completed;
      const roleLabel = isReviewer ? "Reviewer" : "Contrib.";

      return {
        fullName: a.user_name || "",
        email: a.user_email,
        name: `${a.user_name?.split(" ")[0] || "User"} | ${roleLabel}`,
        completed: displayActivity,
        avgQ: s.avgQ ?? 0,
        errorRate: s.errorRate ?? 0,
        target: 10,
        barColor: isReviewer ? "#22c55e" : "#6366f1"
      };
    }).sort((a, b) => b.completed - a.completed);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      allData = allData.filter(c => 
        c.fullName.toLowerCase().includes(q) || 
        c.email.toLowerCase().includes(q)
      );
    }

    const total = Math.ceil(allData.length / PAGE_SIZE);
    const start = currentPage * PAGE_SIZE;
    const batch = allData.slice(start, start + PAGE_SIZE);

    return { 
      paginatedData: batch, 
      totalPages: total, 
      totalFiltered: allData.length 
    };
  }, [contributors, getContribStats, getReviewerStats, currentPage, searchQuery]);

  return (
    <div className="flex flex-col gap-6 pb-10">
      
      {/* 1. Global Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Geography Progress</h3>
          <p className="text-xs text-slate-400 mb-4">Cumulative progress across regions</p>
          <GeoKpiChart tasks={tasks} />
        </div>

        <DonutChartCard
          title="Task Status Breakdown"
          subtitle="Overall distribution for your team"
          data={statusData}
          colors={CHART_COLORS}
        />
      </div>

      <hr className="border-slate-100" />

      {/* 2. SEARCH & PAGINATION BAR */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200 gap-4">
        <div className="flex flex-col w-full md:w-auto">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" /> Contributor Analytics
          </h3>
          <p className="text-[11px] text-slate-500">
            {searchQuery ? `Found ${totalFiltered} matches` : `Showing ${totalFiltered} contributors`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by name or email..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(0); }}
              className="pl-9 h-9 text-xs bg-white"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" size="sm" 
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))} 
                disabled={currentPage === 0}
                className="h-9 w-9 p-0 bg-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-[11px] font-bold text-slate-600 min-w-[50px] text-center">
                {currentPage + 1} / {totalPages}
              </span>
              <Button 
                variant="outline" size="sm" 
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} 
                disabled={currentPage >= totalPages - 1}
                className="h-9 w-9 p-0 bg-white"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 3. PAGINATED CHARTS SECTION */}
      {paginatedData.length > 0 ? (
        <div className="grid grid-cols-1 gap-8">
          
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Volume & Quality Performance</h3>
            <p className="text-xs text-slate-400 mb-6">Output vs. Avg Quality Score</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={paginatedData} barGap={8} margin={{ bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" interval={0} tick={<CustomizedAxisTick />} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: 12 }} 
                  labelFormatter={(val) => val.split(" | ")[0]}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 11, paddingBottom: 20 }} />
                <Bar dataKey="completed" name="Output (Tasks)" radius={[4, 4, 0, 0]} barSize={20}>
                  {paginatedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.barColor} />
                  ))}
                </Bar>
                <Bar dataKey="avgQ" fill="#e2e8f0" name="Avg Score %" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Error Rate Trends</h3>
            <p className="text-xs text-slate-400 mb-6">% of tasks requiring correction — Target 10%</p>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={paginatedData} margin={{ bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" interval={0} tick={<CustomizedAxisTick />} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: 12 }}
                  labelFormatter={(val) => val.split(" | ")[0]}
                  formatter={(v) => [`${v}%`, "Error Rate"]}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 11, paddingBottom: 20 }} />
                <Line type="monotone" dataKey="errorRate" name="Current Error %" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: "#ef4444", strokeWidth: 2, stroke: "#fff" }} />
                <Line type="step" dataKey="target" name="Quality Target (10%)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="p-20 text-center bg-white border border-slate-200 rounded-2xl shadow-sm">
          <PieChart className="w-10 h-10 mx-auto text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No results found for "{searchQuery}"</p>
          <Button variant="link" onClick={() => setSearchQuery("")} className="text-indigo-600">Clear search</Button>
        </div>
      )}
    </div>
  );
}









// import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Cell } from "recharts";
// import GeoKpiChart from "@/components/GeoKpiChart";
// import DonutChartCard from "@/components/shared/DonutChartCard";

// const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

// // Custom Tick to show Name and Role
// const CustomizedAxisTick = ({ x, y, payload }) => {
//   const parts = payload.value.split(" | ");
//   return (
//     <g transform={`translate(${x},${y})`}>
//       <text x={0} y={0} dy={12} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight="600">
//         {parts[0]}
//       </text>
//       <text x={0} y={0} dy={24} textAnchor="middle" fill="#94a3b8" fontSize={8} fontWeight="400">
//         {parts[1]}
//       </text>
//     </g>
//   );
// };

// export default function TeamLeadChartsTab({ tasks, contributors, getContribStats, getReviewerStats }) {
//   // 1. Status Distribution
//   const statusMap = {};
//   tasks.forEach(t => {
//     const k = t.status || "unknown";
//     if (!statusMap[k]) statusMap[k] = { name: k.replace(/_/g," "), value: 0 };
//     statusMap[k].value++;
//   });
//   const statusData = Object.values(statusMap);

//   // 2. Bar Data (Output vs Score)
//   const barData = contributors.map(a => {
//     const isReviewer = a.role === "reviewer";
//     const s = getContribStats(a.user_email);
//     const r = typeof getReviewerStats === 'function' ? getReviewerStats(a.user_email) : { reviewed: 0 };
    
//     const displayActivity = isReviewer ? (r.reviewed || s.completed) : s.completed;
//     const roleColor = isReviewer ? "#22c55e" : "#6366f1";
//     const roleLabel = isReviewer ? "Reviewer" : "Contrib.";

//     return { 
//       // Encoding role into the name for the custom tick
//       name: `${a.user_name?.split(" ")[0] || "User"} | ${roleLabel}`, 
//       completed: displayActivity, 
//       avgQ: s.avgQ ?? 0,
//       barColor: roleColor
//     };
//   });

//   // 3. Line Data (Error Rate)
//   const lineData = contributors.map(a => {
//     const s = getContribStats(a.user_email);
//     const roleLabel = a.role === "reviewer" ? "Reviewer" : "Contrib.";
//     return { 
//       name: `${a.user_name?.split(" ")[0] || "User"} | ${roleLabel}`, 
//       "Error Rate (%)": s.errorRate ?? 0, 
//       "Target": 10 
//     };
//   });

//   return (
//     <div className="flex flex-col gap-8">
//       {/* Geography Progress */}
//       <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
//         <h3 className="text-sm font-semibold text-slate-800 mb-1">Team Progress by Geography</h3>
//         <p className="text-xs text-slate-400 mb-4">Completed vs. reviewed (date range)</p>
//         {tasks.length === 0 ? (
//           <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No task data</div>
//         ) : (
//           <GeoKpiChart tasks={tasks} />
//         )}
//       </div>

//       {/* Status Breakdown */}
//       {tasks.length > 0 && (
//         <DonutChartCard
//           title="Task Status"
//           subtitle="All tasks in team's geography"
//           data={statusData}
//           colors={CHART_COLORS}
//         />
//       )}

//       {/* Performance Bar Chart */}
//       {contributors.length > 0 && (
//         <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
//           <h3 className="text-sm font-semibold text-slate-800 mb-1">Contributor Performance</h3>
//           <p className="text-xs text-slate-400 mb-4">Completed (Indigo) / Reviewed (Green) & avg score</p>
//           <ResponsiveContainer width="100%" height={280}>
//             <BarChart data={barData} barSize={20} margin={{ bottom: 20 }}>
//               <XAxis 
//                 dataKey="name" 
//                 interval={0} 
//                 tick={<CustomizedAxisTick />} 
//                 axisLine={false} 
//                 tickLine={false} 
//               />
//               <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
//               <Tooltip 
//                 contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }} 
//                 labelFormatter={(value) => value.split(" | ")[0]} // Hide role in tooltip label for cleanliness
//               />
//               <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 20 }} />
//               <Bar dataKey="completed" name="Output" radius={[4, 4, 0, 0]}>
//                 {barData.map((entry, index) => (
//                   <Cell key={`cell-${index}`} fill={entry.barColor} />
//                 ))}
//               </Bar>
//               <Bar dataKey="avgQ" fill="#e2e8f0" name="Avg Score" radius={[4, 4, 0, 0]} />
//             </BarChart>
//           </ResponsiveContainer>
//         </div>
//       )}

//       {/* Error Rate Line Chart */}
//       {contributors.length > 0 && (
//         <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
//           <h3 className="text-sm font-semibold text-slate-800 mb-1">Error Rate by Contributor</h3>
//           <p className="text-xs text-slate-400 mb-4">% of reviewed tasks with corrections — target &lt;10%</p>
//           <ResponsiveContainer width="100%" height={280}>
//             <LineChart data={lineData} margin={{ bottom: 20 }}>
//               <XAxis 
//                 dataKey="name" 
//                 interval={0} 
//                 tick={<CustomizedAxisTick />} 
//                 axisLine={false} 
//                 tickLine={false} 
//               />
//               <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} axisLine={false} tickLine={false} />
//               <Tooltip 
//                 contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }} 
//                 formatter={(v) => [`${v}%`, ""]}
//                 labelFormatter={(value) => value.split(" | ")[0]}
//               />
//               <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 20 }} />
//               <Line type="monotone" dataKey="Error Rate (%)" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4, fill: "#ef4444" }} activeDot={{ r: 6 }} />
//               <Line type="monotone" dataKey="Target" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
//             </LineChart>
//           </ResponsiveContainer>
//         </div>
//       )}
//     </div>
//   );
// }