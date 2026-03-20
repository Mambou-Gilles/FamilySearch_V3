import { Button } from "@/components/ui/button";
import { Users, ArrowRight, Calendar, UserCheck } from "lucide-react";

export default function ReviewerContributorList({ 
  contributors, 
  selectedDate, 
  setSelectedDate, 
  getContribTasksForDate, 
  getReviewedForDate, 
  getAllContribPending, 
  getAllContribReviewed, 
  onSelect 
}) {
  return (
    <div className="space-y-5">
      {/* Date Selection Filter */}
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <Calendar className="w-4 h-4 text-teal-500" />
        <span className="text-sm font-bold text-slate-700">Audit Date:</span>
        <input 
          type="date" 
          value={selectedDate} 
          onChange={e => setSelectedDate(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all cursor-pointer" 
        />
        {selectedDate && (
          <button 
            onClick={() => setSelectedDate("")} 
            className="text-xs text-slate-400 hover:text-teal-600 font-medium underline ml-1"
          >
            All History
          </button>
        )}
      </div>

      {!contributors.length ? (
        <div className="text-center py-16 bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
          <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 font-semibold">No contributors found</p>
          <p className="text-xs mt-2 text-slate-400 max-w-[200px] mx-auto leading-relaxed">
            Pairing is managed by Team Leads. Once contributors are assigned to your project queue, they will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Active Contributors ({contributors.length})
            </p>
          </div>
          
          {contributors.map(contrib => {
            // Logic preserved for deterministic sampling and progress
            const tasksForSelectedDate = getContribTasksForDate(contrib.user_email);
            const countForDate = tasksForSelectedDate.length;
            
            const totalPending = getAllContribPending ? getAllContribPending(contrib.user_email) : countForDate;
            const totalReviewed = getAllContribReviewed ? getAllContribReviewed(contrib.user_email) : 0;
            const total = totalPending + totalReviewed;
            
            const progressPct = total > 0 ? Math.round((totalReviewed / total) * 100) : 0;
            const canReview = countForDate > 0;

            return (
              <div 
                key={contrib.id || contrib.user_email} 
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 hover:border-teal-300 hover:shadow-md transition-all group"
              >
                {/* Avatar Icon */}
                <div className="w-12 h-12 bg-teal-50 border border-teal-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-teal-600 transition-colors">
                  <span className="text-base font-black text-teal-700 group-hover:text-white uppercase">
                    {contrib.user_name?.[0] || "?"}
                  </span>
                </div>

                {/* Contributor Info & Progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-slate-900 truncate">{contrib.user_name}</p>
                    {(contrib.review_percentage ?? 100) < 100 && (
                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                        {contrib.review_percentage}% QA Rate
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mb-3 truncate">
                    {contrib.geography} • {contrib.user_email}
                  </p>

                  {/* Progress bar visualizer */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${
                          progressPct === 100 ? 'bg-teal-500' : 'bg-indigo-500'
                        }`} 
                        style={{ width: `${progressPct}%` }} 
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 tabular-nums">
                      {totalReviewed}/{total} Done
                    </span>
                  </div>
                </div>

                {/* Large Pending Count */}
                <div className="text-center flex-shrink-0 px-4 border-l border-slate-100">
                  <p className={`text-2xl font-black ${canReview ? "text-amber-500" : "text-slate-300"}`}>
                    {totalPending}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Pending</p>
                </div>

                {/* Navigation Button */}
                <Button
                  size="sm"
                  onClick={() => onSelect(contrib)}
                  disabled={!canReview}
                  className={`rounded-lg transition-all ${
                    canReview 
                      ? "bg-teal-600 hover:bg-teal-700 text-white shadow-sm" 
                      : "bg-slate-100 text-slate-400"
                  }`}
                  variant={!canReview ? "ghost" : "default"}
                >
                  {canReview ? (
                    <div className="flex items-center gap-1.5 px-1 font-bold">
                      <span>AUDIT</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <span className="font-bold">EMPTY</span>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}