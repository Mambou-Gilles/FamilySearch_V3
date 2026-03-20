import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { User, Database, ClipboardCheck, MessageSquare } from "lucide-react";
import {
  HINTS_TREE_WORK_OPTIONS, HINTS_DOC_OPTIONS,
  DUPLICATES_TREE_REVIEW_OPTIONS, DUPLICATES_DOC_OPTIONS,
  TIME_REVIEWER_OPTIONS, calcScores
} from "./scoring";

export default function ReviewerTaskForm({ task, onSubmit, loading }) {
  const isHints = task.project_type === "hints";
  const [form, setForm] = useState({
    revision_needed: task.revision_needed || false,
    tree_work_review: task.tree_work_review || "",
    doc_results: task.doc_results || "",
    time_spent_reviewer: task.time_spent_reviewer || "",
    reviewer_notes: task.reviewer_notes || ""
  });
  
  const [scores, setScores] = useState({ 
    quality_score_tree: 0, 
    quality_score_doc: 0, 
    total_quality_score: 0 
  });

  useEffect(() => {
    const s = calcScores({ ...task, ...form });
    setScores(s);
  }, [form.tree_work_review, form.doc_results, task]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const status = form.revision_needed ? "needs_correction" : "reviewed";
    onSubmit({
      ...form,
      ...scores,
      status,
      review_date: new Date().toISOString(),
      correction_count: form.revision_needed ? (task.correction_count || 0) + 1 : task.correction_count || 0
    });
  };

  const treeOptions = isHints ? HINTS_TREE_WORK_OPTIONS : DUPLICATES_TREE_REVIEW_OPTIONS;
  const docOptions = isHints ? HINTS_DOC_OPTIONS : DUPLICATES_DOC_OPTIONS;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Enhanced Contributor Submission View */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Contributor Submission</span>
          </div>
          {task.collection_name && (
            <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none text-[10px]">
              {task.collection_name}
            </Badge>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Section 1: Core Connection Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-500 uppercase">Member Connected</Label>
              <p className={`text-sm font-semibold ${task.member_connected ? "text-green-700" : "text-slate-900"}`}>
                {task.member_connected ? "Yes" : "No"}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-500 uppercase">New Person Available</Label>
              <p className="text-sm font-semibold text-slate-900">
                {task.new_person_available ? "Yes" : "No"}
              </p>
            </div>
          </div>

          {/* Section 2: Project Specific Results */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            {isHints ? (
              <>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500 uppercase">Hint Result</Label>
                  <p className="text-sm font-medium text-slate-900">{task.hint_result || "—"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500 uppercase">New Persons Added</Label>
                  <p className="text-sm font-medium text-slate-900">{task.new_persons_added ?? "0"}</p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500 uppercase">Duplicate Result</Label>
                  <p className="text-sm font-medium text-slate-900">{task.duplicate_result || "—"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500 uppercase">Resolved</Label>
                  <p className="text-sm font-medium text-slate-900">{task.duplicates_resolved || "—"}</p>
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-500 uppercase">Quals Created</Label>
              <p className="text-sm font-medium text-slate-900">{task.qualifications_created ?? "0"}</p>
            </div>
            {!isHints && (
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-500 uppercase">Qual Status</Label>
                <p className="text-sm font-medium text-slate-900">{task.qualification_status || "—"}</p>
              </div>
            )}
          </div>

          {/* Section 3: Notes */}
          {task.contributor_notes && (
            <div className="mt-3 p-3 bg-amber-50/50 rounded-lg border border-amber-100">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-3 h-3 text-amber-600" />
                <span className="text-[10px] font-bold text-amber-800 uppercase">Contributor Notes</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed italic">"{task.contributor_notes}"</p>
            </div>
          )}
        </div>
      </div>

      {/* Reviewer Action Form */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-3">
            <Switch checked={form.revision_needed} onCheckedChange={v => set("revision_needed", v)} id="rn" />
            <Label htmlFor="rn" className="font-semibold text-slate-700">Revision Needed</Label>
          </div>
          {form.revision_needed && <Badge className="bg-red-100 text-red-700 border-none">Correction Mode</Badge>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600 uppercase ml-1">Tree Work Review</Label>
            <Select value={form.tree_work_review} onValueChange={v => set("tree_work_review", v)}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Select quality..." /></SelectTrigger>
              <SelectContent>
                {treeOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600 uppercase ml-1">Doc Results</Label>
            <Select value={form.doc_results} onValueChange={v => set("doc_results", v)}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Select quality..." /></SelectTrigger>
              <SelectContent>
                {docOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-600 uppercase ml-1">Time Spent (Reviewer)</Label>
          <Select value={form.time_spent_reviewer} onValueChange={v => set("time_spent_reviewer", v)}>
            <SelectTrigger className="bg-white"><SelectValue placeholder="How long did review take?" /></SelectTrigger>
            <SelectContent>
              {TIME_REVIEWER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-600 uppercase ml-1">Reviewer Feedback</Label>
          <Textarea 
            value={form.reviewer_notes} 
            onChange={e => set("reviewer_notes", e.target.value)} 
            rows={3} 
            className="bg-white resize-none"
            placeholder={form.revision_needed ? "Explain what needs fixing..." : "Optional positive feedback..."} 
          />
        </div>

        {/* Scores Display */}
        {(form.tree_work_review || form.doc_results) && (
          <div className="flex items-center gap-4 p-4 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-200">
            <div className="flex-1 grid grid-cols-2 gap-2 border-r border-indigo-400/50 pr-4">
              <div>
                <p className="text-[10px] uppercase opacity-80">Tree Score</p>
                <p className="text-lg font-bold">{scores.quality_score_tree}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase opacity-80">Doc Score</p>
                <p className="text-lg font-bold">{scores.quality_score_doc}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase opacity-80">Total Score</p>
              <p className="text-3xl font-black">{scores.total_quality_score}</p>
            </div>
          </div>
        )}

        <Button 
          type="submit" 
          disabled={loading} 
          className={`w-full h-12 text-sm font-bold transition-all shadow-sm ${
            form.revision_needed 
              ? "bg-red-600 hover:bg-red-700 text-white" 
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          {loading ? "Processing..." : form.revision_needed ? "Send Back for Corrections" : "Approve & Complete"}
        </Button>
      </div>
    </form>
  );
}














// import { useState, useEffect } from "react";
// import { Button } from "@/components/ui/button";
// import { Textarea } from "@/components/ui/textarea";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Label } from "@/components/ui/label";
// import { Switch } from "@/components/ui/switch";
// import { Badge } from "@/components/ui/badge";
// import {
//   HINTS_TREE_WORK_OPTIONS, HINTS_DOC_OPTIONS,
//   DUPLICATES_TREE_REVIEW_OPTIONS, DUPLICATES_DOC_OPTIONS,
//   TIME_REVIEWER_OPTIONS, calcScores
// } from "./scoring";

// export default function ReviewerTaskForm({ task, onSubmit, loading }) {
//   const isHints = task.project_type === "hints";
//   const [form, setForm] = useState({
//     revision_needed: task.revision_needed || false,
//     tree_work_review: task.tree_work_review || "",
//     doc_results: task.doc_results || "",
//     time_spent_reviewer: task.time_spent_reviewer || "",
//     reviewer_notes: task.reviewer_notes || ""
//   });
  
//   const [scores, setScores] = useState({ 
//     quality_score_tree: 0, 
//     quality_score_doc: 0, 
//     total_quality_score: 0 
//   });

//   useEffect(() => {
//     const s = calcScores({ ...task, ...form });
//     setScores(s);
//   }, [form.tree_work_review, form.doc_results, task]);

//   const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     const status = form.revision_needed ? "needs_correction" : "reviewed";
//     onSubmit({
//       ...form,
//       ...scores,
//       status,
//       review_date: new Date().toISOString(),
//       correction_count: form.revision_needed ? (task.correction_count || 0) + 1 : task.correction_count || 0
//     });
//   };

//   const treeOptions = isHints ? HINTS_TREE_WORK_OPTIONS : DUPLICATES_TREE_REVIEW_OPTIONS;
//   const docOptions = isHints ? HINTS_DOC_OPTIONS : DUPLICATES_DOC_OPTIONS;

//   return (
//     <form onSubmit={handleSubmit} className="space-y-4">
//       <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1.5">
//         <p className="font-semibold text-slate-700 mb-2">Contributor Submission</p>
        
//         {/* Common fields */}
//         <div className="grid grid-cols-2 gap-x-4 gap-y-1">
//           <p className="text-slate-500">Member Connected</p>
//           <p className="text-slate-900 font-medium">{task.member_connected ? "Yes" : "No"}</p>
//         </div>

//         {isHints ? (
//           <>
//             <div className="grid grid-cols-2 gap-x-4 gap-y-1">
//               <p className="text-slate-500">New Person Available</p>
//               <p className="text-slate-900 font-medium">{task.new_person_available ? "Yes" : "No"}</p>
//             </div>
//             <div className="grid grid-cols-2 gap-x-4 gap-y-1">
//               <p className="text-slate-500">Hint Result</p>
//               <p className="text-slate-900 font-medium">{task.hint_result || "—"}</p>
//             </div>
//             <div className="grid grid-cols-2 gap-x-4 gap-y-1">
//               <p className="text-slate-500">Qualifications Created</p>
//               <p className="text-slate-900 font-medium">{task.qualifications_created ?? "—"}</p>
//             </div>
//             <div className="grid grid-cols-2 gap-x-4 gap-y-1">
//               <p className="text-slate-500">New Persons Added</p>
//               <p className="text-slate-900 font-medium">{task.new_persons_added ?? "—"}</p>
//             </div>
//           </>
//         ) : (
//           <>
//             <div className="grid grid-cols-2 gap-x-4 gap-y-1">
//               <p className="text-slate-500">Data Conflicts</p>
//               <p className="text-slate-900 font-medium">{task.data_conflicts || "—"}</p>
//             </div>
//             <div className="grid grid-cols-2 gap-x-4 gap-y-1">
//               <p className="text-slate-500">Duplicate Result</p>
//               <p className="text-slate-900 font-medium">{task.duplicate_result || "—"}</p>
//             </div>
//             <div className="grid grid-cols-2 gap-x-4 gap-y-1">
//               <p className="text-slate-500">Duplicates Resolved</p>
//               <p className="text-slate-900 font-medium">{task.duplicates_resolved || "—"}</p>
//             </div>
//             <div className="grid grid-cols-2 gap-x-4 gap-y-1">
//               <p className="text-slate-500">Qualifications Created</p>
//               <p className="text-slate-900 font-medium">{task.qualifications_created ?? "—"}</p>
//             </div>
//             <div className="grid grid-cols-2 gap-x-4 gap-y-1">
//               <p className="text-slate-500">Qualification Status</p>
//               <p className="text-slate-900 font-medium">{task.qualification_status || "—"}</p>
//             </div>
//           </>
//         )}

//         {task.contributor_notes && (
//           <div className="pt-1 border-t border-slate-200 mt-1">
//             <p className="text-slate-500">Notes</p>
//             <p className="text-slate-900 italic text-xs mt-0.5">{task.contributor_notes}</p>
//           </div>
//         )}
//       </div>

//       <div className="flex items-center gap-3">
//         <Switch checked={form.revision_needed} onCheckedChange={v => set("revision_needed", v)} id="rn" />
//         <Label htmlFor="rn" className="font-medium">Revision Needed</Label>
//       </div>

//       <div className="space-y-1">
//         <Label>Tree Work Review</Label>
//         <Select value={form.tree_work_review} onValueChange={v => set("tree_work_review", v)}>
//           <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
//           <SelectContent>
//             {treeOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
//           </SelectContent>
//         </Select>
//       </div>

//       <div className="space-y-1">
//         <Label>Documentation Results</Label>
//         <Select value={form.doc_results} onValueChange={v => set("doc_results", v)}>
//           <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
//           <SelectContent>
//             {docOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
//           </SelectContent>
//         </Select>
//       </div>

//       <div className="space-y-1">
//         <Label>Time Spent (Reviewer)</Label>
//         <Select value={form.time_spent_reviewer} onValueChange={v => set("time_spent_reviewer", v)}>
//           <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
//           <SelectContent>
//             {TIME_REVIEWER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
//           </SelectContent>
//         </Select>
//       </div>

//       <div className="space-y-1">
//         <Label>Reviewer Notes</Label>
//         <Textarea 
//           value={form.reviewer_notes} 
//           onChange={e => set("reviewer_notes", e.target.value)} 
//           rows={3} 
//           placeholder="Feedback for contributor..." 
//         />
//       </div>

//       {(form.tree_work_review || form.doc_results) && (
//         <div className="flex gap-3 p-3 bg-indigo-50 rounded-lg">
//           <div className="text-center">
//             <p className="text-xs text-slate-500">Tree Score</p>
//             <p className="text-lg font-bold text-indigo-700">{scores.quality_score_tree}</p>
//           </div>
//           <div className="text-center">
//             <p className="text-xs text-slate-500">Doc Score</p>
//             <p className="text-lg font-bold text-indigo-700">{scores.quality_score_doc}</p>
//           </div>
//           <div className="text-center ml-auto">
//             <p className="text-xs text-slate-500">Total</p>
//             <p className="text-2xl font-bold text-indigo-700">{scores.total_quality_score}</p>
//           </div>
//         </div>
//       )}

//       <Button 
//         type="submit" 
//         disabled={loading} 
//         className={`w-full text-white ${form.revision_needed ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
//       >
//         {loading ? "Submitting..." : form.revision_needed ? "Send for Correction" : "Approve & Complete"}
//       </Button>
//     </form>
//   );
// }