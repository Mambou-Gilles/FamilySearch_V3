import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function InnerLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  const RADIAN = Math.PI / 180;
  // Calculate position centered within the donut ring
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  // Avoid cluttering the chart with tiny percentage labels
  if (percent < 0.06) return null;

  return (
    <text 
      x={x} 
      y={y} 
      fill="white" 
      textAnchor="middle" 
      dominantBaseline="central" 
      className="text-[11px] font-bold pointer-events-none"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function DonutChartCard({ 
  title, 
  subtitle, 
  data, 
  valueKey = "value", 
  nameKey = "name", 
  colors = COLORS, 
  tooltipFormatter 
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 h-full flex flex-col shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800 tracking-tight">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6 flex-1">
        {/* Chart Section */}
        <div className="w-full h-[180px] sm:h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%" 
                cy="50%"
                innerRadius={55} 
                outerRadius={85}
                paddingAngle={4}
                dataKey={valueKey}
                nameKey={nameKey}
                labelLine={false}
                label={InnerLabel}
                stroke="none"
              >
                {data.map((_, i) => (
                  <Cell 
                    key={`cell-${i}`} 
                    fill={colors[i % colors.length]} 
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={tooltipFormatter || ((v) => [v, "Tasks"])}
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                  fontSize: '12px',
                  padding: '8px 12px'
                }}
                itemStyle={{ fontWeight: 600 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend Section */}
        <div className="w-full sm:w-auto sm:min-w-[140px] space-y-2">
          {data.map((d, i) => (
            <div key={d[nameKey]} className="flex items-center justify-between gap-3 group">
              <div className="flex items-center gap-2 overflow-hidden">
                <span 
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                  style={{ background: colors[i % colors.length] }} 
                />
                <span className="text-[11px] text-slate-500 capitalize truncate group-hover:text-slate-800 transition-colors">
                  {d[nameKey]}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-700">
                {d[valueKey]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}