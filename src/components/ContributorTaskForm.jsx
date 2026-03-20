import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Database, Link2, UserPlus } from "lucide-react";
import {
  HINTS_RESULT_OPTIONS, DUPLICATES_DATA_CONFLICTS_OPTIONS,
  DUPLICATES_RESULT_OPTIONS, DUPLICATES_QUALIFICATION_OPTIONS,
  DUPLICATES_RESOLVED_OPTIONS, TIME_CONTRIBUTOR_OPTIONS_HINTS,
  TIME_CONTRIBUTOR_OPTIONS_DUPS
} from "./scoring";

export default function ContributorTaskForm({ task, onSubmit, loading }) {
  const [form, setForm] = useState({
    hint_result: task.hint_result || "",
    qualifications_created: task.qualifications_created || "",
    new_persons_added: task.new_persons_added || "",
    time_spent_contributor: task.time_spent_contributor || "",
    contributor_notes: task.contributor_notes || "",
    data_conflicts: task.data_conflicts || "",
    duplicate_result: task.duplicate_result || "",
    duplicates_resolved: task.duplicates_resolved || "",
    qualification_status: task.qualification_status || "",
  });

  const isHints = task.project_type === "hints";
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    onSubmit({
      ...form,
      status: 'completed',
      date_completed: new Date().toISOString(),
      qualifications_created: form.qualifications_created !== "" ? parseInt(form.qualifications_created, 10) : 0,
      new_persons_added: form.new_persons_added !== "" ? parseInt(form.new_persons_added, 10) : 0,
    });
  };

  const formatBool = (val) => (val === true ? "Yes" : "No");

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      
      {/* SOURCE DATA HEADER */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-100/50 px-5 py-2 border-b border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Source Data</span>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-400">
              <Database className="w-4 h-4" />
              <Label className="text-[11px] font-bold uppercase text-slate-500">Collection</Label>
            </div>
            <p className="text-sm font-bold text-slate-900 leading-tight">
              {task.collection_name || "N/A"}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-400">
              <Link2 className="w-4 h-4" />
              <Label className="text-[11px] font-bold uppercase text-slate-500">Member Connected</Label>
            </div>
            <div className={`text-xs font-bold px-3 py-1 rounded-full border w-fit ${
              task.member_connected ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
            }`}>
              {formatBool(task.member_connected)}
            </div>
          </div>

          {isHints && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-400">
                <UserPlus className="w-4 h-4" />
                <Label className="text-[11px] font-bold uppercase text-slate-500">New Person Available</Label>
              </div>
              <div className={`text-xs font-bold px-3 py-1 rounded-full border w-fit ${
                task.new_person_available ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-100 border-slate-300 text-slate-600"
              }`}>
                {formatBool(task.new_person_available)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* INPUTS SECTION */}
      <div className="space-y-5">
        {isHints ? (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-bold">Hint Result *</Label>
              <Select value={form.hint_result} onValueChange={v => set("hint_result", v)}>
                <SelectTrigger className="h-12"><SelectValue placeholder="Select result..." /></SelectTrigger>
                <SelectContent>
                  {HINTS_RESULT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-bold">Qualifications Created</Label>
                <Input 
                  type="number" 
                  min="0" // Prevents the stepper (arrows) from going below 0
                  className="h-12" 
                  value={form.qualifications_created} 
                  onChange={e => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    set("qualifications_created", val);
                  }} 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold">New Persons Added</Label>
                <Input 
                  type="number" 
                  min="0" // Prevents the stepper (arrows) from going below 0
                  className="h-12" 
                  value={form.new_persons_added} 
                  onChange={e => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    set("new_persons_added", val);
                  }} 
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-bold">Data Conflicts *</Label>
              <Select value={form.data_conflicts} onValueChange={v => set("data_conflicts", v)}>
                <SelectTrigger className="h-12"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {DUPLICATES_DATA_CONFLICTS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-bold">Duplicate Result *</Label>
              <Select value={form.duplicate_result} onValueChange={v => set("duplicate_result", v)}>
                <SelectTrigger className="h-12"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {DUPLICATES_RESULT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-bold">Time Spent</Label>
          <Select value={form.time_spent_contributor} onValueChange={v => set("time_spent_contributor", v)}>
            <SelectTrigger className="h-12"><SelectValue placeholder="Select time..." /></SelectTrigger>
            <SelectContent>
              {(isHints ? TIME_CONTRIBUTOR_OPTIONS_HINTS : TIME_CONTRIBUTOR_OPTIONS_DUPS).map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-bold">Notes</Label>
          <Textarea 
            className="min-h-[100px] bg-slate-50/50" 
            value={form.contributor_notes} 
            onChange={e => set("contributor_notes", e.target.value)} 
          />
        </div>
      </div>

      <Button
        type="button"
        disabled={loading}
        onClick={handleSubmit}
        className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl"
      >
        {loading ? "Submitting..." : "Submit Task"}
      </Button>
    </form>
  );
}












// import { useState } from "react";
// import { Button } from "@/components/ui/button";
// import { Textarea } from "@/components/ui/textarea";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Label } from "@/components/ui/label";
// import { Switch } from "@/components/ui/switch";
// import { Input } from "@/components/ui/input";
// import {
//   HINTS_RESULT_OPTIONS, DUPLICATES_DATA_CONFLICTS_OPTIONS,
//   DUPLICATES_RESULT_OPTIONS, DUPLICATES_QUALIFICATION_OPTIONS,
//   DUPLICATES_RESOLVED_OPTIONS, TIME_CONTRIBUTOR_OPTIONS_HINTS,
//   TIME_CONTRIBUTOR_OPTIONS_DUPS
// } from "./scoring";

// export default function ContributorTaskForm({ task, onSubmit, loading }) {
//   const [form, setForm] = useState({
//     hint_result: task.hint_result || "",
//     qualifications_created: task.qualifications_created || "",
//     new_persons_added: task.new_persons_added || "",
//     time_spent_contributor: task.time_spent_contributor || "",
//     contributor_notes: task.contributor_notes || "",
//     data_conflicts: task.data_conflicts || "",
//     duplicate_result: task.duplicate_result || "",
//     duplicates_resolved: task.duplicates_resolved || "",
//     qualification_status: task.qualification_status || "",
//     member_connected: task.member_connected || false,
//     new_person_available: task.new_person_available || false
//   });

//   const isHints = task.project_type === "hints";
//   const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

//   const handleSubmit = (e) => {
//     if (e && e.preventDefault) e.preventDefault();
    
//     // Preparing data for Supabase: ensuring numeric types and default statuses
//     onSubmit({
//       ...form,
//       status: 'submitted', // Standard workflow status for Supabase
//       submitted_at: new Date().toISOString(),
//       qualifications_created: form.qualifications_created !== "" ? parseInt(form.qualifications_created, 10) : 0,
//       new_persons_added: form.new_persons_added !== "" ? parseInt(form.new_persons_added, 10) : 0,
//     });
//   };

//   return (
//     <form onSubmit={handleSubmit} className="space-y-4">
//       <div className="flex items-center gap-3">
//         <Switch checked={form.member_connected} onCheckedChange={v => set("member_connected", v)} id="mc" />
//         <Label htmlFor="mc">Member Connected</Label>
//       </div>

//       {isHints && (
//         <div className="flex items-center gap-3">
//           <Switch checked={form.new_person_available} onCheckedChange={v => set("new_person_available", v)} id="npa" />
//           <Label htmlFor="npa">New Person Available</Label>
//         </div>
//       )}

//       {isHints ? (
//         <>
//           <div className="space-y-1">
//             <Label>Hint Result *</Label>
//             <Select value={form.hint_result} onValueChange={v => set("hint_result", v)}>
//               <SelectTrigger><SelectValue placeholder="Select result..." /></SelectTrigger>
//               <SelectContent>
//                 {HINTS_RESULT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
//               </SelectContent>
//             </Select>
//           </div>
//           <div className="grid grid-cols-2 gap-3">
//             <div className="space-y-1">
//               <Label>Qualifications Created</Label>
//               <Input type="number" min="0" value={form.qualifications_created} onChange={e => set("qualifications_created", e.target.value)} />
//             </div>
//             <div className="space-y-1">
//               <Label>New Persons Added</Label>
//               <Input type="number" min="0" value={form.new_persons_added} onChange={e => set("new_persons_added", e.target.value)} />
//             </div>
//           </div>
//           <div className="space-y-1">
//             <Label>Time Spent</Label>
//             <Select value={form.time_spent_contributor} onValueChange={v => set("time_spent_contributor", v)}>
//               <SelectTrigger><SelectValue placeholder="Select time..." /></SelectTrigger>
//               <SelectContent>
//                 {TIME_CONTRIBUTOR_OPTIONS_HINTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
//               </SelectContent>
//             </Select>
//           </div>
//         </>
//       ) : (
//         <>
//           <div className="space-y-1">
//             <Label>Data Conflicts *</Label>
//             <Select value={form.data_conflicts} onValueChange={v => set("data_conflicts", v)}>
//               <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
//               <SelectContent>
//                 {DUPLICATES_DATA_CONFLICTS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
//               </SelectContent>
//             </Select>
//           </div>
//           <div className="space-y-1">
//             <Label>Duplicate Result *</Label>
//             <Select value={form.duplicate_result} onValueChange={v => set("duplicate_result", v)}>
//               <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
//               <SelectContent>
//                 {DUPLICATES_RESULT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
//               </SelectContent>
//             </Select>
//           </div>
//           <div className="grid grid-cols-2 gap-3">
//             <div className="space-y-1">
//               <Label>Duplicates Resolved</Label>
//               <Select value={form.duplicates_resolved} onValueChange={v => set("duplicates_resolved", v)}>
//                 <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
//                 <SelectContent>
//                   {DUPLICATES_RESOLVED_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
//                 </SelectContent>
//               </Select>
//             </div>
//             <div className="space-y-1">
//               <Label>Qualifications Created</Label>
//               <Input type="number" min="0" value={form.qualifications_created} onChange={e => set("qualifications_created", e.target.value)} />
//             </div>
//           </div>
//           <div className="space-y-1">
//             <Label>Qualification Status</Label>
//             <Select value={form.qualification_status} onValueChange={v => set("qualification_status", v)}>
//               <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
//               <SelectContent>
//                 {DUPLICATES_QUALIFICATION_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
//               </SelectContent>
//             </Select>
//           </div>
//           <div className="space-y-1">
//             <Label>Time Spent</Label>
//             <Select value={form.time_spent_contributor} onValueChange={v => set("time_spent_contributor", v)}>
//               <SelectTrigger><SelectValue placeholder="Select time..." /></SelectTrigger>
//               <SelectContent>
//                 {TIME_CONTRIBUTOR_OPTIONS_DUPS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
//               </SelectContent>
//             </Select>
//           </div>
//         </>
//       )}

//       <div className="space-y-1">
//         <Label>Notes</Label>
//         <Textarea value={form.contributor_notes} onChange={e => set("contributor_notes", e.target.value)} rows={3} placeholder="Add any notes..." />
//       </div>

//       <Button
//         type="button"
//         disabled={loading}
//         onClick={handleSubmit}
//         className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
//       >
//         {loading ? "Submitting..." : "Submit Task"}
//       </Button>
//     </form>
//   );
// }