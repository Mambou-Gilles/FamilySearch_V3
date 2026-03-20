import { Button } from "@/components/ui/button";
import { ExternalLink, ChevronLeft, AlertCircle } from "lucide-react"; // Added AlertCircle for feedback
import StatusBadge from "@/components/StatusBadge";
import ContributorTaskForm from "@/components/ContributorTaskForm";

export default function ContributorTaskPanel({ selectedTask, onSubmit, submitting, isMobile, onBack }) {
  if (!selectedTask) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-400 py-20 flex-1 bg-slate-50">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
          <ExternalLink className="w-7 h-7 text-indigo-300" />
        </div>
        <p className="text-sm font-medium text-slate-500">Select a task to proceed</p>
        <p className="text-xs mt-1">Click "Go" on any URL in the list</p>
      </div>
    );
  }

  // Check if the task is in correction mode (status: 'needs_correction')
  const isCorrection = selectedTask.status === 'needs_correction';

  return (
    <div className="flex-1 bg-slate-50">
      <div className="max-w-xl mx-auto p-4 space-y-4">
        {isMobile && (
          <Button size="sm" variant="ghost" onClick={onBack} className="mb-1">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to list
          </Button>
        )}
        
        {/* Task Header Information */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Reference URL</span>
            <StatusBadge status={selectedTask.status} />
          </div>
          <a href={selectedTask.url} target="_blank" rel="noopener noreferrer"
             className="text-sm text-indigo-600 hover:underline flex items-center gap-1 font-mono break-all leading-relaxed">
            {selectedTask.url} <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
          <div className="flex gap-2 mt-1">
            {selectedTask.geography && (
              <p className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full uppercase">
                {selectedTask.geography}
              </p>
            )}
            {selectedTask.project_type && (
              <p className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full uppercase">
                {selectedTask.project_type}
              </p>
            )}
          </div>
        </div>

        {/* Reviewer Feedback - Highlighted more prominently if in Correction mode */}
        {selectedTask.reviewer_notes && (
          <div className={`rounded-xl p-4 text-sm border ${
            isCorrection 
              ? "bg-amber-50 border-amber-200 text-amber-900" 
              : "bg-blue-50 border-blue-200 text-blue-900"
          }`}>
            <div className="flex items-center gap-2 font-semibold mb-1">
              <AlertCircle className="w-4 h-4" />
              <p>{isCorrection ? "Required Corrections" : "Reviewer Notes"}</p>
            </div>
            <p className="opacity-90 italic">"{selectedTask.reviewer_notes}"</p>
          </div>
        )}

        {/* The Submission Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <ContributorTaskForm 
            task={selectedTask} 
            onSubmit={onSubmit} 
            loading={submitting} 
          />
        </div>
      </div>
    </div>
  );
}