import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient"; 
import { useAuth } from "@/lib/AuthContext";      
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import Footer from "@/components/Footer";
import ContributorKpiStrip from "@/components/contributor/ContributorKpiStrip";
import ContributorTaskList from "@/components/contributor/ContributorTaskList";
import ContributorTaskPanel from "@/components/contributor/ContributorTaskPanel";
import ContributorHistoryTab from "@/components/contributor/ContributorHistoryTab";
import BatchRequestDialog from "@/components/contributor/BatchRequestDialog";
import ContributorAnalytics from "@/components/contributor/ContributorAnalytics";

const PAGE_SIZE_DESKTOP = 10;
const PAGE_SIZE_MOBILE = 5;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isMobile;
}

export default function ContributorDashboard() {
  const { user } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [queue, setQueue] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("queue");
  const [page, setPage] = useState(0);

  // --- PERSISTENCE: Save ID to localStorage whenever selectedTask changes ---
  useEffect(() => {
    if (selectedTask) {
      localStorage.setItem("active_task_id", selectedTask.id);
    }
  }, [selectedTask]);

  useEffect(() => { 
    if (user) init(); 
  }, [user]);

  async function init() {
    if (!assignment && queue.length === 0) setLoading(true);
    try {
      if (!user?.id) return;

      // Tighten this query to ensure we get the right role and status
      const { data: assignments, error } = await supabase
        .from('team_assignments')
        .select('*')
        .eq('status', 'active')
        .eq('role', 'contributor')
        .or(`user_id.eq.${user.id},user_email.eq.${user.email}`)
        .order('created_date', { ascending: false }); // Get the newest one

      if (error) throw error;
      
      if (assignments?.length) {
        console.log("Active Assignment Found:", assignments[0]); // Debug log
        setAssignment(assignments[0]);
      } else {
        console.warn("No active contributor assignment found for:", user.email);
      }
      
      await loadTasks(user.email, user.id);
    } catch (err) {
      console.error("Initialization error:", err);
      toast.error("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTasks(email, uid) {
    try {
      const [assignedRes, correctionsRes, historyRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('status', 'assigned').or(`contributor_id.eq.${uid},contributor_email.eq.${email}`),
        supabase.from('tasks').select('*').eq('status', 'needs_correction').or(`contributor_id.eq.${uid},contributor_email.eq.${email}`),
        supabase.from('tasks').select('*').in('status', ['completed', 'reviewed']).or(`contributor_id.eq.${uid},contributor_email.eq.${email}`).order('date_completed', { ascending: false }).limit(100)
      ]);

      const freshQueue = assignedRes.data || [];
      const freshCorrections = correctionsRes.data || [];

      setQueue(freshQueue);
      setCorrections(freshCorrections);
      setHistory(historyRes.data || []);
      setPage(0);

      // --- PERSISTENCE: Restore the selected task if an ID is saved ---
      const savedId = localStorage.getItem("active_task_id");
      if (savedId) {
        const taskInQueue = freshQueue.find(t => t.id === savedId);
        const taskInCorr = freshCorrections.find(t => t.id === savedId);

        if (taskInQueue) {
          setSelectedTask(taskInQueue);
          setActiveTab("queue");
        } else if (taskInCorr) {
          setSelectedTask(taskInCorr);
          setActiveTab("corrections");
        }
      }
    } catch (err) {
      console.error("Task loading error:", err);
    }
  }

  async function requestBatch(batchSize) {
    if (!assignment) { 
      toast.error("No active assignment found. Contact your manager."); 
      return; 
    }
    
    setRequesting(true);
    setBatchDialogOpen(false);

    try {
      const { data: geoState, error: geoError } = await supabase
        .from('project_geography_states')
        .select('status')
        .eq('project_id', assignment.project_id)
        .eq('geography', assignment.geography)
        .single();

      if (geoError || !geoState || geoState.status !== "open") {
        toast.error(`Geography "${assignment.geography}" is locked.`, {
          description: "Ask your manager to unlock this region.",
          duration: 6000 
        });
        setRequesting(false);
        return;
      }

      const { data: available, error: availError } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', assignment.project_id)
        .eq('geography', assignment.geography)
        .eq('status', 'available')
        .limit(batchSize);

      if (availError || !available?.length) {
        toast.info("No available tasks in this geography right now.");
        setRequesting(false);
        return;
      }

      const batchId = `batch-${Date.now()}`;
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          status: "assigned",
          contributor_id: user.id,
          contributor_email: user.email,
          contributor_name: user.user_metadata?.full_name || user.email,
          batch_id: batchId,
          updated_date: new Date().toISOString()
        })
        .in('id', available.map(t => t.id));

      if (updateError) throw updateError;

      toast.success(`Successfully checked out ${available.length} tasks!`);
      await loadTasks(user.email, user.id);
    } catch (err) {
      console.error("Batch request error:", err);
      toast.error("An error occurred while requesting tasks.");
    } finally {
      setRequesting(false);
    }
  }

  async function submitTask(data) {
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('tasks')
        .update({
          ...data,
          status: "completed",
          date_completed: now,
          original_completion_date: selectedTask.original_completion_date || now,
          updated_date: now
        })
        .eq('id', selectedTask.id);

      if (error) throw error;

      toast.success("Task submitted for review!");
      
      // Clear persistence only when the task is actually finished
      localStorage.removeItem("active_task_id");
      setSelectedTask(null);
      await loadTasks(user.email, user.id);
    } catch (err) {
      console.error("Submission error:", err);
      toast.error("Failed to submit task.");
    } finally {
      setSubmitting(false);
    }
  }

  // Clear memory if user manually backs out of the form
  const handleBack = () => {
    localStorage.removeItem("active_task_id");
    setSelectedTask(null);
  };

  const completedToday = history.filter(t => t.date_completed && new Date(t.date_completed).toDateString() === new Date().toDateString()).length;
  const reviewed = history.filter(t => t.status === "reviewed").length;
  const noCorrection = history.filter(t => t.status === "reviewed" && !t.correction_count).length;
  const accuracy = reviewed ? Math.round((noCorrection / reviewed) * 100) : 0;

  const isMobile = useIsMobile();
  const PAGE_SIZE = isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP;
  const activeList = activeTab === "queue" ? queue : activeTab === "corrections" ? corrections : [];
  const totalPages = Math.ceil(activeList.length / PAGE_SIZE);
  const pageTasks = activeList.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const isCorrectionMode = activeTab === "corrections";

  // Only block the WHOLE dashboard if we are loading AND have no user yet
  if (loading && !assignment && queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 animate-pulse">
        <RefreshCw className="w-8 h-8 animate-spin mb-4 text-sky-600" />
        <p className="font-medium">Syncing Workspace...</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col overflow-x-hidden">
      <div className="bg-gradient-to-br from-sky-600 to-sky-900 px-6 py-6 grid grid-cols-1 md:grid-cols-3 items-center gap-4">
        
        {/* Left: Project Info */}
        <div className="flex items-center gap-3 order-2 md:order-1">
          <div className="p-2.5 bg-white/10 rounded-xl hidden sm:block">
            <span className="text-xl">📥</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">My Workspace</h1>
            {assignment && (
              <p className="text-[11px] text-sky-200 mt-1 font-medium uppercase tracking-wider">
                {assignment.geography} • {assignment.project_type}
              </p>
            )}
          </div>
        </div>

        {/* Middle: Big Centered Target Display */}
        <div className="flex flex-col items-center justify-center order-1 md:order-2 py-2">
          <div className="text-center group">
            <span className="text-[10px] text-sky-200 uppercase font-bold tracking-[0.2em] mb-1 block">
              Daily Progress
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl md:text-5xl font-black text-white drop-shadow-sm">
                {completedToday}
              </span>
              <span className="text-xl md:text-2xl font-bold text-sky-300/70">
                / {assignment?.daily_target || '—'}
              </span>
            </div>
            {/* Simple Progress Bar Underneath */}
            {assignment?.daily_target > 0 && (
              <div className="w-32 h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-sky-300 transition-all duration-500 shadow-[0_0_8px_rgba(125,211,252,0.5)]"
                  style={{ width: `${Math.min((completedToday / assignment.daily_target) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: Action Button */}
        <div className="flex justify-start md:justify-end order-3">
          <Button 
            onClick={() => setBatchDialogOpen(true)} 
            disabled={requesting || queue.length > 0} 
            size="sm"
            className="bg-white text-sky-800 hover:bg-sky-50 font-bold border-0 shadow-xl px-5 h-10 rounded-xl transition-all active:scale-95"
          >
            {requesting ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <span className="mr-2">⚡</span>
            )}
            <span>
              {requesting 
                ? "Requesting..." 
                : queue.length > 0 
                  ? `${queue.length} in Queue` 
                  : "Get Next Batch"}
            </span>
          </Button>
        </div>
      </div>

      <ContributorKpiStrip queue={queue} corrections={corrections} completedToday={completedToday} history={history} accuracy={accuracy} />

      <div className="flex border-b border-slate-200 bg-white overflow-x-auto">
        {[
          { key: "queue", label: `Queue (${queue.length})` },
          { key: "corrections", label: `Corrections (${corrections.length})` },
          { key: "history", label: `History (${history.length})` },
        ].map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setPage(0); handleBack(); }}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === tab.key ? "border-indigo-600 text-indigo-700 bg-indigo-50/40" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        {activeTab !== "history" && (
          <div className="flex flex-col md:flex-row flex-1">
            <ContributorTaskList
              tasks={pageTasks} selectedTask={selectedTask} setSelectedTask={setSelectedTask}
              isMobile={isMobile} isCorrectionMode={isCorrectionMode}
              page={page} setPage={setPage} totalPages={totalPages} pageSize={PAGE_SIZE}
            />
            <ContributorTaskPanel
              selectedTask={selectedTask} onSubmit={submitTask} submitting={submitting}
              isMobile={isMobile} onBack={handleBack}
            />
          </div>
        )}
        {activeTab === "history" && (
          <div className="flex-1 p-4 space-y-4">
            <ContributorAnalytics history={history} />
            <ContributorHistoryTab history={history} />
          </div>
        )}
      </div>
      <BatchRequestDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        assignment={assignment}
        onConfirm={requestBatch}
        requesting={requesting}
      />
      <Footer />
    </div>
  );
}













// import { useState, useEffect } from "react";
// import { supabase } from "@/api/supabaseClient"; 
// import { useAuth } from "@/lib/AuthContext";      
// import { Button } from "@/components/ui/button";
// import { toast } from "sonner";
// import { RefreshCw } from "lucide-react";
// import Footer from "@/components/Footer";
// import ContributorKpiStrip from "@/components/contributor/ContributorKpiStrip";
// import ContributorTaskList from "@/components/contributor/ContributorTaskList";
// import ContributorTaskPanel from "@/components/contributor/ContributorTaskPanel";
// import ContributorHistoryTab from "@/components/contributor/ContributorHistoryTab";
// import BatchRequestDialog from "@/components/contributor/BatchRequestDialog";
// import ContributorAnalytics from "@/components/contributor/ContributorAnalytics";

// const PAGE_SIZE_DESKTOP = 10;
// const PAGE_SIZE_MOBILE = 5;

// function useIsMobile() {
//   const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
//   useEffect(() => {
//     const fn = () => setIsMobile(window.innerWidth < 768);
//     window.addEventListener("resize", fn);
//     return () => window.removeEventListener("resize", fn);
//   }, []);
//   return isMobile;
// }

// export default function ContributorDashboard() {
//   const { user } = useAuth(); // Get user from Supabase Auth Context
//   const [assignment, setAssignment] = useState(null);
//   const [queue, setQueue] = useState([]);
//   const [corrections, setCorrections] = useState([]);
//   const [history, setHistory] = useState([]);
//   const [selectedTask, setSelectedTask] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [submitting, setSubmitting] = useState(false);
//   const [requesting, setRequesting] = useState(false);
//   const [batchDialogOpen, setBatchDialogOpen] = useState(false);
//   const [activeTab, setActiveTab] = useState("queue");
//   const [page, setPage] = useState(0);

//   useEffect(() => { 
//     if (user) init(); 
//   }, [user]);

//   async function init() {
//     setLoading(true);
//     try {
//       // Find the contributor-role assignment specifically
//       const { data: assignments, error } = await supabase
//         .from('team_assignments')
//         .select('*')
//         .eq('status', 'active')
//         .eq('role', 'contributor')
//         .or(`user_id.eq.${user.id},user_email.eq.${user.email}`);

//       if (error) throw error;
//       if (assignments?.length) setAssignment(assignments[0]);
      
//       await loadTasks(user.email, user.id);
//     } catch (err) {
//       console.error("Initialization error:", err);
//       toast.error("Failed to load dashboard data.");
//     } finally {
//       setLoading(false);
//     }
//   }

//   async function loadTasks(email, uid) {
//     try {
//       // Fetch assigned and corrections in parallel using Supabase
//       const [assignedRes, correctionsRes, historyRes] = await Promise.all([
//         supabase.from('tasks').select('*').eq('status', 'assigned').or(`contributor_id.eq.${uid},contributor_email.eq.${email}`),
//         supabase.from('tasks').select('*').eq('status', 'needs_correction').or(`contributor_id.eq.${uid},contributor_email.eq.${email}`),
//         supabase.from('tasks').select('*').in('status', ['completed', 'reviewed']).or(`contributor_id.eq.${uid},contributor_email.eq.${email}`).order('date_completed', { ascending: false }).limit(100)
//       ]);

//       setQueue(assignedRes.data || []);
//       setCorrections(correctionsRes.data || []);
//       setHistory(historyRes.data || []);
//       setPage(0);
//     } catch (err) {
//       console.error("Task loading error:", err);
//     }
//   }

//   async function requestBatch(batchSize) {
//     if (!assignment) { 
//       toast.error("No active assignment found. Contact your manager."); 
//       return; 
//     }

//     console.log("Current Assignment:", assignment);
//     console.log("Geography Status Check:", assignment.project_id, assignment.geography);
    
//     setRequesting(true);
//     setBatchDialogOpen(false);

//     try {
//       // 1. Check if the Geography is currently OPEN
//       const { data: geoState, error: geoError } = await supabase
//         .from('project_geography_states')
//         .select('status')
//         .eq('project_id', assignment.project_id)
//         .eq('geography', assignment.geography)
//         .single();

//       if (geoError || !geoState || geoState.status !== "open") {
//         toast.error(`Geography "${assignment.geography}" is locked.`, {
//           description: "Ask your manager to unlock this region.",
//           duration: 6000 
//         });
//         setRequesting(false);
//         return;
//       }

//       // 2. Fetch available tasks for this specific assignment
//       const { data: available, error: availError } = await supabase
//         .from('tasks')
//         .select('id')
//         .eq('project_id', assignment.project_id)
//         .eq('geography', assignment.geography)
//         .eq('status', 'available')
//         .limit(batchSize);

//       if (availError || !available?.length) {
//         toast.info("No available tasks in this geography right now.");
//         setRequesting(false);
//         return;
//       }

//       // 3. Assign the batch to the user
//       const batchId = `batch-${Date.now()}`;
//       const { error: updateError } = await supabase
//         .from('tasks')
//         .update({
//           status: "assigned",
//           contributor_id: user.id,
//           contributor_email: user.email,
//           contributor_name: user.user_metadata?.full_name || user.email, // Use metadata if available
//           batch_id: batchId,
//           updated_date: new Date().toISOString()
//         })
//         .in('id', available.map(t => t.id));

//       if (updateError) throw updateError;

//       toast.success(`Successfully checked out ${available.length} tasks!`);
      
//       // Refresh the local task list
//       await loadTasks(user.email, user.id);
//     } catch (err) {
//       console.error("Batch request error:", err);
//       toast.error("An error occurred while requesting tasks.");
//     } finally {
//       setRequesting(false);
//     }
//   }

//   async function submitTask(data) {
//     setSubmitting(true);
//     try {
//       const now = new Date().toISOString();
//       const { error } = await supabase
//         .from('tasks')
//         .update({
//           ...data,
//           status: "completed",
//           date_completed: now,
//           original_completion_date: selectedTask.original_completion_date || now,
//           updated_date: now
//         })
//         .eq('id', selectedTask.id);

//       if (error) throw error;

//       toast.success("Task submitted for review!");
//       setSelectedTask(null);
//       await loadTasks(user.email, user.id);
//     } catch (err) {
//       console.error("Submission error:", err);
//       toast.error("Failed to submit task.");
//     } finally {
//       setSubmitting(false);
//     }
//   }

//   // --- KPI and Pagination Logic (Unchanged as it is purely frontend) ---
//   const completedToday = history.filter(t => t.date_completed && new Date(t.date_completed).toDateString() === new Date().toDateString()).length;
//   const reviewed = history.filter(t => t.status === "reviewed").length;
//   const noCorrection = history.filter(t => t.status === "reviewed" && !t.correction_count).length;
//   const accuracy = reviewed ? Math.round((noCorrection / reviewed) * 100) : 0;

//   const isMobile = useIsMobile();
//   const PAGE_SIZE = isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP;
//   const activeList = activeTab === "queue" ? queue : activeTab === "corrections" ? corrections : [];
//   const totalPages = Math.ceil(activeList.length / PAGE_SIZE);
//   const pageTasks = activeList.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
//   const isCorrectionMode = activeTab === "corrections";

//   if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Loading Dashboard...</div>;

//   return (
//     <div className="min-h-[calc(100vh-56px)] flex flex-col overflow-x-hidden">
//       {/* UI markup remains the same to preserve design */}
//       <div className="bg-gradient-to-br from-sky-600 to-sky-900 px-6 py-5 flex items-center justify-between gap-3 flex-wrap">
//         <div className="flex items-center gap-3">
//           <div className="p-2.5 bg-white/10 rounded-xl"><span className="text-xl">📥</span></div>
//           <div>
//             <h1 className="text-xl font-extrabold text-white tracking-tight">My Workspace</h1>
//             {assignment && <p className="text-xs text-sky-200 mt-0.5">{assignment.geography} · {assignment.project_type}</p>}
//           </div>
//         </div>
//         <Button onClick={() => setBatchDialogOpen(true)} disabled={requesting || queue.length > 0} size="sm"
//           className="bg-white text-sky-700 hover:bg-sky-50 font-semibold border-0">
//           <RefreshCw className={`w-4 h-4 ${requesting ? "animate-spin" : ""}`} />
//           <span className="hidden sm:inline ml-1">{requesting ? "Requesting..." : queue.length > 0 ? `${queue.length} in queue` : "Request New Batch"}</span>
//           <span className="sm:hidden ml-1">{queue.length > 0 ? queue.length : "+"}</span>
//         </Button>
//       </div>

//       <ContributorKpiStrip queue={queue} corrections={corrections} completedToday={completedToday} history={history} accuracy={accuracy} />

//       <div className="flex border-b border-slate-200 bg-white overflow-x-auto">
//         {[
//           { key: "queue", label: `Queue (${queue.length})` },
//           { key: "corrections", label: `Corrections (${corrections.length})` },
//           { key: "history", label: `History (${history.length})` },
//         ].map(tab => (
//           <button key={tab.key} onClick={() => { setActiveTab(tab.key); setPage(0); setSelectedTask(null); }}
//             className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === tab.key ? "border-indigo-600 text-indigo-700 bg-indigo-50/40" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
//             {tab.label}
//           </button>
//         ))}
//       </div>

//       <div className="flex flex-col flex-1 min-h-0">
//         {activeTab !== "history" && (
//           <div className="flex flex-col md:flex-row flex-1">
//             <ContributorTaskList
//               tasks={pageTasks} selectedTask={selectedTask} setSelectedTask={setSelectedTask}
//               isMobile={isMobile} isCorrectionMode={isCorrectionMode}
//               page={page} setPage={setPage} totalPages={totalPages} pageSize={PAGE_SIZE}
//             />
//             <ContributorTaskPanel
//               selectedTask={selectedTask} onSubmit={submitTask} submitting={submitting}
//               isMobile={isMobile} onBack={() => setSelectedTask(null)}
//             />
//           </div>
//         )}
//         {activeTab === "history" && (
//           <div className="flex-1 p-4 space-y-4">
//             <ContributorAnalytics history={history} />
//             <ContributorHistoryTab history={history} />
//           </div>
//         )}
//       </div>
//       <BatchRequestDialog
//         open={batchDialogOpen}
//         onOpenChange={setBatchDialogOpen}
//         assignment={assignment}
//         onConfirm={requestBatch}
//         requesting={requesting}
//       />
//       <Footer />
//     </div>
//   );
// }