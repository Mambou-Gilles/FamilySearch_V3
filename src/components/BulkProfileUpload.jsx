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
  FileSpreadsheet, 
  Upload, 
  Trash2, 
  Info, 
  AlertCircle, 
  Loader2, 
  Download
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/api/supabaseClient";

/**
 * Standard CSV parser handling quotes and comma delimiters.
 */
function parseCsv(text) {
  // Use a regex to split lines to handle both \n and \r\n (Windows)
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  
  const headers = lines[0]
    .split(",")
    .map(h => h.trim()
      .replace(/^"|"$/g, "") // Remove quotes
      .toLowerCase()
      .replace(/\s+/g, "_")  // Spaces to underscores
      // Keep only alphanumeric and underscores to match your 'valid' object keys
      .replace(/[^a-z0-9_]/g, "") 
    );

  return lines.slice(1).map(line => {
    const vals = [];
    let cur = "", inQuote = false;
    
    // Proper CSV state machine for quotes
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        vals.push(cur.replace(/^"|"$/g, "").trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    vals.push(cur.replace(/^"|"$/g, "").trim());

    const row = {};
    headers.forEach((h, i) => {
      if (h) row[h] = vals[i] || ""; 
    });
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

  // function handleFile(e) {
  //   const f = e.target.files[0];
  //   if (!f) return;
  //   setFile(f);
    
  //   const reader = new FileReader();
  //   reader.onload = (ev) => {
  //     const rows = parseCsv(ev.target.result);
  //     const errs = [];
  //     const valid = [];

  //     rows.forEach((row, i) => {
  //       console.log(`🔍 Row ${i + 2} Data:`, row);
  //       const rowNum = i + 2;
  //       const email = (row.email || "").trim();
  //       const full_name = (row.full_name || "").trim();
  //       const role = (row.role || "contributor").trim().toLowerCase();
        
  //       if (!email) { errs.push(`Row ${rowNum}: Missing email`); return; }
  //       if (!full_name) { errs.push(`Row ${rowNum}: Missing full_name`); return; }

  //       valid.push({
  //         email,
  //         full_name,
  //         system_role: ["contributor", "reviewer", "team_lead"].includes(role) ? role : "contributor",
  //         csvCohort: row.cohort || "",
  //         byu_id: row.byu_pathway_id || row.byu_id || "",
  //         team_lead_email: (row.team_lead_email || "").trim()
  //       });
  //     });

  //     setPreview(valid);
  //     setErrors(errs);
  //   };
  //   reader.readAsText(f);
  // }

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      // Assuming parseCsv returns an array of objects based on headers
      const rows = parseCsv(ev.target.result);
      const errs = [];
      const valid = [];

      rows.forEach((row, i) => {
        // Log the raw row to the console so you can see the exact header keys
        console.log(`🔍 Row ${i + 2} Data:`, row);
        
        const rowNum = i + 2;
        const email = (row.email || "").trim();
        const full_name = (row.full_name || "").trim();
        
        // Normalize the role
        const rawRole = (row.role || "contributor").trim().toLowerCase();
        const role = ["contributor", "reviewer", "team_lead"].includes(rawRole) ? rawRole : "contributor";

        // Validation
        if (!email) { 
          errs.push(`Row ${rowNum}: Missing email`); 
          return; 
        }
        if (!full_name) { 
          errs.push(`Row ${rowNum}: Missing full_name`); 
          return; 
        }

        // We map the row data to a clean object. 
        // IMPORTANT: We use the exact names the update function expects.
        valid.push({
          email,
          full_name,
          role, // Using 'role' to match the CSV header
          cohort: (row.cohort || "").trim(),
          byu_pathway_id: (row.byu_pathway_id || row.byu_id || "").trim(),
          team_lead_email: (row.team_lead_email || "").trim()
        });
      });

      setPreview(valid);
      setErrors(errs);
      
      if (errs.length > 0) {
        toast.error(`Found ${errs.length} errors in CSV.`);
      }
    };
    reader.readAsText(f);
}

  async function doUpload() {
    if (!preview.length || !targetGeo) return;
    setLoading(true);

    try {
      for (const person of preview) {
        // 1. Resolve Lead ID first (if email exists)
        let leadId = null;
        if (person.team_lead_email) {
          const { data: lead } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', person.team_lead_email.trim())
            .maybeSingle();
          if (lead) leadId = lead.id;
        }

        // 2. Call the UPDATED RPC with all parameters
        const { error: rpcError } = await supabase.rpc('admin_add_user_to_team', {
          p_email: person.email,
          p_full_name: person.full_name,
          p_role: person.role, 
          p_project_id: myAssignment.project_id,
          p_geography: targetGeo,
          p_project_type: project?.project_type || myAssignment.project_type,
          p_cohort: (cohortOverride && cohortOverride.trim() !== "") ? cohortOverride : person.cohort,
          p_byu_id: String(person.byu_pathway_id || ""),
          p_report_to: leadId // This matches our new RPC param
        });

        if (rpcError) {
          console.error(`Error processing ${person.email}:`, rpcError.message);
        }
      }

      toast.success(`Success! ${preview.length} profiles fully synced.`);
      onSuccess?.();
      onClose();
    } catch (e) {
      console.error("Critical Upload Error:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleClearFile() {
    setFile(null);
    setPreview([]);
    setErrors([]);
    
    // Use the ref you already defined instead of getElementById
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  }


//   async function doUpload() {
//   if (!preview.length || !targetGeo) return;
//   setLoading(true);

//   try {
//     for (const person of preview) {
//       // 1. ADD THE USER & INITIAL TEAM ASSIGNMENT
//       // We await this fully before moving to metadata
//       await supabase.rpc('admin_add_user_to_team', {
//         p_email: person.email,
//         p_full_name: person.full_name,
//         p_role: person.system_role,
//         p_project_id: myAssignment.project_id,
//         p_project_type: project?.project_type || myAssignment.project_type,
//         p_geography: targetGeo
//       });

//       // 2. METADATA UPSERT (Cohort & BYU ID)
//       // We use .upsert() instead of .update() because it's more reliable 
//       // for rows that were JUST created.
//       const finalCohort = cohortOverride.trim() !== "" ? cohortOverride : person.csvCohort;
      
//       const { error: profileError } = await supabase.from('profiles')
//         .upsert({ 
//           email: person.email, // Required for upsert to find the conflict
//           full_name: person.full_name,
//           cohort: finalCohort, 
//           byu_pathway_id: person.byu_id,
//           updated_date: new Date().toISOString()
//         }, { onConflict: 'email' }); // Matches your unique email constraint

//       if (profileError) console.error("❌ Profile Sync Error:", profileError.message);

//       // 3. TEAM LEAD MAPPING
//       if (person.team_lead_email && person.system_role !== 'team_lead') {
//         // Find Lead ID
//         const { data: lead } = await supabase
//           .from('profiles')
//           .select('id')
//           .eq('email', person.team_lead_email)
//           .maybeSingle();

//         if (lead) {
//           // This uses your CONSTRAINT unique_user_project (user_email, project_id)
//           const { error: teamError } = await supabase.from('team_assignments')
//             .upsert({ 
//               user_email: person.email,
//               project_id: myAssignment.project_id,
//               reports_to: lead.id,
//               // Add any other required fields for team_assignments here
//             }, { onConflict: 'user_email,project_id' });

//           if (teamError) console.error("❌ Team Lead Error:", teamError.message);
//         }
//       }
//     }

//     toast.success(`Processed ${preview.length} users successfully.`);
//     onSuccess?.();
//     onClose();
//   } catch (e) {
//     console.error("Bulk Upload Crash:", e);
//     toast.error("Process interrupted. Check console for details.");
//   } finally {
//     setLoading(false);
//   }
// }



  // async function doUpload() {
  //   if (!preview.length || !targetGeo) return;
  //   setLoading(true);

  //   try {
  //     for (const person of preview) {
  //       // 1. Core Profile & Assignment
  //       await supabase.rpc('admin_add_user_to_team', {
  //         p_email: person.email,
  //         p_full_name: person.full_name,
  //         p_role: person.system_role,
  //         p_project_id: myAssignment.project_id,
  //         p_project_type: project?.project_type || myAssignment.project_type,
  //         p_geography: targetGeo
  //       });

  //       // 2. Metadata Update
  //       const finalCohort = cohortOverride.trim() !== "" ? cohortOverride : person.csvCohort;
  //       await supabase.from('profiles')
  //         .update({ cohort: finalCohort, byu_pathway_id: person.byu_id })
  //         .eq('email', person.email);

  //       // 3. Team Lead Mapping
  //       if (person.team_lead_email && person.system_role !== 'team_lead') {
  //         const { data: lead } = await supabase
  //           .from('profiles').select('id').eq('email', person.team_lead_email).single();
  //         if (lead) {
  //           await supabase.from('team_assignments')
  //             .update({ reports_to: lead.id })
  //             .eq('user_email', person.email)
  //             .eq('project_id', myAssignment.project_id);
  //         }
  //       }
  //     }

  //     toast.success(`Successfully processed ${preview.length} users.`);
  //     onSuccess?.();
  //     onClose();
  //   } catch (e) {
  //     toast.error("Upload failed.");
  //   } finally {
  //     setLoading(false);
  //   }
  // }

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
            {/* Column Guide */}
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

            <input ref={fileRef} type="file" id="csv-upload-input" accept=".csv" onChange={handleFile} className="hidden" />

            {/* DYNAMIC UPLOAD/CLEAR SECTION */}
            {!file ? (
              <button 
                onClick={() => fileRef.current.click()} 
                className="w-full border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center gap-2 hover:border-indigo-400 hover:bg-slate-50 transition-all"
              >
                <Upload className="w-6 h-6 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">Select CSV File</span>
              </button>
            ) : (
              <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-md">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-indigo-900 truncate max-w-[250px]">
                      {file.name}
                    </p>
                    <p className="text-xs text-indigo-600">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFile}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                </Button>
              </div>
            )}

            {errors.length > 0 && (
              <div className="p-3 text-red-700 bg-red-50 rounded-md border border-red-200">
                <p className="font-bold text-sm flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Please fix {errors.length} errors:
                </p>
                <ul className="text-xs list-disc ml-5 mt-1 max-h-24 overflow-y-auto">
                  {errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}

            {/* Data Preview Table */}
            {preview.length > 0 && (
              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase">Data Preview</h3>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-medium">
                    {preview.length} rows detected
                  </span>
                </div>
                
                <div className="overflow-hidden border border-slate-200 rounded-lg shadow-sm bg-white">
                  <div className="max-h-64 overflow-y-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Profile</th>
                          <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Cohort</th>
                          <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">BYU ID</th>
                          <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Lead</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {preview.map((person, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="text-sm font-semibold text-slate-800">{person.full_name}</div>
                              <div className="text-[11px] text-slate-500">{person.email}</div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-indigo-600 font-medium">
                              {cohortOverride?.trim() ? cohortOverride : (person.cohort || "—")}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-600">
                              {person.byu_pathway_id || "—"}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-[11px] text-slate-500">
                              {person.team_lead_email || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-slate-400 italic flex items-center gap-1">
                  <Info className="w-3 h-3" /> Double-check the values above before confirming upload.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button 
              disabled={loading || !preview.length || !targetGeo} 
              onClick={doUpload} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all px-6"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                </span>
              ) : `Confirm & Upload ${preview.length} Profiles`}
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