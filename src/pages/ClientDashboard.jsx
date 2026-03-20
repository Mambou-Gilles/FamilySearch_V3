import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient"; 
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientExportModal } from "@/components/ExportCsvModal";
import Footer from "@/components/Footer";
import ClientStatsSection from "@/components/client/ClientStatsSection";
import ClientGeoTable from "@/components/client/ClientGeoTable";
import ClientChartsSection from "@/components/client/ClientChartsSection";

export default function ClientDashboard() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [geoStates, setGeoStates] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [selectedProjectType, setSelectedProjectType] = useState("all");
  const [selectedGeo, setSelectedGeo] = useState("all");
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    try {
      const [pRes, tRes, gsRes] = await Promise.all([
        supabase.from('projects').select('*').eq('status', 'active'),
        // Note: If you have more than 1000 tasks, you may need to adjust this limit
        // or use a count-only query for large datasets.
        supabase.from('tasks').select('*').order('date_completed', { ascending: false }).limit(1000),
        supabase.from('project_geography_states').select('*')
      ]);

      setProjects(pRes.data || []);
      setTasks(tRes.data || []);
      setGeoStates(gsRes.data || []);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredProjects = projects.filter(p =>
    selectedProjectType === "all" || p.project_type === selectedProjectType
  );

  const selectedProject = selectedProjectId !== "all"
    ? projects.find(p => p.id === selectedProjectId) || null
    : null;

  const geos = (() => {
    let relevantStates = geoStates;
    if (selectedProjectId !== "all") {
      relevantStates = relevantStates.filter(s => s.project_id === selectedProjectId);
    } else {
      const ids = filteredProjects.map(p => p.id);
      relevantStates = relevantStates.filter(s => ids.includes(s.project_id));
    }
    return [...new Set(relevantStates.map(s => s.geography).filter(Boolean))].sort();
  })();

  const projectTasks = (() => {
    let base = tasks;
    if (selectedProjectId !== "all") {
      base = base.filter(t => t.project_id === selectedProjectId);
    } else {
      const ids = filteredProjects.map(p => p.id);
      base = base.filter(t => ids.includes(t.project_id));
    }
    if (selectedGeo !== "all") base = base.filter(t => t.geography === selectedGeo);
    return base;
  })();

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

  // --- Geo Table Logic ---
  const geoMap = {};
  
  projectTasks.forEach(t => {
    const gName = t.geography || "Unassigned";
    if (!geoMap[gName]) {
      geoMap[gName] = { 
        geography: gName, 
        // We sum everything to get the absolute total
        total_urls: 0, 
        worked: 0, 
        reviewed: 0, 
        remaining: 0 
      };
    }

    // 1. COUNT EVERY TASK (This will include 'assigned' tasks)
    geoMap[gName].total_urls += 1;

    // 2. BREAKDOWN
    if (workedStatuses.includes(t.status)) {
      geoMap[gName].worked++;
    }
    
    if (t.status === "reviewed") {
      geoMap[gName].reviewed++;
    }
    
    // Only 'available' is remaining
    if (t.status === "available") {
      geoMap[gName].remaining++;
    }
  });

  const geoData = Object.values(geoMap);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Project Reports</h1>
            <p className="text-indigo-200 text-sm mt-1">Analytics overview · {projectTasks.length.toLocaleString()} tasks in view</p>
          </div>
          <Button size="sm" onClick={() => setExportOpen(true)} className="bg-white/20 hover:bg-white/30 text-white border-white/30 border">
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
        </div>

        <div className="mt-5 flex gap-3 flex-wrap">
          <select value={selectedProjectId}
            onChange={e => { setSelectedProjectId(e.target.value); setSelectedGeo("all"); }}
            className="text-sm rounded-lg px-3 py-1.5 bg-white/15 border border-white/20 text-white min-w-[160px] focus:outline-none focus:ring-2 focus:ring-white/40">
            <option className="text-slate-800" value="all">All Projects</option>
            {filteredProjects.map(p => <option className="text-slate-800" key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={selectedProjectType}
            onChange={e => { setSelectedProjectType(e.target.value); setSelectedProjectId("all"); setSelectedGeo("all"); }}
            className="text-sm rounded-lg px-3 py-1.5 bg-white/15 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/40">
            <option className="text-slate-800" value="all">All Types</option>
            <option className="text-slate-800" value="hints">Hints</option>
            <option className="text-slate-800" value="duplicates">Duplicates</option>
          </select>
          <select value={selectedGeo} onChange={e => setSelectedGeo(e.target.value)}
            className="text-sm rounded-lg px-3 py-1.5 bg-white/15 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/40">
            <option className="text-slate-800" value="all">All Geographies</option>
            {geos.map(g => <option className="text-slate-800" key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <ClientStatsSection
        isHints={isHints} 
        worked={worked} 
        projectTasks={projectTasks} 
        remaining={remaining}
        reviewed={reviewed}
        reviewRate={reviewRate} 
        avgScore={avgScore} 
        qualsCreated={qualsCreated}
        newPersonsAdded={newPersonsAdded} 
        hintsNeedingFSReview={hintsNeedingFSReview}
        hintsUnableAccess={hintsUnableAccess} 
        dupsNeedingFSReview={dupsNeedingFSReview}
        dupsIncorrectMerge={dupsIncorrectMerge}
      />

      <ClientGeoTable geoData={geoData} />
      <ClientChartsSection geoData={geoData} tasks={tasks} projectTasks={projectTasks} />
      
      <ClientExportModal open={exportOpen} onClose={() => setExportOpen(false)} projects={projects} tasks={tasks} />
      <Footer />
    </div>
  );
}










// import { useState, useEffect } from "react";
// import { supabase } from "@/api/supabaseClient"; // Your Supabase client
// import { Download } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { ClientExportModal } from "@/components/ExportCsvModal";
// import Footer from "@/components/Footer";
// import ClientStatsSection from "@/components/client/ClientStatsSection";
// import ClientGeoTable from "@/components/client/ClientGeoTable";
// import ClientChartsSection from "@/components/client/ClientChartsSection";

// export default function ClientDashboard() {
//   const [projects, setProjects] = useState([]);
//   const [tasks, setTasks] = useState([]);
//   const [geoStates, setGeoStates] = useState([]);
//   const [selectedProjectId, setSelectedProjectId] = useState("all");
//   const [selectedProjectType, setSelectedProjectType] = useState("all");
//   const [selectedGeo, setSelectedGeo] = useState("all");
//   const [loading, setLoading] = useState(true);
//   const [exportOpen, setExportOpen] = useState(false);

//   useEffect(() => { init(); }, []);

//   async function init() {
//     setLoading(true);
//     try {
//       // Supabase Migrated Calls
//       const [pRes, tRes, gsRes] = await Promise.all([
//         supabase.from('projects').select('*').eq('status', 'active'),
//         supabase.from('tasks').select('*').order('date_completed', { ascending: false }).limit(1000),
//         supabase.from('project_geography_states').select('*')
//       ]);

//       setProjects(pRes.data || []);
//       setTasks(tRes.data || []);
//       setGeoStates(gsRes.data || []);
//     } catch (error) {
//       console.error("Error loading dashboard data:", error);
//     } finally {
//       setLoading(false);
//     }
//   }

//   // --- Filter Logic ---
//   const filteredProjects = projects.filter(p =>
//     selectedProjectType === "all" || p.project_type === selectedProjectType
//   );

//   const selectedProject = selectedProjectId !== "all"
//     ? projects.find(p => p.id === selectedProjectId) || null
//     : null;

//   const geos = (() => {
//     let relevantStates = geoStates;
//     if (selectedProjectId !== "all") {
//       relevantStates = relevantStates.filter(s => s.project_id === selectedProjectId);
//     } else {
//       const ids = filteredProjects.map(p => p.id);
//       relevantStates = relevantStates.filter(s => ids.includes(s.project_id));
//     }
//     return [...new Set(relevantStates.map(s => s.geography).filter(Boolean))].sort();
//   })();

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

//   const effectiveType = selectedProject?.project_type
//     || (selectedProjectType !== "all" ? selectedProjectType : null);
//   const isHints = effectiveType === "hints";

//   // --- Stats Logic (Restoring Escalation Variables) ---
//   const workedStatuses = ["completed", "in_review", "needs_correction", "reviewed"];
//   const worked = projectTasks.filter(t => workedStatuses.includes(t.status));
//   const remaining = projectTasks.filter(t => t.status === "available");
//   const reviewed = projectTasks.filter(t => t.status === "reviewed");
  
//   const reviewRate = worked.length ? Math.round((reviewed.length / worked.length) * 100) : 0;
//   const avgScore = reviewed.length ? Math.round(reviewed.reduce((s, t) => s + (t.total_quality_score || 0), 0) / reviewed.length) : 0;
//   const qualsCreated = projectTasks.reduce((s, t) => s + (parseInt(t.qualifications_created) || 0), 0);
//   const newPersonsAdded = projectTasks.reduce((s, t) => s + (parseInt(t.new_persons_added) || 0), 0);

//   // FIX: RESTORED ESCALATION LOGIC
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

//   // --- Geo Table Logic ---
//   const geoMap = {};
//   projectTasks.forEach(t => {
//     if (!geoMap[t.geography]) geoMap[t.geography] = { geography: t.geography, worked: 0, reviewed: 0, remaining: 0 };
//     if (workedStatuses.includes(t.status)) geoMap[t.geography].worked++;
//     if (t.status === "reviewed") geoMap[t.geography].reviewed++;
//     if (t.status === "available") geoMap[t.geography].remaining++;
//   });
//   const geoData = Object.values(geoMap);

//   if (loading) return (
//     <div className="flex items-center justify-center h-64">
//       <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
//     </div>
//   );

//   return (
//     <div className="max-w-6xl mx-auto p-6 space-y-6">
//       {/* Header section remains visually identical */}
//       <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white">
//         <div className="flex items-start justify-between gap-4 flex-wrap">
//           <div>
//             <h1 className="text-2xl font-extrabold tracking-tight">Project Reports</h1>
//             <p className="text-indigo-200 text-sm mt-1">Analytics overview · {projectTasks.length.toLocaleString()} tasks in view</p>
//           </div>
//           <Button size="sm" onClick={() => setExportOpen(true)} className="bg-white/20 hover:bg-white/30 text-white border-white/30 border">
//             <Download className="w-4 h-4 mr-1.5" /> Export CSV
//           </Button>
//         </div>

//         {/* Filters */}
//         <div className="mt-5 flex gap-3 flex-wrap">
//           <select value={selectedProjectId}
//             onChange={e => { setSelectedProjectId(e.target.value); setSelectedGeo("all"); }}
//             className="text-sm rounded-lg px-3 py-1.5 bg-white/15 border border-white/20 text-white placeholder-white/60 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-white/40">
//             <option className="text-slate-800" value="all">All Projects</option>
//             {filteredProjects.map(p => <option className="text-slate-800" key={p.id} value={p.id}>{p.name}</option>)}
//           </select>
//           <select value={selectedProjectType}
//             onChange={e => { setSelectedProjectType(e.target.value); setSelectedProjectId("all"); setSelectedGeo("all"); }}
//             className="text-sm rounded-lg px-3 py-1.5 bg-white/15 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/40">
//             <option className="text-slate-800" value="all">All Types</option>
//             <option className="text-slate-800" value="hints">Hints</option>
//             <option className="text-slate-800" value="duplicates">Duplicates</option>
//           </select>
//           <select value={selectedGeo} onChange={e => setSelectedGeo(e.target.value)}
//             className="text-sm rounded-lg px-3 py-1.5 bg-white/15 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/40">
//             <option className="text-slate-800" value="all">All Geographies</option>
//             {geos.map(g => <option className="text-slate-800" key={g} value={g}>{g}</option>)}
//           </select>
//         </div>
//       </div>

//       <ClientStatsSection
//         isHints={isHints} 
//         worked={worked} 
//         projectTasks={projectTasks} 
//         remaining={remaining}
//         reviewed={reviewed}
//         reviewRate={reviewRate} 
//         avgScore={avgScore} 
//         qualsCreated={qualsCreated}
//         newPersonsAdded={newPersonsAdded} 
//         hintsNeedingFSReview={hintsNeedingFSReview}
//         hintsUnableAccess={hintsUnableAccess} 
//         dupsNeedingFSReview={dupsNeedingFSReview}
//         dupsIncorrectMerge={dupsIncorrectMerge}
//       />

//       <ClientGeoTable geoData={geoData} />
//       <ClientChartsSection geoData={geoData} tasks={tasks} projectTasks={projectTasks} />
      
//       <ClientExportModal open={exportOpen} onClose={() => setExportOpen(false)} projects={projects} tasks={tasks} />
//       <Footer />
//     </div>
//   );
// }

