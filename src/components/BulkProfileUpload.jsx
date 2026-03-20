import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  FileSpreadsheet,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/api/supabaseClient";

/**
 * Standard CSV parser handling quotes and comma delimiters.
 */
function parseCsv(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  
  const headers = lines[0]
    .split(",")
    .map(h => h.trim()
      .replace(/^"|"$/g, "")
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
    );

  return lines.slice(1).map(line => {
    const vals = [];
    let cur = "", inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { vals.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    vals.push(cur.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ""; });
    return row;
  }).filter(r => Object.values(r).some(v => v));
}

const downloadTemplate = () => {
  const headers = "email,full_name,role,cohort,byu_pathway_id,team_lead_email";
  const blob = new Blob([headers], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', 'bulk_user_template.csv');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export default function BulkProfileUpload({ open, onClose, onSuccess, myAssignment, project }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [targetGeo, setTargetGeo] = useState("");
  const [cohortOverride, setCohortOverride] = useState("");
  const [openGeos, setOpenGeos] = useState([]);
  const fileRef = useRef();

  // The columns the system expects
  const EXPECTED_COLUMNS = ["email", "full_name", "role", "cohort", "byu_pathway_id", "team_lead_email"];

  useEffect(() => {
    if (open && myAssignment?.project_id) {
      const fetchGeos = async () => {
        const { data, error } = await supabase
          .from('project_geography_states')
          .select('geography')
          .eq('project_id', myAssignment.project_id)
          .eq('status', 'open');
        
        if (!error && data) {
          setOpenGeos(data);
          if (data.length > 0) setTargetGeo(data[0].geography);
        }
      };
      fetchGeos();
    }
  }, [open, myAssignment?.project_id]);

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCsv(ev.target.result);
      const errs = [];
      const valid = [];

      rows.forEach((row, i) => {
        const rowNum = i + 2;
        const email = (row.email || "").trim();
        const full_name = (row.full_name || "").trim();
        const role = (row.role || "contributor").trim().toLowerCase();
        
        if (!email) { errs.push(`Row ${rowNum}: Missing email`); return; }
        if (!full_name) { errs.push(`Row ${rowNum}: Missing full_name`); return; }

        valid.push({
          email,
          full_name,
          system_role: ["contributor", "reviewer", "team_lead"].includes(role) ? role : "contributor",
          csvCohort: row.cohort || "",
          byu_id: row.byu_pathway_id || row.byu_id || "",
          team_lead_email: (row.team_lead_email || "").trim()
        });
      });

      setPreview(valid);
      setErrors(errs);
    };
    reader.readAsText(f);
  }

  async function doUpload() {
    if (!preview.length || !targetGeo) return;
    setLoading(true);

    try {
      for (const person of preview) {
        // 1. Core Profile & Assignment
        await supabase.rpc('admin_add_user_to_team', {
          p_email: person.email,
          p_full_name: person.full_name,
          p_role: person.system_role,
          p_project_id: myAssignment.project_id,
          p_project_type: project?.project_type || myAssignment.project_type,
          p_geography: targetGeo
        });

        // 2. Metadata Update
        const finalCohort = cohortOverride.trim() !== "" ? cohortOverride : person.csvCohort;
        await supabase.from('profiles')
          .update({ cohort: finalCohort, byu_pathway_id: person.byu_id })
          .eq('email', person.email);

        // 3. Team Lead Mapping
        if (person.team_lead_email && person.system_role !== 'team_lead') {
          const { data: lead } = await supabase
            .from('profiles').select('id').eq('email', person.team_lead_email).single();
          if (lead) {
            await supabase.from('team_assignments')
              .update({ reports_to: lead.id })
              .eq('user_email', person.email)
              .eq('project_id', myAssignment.project_id);
          }
        }
      }

      toast.success(`Successfully processed ${preview.length} users.`);
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error("Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-center pr-6">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              Bulk Profile Upload
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-indigo-600 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-xs font-bold h-8 px-3 rounded-lg flex items-center shadow-sm transition-all">
              <Download className="w-3 h-3 mr-1" /> Template
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Column Guide - ADDED THIS SECTION */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
            <div className="flex items-center gap-2 text-indigo-800 text-xs font-bold mb-2">
              <Info className="w-3.5 h-3.5" /> Expected CSV Headers:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXPECTED_COLUMNS.map(col => (
                <code key={col} className="bg-white border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-mono">
                  {col}
                </code>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-500 uppercase">Target Geography</Label>
              <select 
                value={targetGeo} 
                onChange={e => setTargetGeo(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md h-9 px-2 bg-white"
              >
                <option value="" disabled>Select geography...</option>
                {openGeos.map(g => <option key={g.geography} value={g.geography}>{g.geography}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-500 uppercase">Cohort Override</Label>
              <Input 
                placeholder="Overrides CSV value..." 
                value={cohortOverride} 
                onChange={e => setCohortOverride(e.target.value)} 
                className="h-9 text-sm"
              />
            </div>
          </div>

          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          <button 
            onClick={() => fileRef.current.click()} 
            className="w-full border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center gap-2 hover:border-indigo-400 hover:bg-slate-50 transition-all"
          >
            <Upload className="w-6 h-6 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">{file ? file.name : "Select CSV File"}</span>
          </button>

          {errors.length > 0 && (
            <div className="bg-red-50 p-3 rounded-lg text-[11px] text-red-600 max-h-24 overflow-y-auto font-mono">
              {errors.map((err, i) => <p key={i}>• {err}</p>)}
            </div>
          )}

          {preview.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-[10px]">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.slice(0, 5).map((p, i) => (
                    <tr key={i}>
                      <td className="p-2 truncate max-w-[120px]">{p.email}</td>
                      <td className="p-2">{p.full_name}</td>
                      <td className="p-2 capitalize">{p.system_role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={loading || !preview.length || !targetGeo} onClick={doUpload} className="bg-indigo-600 text-white">
            {loading ? "Uploading..." : `Upload ${preview.length} Profiles`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}









// export default function BulkProfileUpload({ open, onClose, onSuccess, myAssignment, project }) {
//   const [file, setFile] = useState(null);
//   const [preview, setPreview] = useState([]);
//   const [errors, setErrors] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const fileRef = useRef();

//   function handleFile(e) {
//     const f = e.target.files[0];
//     if (!f) return;
//     setFile(f);
//     const reader = new FileReader();
//     reader.onload = (ev) => {
//       const rows = parseCsv(ev.target.result);
//       const errs = [];
//       const valid = [];

//       rows.forEach((row, i) => {
//         const rowNum = i + 2;
//         const email = (row.email || row.user_email || "").trim();
//         const full_name = (row.full_name || row.name || row.fullname || "").trim();
//         const rawRole = (row.role || row.system_role || "contributor").trim().toLowerCase();

//         if (!email) { errs.push(`Row ${rowNum}: missing email`); return; }
//         if (!full_name) { errs.push(`Row ${rowNum}: missing full_name`); return; }
//         if (BLOCKED_ROLES.includes(rawRole)) {
//           errs.push(`Row ${rowNum}: role "${rawRole}" is not allowed — only contributor, reviewer, team_lead`);
//           return;
//         }
//         const system_role = ALLOWED_ROLES.includes(rawRole) ? rawRole : "contributor";

//         valid.push({
//           email,
//           full_name,
//           system_role,
//           // We keep these for the UI preview but will send essential ones to RPC
//           byu_pathway_id: row.byu_pathway_id || row.byu_id || "",
//           cohort: row.cohort || "",
//           report_to: row.report_to || row.reportto || "",
//         });
//       });

//       setPreview(valid);
//       setErrors(errs);
//     };
//     reader.readAsText(f);
//   }

//   async function doUpload() {
//     if (!preview.length) return;
//     setLoading(true);
//     let successCount = 0;
//     let failCount = 0;

//     try {
//       // We process sequentially to ensure RLS doesn't catch an "incomplete" profile
//       for (const person of preview) {
//         const { error } = await supabase.rpc('admin_add_user_to_team', {
//           p_email: person.email,
//           p_full_name: person.full_name,
//           p_role: person.system_role,
//           p_project_id: myAssignment.project_id,
//           p_project_type: project?.project_type || myAssignment.project_type,
//           p_geography: myAssignment.geography
//         });

//         if (error) {
//           console.error(`Error uploading ${person.email}:`, error);
//           failCount++;
//         } else {
//           successCount++;
//         }
//       }

//       if (failCount === 0) {
//         toast.success(`Success: ${successCount} profiles added to your team.`);
//       } else {
//         toast.warning(`Finished: ${successCount} successful, ${failCount} failed.`);
//       }

//       onSuccess?.();
//       onClose();
//       setFile(null); setPreview([]); setErrors([]);
//     } catch (e) {
//       console.error(e);
//       toast.error("An unexpected error occurred during upload.");
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <Dialog open={open} onOpenChange={onClose}>
//       <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle>Bulk Upload Profiles</DialogTitle>
//         </DialogHeader>
//         <div className="space-y-4">
//           {myAssignment && (
//             <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800">
//               <span className="font-semibold">Scope enforced:</span> Geography = <strong>{myAssignment.geography}</strong> · Project type = <strong>{project?.project_type || myAssignment.project_type}</strong>
//             </div>
//           )}

//           <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-800">
//             <p className="font-semibold mb-1">Expected CSV columns</p>
//             <p className="font-medium mt-1">Required:</p>
//             <code className="block ml-2">email</code>
//             <code className="block ml-2">full_name</code>
//             <p className="font-medium mt-2">Optional:</p>
//             <code className="block ml-2">role (system_role)</code>
//             <p className="mt-2 opacity-70">Valid roles: <strong>contributor</strong>, <strong>reviewer</strong>, <strong>team_lead</strong></p>
//             <p className="text-red-600 mt-1">Note: This will automatically assign users to your current project territory.</p>
//           </div>

//           <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
//           <button onClick={() => fileRef.current.click()}
//             className="w-full border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center gap-3 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer">
//             <Upload className="w-8 h-8" />
//             <span className="text-sm font-medium">{file ? file.name : "Click to select CSV file"}</span>
//           </button>

//           {/* ... Errors and Preview logic remains the same as your original ... */}
//           {errors.length > 0 && (
//             <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
//               <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
//                 <AlertCircle className="w-4 h-4" /> {errors.length} row(s) rejected
//               </div>
//               {errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
//             </div>
//           )}

//           {preview.length > 0 && (
//             <div className="bg-green-50 border border-green-200 rounded-lg p-3">
//               <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-2">
//                 <CheckCircle2 className="w-4 h-4" /> {preview.length} profiles ready to upload
//               </div>
//               <div className="overflow-x-auto max-h-48 rounded border border-green-200">
//                 <table className="w-full text-xs">
//                   <thead className="bg-green-100">
//                     <tr>
//                       <th className="text-left p-2">Email</th>
//                       <th className="text-left p-2">Name</th>
//                       <th className="text-left p-2">Role</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {preview.slice(0, 10).map((r, i) => (
//                       <tr key={i} className="border-t border-green-200">
//                         <td className="p-2">{r.email}</td>
//                         <td className="p-2">{r.full_name}</td>
//                         <td className="p-2">{r.system_role}</td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           )}
//         </div>

//         <DialogFooter>
//           <Button variant="outline" onClick={onClose}>Cancel</Button>
//           <Button
//             disabled={loading || !preview.length}
//             onClick={doUpload}
//             className="bg-indigo-600 hover:bg-indigo-700 text-white"
//           >
//             {loading ? "Processing..." : `Upload ${preview.length} Profiles`}
//           </Button>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   );
// }