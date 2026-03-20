import { useState } from "react";

const PAGE_SIZE = 15;

export default function ManagerEscalationsTab({ escalations }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(escalations.length / PAGE_SIZE);
  const paged = escalations.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (escalations.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
        <p className="text-sm font-medium text-slate-400 italic">No active escalations found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left p-3 text-slate-600 font-medium">URL</th>
              <th className="text-left p-3 text-slate-600 font-medium">Contributor</th>
              <th className="text-left p-3 text-slate-600 font-medium">Reason / Issue</th>
              <th className="text-left p-3 text-slate-600 font-medium">Date</th>
              <th className="text-left p-3 text-slate-600 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paged.map(t => (
              <tr key={t.id} className="hover:bg-amber-50/50 transition-colors">
                <td className="p-3 max-w-xs">
                  <div className="flex flex-col gap-0.5">
                    <a 
                      href={t.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-indigo-600 hover:underline text-xs font-mono truncate block"
                    >
                      {t.url}
                    </a>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">ID: {t.id.split('-')[0]}</span>
                  </div>
                </td>
                <td className="p-3 text-slate-700 font-medium">{t.contributor_name || "—"}</td>
                <td className="p-3">
                  <span className="inline-block px-2 py-0.5 rounded bg-red-50 text-red-700 text-[11px] font-semibold border border-red-100">
                    {t.hint_result || t.duplicate_result || t.tree_work_review || "Manual Escalation"}
                  </span>
                </td>
                <td className="p-3 text-xs text-slate-500 whitespace-nowrap">
                  {t.date_completed ? new Date(t.date_completed).toLocaleDateString() : "—"}
                </td>
                <td className="p-3 text-xs text-slate-500 italic max-w-sm">
                  {t.contributor_notes || t.reviewer_notes || "No context provided"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Custom Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border border-slate-200 rounded-xl bg-slate-50">
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{page * PAGE_SIZE + 1}</span>–
            <span className="font-semibold text-slate-700">{Math.min((page + 1) * PAGE_SIZE, escalations.length)}</span> of {escalations.length}
          </p>
          <div className="flex gap-1">
            <button 
              disabled={page === 0} 
              onClick={() => setPage(p => p - 1)} 
              className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              // Sliding window for pagination numbers
              const start = Math.max(0, Math.min(page - 2, totalPages - 5));
              const p = start + i;
              if (p >= totalPages) return null;
              return (
                <button 
                  key={p} 
                  onClick={() => setPage(p)} 
                  className={`w-8 h-8 text-xs rounded font-bold transition-all ${page === p ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {p + 1}
                </button>
              );
            })}
            <button 
              disabled={page >= totalPages - 1} 
              onClick={() => setPage(p => p + 1)} 
              className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}










// import { useState } from "react";
// import { AlertTriangle, ExternalLink, Calendar, User, StickyNote, Search } from "lucide-react";
// import TablePagination from "@/components/shared/TablePagination";

// const PAGE_SIZE = 15;

// export default function ManagerEscalationsTab({ escalations = [] }) {
//   const [page, setPage] = useState(0);
//   const [searchTerm, setSearchTerm] = useState("");

//   // Filter based on search
//   const filteredEscalations = escalations.filter(t => 
//     t.url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
//     t.contributor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
//     t.hint_result?.toLowerCase().includes(searchTerm.toLowerCase())
//   );

//   const totalPages = Math.ceil(filteredEscalations.length / PAGE_SIZE);
//   const paged = filteredEscalations.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

//   if (escalations.length === 0) {
//     return (
//       <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
//         <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
//           <AlertTriangle className="w-6 h-6 text-slate-300" />
//         </div>
//         <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Clear Skies</h3>
//         <p className="text-xs text-slate-400 mt-1 font-medium">No active escalations for this project.</p>
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-4">
//       {/* 🔍 Search and Header */}
//       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
//         <div>
//           <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
//             <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
//             Escalation Queue
//           </h3>
//           <p className="text-[11px] text-slate-500 font-medium italic">High-priority tasks requiring manager intervention</p>
//         </div>
        
//         <div className="relative w-full md:w-64">
//           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
//           <input 
//             type="text" 
//             placeholder="Search URLs or names..." 
//             value={searchTerm}
//             onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
//             className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all shadow-sm"
//           />
//         </div>
//       </div>

//       {/* 📋 Table */}
//       <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm">
//             <thead className="bg-slate-50 border-b border-slate-200">
//               <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
//                 <th className="text-left p-4">Reference URL</th>
//                 <th className="text-left p-4">Contributor</th>
//                 <th className="text-left p-4">Reason / Issue</th>
//                 <th className="text-left p-4">Logged At</th>
//                 <th className="text-left p-4">Context Notes</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-slate-100">
//               {paged.length === 0 ? (
//                 <tr>
//                   <td colSpan={5} className="p-10 text-center text-slate-400 italic text-xs">
//                     No matching escalations found
//                   </td>
//                 </tr>
//               ) : (
//                 paged.map(t => (
//                   <tr key={t.id} className="group hover:bg-red-50/30 transition-colors">
//                     <td className="p-4 max-w-xs">
//                       <div className="flex items-center gap-2">
//                         <a 
//                           href={t.url} 
//                           target="_blank" 
//                           rel="noopener noreferrer" 
//                           className="text-indigo-600 hover:text-indigo-800 font-mono text-[11px] font-bold truncate block group-hover:underline"
//                         >
//                           {t.url}
//                         </a>
//                         <ExternalLink className="w-3 h-3 text-slate-300 flex-shrink-0" />
//                       </div>
//                     </td>
//                     <td className="p-4">
//                       <div className="flex items-center gap-2">
//                         <User className="w-3 h-3 text-slate-400" />
//                         <span className="text-xs font-bold text-slate-700">{t.contributor_name || "Unknown"}</span>
//                       </div>
//                     </td>
//                     <td className="p-4">
//                       <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded shadow-sm">
//                         {t.hint_result || t.duplicate_result || t.tree_work_review || "Escalated"}
//                       </span>
//                     </td>
//                     <td className="p-4">
//                       <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
//                         <Calendar className="w-3 h-3" />
//                         {t.date_completed ? new Date(t.date_completed).toLocaleDateString() : "—"}
//                       </div>
//                     </td>
//                     <td className="p-4">
//                       <div className="flex items-start gap-1.5 max-w-sm">
//                         <StickyNote className="w-3 h-3 text-slate-300 mt-0.5 flex-shrink-0" />
//                         <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic">
//                           {t.contributor_notes || t.reviewer_notes || "No notes provided"}
//                         </p>
//                       </div>
//                     </td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         </div>

//         {/* 📟 Pagination Footer */}
//         {totalPages > 1 && (
//           <div className="bg-slate-50 border-t border-slate-100">
//             <TablePagination 
//               page={page} 
//               total={totalPages} 
//               onPage={setPage} 
//               count={filteredEscalations.length} 
//               size={PAGE_SIZE} 
//             />
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }