import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ClipboardCheck, ExternalLink, MessageSquare } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import ReviewerTaskForm from "@/components/ReviewerTaskForm";

const PAGE_SIZE = 10;

export default function ReviewerTaskPanel({ 
  selectedContributor, 
  selectedDate, 
  contribTasks, 
  alreadyReviewedToday, 
  selectedTask, 
  setSelectedTask, 
  onSubmit, 
  submitting, 
  onBack 
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(contribTasks.length / PAGE_SIZE);
  const pagedTasks = contribTasks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* Header Navigation */}
      <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBack}
          className="hover:bg-slate-100 text-slate-600 font-bold px-3"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> EXIT
        </Button>
        <div className="h-8 w-px bg-slate-200" />
        <div>
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
            Auditing: {selectedContributor.user_name}
          </h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            {selectedDate ? `Batch: ${selectedDate} • ` : ""}{contribTasks.length} Pending
          </p>
        </div>
      </div>

      {alreadyReviewedToday.length > 0 && (
        <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-[11px] font-bold text-teal-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <ClipboardCheck className="w-4 h-4" />
          SYSTEM: {alreadyReviewedToday.length} item(s) already verified in this session.
        </div>
      )}

      {!contribTasks.length ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl shadow-inner">
          <ClipboardCheck className="w-16 h-16 mx-auto mb-4 text-slate-200" />
          <p className="text-slate-500 font-black uppercase tracking-widest">Queue Clear</p>
          <p className="text-xs mt-2 text-slate-400">All sampled tasks for this contributor have been processed.</p>
          <Button variant="outline" size="sm" onClick={onBack} className="mt-6 font-bold">Return to List</Button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Paginated Task List */}
          <div className={`lg:w-[400px] flex flex-col gap-3 ${selectedTask ? "hidden lg:flex" : "flex"}`}>
            <div className="space-y-2.5">
              {pagedTasks.map(task => (
                <div 
                  key={task.id}
                  className={`group bg-white border-2 rounded-2xl p-4 cursor-pointer transition-all ${
                    selectedTask?.id === task.id 
                      ? "border-teal-500 shadow-lg shadow-teal-100" 
                      : "border-slate-100 hover:border-teal-200 hover:shadow-md"
                  }`}
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <StatusBadge status={task.status} />
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold uppercase tracking-tighter">
                          {task.project_type}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-teal-600 mb-2">
                        <ExternalLink className="w-3 h-3" />
                        <span className="text-[11px] font-mono truncate block w-full">
                          {task.url}
                        </span>
                      </div>

                      {/* Display Results based on type */}
                      {task.hint_result && (
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mb-2">
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Contributor Result</p>
                          <p className="text-xs text-slate-700 font-medium">{task.hint_result}</p>
                        </div>
                      )}

                      {task.contributor_notes && (
                        <div className="flex items-start gap-1.5 text-amber-700 mt-2 bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                          <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <p className="text-[11px] font-medium leading-relaxed">
                            {task.contributor_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, contribTasks.length)} / {contribTasks.length}
                </p>
                <div className="flex gap-1.5">
                  <button 
                    disabled={page === 0} 
                    onClick={() => setPage(p => p - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-colors"
                  >
                    ‹
                  </button>
                  <button 
                    disabled={page >= totalPages - 1} 
                    onClick={() => setPage(p => p + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-colors"
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Review Form Container */}
          <div className="flex-1">
            {selectedTask ? (
              <div className="bg-white border-2 border-slate-100 rounded-3xl p-6 shadow-sm sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-6 bg-teal-500 rounded-full" />
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Perform Audit</h3>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setSelectedTask(null)}
                    className="lg:hidden font-bold"
                  >
                    ← CLOSE
                  </Button>
                </div>
                
                <ReviewerTaskForm 
                  task={selectedTask} 
                  onSubmit={onSubmit} 
                  loading={submitting} 
                />
              </div>
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center h-[400px] border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                <div className="p-4 bg-white rounded-2xl shadow-sm mb-4">
                  <ChevronLeft className="w-6 h-6 text-teal-400 rotate-180" />
                </div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Select a task to begin audit</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}