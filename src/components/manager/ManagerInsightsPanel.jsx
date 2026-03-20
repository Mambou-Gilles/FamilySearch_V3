import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from "recharts";
import { AlertTriangle, TrendingUp, TrendingDown, CheckCircle, Users, Zap } from "lucide-react";

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

export default function ManagerInsightsPanel({ tasks, contributors, getContribStats }) {
  const analytics = useMemo(() => {
    const now = new Date();

    // --- Daily throughput (last 30 days) ---
    const dailyMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = {
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        completed: 0, reviewed: 0, corrections: 0
      };
    }
    
    tasks.forEach(t => {
      if (t.date_completed) {
        const key = t.date_completed.split("T")[0];
        if (dailyMap[key]) {
          if (["completed","in_review","needs_correction","reviewed"].includes(t.status)) dailyMap[key].completed++;
          if (t.status === "reviewed") dailyMap[key].reviewed++;
          if ((t.correction_count || 0) > 0) dailyMap[key].corrections++;
        }
      }
    });
    const dailyData = Object.entries(dailyMap).map(([, v]) => v);

    // Week-over-week throughput
    const thisWeek = dailyData.slice(23).reduce((s, d) => s + d.completed, 0);
    const lastWeek = dailyData.slice(16, 23).reduce((s, d) => s + d.completed, 0);
    const throughputTrend = lastWeek ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;

    // Avg daily for forecast
    const activeDays = dailyData.filter(d => d.completed > 0);
    const avgDaily = activeDays.length ? Math.round(activeDays.reduce((s, d) => s + d.completed, 0) / activeDays.length) : 0;
    const remaining = tasks.filter(t => t.status === "available").length;
    const daysToComplete = avgDaily > 0 ? Math.ceil(remaining / avgDaily) : null;

    // --- Contributor comparison ---
    const contribData = contributors.map(a => {
      const s = getContribStats(a.user_email);
      return {
        name: a.user_name?.split(" ")[0] || a.user_email,
        completed: s.completed,
        avgQ: s.avgQ ?? 0,
        errorRate: s.errorRate ?? 0,
        corrections: s.corrections
      };
    }).sort((a, b) => b.completed - a.completed);

    // --- Bottleneck detection logic ---
    const insights = [];
    const available = tasks.filter(t => t.status === "available").length;
    const inReview = tasks.filter(t => t.status === "in_review").length;
    const needsCorrection = tasks.filter(t => t.status === "needs_correction").length;
    const assigned = tasks.filter(t => t.status === "assigned").length;

    if (inReview > 30) insights.push({ icon: AlertTriangle, color: "bg-red-50 border-red-200 text-red-800", title: "Review Backlog", text: `${inReview} tasks waiting for review. Consider adding reviewers to this geography.` });
    if (needsCorrection > 20) insights.push({ icon: AlertTriangle, color: "bg-amber-50 border-amber-200 text-amber-800", title: "High Corrections Pending", text: `${needsCorrection} tasks need correction. Quality is slipping.` });
    if (available === 0 && assigned === 0) insights.push({ icon: Zap, color: "bg-indigo-50 border-indigo-200 text-indigo-800", title: "Geography Depleted", text: "No available tasks left in this geography. Time to unlock a new region." });
    
    if (throughputTrend < -20) insights.push({ icon: TrendingDown, color: "bg-red-50 border-red-200 text-red-800", title: "Output Declining", text: `Throughput dropped ${Math.abs(throughputTrend)}% WoW.` });
    
    const lowPerformers = contribData.filter(c => c.errorRate > 25 && c.completed > 5);
    if (lowPerformers.length) insights.push({ icon: Users, color: "bg-amber-50 border-amber-200 text-amber-800", title: "Quality Concern", text: `${lowPerformers.map(c => c.name).join(", ")} exceed 25% error rate.` });

    if (!insights.length) insights.push({ icon: CheckCircle, color: "bg-slate-50 border-slate-200 text-slate-700", title: "All Systems Normal", text: "Team performance is stable across all metrics." });

    return { dailyData, contribData, throughputTrend, avgDaily, remaining, daysToComplete, insights };
  }, [tasks, contributors, getContribStats]);

  return (
    <div className="space-y-5">
      {/* 1. Area Chart: Daily Volume */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-slate-800">Daily Throughput — Last 30 Days</p>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${analytics.throughputTrend > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {analytics.throughputTrend >= 0 ? "+" : ""}{analytics.throughputTrend}% WoW
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={analytics.dailyData}>
            <defs>
              <linearGradient id="mgGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={4} axisLine={false} />
            <YAxis tick={{ fontSize: 9 }} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            <Area type="monotone" dataKey="completed" stroke="#6366f1" strokeWidth={2} fill="url(#mgGrad)" name="Completed" />
            <Area type="monotone" dataKey="reviewed" stroke="#22c55e" strokeWidth={2} fillOpacity={0} name="Reviewed" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 2. Forecast Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-indigo-700">{analytics.avgDaily}</p>
          <p className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider">Avg Daily Output</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{analytics.remaining.toLocaleString()}</p>
          <p className="text-[10px] font-bold uppercase text-amber-400 tracking-wider">Queue Remaining</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{analytics.daysToComplete ?? "∞"}</p>
          <p className="text-[10px] font-bold uppercase text-green-400 tracking-wider">Est. Days Left</p>
        </div>
      </div>

      {/* 3. Detailed Insights */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-slate-800 mb-3">Critical Insights</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {analytics.insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
        </div>
      </div>
    </div>
  );
}