import { useState, useMemo } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Legend, LineChart, Line, CartesianGrid 
} from "recharts";
import { ChevronLeft, ChevronRight, Users, Search, X } from "lucide-react";
import GeoKpiChart from "@/components/GeoKpiChart";
import DonutChartCard from "@/components/shared/DonutChartCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 12;

export default function ManagerChartsTab({ tasks, contributors, getContribStats }) {
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

  const totalTasks = tasks.length;

  // 2. Filter and Paginate Contributor Data
  const { paginatedData, totalPages, totalFiltered } = useMemo(() => {
    // First, calculate all stats
    let filtered = contributors.map(a => {
      const s = getContribStats(a.user_email);
      return {
        name: a.user_name?.split(" ")[0] || a.user_name,
        fullName: a.user_name || "",
        email: a.user_email,
        completed: s.completed || 0,
        avgQ: s.avgQ ?? 0,
        errorRate: s.errorRate ?? 0,
        target: 10
      };
    }).sort((a, b) => b.completed - a.completed);

    // Apply Search Filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(c => 
        c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    const total = Math.ceil(filtered.length / PAGE_SIZE);
    const start = currentPage * PAGE_SIZE;
    const batch = filtered.slice(start, start + PAGE_SIZE);

    return { 
      paginatedData: batch, 
      totalPages: total, 
      totalFiltered: filtered.length 
    };
  }, [contributors, getContribStats, currentPage, searchQuery]);

  const handleNext = () => setCurrentPage(p => Math.min(p + 1, totalPages - 1));
  const handlePrev = () => setCurrentPage(p => Math.max(p - 1, 0));

  // Reset page when searching
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(0);
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      
      {/* Geography Progress */}
      <div className="w-full bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Progress by Geography</h3>
        <p className="text-xs text-slate-400 mb-4">Cumulative progress across regions</p>
        <GeoKpiChart tasks={tasks} />
      </div>

      {/* Task Breakdown */}
      <div className="w-full">
        <DonutChartCard
          title="Task Status Breakdown"
          subtitle="Overall distribution for all contributors"
          data={statusData}
          tooltipFormatter={(v) => [`${v} (${totalTasks ? Math.round(v / totalTasks * 100) : 0}%)`, ""]}
        />
      </div>

      <hr className="border-slate-100" />

      {/* SEARCH & PAGINATION BAR */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200 gap-4">
        <div className="flex flex-col w-full md:w-auto">
          <h3 className="text-sm font-bold text-slate-800">Contributor Analytics</h3>
          <p className="text-[11px] text-slate-500">
            {searchQuery ? `Found ${totalFiltered} matches` : `Showing ${currentPage * PAGE_SIZE + 1} - ${Math.min((currentPage + 1) * PAGE_SIZE, totalFiltered)} of ${totalFiltered}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by name or email..." 
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-9 h-9 text-xs bg-white border-slate-200"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>

          {/* Nav Controls (Hide if only 1 page) */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrev} 
                disabled={currentPage === 0}
                className="h-9 w-9 p-0 bg-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-[11px] font-bold text-slate-600 min-w-[60px] text-center">
                {currentPage + 1} / {totalPages}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNext} 
                disabled={currentPage >= totalPages - 1}
                className="h-9 w-9 p-0 bg-white"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* CHARTS SECTION */}
      {paginatedData.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          
          {/* Bar Chart */}
          <div className="w-full bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Batch Performance: Volume & Quality</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={paginatedData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: 12 }} 
                  cursor={{ fill: '#f8fafc' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 15 }} />
                <Bar dataKey="completed" fill="#6366f1" name="Tasks Completed" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="avgQ" fill="#10b981" name="Avg Score (0-100)" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Line Chart */}
          <div className="w-full bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Batch Performance: Error Rates</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={paginatedData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 'auto']} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: 12 }} 
                  formatter={(v) => [`${v}%`, "Error Rate"]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 15 }} />
                <Line 
                  type="monotone" 
                  dataKey="errorRate" 
                  name="Current Error %"
                  stroke="#ef4444" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: "#ef4444", strokeWidth: 2, stroke: "#fff" }} 
                  activeDot={{ r: 6 }} 
                />
                <Line 
                  type="step" 
                  dataKey="target" 
                  name="Quality Target (10%)"
                  stroke="#f59e0b" 
                  strokeWidth={2} 
                  strokeDasharray="5 5" 
                  dot={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

        </div>
      ) : (
        <div className="p-20 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No results found for "{searchQuery}"</p>
          <Button variant="link" onClick={() => setSearchQuery("")} className="text-indigo-600">Clear search</Button>
        </div>
      )}
    </div>
  );
}
