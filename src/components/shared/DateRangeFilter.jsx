import { Calendar } from "lucide-react";

export default function DateRangeFilter({ dateFrom, dateTo, setDateFrom, setDateTo }) {
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 flex-wrap shadow-sm">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-semibold text-slate-700">Filter Period:</span>
      </div>
      
      <div className="flex items-center gap-2">
        <input 
          type="date" 
          value={dateFrom} 
          onChange={e => setDateFrom(e.target.value)} 
          max={dateTo}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer" 
        />
        
        <span className="text-slate-400 text-xs font-medium uppercase">to</span>
        
        <input 
          type="date" 
          value={dateTo} 
          onChange={e => setDateTo(e.target.value)} 
          min={dateFrom} 
          max={today}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer" 
        />
      </div>

      {(dateFrom !== "" || dateTo !== today) && (
        <button 
          onClick={() => {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString().split("T")[0];
            setDateFrom(thirtyDaysAgo);
            setDateTo(today);
          }}
          className="ml-auto text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Reset to 30d
        </button>
      )}
    </div>
  );
}