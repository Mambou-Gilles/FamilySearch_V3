import { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserCheck, Edit2, Trash2, Users, Filter, X } from "lucide-react";

/**
 * ReviewerPairingTab
 * Handled by Managers to link Contributors to Reviewers via Bulk Actions.
 */
export default function ReviewerPairingTab({ assignments = [], onRefresh, myAssignment }) {
  // Extract scope from the Manager's own assignment
  const currentGeo = myAssignment?.geography;
  const currentProject = myAssignment?.project_id;

  const contributors = assignments.filter(a => a.role === "contributor" && a.status === "active");
  const reviewers = assignments
    .filter(a => a.role === "reviewer" && a.status === "active")
    .sort((a, b) => a.user_name.localeCompare(b.user_name));

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [targetReviewer, setTargetReviewer] = useState("");
  const [updating, setUpdating] = useState(false);

  // Filter & Modal State
  const [reviewerFilter, setReviewerFilter] = useState("all");
  const [editTarget, setEditTarget] = useState(null);
  const [editReviewer, setEditReviewer] = useState("");
  const [editReviewPct, setEditReviewPct] = useState(100);
  const [savingEdit, setSavingEdit] = useState(false);

  // Logic for the main table view
  const filteredTable = contributors.filter(c => {
    if (reviewerFilter === "all") return true;
    if (reviewerFilter === "unassigned") return !c.reviewer_email;
    return c.reviewer_email === reviewerFilter;
  });

  // Selection Logic
  const toggleAll = (checked) => {
    setSelectedIds(checked ? new Set(filteredTable.map(c => c.id)) : new Set());
  };

  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /**
   * Bulk apply a reviewer to multiple selected contributors
   */
  async function handleBulkAssign() {
    // 1. Added safety check for the scope variables
    if (!targetReviewer || selectedIds.size === 0) return;
    
    if (!currentGeo || !currentProject) {
      toast.error("Missing scope: Geography or Project ID not found.");
      console.error("Scope Error:", { currentGeo, currentProject });
      return;
    }

    setUpdating(true);
    const reviewer = reviewers.find(r => r.user_email === targetReviewer);
    
    try {
      const { error } = await supabase
        .from('team_assignments')
        .update({
          reviewer_id: reviewer?.user_id || null,
          reviewer_email: targetReviewer,
          reviewer_name: reviewer?.user_name || targetReviewer,
        })
        .in('id', Array.from(selectedIds)) // The list of UUIDs
        .eq('geography', currentGeo)       // Must NOT be undefined
        .eq('project_id', currentProject); // Must NOT be undefined

      if (error) throw error;

      toast.success(`Paired ${selectedIds.size} contributors to ${reviewer?.user_name}`);
      setSelectedIds(new Set());
      setTargetReviewer("");
      onRefresh?.();
    } catch (err) {
      toast.error("Update failed: " + err.message);
    } finally {
      setUpdating(false);
    }
  }

  /**
   * Completely remove a pairing for a single row
   */
  async function removePairing(assignmentId) {
    try {
      const { error } = await supabase
        .from('team_assignments')
        .update({ 
          reviewer_id: null, 
          reviewer_email: null, 
          reviewer_name: null 
        })
        .eq('id', assignmentId)
        .eq('geography', currentGeo);

      if (error) throw error;
      toast.success("Pairing removed");
      onRefresh?.();
    } catch (error) {
      toast.error("Failed to remove pairing: " + error.message);
    }
  }

  /**
   * Modal Logic
   */
  function openEdit(c) {
    setEditTarget(c);
    setEditReviewer(c.reviewer_email || "");
    setEditReviewPct(c.review_percentage ?? 100);
  }

  async function saveEdit() {
    if (!editTarget) return;
    setSavingEdit(true);
    
    const reviewer = reviewers.find(r => r.user_email === editReviewer);
    
    const updateData = {
      reviewer_id: reviewer?.user_id || null,
      reviewer_email: editReviewer || null,
      reviewer_name: reviewer?.user_name || null,
      review_percentage: editReviewer ? editReviewPct : 100,
    };

    try {
      const { error } = await supabase
        .from('team_assignments')
        .update(updateData)
        .eq('id', editTarget.id)
        .eq('geography', currentGeo);

      if (error) throw error;

      toast.success(editReviewer ? "Pairing updated" : "Pairing removed");
      setEditTarget(null);
      onRefresh?.();
    } catch (error) {
      toast.error("Failed to save changes: " + error.message);
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-800">Reviewer Pairing</h3>
        </div>
        {selectedIds.size > 0 && (
          <button 
            onClick={() => setSelectedIds(new Set())}
            className="text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase tracking-wider flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear Selection ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Bulk Action & Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center bg-slate-50 border border-slate-200 rounded-xl p-3">
        {/* Left: Filter dropdown */}
        <div className="flex items-center gap-3">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select 
            value={reviewerFilter} 
            onChange={e => { setReviewerFilter(e.target.value); setSelectedIds(new Set()); }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="all">All Contributors ({contributors.length})</option>
            <option value="unassigned">Unassigned ({contributors.filter(c => !c.reviewer_email).length})</option>
            <optgroup label="Filter by Reviewer">
              {reviewers.map(r => (
                <option key={r.id} value={r.user_email}>{r.user_name}</option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Right: Bulk Pairing dropdown */}
        <div className={`flex items-center gap-2 justify-end transition-all ${selectedIds.size > 0 ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <span className="text-xs font-medium text-slate-500">Pair to:</span>
          <select 
            value={targetReviewer} 
            onChange={(e) => setTargetReviewer(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 min-w-[180px]"
          >
            <option value="">Select Reviewer...</option>
            {reviewers.map(r => (
              <option key={r.id} value={r.user_email}>{r.user_name}</option>
            ))}
          </select>
          <Button 
            size="sm" 
            disabled={!targetReviewer || updating} 
            onClick={handleBulkAssign}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-8"
          >
            {updating ? "..." : "Apply Pairing"}
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="p-3 w-10 text-center">
                  <Checkbox 
                    checked={filteredTable.length > 0 && filteredTable.every(c => selectedIds.has(c.id))}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="p-3">Contributor</th>
                <th className="p-3">Email</th>
                <th className="p-3">Reviewer</th>
                <th className="p-3 text-center">Review %</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTable.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <Users className="w-8 h-8 mx-auto text-slate-200 mb-2" />
                    <p className="text-slate-400">No contributors found for this filter.</p>
                  </td>
                </tr>
              ) : (
                filteredTable.map(c => (
                  <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(c.id) ? 'bg-indigo-50/40' : ''}`}>
                    <td className="p-3 text-center">
                      <Checkbox 
                        checked={selectedIds.has(c.id)} 
                        onCheckedChange={() => toggleOne(c.id)} 
                      />
                    </td>
                    <td className="p-3 font-medium text-slate-900">{c.user_name}</td>
                    <td className="p-3 text-xs text-slate-500 font-mono">{c.user_email}</td>
                    <td className="p-3">
                      {c.reviewer_email ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {c.reviewer_name || c.reviewer_email.split('@')[0]}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs italic">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-xs font-bold ${(c.review_percentage ?? 100) < 100 ? "text-amber-600" : "text-slate-400"}`}>
                        {c.review_percentage ?? 100}%
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {c.reviewer_email && (
                          <button onClick={() => removePairing(c.id)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Dialog for detailed adjustments (Percentage, etc) */}
      <Dialog open={!!editTarget} onOpenChange={v => !v && setEditTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Reviewer Pairing</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-500 uppercase font-bold tracking-tight">Contributor</p>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
               <p className="text-sm font-semibold text-slate-900">{editTarget?.user_name}</p>
               <p className="text-xs text-slate-500 font-mono">{editTarget?.user_email}</p>
            </div>
            
            <div>
              <label className="text-xs text-slate-500 block mb-1">Assign Reviewer</label>
              <select value={editReviewer} onChange={e => setEditReviewer(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800">
                <option value="">— Remove reviewer —</option>
                {reviewers.map(r => <option key={r.id} value={r.user_email}>{r.user_name} ({r.user_email})</option>)}
              </select>
            </div>

            {editReviewer && (
              <div className="animate-in fade-in slide-in-from-top-1">
                <label className="text-xs text-slate-500 block mb-2 flex justify-between">
                  QA Sampling Rate <span className="font-bold text-indigo-700">{editReviewPct}% of work</span>
                </label>
                <input
                  type="range" min={5} max={100} step={5}
                  value={editReviewPct}
                  onChange={e => setEditReviewPct(Number(e.target.value))}
                  className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-[10px] text-slate-400 mt-2 italic">
                  Note: A random sample of tasks will be sent for review.
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
            <Button variant="ghost" size="sm" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button size="sm" disabled={savingEdit} onClick={saveEdit} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}









// import { useState } from "react";
// import { supabase } from "@/api/supabaseClient";
// import { toast } from "sonner";
// import { Button } from "@/components/ui/button";
// import { Checkbox } from "@/components/ui/checkbox";
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// import { UserCheck, Edit2, Trash2, Users } from "lucide-react";

// /**
//  * ReviewerPairingTab
//  * Handled by Managers to link Contributors to Reviewers.
//  * Includes geography-locked RLS safety checks.
//  */
// export default function ReviewerPairingTab({ assignments = [], onRefresh, myAssignment }) {
//   // Extract scope from the Manager's own assignment
//   const currentGeo = myAssignment?.geography;
//   const currentProject = myAssignment?.project_id;

//   const contributors = assignments.filter(a => a.role === "contributor" && a.status === "active");
//   const reviewers = assignments.filter(a => a.role === "reviewer" && a.status === "active");

//   const [selectedIds, setSelectedIds] = useState(new Set());
//   const [selectedReviewer, setSelectedReviewer] = useState("");
//   const [saving, setSaving] = useState(false);

//   // Edit single pairing state
//   const [editTarget, setEditTarget] = useState(null);
//   const [editReviewer, setEditReviewer] = useState("");
//   const [editReviewPct, setEditReviewPct] = useState(100);
//   const [savingEdit, setSavingEdit] = useState(false);

//   // Table filter state
//   const [reviewerFilter, setReviewerFilter] = useState("all");

//   const unassigned = contributors.filter(c => !c.reviewer_email);

//   function toggleOne(id) {
//     setSelectedIds(prev => { 
//       const n = new Set(prev); 
//       n.has(id) ? n.delete(id) : n.add(id); 
//       return n; 
//     });
//   }

//   function toggleAll(checked) {
//     setSelectedIds(checked ? new Set(unassigned.map(c => c.id)) : new Set());
//   }

//   /**
//    * Bulk apply a reviewer to multiple selected contributors
//    */
//   async function applyPairing() {
//     if (!selectedReviewer || !selectedIds.size) return;
//     setSaving(true);
    
//     const reviewer = reviewers.find(r => r.user_email === selectedReviewer);
    
//     try {
//       const { error } = await supabase
//         .from('team_assignments')
//         .update({
//           reviewer_id: reviewer?.user_id || null,
//           reviewer_email: selectedReviewer,
//           reviewer_name: reviewer?.user_name || selectedReviewer,
//         })
//         .in('id', Array.from(selectedIds))
//         .eq('geography', currentGeo)
//         .eq('project_id', currentProject);

//       if (error) throw error;

//       toast.success(`Assigned ${reviewer?.user_name || selectedReviewer} to ${selectedIds.size} contributor(s)`);
//       setSelectedIds(new Set());
//       setSelectedReviewer("");
//       onRefresh?.();
//     } catch (error) {
//       toast.error("Failed to update pairings: " + error.message);
//     } finally {
//       setSaving(false);
//     }
//   }

//   /**
//    * Completely remove a pairing for a single row
//    */
//   async function removePairing(assignmentId) {
//     try {
//       const { error } = await supabase
//         .from('team_assignments')
//         .update({ 
//           reviewer_id: null, 
//           reviewer_email: null, 
//           reviewer_name: null 
//         })
//         .eq('id', assignmentId)
//         .eq('geography', currentGeo);

//       if (error) throw error;
//       toast.success("Pairing removed");
//       onRefresh?.();
//     } catch (error) {
//       toast.error("Failed to remove pairing: " + error.message);
//     }
//   }

//   /**
//    * Open the edit modal for a specific contributor
//    */
//   function openEdit(c) {
//     setEditTarget(c);
//     setEditReviewer(c.reviewer_email || "");
//     setEditReviewPct(c.review_percentage ?? 100);
//   }

//   /**
//    * Save changes from the modal (Handles both new assignment and unassigning)
//    */
//   async function saveEdit() {
//     if (!editTarget) return;
//     setSavingEdit(true);
    
//     const reviewer = reviewers.find(r => r.user_email === editReviewer);
    
//     const updateData = {
//       reviewer_id: reviewer?.user_id || null,
//       reviewer_email: editReviewer || null,
//       reviewer_name: reviewer?.user_name || null,
//       review_percentage: editReviewer ? editReviewPct : 100,
//     };

//     try {
//       const { error } = await supabase
//         .from('team_assignments')
//         .update(updateData)
//         .eq('id', editTarget.id)
//         .eq('geography', currentGeo);

//       if (error) throw error;

//       toast.success(editReviewer ? "Pairing updated" : "Pairing removed");
//       setEditTarget(null);
//       onRefresh?.();
//     } catch (error) {
//       toast.error("Failed to save changes: " + error.message);
//     } finally {
//       setSavingEdit(false);
//     }
//   }

//   const filteredTable = contributors.filter(c => {
//     if (reviewerFilter === "all") return true;
//     if (reviewerFilter === "unassigned") return !c.reviewer_email;
//     return c.reviewer_email === reviewerFilter;
//   });

//   return (
//     <div className="space-y-6">
//       <div className="flex items-center gap-2">
//         <UserCheck className="w-4 h-4 text-indigo-500" />
//         <h3 className="text-sm font-semibold text-slate-800">Reviewer Pairing</h3>
//       </div>

//       {reviewers.length === 0 && (
//         <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
//           No reviewers found in this project/geography. Add a reviewer assignment first.
//         </div>
//       )}

//       {/* Two-column assignment panel */}
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
//         {/* Left: Unassigned contributors */}
//         <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
//           <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
//             <div>
//               <p className="text-sm font-semibold text-slate-800">Unassigned Contributors</p>
//               <p className="text-xs text-slate-400">{unassigned.length} awaiting reviewer</p>
//             </div>
//             <Checkbox
//               checked={unassigned.length > 0 && selectedIds.size === unassigned.length}
//               onCheckedChange={toggleAll}
//             />
//           </div>
//           <div className="flex-1 overflow-y-auto max-h-72 divide-y divide-slate-100">
//             {unassigned.length === 0 ? (
//               <div className="p-8 text-center text-slate-400">
//                 <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
//                 <p className="text-sm">All contributors are paired</p>
//               </div>
//             ) : (
//               unassigned.map(c => (
//                 <label key={c.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-indigo-50 transition-colors ${selectedIds.has(c.id) ? "bg-indigo-50" : ""}`}>
//                   <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
//                   <div className="flex-1 min-w-0">
//                     <p className="text-sm font-medium text-slate-900">{c.user_name}</p>
//                     <p className="text-xs text-slate-400 truncate">{c.user_email}</p>
//                   </div>
//                 </label>
//               ))
//             )}
//           </div>
//         </div>

//         {/* Right: Select reviewer + assign */}
//         <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4 justify-center">
//           <div>
//             <p className="text-sm font-semibold text-slate-800 mb-1">Select Reviewer</p>
//             <p className="text-xs text-slate-400 mb-3">Choose a reviewer then click Assign</p>
//             <div className="space-y-2">
//               {reviewers.map(r => (
//                 <label key={r.id}
//                   className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedReviewer === r.user_email ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-indigo-200"}`}>
//                   <input type="radio" name="reviewer" value={r.user_email} checked={selectedReviewer === r.user_email} onChange={e => setSelectedReviewer(e.target.value)} className="text-indigo-600" />
//                   <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
//                     <span className="text-xs font-bold text-indigo-700">{r.user_name?.[0]?.toUpperCase() || "?"}</span>
//                   </div>
//                   <div className="flex-1 min-w-0">
//                     <p className="text-sm font-medium text-slate-900">{r.user_name}</p>
//                     <p className="text-xs text-slate-400 truncate">{r.user_email}</p>
//                   </div>
//                   <span className="text-xs text-slate-400">
//                     {contributors.filter(c => c.reviewer_email === r.user_email).length} assigned
//                   </span>
//                 </label>
//               ))}
//               {reviewers.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No reviewers available</p>}
//             </div>
//           </div>
//           <Button
//             onClick={applyPairing}
//             disabled={saving || !selectedIds.size || !selectedReviewer}
//             className="bg-indigo-600 hover:bg-indigo-700 text-white w-full"
//           >
//             {saving ? "Saving..." : `Assign Reviewer${selectedIds.size > 0 ? ` (${selectedIds.size} selected)` : ""}`}
//           </Button>
//         </div>
//       </div>

//       {/* Pairing table */}
//       <div className="space-y-3">
//         <div className="flex items-center justify-between flex-wrap gap-2">
//           <p className="text-sm font-semibold text-slate-700">Current Pairings</p>
//           <select value={reviewerFilter} onChange={e => setReviewerFilter(e.target.value)}
//             className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
//             <option value="all">All Contributors</option>
//             <option value="unassigned">Unassigned</option>
//             {reviewers.map(r => <option key={r.id} value={r.user_email}>{r.user_name}</option>)}
//           </select>
//         </div>

//         <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
//           <div className="overflow-x-auto">
//             <table className="w-full text-sm">
//               <thead className="bg-slate-50 border-b border-slate-200">
//                 <tr>
//                   <th className="text-left p-3 text-slate-600 font-medium">Contributor</th>
//                   <th className="text-left p-3 text-slate-600 font-medium">Email</th>
//                   <th className="text-left p-3 text-slate-600 font-medium">Reviewer</th>
//                   <th className="text-center p-3 text-slate-600 font-medium">Review %</th>
//                   <th className="p-3 text-right text-slate-600 font-medium">Actions</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-slate-100">
//                 {filteredTable.length === 0 && (
//                   <tr><td colSpan={5} className="p-8 text-center text-slate-400">No contributors match this filter.</td></tr>
//                 )}
//                 {filteredTable.map(c => (
//                   <tr key={c.id} className="hover:bg-slate-50 transition-colors">
//                     <td className="p-3 font-medium text-slate-900">{c.user_name}</td>
//                     <td className="p-3 text-xs text-slate-500">{c.user_email}</td>
//                     <td className="p-3">
//                       {c.reviewer_email ? (
//                         <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
//                           {reviewers.find(r => r.user_email === c.reviewer_email)?.user_name || c.reviewer_name || c.reviewer_email}
//                         </span>
//                       ) : (
//                         <span className="text-xs text-slate-300 italic">Unassigned</span>
//                       )}
//                     </td>
//                     <td className="p-3 text-center">
//                       {c.reviewer_email ? (
//                         <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(c.review_percentage ?? 100) < 100 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
//                           {c.review_percentage ?? 100}%
//                         </span>
//                       ) : (
//                         <span className="text-xs text-slate-300">—</span>
//                       )}
//                     </td>
//                     <td className="p-3 text-right">
//                       <div className="flex items-center justify-end gap-1">
//                         <button onClick={() => openEdit(c)}
//                           className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
//                           <Edit2 className="w-3.5 h-3.5" />
//                         </button>
//                         {c.reviewer_email && (
//                           <button onClick={() => removePairing(c.id)}
//                             className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
//                             <Trash2 className="w-3.5 h-3.5" />
//                           </button>
//                         )}
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       </div>

//       {/* Edit dialog */}
//       <Dialog open={!!editTarget} onOpenChange={v => !v && setEditTarget(null)}>
//         <DialogContent className="max-w-sm">
//           <DialogHeader><DialogTitle>Edit Reviewer Pairing</DialogTitle></DialogHeader>
//           <p className="text-sm text-slate-600">Contributor: <span className="font-semibold">{editTarget?.user_name}</span></p>
//           <div className="mt-2 space-y-4">
//             <div>
//               <label className="text-xs text-slate-500 block mb-1">Assign Reviewer</label>
//               <select value={editReviewer} onChange={e => setEditReviewer(e.target.value)}
//                 className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800">
//                 <option value="">— Remove reviewer —</option>
//                 {reviewers.map(r => <option key={r.id} value={r.user_email}>{r.user_name} ({r.user_email})</option>)}
//               </select>
//             </div>
//             {editReviewer && (
//               <div>
//                 <label className="text-xs text-slate-500 block mb-2">
//                   Review Percentage — <span className="font-bold text-indigo-700">{editReviewPct}%</span>
//                 </label>
//                 <input
//                   type="range" min={5} max={100} step={5}
//                   value={editReviewPct}
//                   onChange={e => setEditReviewPct(Number(e.target.value))}
//                   className="w-full accent-indigo-600"
//                 />
//                 <div className="flex justify-between text-xs text-slate-400 mt-1">
//                   <span>5%</span>
//                   <span>100%</span>
//                 </div>
//                 <p className="text-[11px] text-slate-400 mt-2 bg-slate-50 rounded p-2">
//                   Reviewer will see a random sample of <strong>{editReviewPct}%</strong> of this contributor's completed tasks.
//                 </p>
//               </div>
//             )}
//           </div>
//           <div className="flex gap-2 justify-end pt-4">
//             <Button variant="outline" size="sm" onClick={() => setEditTarget(null)}>Cancel</Button>
//             <Button size="sm" disabled={savingEdit} onClick={saveEdit} className="bg-indigo-600 hover:bg-indigo-700 text-white">
//               {savingEdit ? "Saving..." : "Save Changes"}
//             </Button>
//           </div>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }