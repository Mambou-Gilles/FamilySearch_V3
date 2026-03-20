import ClientStatsSection from "@/components/client/ClientStatsSection";
import ClientGeoTable from "@/components/client/ClientGeoTable";
import ClientChartsSection from "@/components/client/ClientChartsSection";
import { useState, useMemo } from "react";
import { BarChart3, Filter, MapPin } from "lucide-react";

export default function AdminChartsTab({ tasks = [], projects = [], geoStates = [] }) {
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [selectedProjectType, setSelectedProjectType] = useState("all");
  const [selectedGeo, setSelectedGeo] = useState("all");

  const filteredProjects = projects.filter(p =>
    selectedProjectType === "all" || p.project_type === selectedProjectType
  );

  const selectedProject = selectedProjectId !== "all"
    ? projects.find(p => p.id === selectedProjectId) || null
    : null;

  const geos = useMemo(() => {
    let base = tasks;
    if (selectedProjectId !== "all") {
      base = base.filter(t => t.project_id === selectedProjectId);
    } else {
      const ids = filteredProjects.map(p => p.id);
      base = base.filter(t => ids.includes(t.project_id));
    }
    return [...new Set(base.map(t => t.geography).filter(Boolean))].sort();
  }, [tasks, selectedProjectId, filteredProjects]);

  const projectTasks = useMemo(() => {
    let base = tasks;
    if (selectedProjectId !== "all") {
      base = base.filter(t => t.project_id === selectedProjectId);
    } else {
      const ids = filteredProjects.map(p => p.id);
      base = base.filter(t => ids.includes(t.project_id));
    }
    if (selectedGeo !== "all") base = base.filter(t => t.geography === selectedGeo);
    return base;
  }, [tasks, selectedProjectId, filteredProjects, selectedGeo]);

  const effectiveType = selectedProject?.project_type
    || (selectedProjectType !== "all" ? selectedProjectType : null);
  const isHints = effectiveType === "hints";

  const workedStatuses = ["completed", "in_review", "needs_correction", "reviewed"];
  const worked = projectTasks.filter(t => workedStatuses.includes(t.status));
  const remaining = projectTasks.filter(t => t.status === "available");
  const reviewed = projectTasks.filter(t => t.status === "reviewed");
  
  const reviewRate = worked.length ? Math.round((reviewed.length / worked.length) * 100) : 0;
  const avgScore = reviewed.length ? Math.round(reviewed.reduce((s, t) => s + (t.total_quality_score || 0), 0) / reviewed.length) : 0;
  
  const qualsCreated = projectTasks.reduce((s, t) => s + (parseInt(t.qualifications_created) || 0), 0);
  const newPersonsAdded = projectTasks.reduce((s, t) => s + (parseInt(t.new_persons_added) || 0), 0);
  
  const hintsNeedingFSReview = projectTasks.filter(t => 
    t.hint_result?.toLowerCase().includes("escalation") || 
    t.tree_work_review?.toLowerCase().includes("escalation") || 
    t.tree_work_review?.toLowerCase().includes("fs needed")
  );
  const hintsUnableAccess = projectTasks.filter(t => t.hint_result?.startsWith("6-"));
  
  const dupsNeedingFSReview = projectTasks.filter(t => 
    t.duplicate_result?.toLowerCase().includes("escalate") || 
    t.tree_work_review?.toLowerCase().includes("escalation") || 
    t.tree_work_review?.toLowerCase().includes("fs needed")
  );
  const dupsIncorrectMerge = projectTasks.filter(t => t.duplicate_result?.startsWith("2-Merge completed, not the same"));

  // --- THE CULPRIT FIXED: Geography Table Data logic ---
  const geoData = useMemo(() => {
    const geoMap = {};
    projectTasks.forEach(t => {
      if (!geoMap[t.geography]) {
        const registryState = geoStates.find(s => s.geography === t.geography && s.project_id === t.project_id);
        geoMap[t.geography] = { 
          geography: t.geography, 
          total_urls: 0, // ADDED: Direct counter for every task
          worked: 0, 
          reviewed: 0, 
          remaining: 0,
          status: registryState?.status || 'locked'
        };
      }
      
      // FIX: Every task in projectTasks increments the total count
      geoMap[t.geography].total_urls++;

      if (workedStatuses.includes(t.status)) geoMap[t.geography].worked++;
      if (t.status === "reviewed") geoMap[t.geography].reviewed++;
      if (t.status === "available") geoMap[t.geography].remaining++;
    });
    return Object.values(geoMap);
  }, [projectTasks, geoStates]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Project Analysis
          </h2>
          <p className="text-xs text-slate-500">Full analytics view — all projects &amp; geographies</p>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          {/* <label className="text-[10px] font-bold text-slate-400 uppercase">Project</label> */}
          <select 
            value={selectedProjectId}
            onChange={e => { setSelectedProjectId(e.target.value); setSelectedGeo("all"); }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 min-w-[180px] focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="all">All Projects</option>
            {filteredProjects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          {/* <label className="text-[10px] font-bold text-slate-400 uppercase">Project Type: </label> */}
          <select 
            value={selectedProjectType}
            onChange={e => { setSelectedProjectType(e.target.value); setSelectedProjectId("all"); setSelectedGeo("all"); }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="all">All Types</option>
            <option value="hints">Hints</option>
            <option value="duplicates">Duplicates</option>
          </select>
        </div>

        <div className="space-y-1">
          {/* <label className="text-[10px] font-bold text-slate-400 uppercase">Geography</label> */}
          <select 
            value={selectedGeo} 
            onChange={e => setSelectedGeo(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 min-w-[150px] focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="all">All Geographies</option>
            {geos.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        
        <div className="ml-auto text-xs text-slate-400 font-medium bg-slate-50 px-3 py-1.5 rounded-md border border-slate-100">
          {projectTasks.length} tasks matching filters
        </div>
      </div>

      <ClientStatsSection
        isHints={isHints} 
        worked={worked} 
        projectTasks={projectTasks} 
        remaining={remaining}
        reviewRate={reviewRate} 
        avgScore={avgScore} 
        qualsCreated={qualsCreated}
        newPersonsAdded={newPersonsAdded} 
        hintsNeedingFSReview={hintsNeedingFSReview}
        hintsUnableAccess={hintsUnableAccess} 
        dupsNeedingFSReview={dupsNeedingFSReview}
        dupsIncorrectMerge={dupsIncorrectMerge}
      />

      <div className="flex flex-col gap-6">
        <div>
          <ClientGeoTable geoData={geoData} />
        </div>
        <div>
          <ClientChartsSection geoData={geoData} tasks={tasks} projectTasks={projectTasks} />
        </div>
      </div>
    </div>
  );
}










// import ClientStatsSection from "@/components/client/ClientStatsSection";
// import ClientGeoTable from "@/components/client/ClientGeoTable";
// import ClientChartsSection from "@/components/client/ClientChartsSection";
// import { useState } from "react";

// export default function AdminChartsTab({ tasks = [], projects = [] }) {
//   const [selectedProjectId, setSelectedProjectId] = useState("all");
//   const [selectedProjectType, setSelectedProjectType] = useState("all");
//   const [selectedGeo, setSelectedGeo] = useState("all");

//   // Filter project list based on type selection
//   const filteredProjects = projects.filter(p =>
//     selectedProjectType === "all" || p.project_type === selectedProjectType
//   );

//   const selectedProject = selectedProjectId !== "all"
//     ? projects.find(p => p.id === selectedProjectId) || null
//     : null;

//   // Derive unique geographies based on selected project/type
//   const geos = (() => {
//     let base = tasks;
//     if (selectedProjectId !== "all") {
//       base = base.filter(t => t.project_id === selectedProjectId);
//     } else {
//       const ids = filteredProjects.map(p => p.id);
//       base = base.filter(t => ids.includes(t.project_id));
//     }
//     return [...new Set(base.map(t => t.geography).filter(Boolean))].sort();
//   })();

//   // Final task set for calculations
//   const projectTasks = (() => {
//     let base = tasks;
//     if (selectedProjectId !== "all") {
//       base = base.filter(t => t.project_id === selectedProjectId);
//     } else {
//       const ids = filteredProjects.map(p => p.id);
//       base = base.filter(t => ids.includes(t.project_id));
//     }
//     if (selectedGeo !== "all") base = base.filter(t => t.geography === selectedGeo);
//     return base;
//   })();

//   // Contextual flags
//   const effectiveType = selectedProject?.project_type || (selectedProjectType !== "all" ? selectedProjectType : null);
//   const isHints = effectiveType === "hints";

//   // Metric Calculations
//   const workedStatuses = ["completed", "in_review", "needs_correction", "reviewed"];
//   const worked = projectTasks.filter(t => workedStatuses.includes(t.status));
//   const remaining = projectTasks.filter(t => t.status === "available");
//   const reviewed = projectTasks.filter(t => t.status === "reviewed");
  
//   const reviewRate = worked.length ? Math.round((reviewed.length / worked.length) * 100) : 0;
//   const avgScore = reviewed.length ? Math.round(reviewed.reduce((s, t) => s + (t.total_quality_score || 0), 0) / reviewed.length) : 0;
  
//   const qualsCreated = projectTasks.reduce((s, t) => s + (parseInt(t.qualifications_created) || 0), 0);
//   const newPersonsAdded = projectTasks.reduce((s, t) => s + (parseInt(t.new_persons_added) || 0), 0);

//   // Escalation & Error Logic
//   const hintsNeedingFSReview = projectTasks.filter(t => 
//     t.hint_result?.toLowerCase().includes("escalation") || 
//     t.tree_work_review?.toLowerCase().includes("escalation") || 
//     t.tree_work_review?.toLowerCase().includes("fs needed")
//   );
//   const hintsUnableAccess = projectTasks.filter(t => t.hint_result?.startsWith("6-"));
  
//   const dupsNeedingFSReview = projectTasks.filter(t => 
//     t.duplicate_result?.toLowerCase().includes("escalate") || 
//     t.tree_work_review?.toLowerCase().includes("escalation") || 
//     t.tree_work_review?.toLowerCase().includes("fs needed")
//   );
//   const dupsIncorrectMerge = projectTasks.filter(t => t.duplicate_result?.startsWith("2-Merge completed, not the same"));

//   // Map Data for Geography Table/Charts
//   const geoMap = {};
//   projectTasks.forEach(t => {
//     if (!geoMap[t.geography]) {
//       geoMap[t.geography] = { geography: t.geography, worked: 0, reviewed: 0, remaining: 0 };
//     }
//     if (workedStatuses.includes(t.status)) geoMap[t.geography].worked++;
//     if (t.status === "reviewed") geoMap[t.geography].reviewed++;
//     if (t.status === "available") geoMap[t.geography].remaining++;
//   });
//   const geoData = Object.values(geoMap);

//   return (
//     <div className="space-y-6">
//       <div className="flex justify-between items-start">
//         <div>
//           <h2 className="text-base font-semibold text-slate-800">Project Analysis</h2>
//           <p className="text-xs text-slate-500">Full analytics view — across all projects & geographies</p>
//         </div>
//       </div>

//       {/* Filters Bar */}
//       <div className="flex gap-3 flex-wrap items-end bg-slate-50 border border-slate-200 rounded-xl p-4">
//         <div className="space-y-1">
//           <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-1">Project</label>
//           <select 
//             value={selectedProjectId}
//             onChange={e => { setSelectedProjectId(e.target.value); setSelectedGeo("all"); }}
//             className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 min-w-[200px] focus:ring-2 focus:ring-indigo-500 outline-none"
//           >
//             <option value="all">All Projects</option>
//             {filteredProjects.map(p => (
//               <option key={p.id} value={p.id}>{p.name}</option>
//             ))}
//           </select>
//         </div>

//         <div className="space-y-1">
//           <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-1">Type</label>
//           <select 
//             value={selectedProjectType}
//             onChange={e => { setSelectedProjectType(e.target.value); setSelectedProjectId("all"); setSelectedGeo("all"); }}
//             className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
//           >
//             <option value="all">All Types</option>
//             <option value="hints">Hints</option>
//             <option value="duplicates">Duplicates</option>
//           </select>
//         </div>

//         <div className="space-y-1">
//           <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-1">Geography</label>
//           <select 
//             value={selectedGeo} 
//             onChange={e => setSelectedGeo(e.target.value)}
//             className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 min-w-[160px] focus:ring-2 focus:ring-indigo-500 outline-none"
//           >
//             <option value="all">All Geographies</option>
//             {geos.map(g => <option key={g} value={g}>{g}</option>)}
//           </select>
//         </div>
        
//         <div className="ml-auto text-right">
//           <div className="text-lg font-bold text-slate-700">{projectTasks.length}</div>
//           <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-tighter">Total Tasks</div>
//         </div>
//       </div>

//       {/* Stats Overview */}
//       <ClientStatsSection
//         isHints={isHints} 
//         worked={worked} 
//         projectTasks={projectTasks} 
//         remaining={remaining}
//         reviewRate={reviewRate} 
//         avgScore={avgScore} 
//         qualsCreated={qualsCreated}
//         newPersonsAdded={newPersonsAdded} 
//         hintsNeedingFSReview={hintsNeedingFSReview}
//         hintsUnableAccess={hintsUnableAccess} 
//         dupsNeedingFSReview={dupsNeedingFSReview}
//         dupsIncorrectMerge={dupsIncorrectMerge}
//       />

//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//         <ClientGeoTable geoData={geoData} />
//         <ClientChartsSection geoData={geoData} tasks={tasks} projectTasks={projectTasks} />
//       </div>
//     </div>
//   );
// }