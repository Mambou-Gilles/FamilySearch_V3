import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function GeoKpiChart({ tasks, title = "Progress by Geography" }) {
  // Logic to transform Supabase rows into chart-ready data
  const geoMap = {};
  
  tasks.forEach(t => {
    if (!t.geography) return; // Skip if no geography is assigned in DB
    
    if (!geoMap[t.geography]) {
      geoMap[t.geography] = { 
        geography: t.geography, 
        completed: 0, 
        reviewed: 0, 
        corrections: 0 
      };
    }
    
    // Workflow tracking: Mapping Supabase status strings to chart categories
    if (["completed", "in_review", "needs_correction", "reviewed"].includes(t.status)) {
      geoMap[t.geography].completed++;
    }
    
    if (t.status === "reviewed") {
      geoMap[t.geography].reviewed++;
    }
    
    if (t.status === "needs_correction") {
      geoMap[t.geography].corrections++;
    }
  });

  const data = Object.values(geoMap).sort((a, b) => b.completed - a.completed);

  if (!data.length) return <div className="text-center py-12 text-slate-400">No task data available</div>;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">{title}</h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis 
            dataKey="geography" 
            tick={{ fontSize: 11, fill: '#94a3b8' }} 
            axisLine={false} 
            tickLine={false} 
          />
          <YAxis 
            tick={{ fontSize: 11, fill: '#94a3b8' }} 
            axisLine={false} 
            tickLine={false} 
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
          <Bar dataKey="completed" fill="#6366f1" name="Completed" radius={[4, 4, 0, 0]} barSize={20} />
          <Bar dataKey="reviewed" fill="#22c55e" name="Reviewed" radius={[4, 4, 0, 0]} barSize={20} />
          <Bar dataKey="corrections" fill="#f59e0b" name="Corrections" radius={[4, 4, 0, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

  