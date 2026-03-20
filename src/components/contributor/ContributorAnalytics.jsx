import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Minus } from "lucide-react";

function Insight({ icon: Icon, color, text }) {
  return (
    <div className={`flex items-start gap-2 text-xs p-2.5 rounded-lg ${color}`}>
      <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function MiniStat({ label, value, sub, trend }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 text-center">
      <p className="text-lg font-bold text-slate-800">{value}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {trend != null && trend !== 0 && (
        <p className={`text-[10px] font-medium mt-0.5 ${trend > 0 ? "text-green-600" : "text-red-500"}`}>
          {trend > 0 ? "↑" : "↓"} vs prev week
        </p>
      )}
    </div>
  );
}

export default function ContributorAnalytics({ history }) {
  const stats = useMemo(() => {
    if (!history || !history.length) return null;

    // Daily completions over last 14 days
    const now = new Date();
    const dailyMap = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0]; // YYYY-MM-DD
      dailyMap[key] = { 
        date: key, 
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), 
        completed: 0, 
        avgScore: null, 
        scores: [] 
      };
    }

    history.forEach(t => {
      if (!t.date_completed) return;
      // Supabase ISO strings split correctly to YYYY-MM-DD
      const key = t.date_completed.split("T")[0];
      if (dailyMap[key]) {
        dailyMap[key].completed++;
        if (t.total_quality_score != null) dailyMap[key].scores.push(Number(t.total_quality_score));
      }
    });

    const dailyData = Object.values(dailyMap).map(d => ({
      ...d,
      avgScore: d.scores.length ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : null
    }));

    // Week-over-week logic preserved
    const thisWeek = dailyData.slice(7).reduce((s, d) => s + d.completed, 0);
    const lastWeek = dailyData.slice(0, 7).reduce((s, d) => s + d.completed, 0);
    const weekTrend = lastWeek ? thisWeek - lastWeek : 0;

    // Score trend (last 20 reviewed tasks)
    const reviewed = history.filter(t => t.status === "reviewed" && t.total_quality_score != null)
      .sort((a, b) => new Date(a.review_date || a.date_completed) - new Date(b.review_date || b.date_completed))
      .slice(-20);
    const scoreTrend = reviewed.map((t, i) => ({ i: i + 1, score: t.total_quality_score, target: 90 }));

    // Correction rate calculation (exactly as used in base44)
    const corrRatePool = history.filter(t => ["completed", "reviewed", "needs_correction"].includes(t.status));
    const tasksWithCorrections = history.filter(t => (t.correction_count || 0) > 0);
    const correctionRate = corrRatePool.length ? Math.round((tasksWithCorrections.length / corrRatePool.length) * 100) : 0;

    // Avg daily output (last 7 active days)
    const activeDays = dailyData.filter(d => d.completed > 0);
    const last7Active = activeDays.slice(-7);
    const avgDaily = last7Active.length ? Math.round(last7Active.reduce((s, d) => s + d.completed, 0) / last7Active.length) : 0;

    // Overall metrics
    const scoredTasks = history.filter(t => t.total_quality_score != null);
    const avgScore = scoredTasks.length ? Math.round(scoredTasks.reduce((s, t) => s + Number(t.total_quality_score), 0) / scoredTasks.length) : null;
    
    const recentScored = scoredTasks.slice(-10);
    const recentAvg = recentScored.length ? Math.round(recentScored.reduce((s, t) => s + Number(t.total_quality_score), 0) / recentScored.length) : null;
    const scoreTrendDir = (avgScore != null && recentAvg != null) ? recentAvg - avgScore : 0;

    // Insights logic preserved exactly
    const insights = [];
    if (correctionRate > 20) insights.push({ icon: AlertTriangle, color: "bg-red-50 text-red-700", text: `High correction rate (${correctionRate}%). Focus on accuracy — review guidelines before submitting.` });
    else if (correctionRate > 10) insights.push({ icon: AlertTriangle, color: "bg-amber-50 text-amber-700", text: `Correction rate at ${correctionRate}%. Aim to get below 10% for top-tier quality.` });
    else if (correctionRate <= 5 && corrRatePool.length > 5) insights.push({ icon: CheckCircle, color: "bg-green-50 text-green-700", text: `Excellent accuracy — correction rate is only ${correctionRate}%. Keep it up!` });

    if (weekTrend > 0) insights.push({ icon: TrendingUp, color: "bg-indigo-50 text-indigo-700", text: `Output is up ${weekTrend} tasks vs last week. Strong momentum!` });
    else if (weekTrend < 0 && lastWeek > 0) insights.push({ icon: TrendingDown, color: "bg-amber-50 text-amber-700", text: `Output dropped by ${Math.abs(weekTrend)} tasks vs last week. Try to maintain consistency.` });

    if (scoreTrendDir > 5) insights.push({ icon: TrendingUp, color: "bg-green-50 text-green-700", text: `Quality improving — recent avg score (${recentAvg}%) is above overall avg (${avgScore}%).` });
    else if (scoreTrendDir < -5) insights.push({ icon: TrendingDown, color: "bg-red-50 text-red-700", text: `Recent scores (avg ${recentAvg}%) are below your overall avg (${avgScore}%). Review feedback.` });

    if (!insights.length) insights.push({ icon: Minus, color: "bg-slate-50 text-slate-500", text: "Keep completing tasks to unlock performance insights." });

    return { dailyData, scoreTrend, thisWeek, lastWeek, weekTrend, correctionRate, avgDaily, avgScore, recentAvg, insights };
  }, [history]);

  if (!stats) return <div className="text-center py-8 text-slate-400 text-sm">Complete some tasks to see analytics.</div>;

  return (
    <div className="space-y-4">
      {/* Mini stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Avg Daily Output" value={stats.avgDaily} sub="active days" trend={stats.weekTrend} />
        <MiniStat label="This Week" value={stats.thisWeek} sub={`${stats.lastWeek} last week`} />
        <MiniStat label="Avg Quality Score" value={stats.avgScore != null ? `${stats.avgScore}%` : "—"} sub={stats.recentAvg != null ? `Recent: ${stats.recentAvg}%` : null} />
        <MiniStat label="Correction Rate" value={`${stats.correctionRate}%`} sub="target <10%" />
      </div>

      {/* Charts section with preserved Recharts logic */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-700 mb-1">Daily Output — Last 14 Days</p>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={stats.dailyData}>
            <defs>
              <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={1} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9 }} allowDecimals={false} width={20} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Area type="monotone" dataKey="completed" stroke="#6366f1" strokeWidth={2} fill="url(#cGrad)" name="Completed" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {stats.scoreTrend.length > 2 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-700 mb-1">Quality Score Trend</p>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={stats.scoreTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="i" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} width={24} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} formatter={(v) => [`${v}%`, ""]} />
              <ReferenceLine y={90} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "90% Goal", fill: "#22c55e", fontSize: 8, position: 'insideBottomRight' }} />
              <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} name="Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Insights */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-700 mb-2">Insights & Recommendations</p>
        <div className="space-y-1.5">
          {stats.insights.map((ins, i) => <Insight key={i} {...ins} />)}
        </div>
      </div>
    </div>
  );
}