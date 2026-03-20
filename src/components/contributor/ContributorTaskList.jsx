import { Button } from "@/components/ui/button";
import { Inbox, ChevronLeft, ChevronRight, CheckCircle2, Lock } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

export default function ContributorTaskList({ tasks, selectedTask, setSelectedTask, isMobile, isCorrectionMode, page, setPage, totalPages, pageSize }) {
  
  // Find the index of the first task that isn't finished yet
  const firstUnfinishedIdx = tasks.findIndex(t => !["completed", "reviewed"].includes(t.status));

  return (
    <div className={`md:w-[380px] md:flex-shrink-0 md:border-r border-slate-200 bg-white flex flex-col ${selectedTask && isMobile ? "hidden" : ""}`}>
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <div className="bg-slate-50 p-4 rounded-full mb-3">
            <Inbox className="w-8 h-8 opacity-30" />
          </div>
          <p className="text-sm font-medium">
            {isCorrectionMode ? "No corrections needed!" : "Queue empty — request a batch."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-y-auto divide-y divide-slate-100 max-h-[60vh] md:max-h-none md:flex-1">
            {tasks.map((task, idx) => {
              const globalIdx = page * pageSize + idx + 1;
              const isSelected = selectedTask?.id === task.id;
              const isFinished = ["completed", "reviewed"].includes(task.status);
              
              // --- SEQUENTIAL LOGIC ---
              // 1. Task is disabled if a DIFFERENT task is already open (selectedTask)
              // 2. Task is disabled if it's not finished AND it's not the 'firstUnfinishedIdx' (enforces top-to-bottom)
              const isLocked = !isFinished && !isSelected && (
                (selectedTask !== null) || (idx !== firstUnfinishedIdx)
              );

              return (
                <div key={task.id}
                  onClick={() => !isLocked && setSelectedTask(task)} 
                  className={`p-3 transition-all duration-200 ${
                    isSelected ? "bg-indigo-50 border-l-4 border-indigo-500 shadow-sm" : 
                    isLocked ? "opacity-50 cursor-not-allowed bg-slate-50/50" : "hover:bg-slate-50 border-l-4 border-transparent cursor-pointer"
                  }`}>
                  <div className="flex items-start gap-3">
                    
                    <span className={`mt-0.5 text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 ${
                      isFinished ? "bg-green-100 text-green-600" : 
                      isLocked ? "bg-slate-200 text-slate-400" : "bg-slate-100 text-slate-500"
                    }`}>
                      {isFinished ? <CheckCircle2 className="w-3 h-3" /> : isLocked ? <Lock className="w-2.5 h-2.5" /> : globalIdx}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {task.geography && (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {task.geography}
                          </span>
                        )}
                        <StatusBadge status={task.status} />
                      </div>
                      
                      {/* Only allow clicking the link if the task is NOT locked */}
                      <a 
                        href={isLocked ? undefined : task.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={e => {
                           if (isLocked) e.preventDefault();
                           setSelectedTask(task);
                        }}
                        className={`text-xs font-mono block truncate max-w-[180px] sm:max-w-xs ${
                          isLocked ? "text-slate-400 no-underline" : "text-indigo-600 hover:underline"
                        }`}>
                        {task.url}
                      </a>
                    </div>

                    <Button 
                      size="sm" 
                      variant={isSelected ? "default" : "outline"}
                      disabled={isLocked && !isFinished}
                      className={isSelected ? "bg-indigo-600 text-white text-xs px-3 h-7" : "text-xs px-3 h-7"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTask(task);
                      }}>
                      {isCorrectionMode ? "Fix" : isFinished ? "View" : "Go"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-[11px] font-medium text-slate-500 uppercase">
                Page {page + 1} of {totalPages}
              </span>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}










// import { Button } from "@/components/ui/button";
// import { Inbox, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
// import StatusBadge from "@/components/StatusBadge";

// export default function ContributorTaskList({ tasks, selectedTask, setSelectedTask, isMobile, isCorrectionMode, page, setPage, totalPages, pageSize }) {
//   return (
//     <div className={`md:w-[380px] md:flex-shrink-0 md:border-r border-slate-200 bg-white flex flex-col ${selectedTask && isMobile ? "hidden" : ""}`}>
//       {tasks.length === 0 ? (
//         <div className="flex flex-col items-center justify-center py-16 text-slate-400">
//           <div className="bg-slate-50 p-4 rounded-full mb-3">
//             <Inbox className="w-8 h-8 opacity-30" />
//           </div>
//           <p className="text-sm font-medium">
//             {isCorrectionMode ? "No corrections needed!" : "Queue empty — request a batch."}
//           </p>
//         </div>
//       ) : (
//         <>
//           <div className="overflow-y-auto divide-y divide-slate-100 max-h-[60vh] md:max-h-none md:flex-1">
//             {tasks.map((task, idx) => {
//               const globalIdx = page * pageSize + idx + 1;
//               const isSelected = selectedTask?.id === task.id;
//               // 'completed' and 'reviewed' are both finished states in your new task_status_enum
//               const isFinished = ["completed", "reviewed"].includes(task.status);
              
//               return (
//                 <div key={task.id}
//                   onClick={() => setSelectedTask(task)} // Make the whole row clickable
//                   className={`p-3 cursor-pointer transition-all duration-200 ${
//                     isSelected ? "bg-indigo-50 border-l-4 border-indigo-500 shadow-sm" : "hover:bg-slate-50 border-l-4 border-transparent"
//                   }`}>
//                   <div className="flex items-start gap-3">
//                     {/* Index / Completed Indicator */}
//                     <span className={`mt-0.5 text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 ${
//                       isFinished ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"
//                     }`}>
//                       {isFinished ? <CheckCircle2 className="w-3 h-3" /> : globalIdx}
//                     </span>

//                     <div className="flex-1 min-w-0">
//                       <div className="flex items-center gap-2 mb-1">
//                         {task.geography && (
//                           <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
//                             {task.geography}
//                           </span>
//                         )}
//                         <StatusBadge status={task.status} />
//                       </div>
//                       <a href={task.url} target="_blank" rel="noopener noreferrer"
//                           onClick={(e) => {
//                             // Don't stop propagation; let it select the task too!
//                             setSelectedTask(task); 
//                           }}
//                           className="text-xs text-indigo-600 hover:underline font-mono block truncate max-w-[180px] sm:max-w-xs">
//                           {task.url}
//                         </a>
//                     </div>

//                     <Button size="sm" variant={isSelected ? "default" : "outline"}
//                       className={isSelected ? "bg-indigo-600 text-white text-xs px-3 h-7" : "text-xs px-3 h-7"}
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         setSelectedTask(task);
//                       }}>
//                       {isCorrectionMode ? "Fix" : isFinished ? "View" : "Go"}
//                     </Button>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
          
//           {/* Pagination Controls */}
//           {totalPages > 1 && (
//             <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
//               <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
//                 <ChevronLeft className="w-4 h-4" />
//               </Button>
//               <span className="text-[11px] font-medium text-slate-500 uppercase">
//                 Page {page + 1} of {totalPages}
//               </span>
//               <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
//                 <ChevronRight className="w-4 h-4" />
//               </Button>
//             </div>
//           )}
//         </>
//       )}
//     </div>
//   );
// }