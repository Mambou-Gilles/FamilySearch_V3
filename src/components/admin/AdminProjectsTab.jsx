import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Edit, 
  Trash2, 
  MapPin, 
  Lock, 
  Unlock, 
  Upload 
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AdminProjectsTab({ 
  projects, 
  tasks, 
  geoStates = [], 
  projTypeFilter, 
  setProjTypeFilter, 
  onNew, 
  onEdit, 
  onDelete,
  onUpload 
}) {
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedGeo, setSelectedGeo] = useState("all");

  // --- Shadcn Alert State ---
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ title: "", desc: "", action: null });

  function getProjectStats(pid, geo) {
    const pt = tasks.filter(t => t.project_id === pid && (geo === "all" || t.geography === geo));
    const completed = pt.filter(t => ["completed","in_review","needs_correction","reviewed"].includes(t.status)).length;
    const reviewed = pt.filter(t => t.status === "reviewed").length;
    const available = pt.filter(t => t.status === "available").length;
    return { total: pt.length, completed, reviewed, available };
  }

  const typeFiltered = projects.filter(p => projTypeFilter === "all" || p.project_type === projTypeFilter);
  const filtered = typeFiltered.filter(p => selectedProject === "all" || p.id === selectedProject);

  const geoOptions = selectedProject === "all"
    ? [...new Set(geoStates.filter(s => typeFiltered.some(p => p.id === s.project_id)).map(s => s.geography).filter(Boolean))]
    : [...new Set(geoStates.filter(s => s.project_id === selectedProject).map(s => s.geography).filter(Boolean))];

  const activeGeos = geoStates.filter(s => s.status === "open");

  // --- Delete Trigger ---
  const triggerDelete = (project) => {
    setConfirmConfig({
      title: `Delete Project: ${project.name}?`,
      desc: "This action is irreversible. All associated tasks, team assignments, and geography states for this project will be permanently deleted from the database.",
      action: () => onDelete(project.id)
    });
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Tab Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Project Oversight</h2>
          <p className="text-xs text-slate-500">Manage FamilySearch projects and geography access states</p>
        </div>
        <Button size="sm" onClick={onNew} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
          <Plus className="w-4 h-4 mr-1" /> New Project
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-3 flex-wrap items-center bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
        <select 
          value={projTypeFilter} 
          onChange={e => { setProjTypeFilter(e.target.value); setSelectedProject("all"); setSelectedGeo("all"); }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="all">All Types</option>
          <option value="hints">Hints</option>
          <option value="duplicates">Duplicates</option>
        </select>
        
        <select 
          value={selectedProject} 
          onChange={e => { setSelectedProject(e.target.value); setSelectedGeo("all"); }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="all">All Projects</option>
          {typeFiltered.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <select 
          value={selectedGeo} 
          onChange={e => setSelectedGeo(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="all">All Geographies</option>
          {geoOptions.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-100">
          <Unlock className="w-3.5 h-3.5" />
          {activeGeos.length} Open Geographies
        </div>
      </div>

      {selectedGeo !== "all" && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 text-sm text-indigo-700 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Focusing on: <span className="font-bold underline">{selectedGeo}</span>
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(p => {
          const s = getProjectStats(p.id, selectedGeo);
          const pct = s.total ? Math.round(s.completed / s.total * 100) : 0;
          const projGeoRecords = geoStates.filter(state => state.project_id === p.id);

          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 hover:shadow-lg transition-all border-t-4 border-t-indigo-500 flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 leading-tight">{p.name}</h3>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-1">{p.client_name || 'Internal'}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => onEdit(p)} className="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-slate-50 rounded-md transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => triggerDelete(p)} className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-md transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                 <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${p.project_type === "hints" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"}`}>
                   {p.project_type}
                 </span>
                 <StatusBadge status={p.status} />
              </div>

              <div className="flex-1">
                <p className="text-[10px] text-slate-400 mb-2 font-bold uppercase tracking-tight">Geography Access Control</p>
                <div className="flex flex-wrap gap-1.5">
                  {projGeoRecords.length > 0 ? projGeoRecords.map(record => (
                    <div 
                      key={record.id} 
                      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors ${
                        record.status === 'open' 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : 'bg-slate-100 text-slate-400 border-slate-200 italic'
                      } ${selectedGeo === record.geography ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
                    >
                      {record.status === 'open' ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                      {record.geography}
                    </div>
                  )) : <span className="text-xs text-slate-400 italic">No geographies assigned</span>}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
                  <p className="text-lg font-black text-slate-700">{s.total}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Total</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center border border-green-100">
                  <p className="text-lg font-black text-green-600">{s.completed}</p>
                  <p className="text-[10px] text-green-600 font-bold uppercase">Done</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-2 text-center border border-amber-100">
                  <p className="text-lg font-black text-amber-600">{s.available}</p>
                  <p className="text-[10px] text-amber-600 font-bold uppercase">Open</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                  <span>COMPLETION</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} 
                    style={{ width: `${pct}%` }} 
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onUpload(p)}
                  className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-400 h-9 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Bulk Upload Tasks (CSV)
                </Button>
              </div>

              {p.description && (
                <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-dashed border-slate-200 italic">
                  {p.description}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* --- Shadcn AlertDialog --- */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmConfig.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmConfig.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                confirmConfig.action?.();
                setConfirmOpen(false);
              }}
            >
              Permanently Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}












// import { useState } from "react";
// import { Button } from "@/components/ui/button";
// import { 
//   Plus, 
//   Edit, 
//   Trash2, 
//   MapPin, 
//   Lock, 
//   Unlock, 
//   Upload 
// } from "lucide-react";
// import StatusBadge from "@/components/StatusBadge";

// export default function AdminProjectsTab({ 
//   projects, 
//   tasks, 
//   geoStates = [], 
//   projTypeFilter, 
//   setProjTypeFilter, 
//   onNew, 
//   onEdit, 
//   onDelete,
//   onUpload // Integrated for BulkTaskUpload
// }) {
//   const [selectedProject, setSelectedProject] = useState("all");
//   const [selectedGeo, setSelectedGeo] = useState("all");

//   function getProjectStats(pid, geo) {
//     const pt = tasks.filter(t => t.project_id === pid && (geo === "all" || t.geography === geo));
//     const completed = pt.filter(t => ["completed","in_review","needs_correction","reviewed"].includes(t.status)).length;
//     const reviewed = pt.filter(t => t.status === "reviewed").length;
//     const available = pt.filter(t => t.status === "available").length;
//     return { total: pt.length, completed, reviewed, available };
//   }

//   const typeFiltered = projects.filter(p => projTypeFilter === "all" || p.project_type === projTypeFilter);
//   const filtered = typeFiltered.filter(p => selectedProject === "all" || p.id === selectedProject);

//   // Geographies derived from project_geography_states registry
//   const geoOptions = selectedProject === "all"
//     ? [...new Set(geoStates.filter(s => typeFiltered.some(p => p.id === s.project_id)).map(s => s.geography).filter(Boolean))]
//     : [...new Set(geoStates.filter(s => s.project_id === selectedProject).map(s => s.geography).filter(Boolean))];

//   const activeGeos = geoStates.filter(s => s.status === "open");

//   return (
//     <div className="space-y-4">
//       {/* Tab Header */}
//       <div className="flex items-center justify-between flex-wrap gap-3">
//         <div>
//           <h2 className="text-base font-semibold text-slate-800">Project Oversight</h2>
//           <p className="text-xs text-slate-500">Manage FamilySearch projects and geography access states</p>
//         </div>
//         <Button size="sm" onClick={onNew} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
//           <Plus className="w-4 h-4 mr-1" /> New Project
//         </Button>
//       </div>

//       {/* Filter Bar */}
//       <div className="flex gap-3 flex-wrap items-center bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
//         <select 
//           value={projTypeFilter} 
//           onChange={e => { setProjTypeFilter(e.target.value); setSelectedProject("all"); setSelectedGeo("all"); }}
//           className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500"
//         >
//           <option value="all">All Types</option>
//           <option value="hints">Hints</option>
//           <option value="duplicates">Duplicates</option>
//         </select>
        
//         <select 
//           value={selectedProject} 
//           onChange={e => { setSelectedProject(e.target.value); setSelectedGeo("all"); }}
//           className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500"
//         >
//           <option value="all">All Projects</option>
//           {typeFiltered.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
//         </select>

//         <select 
//           value={selectedGeo} 
//           onChange={e => setSelectedGeo(e.target.value)}
//           className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500"
//         >
//           <option value="all">All Geographies</option>
//           {geoOptions.map(g => <option key={g} value={g}>{g}</option>)}
//         </select>

//         <div className="ml-auto flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-100">
//           <Unlock className="w-3.5 h-3.5" />
//           {activeGeos.length} Open Geographies
//         </div>
//       </div>

//       {selectedGeo !== "all" && (
//         <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 text-sm text-indigo-700 flex items-center gap-2">
//           <MapPin className="w-4 h-4" />
//           Focusing on: <span className="font-bold underline">{selectedGeo}</span>
//         </div>
//       )}

//       {/* Projects Grid */}
//       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
//         {filtered.map(p => {
//           const s = getProjectStats(p.id, selectedGeo);
//           const pct = s.total ? Math.round(s.completed / s.total * 100) : 0;
          
//           // Get statuses for this project's geographies from registry
//           const projGeoRecords = geoStates.filter(state => state.project_id === p.id);

//           return (
//             <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 hover:shadow-lg transition-all border-t-4 border-t-indigo-500 flex flex-col">
//               <div className="flex items-start justify-between">
//                 <div>
//                   <h3 className="font-bold text-slate-900 leading-tight">{p.name}</h3>
//                   <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-1">{p.client_name || 'Internal'}</p>
//                 </div>
//                 <div className="flex items-center gap-1">
//                   <button onClick={() => onEdit(p)} className="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-slate-50 rounded-md transition-colors">
//                     <Edit className="w-4 h-4" />
//                   </button>
//                   <button onClick={() => onDelete(p.id)} className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-md transition-colors">
//                     <Trash2 className="w-4 h-4" />
//                   </button>
//                 </div>
//               </div>

//               <div className="flex items-center justify-between">
//                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${p.project_type === "hints" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"}`}>
//                    {p.project_type}
//                  </span>
//                  <StatusBadge status={p.status} />
//               </div>

//               {/* Master Registry Geography Display */}
//               <div className="flex-1">
//                 <p className="text-[10px] text-slate-400 mb-2 font-bold uppercase tracking-tight">Geography Access Control</p>
//                 <div className="flex flex-wrap gap-1.5">
//                   {projGeoRecords.length > 0 ? projGeoRecords.map(record => (
//                     <div 
//                       key={record.id} 
//                       className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors ${
//                         record.status === 'open' 
//                         ? 'bg-green-50 text-green-700 border-green-200' 
//                         : 'bg-slate-100 text-slate-400 border-slate-200 italic'
//                       } ${selectedGeo === record.geography ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
//                     >
//                       {record.status === 'open' ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
//                       {record.geography}
//                     </div>
//                   )) : <span className="text-xs text-slate-400 italic">No geographies assigned</span>}
//                 </div>
//               </div>

//               {/* Stats Grid */}
//               <div className="grid grid-cols-3 gap-2">
//                 <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
//                   <p className="text-lg font-black text-slate-700">{s.total}</p>
//                   <p className="text-[10px] text-slate-400 font-bold uppercase">Total</p>
//                 </div>
//                 <div className="bg-green-50 rounded-lg p-2 text-center border border-green-100">
//                   <p className="text-lg font-black text-green-600">{s.completed}</p>
//                   <p className="text-[10px] text-green-600 font-bold uppercase">Done</p>
//                 </div>
//                 <div className="bg-amber-50 rounded-lg p-2 text-center border border-amber-100">
//                   <p className="text-lg font-black text-amber-600">{s.available}</p>
//                   <p className="text-[10px] text-amber-600 font-bold uppercase">Open</p>
//                 </div>
//               </div>

//               {/* Progress Bar */}
//               <div>
//                 <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
//                   <span>COMPLETION</span>
//                   <span>{pct}%</span>
//                 </div>
//                 <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
//                   <div 
//                     className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} 
//                     style={{ width: `${pct}%` }} 
//                   />
//                 </div>
//               </div>

//               {/* Bulk Upload Trigger */}
//               <div className="pt-2">
//                 <Button 
//                   variant="outline" 
//                   size="sm" 
//                   onClick={() => onUpload(p)}
//                   className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-400 h-9 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
//                 >
//                   <Upload className="w-3.5 h-3.5" />
//                   Bulk Upload Tasks (CSV)
//                 </Button>
//               </div>

//               {p.description && (
//                 <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-dashed border-slate-200 italic">
//                   {p.description}
//                 </p>
//               )}
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }
