import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, FileText, AlertCircle, CheckCircle2, Download, FileX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/api/supabaseClient";

/**
 * Standard CSV parser handling quotes and comma delimiters.
 */
function parseCsv(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
  
  return lines.slice(1).map(line => {
    const vals = [];
    let inQuote = false, cur = "";
    for (const ch of line) {
      if (ch === '"') inQuote = !inQuote;
      else if (ch === "," && !inQuote) { vals.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    vals.push(cur.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ""; });
    return row;
  }).filter(r => Object.values(r).some(v => v));
}

function downloadTemplate(isHints) {
  const headers = isHints
    ? ["Geography", "URL", "Collection Name", "New Person available to be added", "Member Connected"]
    : ["Geography/Project Name", "URL", "Member Connected"];
  const csvContent = headers.join(",");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${isHints ? "hints" : "duplicates"}_template.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const HINTS_FIELD_MAP = {
  "geography": "geography",
  "url": "url",
  "collection_name": "collection_name",
  "new_person_available": "new_person_available",
  "member_connected": "member_connected",
};

const DUPS_FIELD_MAP = {
  "geography": "geography",
  "project_name": "geography",
  "url": "url",
  "member_connected": "member_connected",
};

export default function BulkTaskUpload({ open, onClose, projectId, projectType, cohort, onSuccess }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // Track row progress
  const [cohortVal, setCohortVal] = useState(cohort || "");
  const [validGeos, setValidGeos] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    if (open && projectId) {
      const fetchGeos = async () => {
        const { data } = await supabase.from('project_geography_states').select('geography').eq('project_id', projectId);
        if (data) setValidGeos(new Set(data.map(s => s.geography)));
      };
      fetchGeos();
    }
  }, [open, projectId]);

  const isHints = projectType === "hints";
  const fieldMap = isHints ? HINTS_FIELD_MAP : DUPS_FIELD_MAP;

  const downloadErrorLog = () => {
    const header = `UPLOAD ERROR LOG - ${new Date().toLocaleString()}\nPROJECT: ${projectId}\n` + "=".repeat(50) + "\n\n";
    const blob = new Blob([header + errors.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `upload_errors_${projectId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  function handleFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  setFile(f);
  const reader = new FileReader();
  reader.onload = (ev) => {
    const rows = parseCsv(ev.target.result);
    const errs = [];
    const urlSeenInCsv = new Set();
    
    const mapped = rows.map((row, i) => {
      const task = { status: "available", project_id: projectId, project_type: projectType, cohort: cohortVal };
      
      Object.entries(row).forEach(([k, v]) => {
        const mapped_key = fieldMap[k];
        if (mapped_key) {
          if (["member_connected", "new_person_available"].includes(mapped_key)) {
            task[mapped_key] = ["yes", "true", "1"].includes(v.toLowerCase().trim()); // Clean boolean strings
          } else {
            // APPLY TRIM HERE for geography, url, etc.
            task[mapped_key] = v ? v.trim() : ""; 
          }
        }
      });

      // Validation logic remains the same
      if (!task.url) errs.push(`Row ${i + 2}: missing URL`);
      else if (urlSeenInCsv.has(task.url)) errs.push(`Row ${i + 2}: Duplicate URL in CSV: ${task.url}`);
      else urlSeenInCsv.add(task.url);
      
      if (!task.geography) errs.push(`Row ${i + 2}: missing Geography`);
      
      return task;
    });

    setPreview(mapped);
    setErrors(errs);
  };
  reader.readAsText(f);
}

  // function handleFile(e) {
  //   const f = e.target.files[0];
  //   if (!f) return;
  //   setFile(f);
  //   const reader = new FileReader();
  //   reader.onload = (ev) => {
  //     const rows = parseCsv(ev.target.result);
  //     const errs = [];
  //     const urlSeenInCsv = new Set();
  //     const mapped = rows.map((row, i) => {
  //       const task = { status: "available", project_id: projectId, project_type: projectType, cohort: cohortVal };
  //       Object.entries(row).forEach(([k, v]) => {
  //         const mapped_key = fieldMap[k];
  //         if (mapped_key) {
  //           if (["member_connected", "new_person_available"].includes(mapped_key)) {
  //             task[mapped_key] = ["yes", "true", "1"].includes(v.toLowerCase());
  //           } else task[mapped_key] = v;
  //         }
  //       });
  //       if (!task.url) errs.push(`Row ${i + 2}: missing URL`);
  //       else if (urlSeenInCsv.has(task.url)) errs.push(`Row ${i + 2}: Duplicate URL in CSV: ${task.url}`);
  //       else urlSeenInCsv.add(task.url);
  //       if (!task.geography) errs.push(`Row ${i + 2}: missing Geography`);
  //       return task;
  //     });
  //     setPreview(mapped);
  //     setErrors(errs);
  //   };
  //   reader.readAsText(f);
  // }

  async function doUpload() {
    const validRows = preview.filter(r => r.url && r.geography);
    if (!validRows.length) return;
    setLoading(true);
    setUploadProgress(0);

    try {
      const urlsToUpload = validRows.map(r => r.url);
      const existingUrls = new Set();
      const CHECK_BATCH = 10000;
      
      for (let i = 0; i < urlsToUpload.length; i += CHECK_BATCH) {
        const chunk = urlsToUpload.slice(i, i + CHECK_BATCH);
        const { data } = await supabase.from('tasks').select('url').in('url', chunk);
        if (data) data.forEach(row => existingUrls.add(row.url));
      }

      if (existingUrls.size > 0) {
        const dbErrs = Array.from(existingUrls).map(url => `Database Error: URL already exists [${url}]`);
        setErrors(prev => [...dbErrs, ...prev]);
        toast.error(`${existingUrls.size} URLs already exist in the system.`);
        setLoading(false);
        return; 
      }

      const uniqueGeos = [...new Set(validRows.map(r => r.geography))];
      const geoInserts = uniqueGeos.map(geo => ({ project_id: projectId, geography: geo, status: "locked" }));
      await supabase.from('project_geography_states').upsert(geoInserts, { onConflict: 'project_id, geography' });

      const INSERT_BATCH = 5000;
      for (let i = 0; i < validRows.length; i += INSERT_BATCH) {
        const chunk = validRows.slice(i, i + INSERT_BATCH).map(r => ({ ...r, cohort: cohortVal }));
        const { error } = await supabase.from('tasks').insert(chunk);
        if (error) throw error;
        setUploadProgress(i + chunk.length);
      }

      toast.success(`${validRows.length} tasks uploaded!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      toast.error("Upload failed: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Tasks — {isHints ? "Hints" : "Duplicates"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs">
            <div className="flex justify-between items-center mb-1">
              <p className="font-semibold text-indigo-800">Expected CSV columns:</p>
              <button type="button" onClick={() => downloadTemplate(isHints)} className="text-indigo-600 font-bold flex items-center gap-1 hover:underline">
                <Download className="w-3 h-3" /> Download Template
              </button>
            </div>
            <code className="text-indigo-700 font-mono block mt-1 bg-white/50 p-2 rounded border border-indigo-100 italic">
              {isHints ? "Geography, URL, Collection Name, New Person Available, Member Connected" : "Geography, URL, Member Connected"}
            </code>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Cohort Override</Label>
            <Input value={cohortVal} onChange={e => setCohortVal(e.target.value)} placeholder="e.g. Spring 2026" className="h-9" disabled={loading} />
          </div>

          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          <button 
            type="button" 
            onClick={() => fileRef.current.click()} 
            disabled={loading}
            className="w-full border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center gap-3 text-slate-500 hover:border-indigo-400 hover:bg-slate-50 transition-all cursor-pointer"
          >
            {file ? <CheckCircle2 className="w-8 h-8 text-green-500" /> : <Upload className="w-8 h-8" />}
            <span className="text-sm font-medium">{file ? file.name : "Select CSV file"}</span>
          </button>

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center justify-between text-red-700 text-sm font-bold">
                <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {errors.length} issue(s)</div>
                <button onClick={downloadErrorLog} className="flex items-center gap-1 text-[10px] bg-red-100 hover:bg-red-200 px-2 py-1 rounded border border-red-300">
                  <FileX className="w-3 h-3" /> Download Full Error Log
                </button>
              </div>
              <div className="max-h-24 overflow-y-auto mt-2 font-mono text-[10px] text-red-600">
                {errors.slice(0, 10).map((e, i) => <p key={i} className="py-0.5 border-b border-red-100">{e}</p>)}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button disabled={loading || !file || errors.length > 0} onClick={doUpload} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px]">
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{uploadProgress > 0 ? `${uploadProgress} / ${preview.length}` : "Checking DB..."}</span>
              </div>
            ) : "Upload Tasks"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}






















// import { useState, useRef, useEffect } from "react";
// import { Button } from "@/components/ui/button";
// import { Label } from "@/components/ui/label";
// import { Input } from "@/components/ui/input";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
// // Added 'Download' icon to imports to prevent the ReferenceError
// import { Upload, FileText, AlertCircle, CheckCircle2, Download } from "lucide-react";
// import { toast } from "sonner";
// import { supabase } from "@/api/supabaseClient";

// /**
//  * Standard CSV parser handling quotes and comma delimiters.
//  */
// function parseCsv(text) {
//   const lines = text.trim().split("\n");
//   if (lines.length < 2) return [];
//   const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
  
//   return lines.slice(1).map(line => {
//     const vals = [];
//     let cur = "", inQuote = false;
//     for (const ch of line) {
//       if (ch === '"') { inQuote = !inQuote; }
//       else if (ch === "," && !inQuote) { vals.push(cur.trim()); cur = ""; }
//       else { cur += ch; }
//     }
//     vals.push(cur.trim());
//     const row = {};
//     headers.forEach((h, i) => { row[h] = vals[i] || ""; });
//     return row;
//   }).filter(r => Object.values(r).some(v => v));
// }

// function downloadTemplate(isHints) {
//   const headers = isHints
//     ? ["Geography", "URL", "Collection Name", "New Person available to be added", "Member Connected"]
//     : ["Geography/Project Name", "URL", "Member Connected"];
  
//   const csvContent = headers.join(",");
//   const blob = new Blob([csvContent], { type: "text/csv" });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement("a");
//   a.href = url;
//   a.download = `${isHints ? "hints" : "duplicates"}_template.csv`;
//   document.body.appendChild(a); // Better practice to append to body briefly
//   a.click();
//   document.body.removeChild(a);
//   URL.revokeObjectURL(url);
// }

// const HINTS_FIELD_MAP = {
//   "geography": "geography",
//   "url": "url",
//   "collection_name": "collection_name",
//   "new_person_available": "new_person_available",
//   "member_connected": "member_connected",
// };

// const DUPS_FIELD_MAP = {
//   "geography": "geography",
//   "project_name": "geography",
//   "url": "url",
//   "member_connected": "member_connected",
// };

// export default function BulkTaskUpload({ open, onClose, projectId, projectType, cohort, onSuccess }) {
//   const [file, setFile] = useState(null);
//   const [preview, setPreview] = useState([]);
//   const [errors, setErrors] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [cohortVal, setCohortVal] = useState(cohort || "");
//   const [validGeos, setValidGeos] = useState(null);
//   const fileRef = useRef();

//   useEffect(() => {
//     if (open && projectId) {
//       const fetchGeos = async () => {
//         const { data } = await supabase
//           .from('project_geography_states')
//           .select('geography')
//           .eq('project_id', projectId);
//         if (data) setValidGeos(new Set(data.map(s => s.geography)));
//       };
//       fetchGeos();
//     }
//   }, [open, projectId]);

//   const isHints = projectType === "hints";
//   const fieldMap = isHints ? HINTS_FIELD_MAP : DUPS_FIELD_MAP;

//   function handleFile(e) {
//     const f = e.target.files[0];
//     if (!f) return;
//     setFile(f);

//     const reader = new FileReader();
//     reader.onload = (ev) => {
//       const rows = parseCsv(ev.target.result);
//       const errs = [];
//       const urlSeenInCsv = new Set();
      
//       const mapped = rows.map((row, i) => {
//         const task = { status: "available", project_id: projectId, project_type: projectType, cohort: cohortVal };
        
//         Object.entries(row).forEach(([k, v]) => {
//           const mapped_key = fieldMap[k];
//           if (mapped_key) {
//             if (["member_connected", "new_person_available"].includes(mapped_key)) {
//               task[mapped_key] = ["yes", "true", "1"].includes(v.toLowerCase());
//             } else {
//               task[mapped_key] = v;
//             }
//           }
//         });

//         // --- DUPLICATE CHECK (Internal) ---
//         if (!task.url) {
//           errs.push(`Row ${i + 2}: missing URL`);
//         } else if (urlSeenInCsv.has(task.url)) {
//           errs.push(`Row ${i + 2}: Duplicate URL in CSV: ${task.url}`);
//         } else {
//           urlSeenInCsv.add(task.url);
//         }

//         if (!task.geography) errs.push(`Row ${i + 2}: missing Geography`);
        
//         return task;
//       });

//       setPreview(mapped);
//       setErrors(errs);
//     };
//     reader.readAsText(f);
//   }

//   // function handleFile(e) {
//   //   const f = e.target.files[0];
//   //   if (!f) return;
//   //   setFile(f);
//   //   const reader = new FileReader();
//   //   reader.onload = (ev) => {
//   //     const rows = parseCsv(ev.target.result);
//   //     const errs = [];
//   //     const mapped = rows.map((row, i) => {
//   //       const task = { status: "available", project_id: projectId, project_type: projectType, cohort: cohortVal };
//   //       Object.entries(row).forEach(([k, v]) => {
//   //         const mapped_key = fieldMap[k];
//   //         if (mapped_key) {
//   //           if (["member_connected", "new_person_available"].includes(mapped_key)) {
//   //             task[mapped_key] = ["yes", "true", "1"].includes(v.toLowerCase());
//   //           } else {
//   //             task[mapped_key] = v;
//   //           }
//   //         }
//   //       });
//   //       if (!task.url) errs.push(`Row ${i + 2}: missing URL`);
//   //       if (!task.geography) errs.push(`Row ${i + 2}: missing Geography`);
//   //       else if (validGeos && !validGeos.has(task.geography)) {
//   //         errs.push(`Row ${i + 2}: geography "${task.geography}" is not registered for this project`);
//   //       }
//   //       return task;
//   //     });
//   //     setPreview(mapped);
//   //     setErrors(errs);
//   //   };
//   //   reader.readAsText(f);
//   // }

//   async function doUpload() {
//     const validRows = preview.filter(r => r.url && r.geography);
//     if (!validRows.length) return;
//     setLoading(true);

//     try {
//       const urlsToUpload = validRows.map(r => r.url);
      
//       // 1. Check Database for Existing URLs (in batches of 10k)
//       const existingUrls = new Set();
//       const CHECK_BATCH = 10000;
      
//       for (let i = 0; i < urlsToUpload.length; i += CHECK_BATCH) {
//         const chunk = urlsToUpload.slice(i, i + CHECK_BATCH);
//         const { data } = await supabase
//           .from('tasks')
//           .select('url')
//           .in('url', chunk);
        
//         if (data) data.forEach(row => existingUrls.add(row.url));
//       }

//       // 2. If duplicates found in DB, stop and show them
//       if (existingUrls.size > 0) {
//         const duplicateList = Array.from(existingUrls).slice(0, 5).join(", ");
//         const errorMsg = `Upload blocked: ${existingUrls.size} URLs already exist in the system. (e.g., ${duplicateList})`;
//         setErrors([errorMsg]);
//         toast.error("Duplicate URLs detected in database");
//         setLoading(false);
//         return; 
//       }

//       // 3. Handle Geographies (Auto-registration)
//       const uniqueGeos = [...new Set(validRows.map(r => r.geography))];
//       const geoInserts = uniqueGeos.map(geo => ({
//         project_id: projectId,
//         geography: geo,
//         status: "locked"
//       }));

//       await supabase.from('project_geography_states').upsert(geoInserts, { onConflict: 'project_id, geography' });

//       // 4. Chunked Task Insert (5000 at a time)
//       const INSERT_BATCH = 5000;
//       for (let i = 0; i < validRows.length; i += INSERT_BATCH) {
//         const chunk = validRows.slice(i, i + INSERT_BATCH).map(r => ({ ...r, cohort: cohortVal }));
//         const { error } = await supabase.from('tasks').insert(chunk);
//         if (error) throw error;
//       }

//       toast.success(`${validRows.length} tasks uploaded!`);
//       if (onSuccess) onSuccess();
//       onClose();
//     } catch (e) {
//       console.error(e);
//       toast.error("Upload failed: " + e.message);
//     } finally {
//       setLoading(false);
//     }
//   }

//   // async function doUpload() {
//   //   const validRows = preview.filter(r => r.url && r.geography).map(r => ({ ...r, cohort: cohortVal }));
//   //   if (!validRows.length) return;
//   //   setLoading(true);
    
//   //   try {
//   //     const { error } = await supabase
//   //       .from('tasks')
//   //       .insert(validRows);

//   //     if (error) throw error;
      
//   //     toast.success(`${validRows.length} tasks uploaded!`);
//   //     if (onSuccess) onSuccess();
//   //     onClose();
//   //   } catch (e) {
//   //     console.error(e);
//   //     toast.error("Upload failed: " + e.message);
//   //   } finally {
//   //     setLoading(false);
//   //   }
//   // }

//   const expectedHeaders = isHints
//     ? "Geography, URL, Collection Name, New Person Available, Member Connected"
//     : "Geography, URL, Member Connected";

//   return (
//     <Dialog open={open} onOpenChange={onClose}>
//       <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle>Bulk Upload Tasks — {isHints ? "Hints" : "Duplicates"}</DialogTitle>
//         </DialogHeader>
//         <div className="space-y-4">
//           <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-800">
//             <div className="flex justify-between items-center mb-1">
//               <p className="font-semibold">
//                 Expected CSV columns:
//               </p>
              
//               <button 
//                 type="button"
//                 onClick={() => downloadTemplate(isHints)}
//                 className="text-indigo-600 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-xs font-bold h-8 px-3 rounded-lg flex items-center shadow-sm transition-all"
//               >
//                 <Download className="w-3 h-3" />
//                 Download Template
//               </button>
//             </div>
//             <code className="text-indigo-700 font-mono block mt-2 bg-white/50 p-2 rounded border border-indigo-100 italic">
//               {expectedHeaders}
//             </code>
//           </div>
          
//           <div className="space-y-1">
//             <Label className="text-xs font-semibold text-slate-700">Cohort Override</Label>
//             <Input 
//               value={cohortVal} 
//               onChange={e => setCohortVal(e.target.value)} 
//               placeholder="e.g. Spring 2026" 
//               className="h-9"
//             />
//           </div>

//           <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
//           <button 
//             type="button"
//             onClick={() => fileRef.current.click()}
//             className="w-full border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center gap-3 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-slate-50 transition-all cursor-pointer"
//           >
//             <Upload className="w-8 h-8" />
//             <span className="text-sm font-medium">{file ? file.name : "Click to select CSV file"}</span>
//           </button>

//           {/* Error and Preview logic continues below... */}
//           {errors.length > 0 && (
//             <div className="bg-red-50 border border-red-200 rounded-lg p-3">
//               <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
//                 <AlertCircle className="w-4 h-4" /> {errors.length} validation issue(s)
//               </div>
//               <div className="max-h-24 overflow-y-auto mt-2">
//                 {errors.slice(0, 10).map((e, i) => <p key={i} className="text-[10px] text-red-600 font-mono">{e}</p>)}
//               </div>
//             </div>
//           )}
//         </div>
//         <DialogFooter>
//           <Button variant="outline" onClick={onClose}>Cancel</Button>
//           <Button
//             disabled={loading || !preview.filter(r => r.url && r.geography).length || errors.length > 0}
//             onClick={doUpload}
//             className="bg-indigo-600 hover:bg-indigo-700 text-white"
//           >
//             {loading ? "Uploading..." : "Upload Tasks"}
//           </Button>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   );
// }





























// import { useState, useRef, useEffect } from "react";
// import { Button } from "@/components/ui/button";
// import { Label } from "@/components/ui/label";
// import { Input } from "@/components/ui/input";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
// import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
// import { toast } from "sonner";
// import { supabase } from "@/api/supabaseClient";


// /**
//  * Standard CSV parser handling quotes and comma delimiters.
//  */
// function parseCsv(text) {
//   const lines = text.trim().split("\n");
//   if (lines.length < 2) return [];
//   const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
  
//   return lines.slice(1).map(line => {
//     const vals = [];
//     let cur = "", inQuote = false;
//     for (const ch of line) {
//       if (ch === '"') { inQuote = !inQuote; }
//       else if (ch === "," && !inQuote) { vals.push(cur.trim()); cur = ""; }
//       else { cur += ch; }
//     }
//     vals.push(cur.trim());
//     const row = {};
//     headers.forEach((h, i) => { row[h] = vals[i] || ""; });
//     return row;
//   }).filter(r => Object.values(r).some(v => v));
// }

// function downloadTemplate(isHints) {
//   const headers = isHints
//     ? ["Geography", "URL", "Collection Name", "New Person available to be added", "Member Connected"]
//     : ["Geography/Project Name", "URL", "Member Connected"];
  
//   const csvContent = headers.join(",");
//   const blob = new Blob([csvContent], { type: "text/csv" });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement("a");
//   a.href = url;
//   a.download = `${isHints ? "hints" : "duplicates"}_template.csv`;
//   a.click();
//   URL.revokeObjectURL(url);
// }

// const HINTS_FIELD_MAP = {
//   "geography": "geography",
//   "url": "url",
//   "collection_name": "collection_name",
//   "new_person_available": "new_person_available",
//   "member_connected": "member_connected",
// };

// const DUPS_FIELD_MAP = {
//   "geography": "geography",
//   "project_name": "geography",
//   "url": "url",
//   "member_connected": "member_connected",
// };

// export default function BulkTaskUpload({ open, onClose, projectId, projectType, cohort, onSuccess }) {
//   const [file, setFile] = useState(null);
//   const [preview, setPreview] = useState([]);
//   const [errors, setErrors] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [cohortVal, setCohortVal] = useState(cohort || "");
//   const [validGeos, setValidGeos] = useState(null);
//   const fileRef = useRef();

//   // Load registered geographies from Supabase to validate the CSV rows
//   useEffect(() => {
//     if (open && projectId) {
//       const fetchGeos = async () => {
//         const { data } = await supabase
//           .from('project_geography_states')
//           .select('geography')
//           .eq('project_id', projectId);
//         if (data) setValidGeos(new Set(data.map(s => s.geography)));
//       };
//       fetchGeos();
//     }
//   }, [open, projectId]);

//   const isHints = projectType === "hints";
//   const fieldMap = isHints ? HINTS_FIELD_MAP : DUPS_FIELD_MAP;

//   function handleFile(e) {
//     const f = e.target.files[0];
//     if (!f) return;
//     setFile(f);
//     const reader = new FileReader();
//     reader.onload = (ev) => {
//       const rows = parseCsv(ev.target.result);
//       const errs = [];
//       const mapped = rows.map((row, i) => {
//         const task = { status: "available", project_id: projectId, project_type: projectType, cohort: cohortVal };
//         Object.entries(row).forEach(([k, v]) => {
//           const mapped_key = fieldMap[k];
//           if (mapped_key) {
//             if (["member_connected", "new_person_available"].includes(mapped_key)) {
//               task[mapped_key] = ["yes", "true", "1"].includes(v.toLowerCase());
//             } else {
//               task[mapped_key] = v;
//             }
//           }
//         });
//         if (!task.url) errs.push(`Row ${i + 2}: missing URL`);
//         if (!task.geography) errs.push(`Row ${i + 2}: missing Geography`);
//         else if (validGeos && !validGeos.has(task.geography)) {
//           errs.push(`Row ${i + 2}: geography "${task.geography}" is not registered for this project`);
//         }
//         return task;
//       });
//       setPreview(mapped);
//       setErrors(errs);
//     };
//     reader.readAsText(f);
//   }

//   async function doUpload() {
//     const validRows = preview.filter(r => r.url && r.geography).map(r => ({ ...r, cohort: cohortVal }));
//     if (!validRows.length) return;
//     setLoading(true);
    
//     try {
//       const { error } = await supabase
//         .from('tasks')
//         .insert(validRows);

//       if (error) throw error;
      
//       toast.success(`${validRows.length} tasks uploaded!`);
//       if (onSuccess) onSuccess();
//       onClose();
//     } catch (e) {
//       console.error(e);
//       toast.error("Upload failed: " + e.message);
//     } finally {
//       setLoading(false);
//     }
//   }

//   const expectedHeaders = isHints
//     ? "Geography/Project Name, URL, Collection Name, New Person Available, Member Connected"
//     : "Geography/Project Name, URL, Member Connected";

//   return (
//     <Dialog open={open} onOpenChange={onClose}>
//       <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle>Bulk Upload Tasks — {isHints ? "Hints" : "Duplicates"}</DialogTitle>
//         </DialogHeader>
//         <div className="space-y-4">
//           <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-800">
//             <div className="flex justify-between items-center mb-1">
//             {/* Kept your original dynamic label here */}
//             <p className="font-semibold">
//               Expected CSV columns ({isHints ? "Hints" : "Duplicates"}):
//             </p>
            
//             <button 
//               onClick={() => downloadTemplate(isHints)}
//               className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition-colors"
//             >
//               <FileText className="w-3 h-3" />
//               Download Template
//             </button>
//           </div>
//             <code className="text-indigo-700 font-mono block mt-2 bg-white/50 p-2 rounded border border-indigo-100">{expectedHeaders}</code>
//           </div>
          
//           <div className="space-y-1">
//             <Label className="text-xs font-semibold text-slate-700">Cohort</Label>
//             <Input 
//               value={cohortVal} 
//               onChange={e => setCohortVal(e.target.value)} 
//               placeholder="e.g. Spring 2026" 
//               className="h-9"
//             />
//           </div>

//           <div>
//             <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
//             <button 
//               onClick={() => fileRef.current.click()}
//               className="w-full border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center gap-3 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-slate-50 transition-all cursor-pointer"
//             >
//               <Upload className="w-8 h-8" />
//               <span className="text-sm font-medium">{file ? file.name : "Click to select CSV file"}</span>
//               <span className="text-xs">CSV files only</span>
//             </button>
//           </div>

//           {errors.length > 0 && (
//             <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1 animate-in fade-in">
//               <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
//                 <AlertCircle className="w-4 h-4" /> {errors.length} validation issue(s)
//               </div>
//               <div className="max-h-24 overflow-y-auto">
//                 {errors.slice(0, 10).map((e, i) => <p key={i} className="text-[10px] text-red-600 font-mono leading-tight">{e}</p>)}
//                 {errors.length > 10 && <p className="text-[10px] text-red-500 italic mt-1">...and {errors.length - 10} more errors</p>}
//               </div>
//             </div>
//           )}

//           {preview.length > 0 && (
//             <div className="bg-green-50 border border-green-200 rounded-lg p-3 animate-in fade-in">
//               <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-2">
//                 <CheckCircle2 className="w-4 h-4" /> {preview.filter(r => r.url && r.geography).length} tasks ready to upload
//               </div>
//               <div className="overflow-x-auto max-h-40 rounded border border-green-200 bg-white">
//                 <table className="w-full text-[10px] tabular-nums">
//                   <thead className="bg-green-100 text-green-800">
//                     <tr>
//                       <th className="text-left p-2">Geography</th>
//                       <th className="text-left p-2">URL</th>
//                       {isHints && (
//                         <>
//                           <th className="text-left p-2">Collection</th>
//                           <th className="text-left p-2">New Person</th>
//                           <th className="text-left p-2">Connected</th>
//                         </>
//                       )}
//                     </tr>
//                   </thead>
//                   <tbody className="divide-y divide-green-100">
//                     {preview.slice(0, 5).map((r, i) => (
//                       <tr key={i}>
//                         <td className="p-2">{r.geography}</td>
//                         <td className="p-2 truncate max-w-[180px]">{r.url}</td>
//                         {isHints && (
//                           <>
//                             <td className="p-2">{r.collection_name}</td>
//                             <td className="p-2">{r.new_person_available ? "Yes" : "No"}</td>
//                             <td className="p-2">{r.member_connected ? "Yes" : "No"}</td>
//                           </>
//                         )}
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
//             disabled={loading || !preview.filter(r => r.url && r.geography).length || errors.length > 0}
//             onClick={doUpload}
//             className="bg-indigo-600 hover:bg-indigo-700 text-white"
//           >
//             {loading ? "Uploading..." : `Upload ${preview.filter(r => r.url && r.geography).length} Tasks`}
//           </Button>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   );
// }