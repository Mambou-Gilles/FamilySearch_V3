import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, UserMinus, Search, AlertCircle } from "lucide-react"; // Removed Trash2
import StatusBadge from "@/components/StatusBadge";
import TablePagination from "@/components/shared/TablePagination";
import { supabase } from "@/api/supabaseClient";
import { toast } from "sonner";

const PAGE_SIZE = 15;

export default function ManagerAssignmentsTab({ assignments, myAssignment, onAdd, onEdit, onRefresh }) { // Removed onDelete prop
  const [roleFilter, setRoleFilter] = useState("all");
  const [tlFilter, setTlFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [targetTeamLead, setTargetTeamLead] = useState("");
  const [processing, setProcessing] = useState(false);

  // Filter: Contributors/Reviewers only
  const studentsOnly = assignments.filter(a => a.role !== "manager" && a.role !== "team_lead");

  const filtered = studentsOnly.filter(a => {
    if (roleFilter !== "all" && a.role !== roleFilter) return false;
    if (searchQuery && !a.user_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    if (tlFilter === "unassigned") {
      if (a.team_lead_email) return false;
    } else if (tlFilter !== "all") {
      if (a.team_lead_email !== tlFilter) return false;
    }
    return true;
  });

  const availableTeamLeads = assignments
    .filter(a => a.role === "team_lead")
    .sort((a, b) => a.user_name.localeCompare(b.user_name));

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const roles = [...new Set(studentsOnly.map(a => a.role).filter(Boolean))];

  const toggleAll = (checked) => setSelectedIds(checked ? new Set(paged.map(a => a.id)) : new Set());
  const toggleOne = (id) => setSelectedIds(prev => { 
    const n = new Set(prev); 
    n.has(id) ? n.delete(id) : n.add(id); 
    return n; 
  });

  async function handleUnassign(assignmentId) {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('team_assignments')
        .update({ team_lead_email: null })
        .eq('id', assignmentId);

      if (error) throw error;
      toast.success("User unassigned (Lead removed)");
      if (onRefresh) onRefresh(); 
    } catch (err) {
      toast.error("Unassign failed: " + err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleBulkAssign() {
    if (!targetTeamLead || selectedIds.size === 0) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('team_assignments')
        .update({ team_lead_email: targetTeamLead })
        .in('id', Array.from(selectedIds));
      if (error) throw error;
      toast.success(`Updated ${selectedIds.size} assignments`);
      setSelectedIds(new Set());
      setTargetTeamLead("");
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Team Assignments</h2>
          <p className="text-xs text-slate-500">Managing leads for {myAssignment?.geography}</p>
        </div>
        <Button size="sm" onClick={onAdd} className="bg-indigo-600 text-white shadow-sm hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-1" /> New Assignment
        </Button>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" placeholder="Search by name..." value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500" 
            />
          </div>
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(0); }} 
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white shadow-sm">
            <option value="all">All Roles</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={tlFilter} onChange={e => { setTlFilter(e.target.value); setPage(0); }} 
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white font-medium shadow-sm">
            <option value="all">All Team Leads</option>
            <option value="unassigned" className="text-amber-600 font-bold">⚠️ Unassigned</option>
            {availableTeamLeads.map(tl => <option key={tl.user_email} value={tl.user_email}>{tl.user_name}</option>)}
          </select>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-200 animate-in fade-in slide-in-from-top-1">
            <span className="text-xs font-bold text-indigo-600 px-2 py-1 bg-indigo-50 rounded border border-indigo-100">
              {selectedIds.size} Selected
            </span>
            <select 
              value={targetTeamLead} 
              onChange={(e) => setTargetTeamLead(e.target.value)} 
              className="text-sm border-indigo-200 rounded-lg px-3 py-1.5 bg-white min-w-[160px] shadow-sm"
            >
              <option value="">Assign to TL...</option>
              {availableTeamLeads.map(tl => <option key={tl.user_email} value={tl.user_email}>{tl.user_name}</option>)}
            </select>
            <Button size="sm" disabled={!targetTeamLead || processing} onClick={handleBulkAssign} className="bg-indigo-600 text-white h-8">
              {processing ? "..." : "Apply"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-slate-400 h-8">Cancel</Button>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-4 w-10"><Checkbox checked={paged.length > 0 && paged.every(a => selectedIds.has(a.id))} onCheckedChange={toggleAll} /></th>
                <th className="p-4">Staff Member</th>
                <th className="p-4">Role</th>
                <th className="p-4">Team Lead</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.length === 0 ? (
                <tr><td colSpan="6" className="p-10 text-center text-slate-400 italic">No matches found for the current filters.</td></tr>
              ) : (
                paged.map(a => (
                  <tr key={a.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(a.id) ? 'bg-indigo-50/40' : ''}`}>
                    <td className="p-4"><Checkbox checked={selectedIds.has(a.id)} onCheckedChange={() => toggleOne(a.id)} /></td>
                    <td className="p-4">
                      <div className="font-medium text-slate-900">{a.user_name}</div>
                      <div className="text-[11px] text-slate-400">{a.user_email}</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-tight">
                        {a.role}
                      </span>
                    </td>
                    <td className="p-4">
                      {a.team_lead_email ? (
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          <span className="text-slate-700 font-medium">{a.team_lead_email.split('@')[0]}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-600 font-bold text-[10px] bg-amber-50 border border-amber-100 px-2 py-1 rounded-md w-fit">
                          <AlertCircle className="w-3 h-3" /> UNASSIGNED
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center"><StatusBadge status={a.status} /></td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => onEdit(a)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit details">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleUnassign(a.id)} 
                          disabled={!a.team_lead_email || processing}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-20"
                          title="Remove Team Lead only"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <TablePagination page={page} total={totalPages} onPage={setPage} count={filtered.length} size={PAGE_SIZE} />
        )}
      </div>
    </div>
  );
}















// import { useState } from "react";
// import { Button } from "@/components/ui/button";
// import { Checkbox } from "@/components/ui/checkbox"; // Assuming you have this shadcn component
// import { Plus, Trash2, Edit, Users } from "lucide-react";
// import StatusBadge from "@/components/StatusBadge";
// import TablePagination from "@/components/shared/TablePagination";
// import { supabase } from "@/api/supabaseClient";
// import { toast } from "sonner";

// const PAGE_SIZE = 15;

// export default function ManagerAssignmentsTab({ assignments, myAssignment, onAdd, onEdit, onDelete, onRefresh }) {
//   const [roleFilter, setRoleFilter] = useState("all");
//   const [page, setPage] = useState(0);
//   const [selectedIds, setSelectedIds] = useState(new Set());
//   const [targetTeamLead, setTargetTeamLead] = useState("");
//   const [updating, setUpdating] = useState(false);

//   // 1. Filter out Managers and Team Leads from the main list view
//   const studentsOnly = assignments.filter(a => 
//     a.role !== "manager" && a.role !== "team_lead"
//   );

//   const filtered = studentsOnly.filter(a => {
//     if (roleFilter !== "all" && a.role !== roleFilter) return false;
//     return true;
//   });

//   // 2. Get list of available Team Leads for the dropdown
//   const availableTeamLeads = assignments
//     .filter(a => a.role === "team_lead")
//     .sort((a, b) => a.user_name.localeCompare(b.user_name));

//   const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
//   const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

//   const roles = [...new Set(studentsOnly.map(a => a.role).filter(Boolean))];

//   // Selection Logic
//   const toggleAll = (checked) => {
//     setSelectedIds(checked ? new Set(paged.map(a => a.id)) : new Set());
//   };

//   const toggleOne = (id) => {
//     setSelectedIds(prev => {
//       const next = new Set(prev);
//       if (next.has(id)) next.delete(id);
//       else next.add(id);
//       return next;
//     });
//   };

//   // 3. Bulk Assignment Function
//   async function handleBulkAssign() {
//     if (!targetTeamLead || selectedIds.size === 0) return;
    
//     setUpdating(true);
//     try {
//       const selectedEmails = Array.from(selectedIds);
//       const { error } = await supabase
//         .from('team_assignments')
//         .update({ team_lead_email: targetTeamLead })
//         .in('id', selectedEmails);

//       if (error) throw error;

//       toast.success(`Assigned ${selectedIds.size} users to ${targetTeamLead}`);
//       setSelectedIds(new Set());
//       setTargetTeamLead("");
//       onRefresh(); // Refresh the parent data
//     } catch (err) {
//       toast.error("Failed to update assignments: " + err.message);
//     } finally {
//       setUpdating(false);
//     }
//   }

//   return (
//     <div className="space-y-4">
//       {/* Header ... same as before */}
//       <div className="flex items-center justify-between flex-wrap gap-3">
//         <div>
//           <h2 className="text-base font-semibold text-slate-800">Team Assignments</h2>
//           <p className="text-xs text-slate-500 mt-0.5">
//             Managing Contributors & Reviewers in <span className="font-medium text-slate-700">{myAssignment?.geography}</span>
//           </p>
//         </div>
//         <Button size="sm" onClick={onAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white">
//           <Plus className="w-4 h-4 mr-1" /> Add Assignment
//         </Button>
//       </div>

//       {/* Bulk Action Bar & Filters */}
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center bg-slate-50 border border-slate-200 rounded-xl p-3">
//         {/* Left Grid: Filter */}
//         <div className="flex items-center gap-3">
//           <span className="text-xs text-slate-500 font-medium">Filter:</span>
//           <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(0); }}
//             className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none">
//             <option value="all">All Contributors ({studentsOnly.length})</option>
//             {roles.map(r => (
//               <option key={r} value={r}>{r}</option>
//             ))}
//           </select>
//         </div>

//         {/* Right Grid: Team Lead Assignment (Only shows if users are selected) */}
//         <div className={`flex items-center gap-2 justify-end transition-all ${selectedIds.size > 0 ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
//           <span className="text-xs text-slate-500 font-medium">Assign TL:</span>
//           <select 
//             value={targetTeamLead} 
//             onChange={(e) => setTargetTeamLead(e.target.value)}
//             className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 min-w-[180px]"
//           >
//             <option value="">Select Team Lead...</option>
//             {availableTeamLeads.map(tl => (
//               <option key={tl.user_email} value={tl.user_email}>{tl.user_name}</option>
//             ))}
//           </select>
//           <Button 
//             size="sm" 
//             disabled={!targetTeamLead || updating} 
//             onClick={handleBulkAssign}
//             className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
//           >
//             {updating ? "..." : "Apply"}
//           </Button>
//         </div>
//       </div>

//       {/* Table */}
//       <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm text-left">
//             <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
//               <tr>
//                 <th className="p-3 w-10">
//                   <Checkbox 
//                     checked={paged.length > 0 && paged.every(a => selectedIds.has(a.id))}
//                     onCheckedChange={toggleAll}
//                   />
//                 </th>
//                 <th className="p-3">Name</th>
//                 <th className="p-3">Email</th>
//                 <th className="p-3">Role</th>
//                 <th className="p-3 text-center">Team Lead</th>
//                 <th className="p-3 text-center">Status</th>
//                 <th className="p-3 text-right">Actions</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-slate-100">
//               {paged.map(a => (
//                 <tr key={a.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(a.id) ? 'bg-indigo-50/50' : ''}`}>
//                   <td className="p-3">
//                     <Checkbox 
//                       checked={selectedIds.has(a.id)} 
//                       onCheckedChange={() => toggleOne(a.id)}
//                     />
//                   </td>
//                   <td className="p-3 font-medium text-slate-900">{a.user_name}</td>
//                   <td className="p-3 text-xs text-slate-500">{a.user_email}</td>
//                   <td className="p-3">
//                     <span className="text-[10px] uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
//                       {a.role}
//                     </span>
//                   </td>
//                   <td className="p-3 text-center">
//                     {a.team_lead_email ? (
//                       <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
//                         {a.team_lead_email.split('@')[0]}
//                       </span>
//                     ) : (
//                       <span className="text-slate-300 text-xs italic">Unassigned</span>
//                     )}
//                   </td>
//                   <td className="p-3 text-center"><StatusBadge status={a.status} /></td>
//                   <td className="p-3 text-right">
//                     <div className="flex items-center justify-end gap-1">
//                       <button onClick={() => onEdit(a)} className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
//                         <Edit className="w-3.5 h-3.5" />
//                       </button>
//                       <button onClick={() => onDelete(a.id, a)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50">
//                         <Trash2 className="w-3.5 h-3.5" />
//                       </button>
//                     </div>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//         {totalPages > 1 && (
//           <TablePagination page={page} total={totalPages} onPage={setPage} count={filtered.length} size={PAGE_SIZE} />
//         )}
//       </div>
//     </div>
//   );
// }



















