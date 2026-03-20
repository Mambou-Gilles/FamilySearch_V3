export default function KpiCard({ title, value, subtitle, icon: Icon, color = "indigo", trend }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600"
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 shadow-sm min-w-0">
      {Icon && (
        <div className={`p-2 rounded-lg flex-shrink-0 ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide leading-tight break-words">
          {title}
        </p>
        <p className="text-xl font-bold text-slate-900 mt-0.5 break-words leading-tight">
          {value ?? "—"}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5 break-words leading-tight">
            {subtitle}
          </p>
        )}
        {trend !== undefined && (
          <p className={`text-xs mt-1 font-medium ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs yesterday
          </p>
        )}
      </div>
    </div>
  );
}