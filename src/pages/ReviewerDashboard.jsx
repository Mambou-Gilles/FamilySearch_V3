import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient"; 
import { toast } from "sonner";
import Footer from "@/components/Footer";
import ReviewerStatsBar from "@/components/reviewer/ReviewerStatsBar";
import ReviewerContributorList from "@/components/reviewer/ReviewerContributorList";
import ReviewerTaskPanel from "@/components/reviewer/ReviewerTaskPanel";

const HISTORY_PAGE = 15;

function getWeekStart() {
  const now = new Date();
  const day = now.getDay(); 
  const diff = (day >= 2) ? day - 2 : day + 5;
  const tuesday = new Date(now);
  tuesday.setDate(now.getDate() - diff);
  tuesday.setHours(0, 0, 0, 0);
  return tuesday;
}

function ReviewerHistoryTable({ reviewed, onDelete }) {
  const [page, setPage] = useState(0);
  const [filterDate, setFilterDate] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  const filtered = filterDate
    ? reviewed.filter(t => t.review_date?.split("T")[0] === filterDate)
    : reviewed;

  const totalPages = Math.ceil(filtered.length / HISTORY_PAGE);
  const paged = filtered.slice(page * HISTORY_PAGE, (page + 1) * HISTORY_PAGE);

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === paged.length) setSelected(new Set());
    else setSelected(new Set(paged.map(t => t.id)));
  };

  const handleDelete = async () => {
    if (!selected.size) return;
    setDeleting(true);
    await onDelete([...selected]);
    setSelected(new Set());
    setDeleting(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600 font-medium">Filter reviews:</span>
          <input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setPage(0); }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-teal-500 outline-none" />
          {filterDate && <button onClick={() => setFilterDate("")} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>}
        </div>
        {selected.size > 0 && (
          <button onClick={handleDelete} disabled={deleting}
            className="ml-auto text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 font-semibold disabled:opacity-50">
            {deleting ? "Deleting..." : `Delete ${selected.size} selected`}
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-3 w-8">
                  <input type="checkbox" checked={paged.length > 0 && selected.size === paged.length} onChange={toggleAll} className="rounded border-slate-300" />
                </th>
                <th className="text-left p-3 text-slate-600 font-bold uppercase text-[10px] tracking-wider">URL</th>
                <th className="text-left p-3 text-slate-600 font-bold uppercase text-[10px] tracking-wider">Contributor</th>
                <th className="text-right p-3 text-slate-600 font-bold uppercase text-[10px] tracking-wider">Score</th>
                <th className="text-right p-3 text-slate-600 font-bold uppercase text-[10px] tracking-wider">Corr.</th>
                <th className="text-left p-3 text-slate-600 font-bold uppercase text-[10px] tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map(t => (
                <tr key={t.id} className={`hover:bg-slate-50 transition-colors ${selected.has(t.id) ? "bg-red-50/50" : ""}`}>
                  <td className="p-3">
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} className="rounded border-slate-300" />
                  </td>
                  <td className="p-3 max-w-[160px] truncate">
                    <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline text-xs font-mono">{t.url}</a>
                  </td>
                  <td className="p-3 text-slate-700 text-sm font-medium">{t.contributor_name || "—"}</td>
                  <td className="p-3 text-right">
                    <span className={`font-bold text-sm ${t.total_quality_score >= 90 ? "text-green-600" : t.total_quality_score >= 70 ? "text-amber-600" : "text-red-600"}`}>
                      {t.total_quality_score}/100
                    </span>
                  </td>
                  <td className="p-3 text-center text-slate-500 font-mono">{t.correction_count || 0}</td>
                  <td className="p-3 text-slate-500 text-xs">{t.review_date ? new Date(t.review_date).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {paged.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">No reviews found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ReviewerDashboard() {
  const [user, setUser] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [contributors, setContributors] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [reviewed, setReviewed] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedContributor, setSelectedContributor] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("new_work"); // Tabs: new_work, corrections, done

  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    setUser(authUser);

    const { data: assignments } = await supabase
      .from('team_assignments')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('role', 'reviewer')
      .eq('status', 'active')
      .limit(1);

    if (!assignments || assignments.length === 0) {
      setLoading(false);
      return;
    }
    const asgn = assignments[0];
    setAssignment(asgn);

    const { data: pairedAssignments } = await supabase
      .from('team_assignments')
      .select('*')
      .eq('project_id', asgn.project_id)
      .eq('geography', asgn.geography)
      .eq('reviewer_id', authUser.id);

    const contribMap = {};
    pairedAssignments?.forEach(pa => {
      if (pa.role === "contributor" || pa.role === "team_lead") {
        contribMap[pa.user_email] = {
          id: pa.user_email,
          user_id: pa.user_id,
          user_email: pa.user_email,
          user_name: pa.user_name || pa.user_email,
          geography: pa.geography,
          project_type: pa.project_type,
          review_percentage: pa.review_percentage ?? 100,
        };
      }
    });

    const contribEmails = Object.keys(contribMap);

    if (contribEmails.length > 0) {
      const [pendingRes, reviewedRes] = await Promise.all([
        supabase.from('tasks')
          .select('*')
          .eq('project_id', asgn.project_id)
          .eq('geography', asgn.geography)
          .eq('status', 'completed')
          .in('contributor_email', contribEmails),
        supabase.from('tasks')
          .select('*')
          .eq('project_id', asgn.project_id)
          .eq('geography', asgn.geography)
          .eq('status', 'reviewed')
          .in('contributor_email', contribEmails)
          .order('review_date', { ascending: false })
          .limit(1000)
      ]);

      setAllTasks(pendingRes.data || []);
      setReviewed(reviewedRes.data || []);

      [...(pendingRes.data || []), ...(reviewedRes.data || [])].forEach(t => {
        if (t.contributor_email && !contribMap[t.contributor_email]) {
          contribMap[t.contributor_email] = { 
            id: t.contributor_email, 
            user_email: t.contributor_email, 
            user_name: t.contributor_name || t.contributor_email, 
            geography: t.geography, 
            project_type: t.project_type 
          };
        }
      });
    }

    setContributors(Object.values(contribMap));
    setLoading(false);
  }

  // LOGIC: Split tasks for the tabs
  const newWorkTasks = allTasks.filter(t => !t.correction_count || t.correction_count === 0);
  const reSubmissionTasks = allTasks.filter(t => t.correction_count > 0);

  function getContribTasksForDate(email) {
    const contrib = contributors.find(c => c.user_email === email);
    const reviewPct = contrib?.review_percentage ?? 100;
    
    // Select the base list based on active tab
    const baseList = activeTab === "corrections" ? reSubmissionTasks : newWorkTasks;
    
    const tasks = baseList.filter(t => t.contributor_email === email && (!selectedDate || t.date_completed?.split("T")[0] === selectedDate));
    
    if (reviewPct >= 100) return tasks;
    
    const count = Math.max(1, Math.round((reviewPct / 100) * tasks.length));
    const sorted = [...tasks].sort((a, b) => a.id.localeCompare(b.id));
    const step = sorted.length / count;
    return Array.from({ length: count }, (_, i) => sorted[Math.floor(i * step)]);
  }

  function getPendingCountForTab(email, tab) {
    if (tab === "corrections") {
      return reSubmissionTasks.filter(t => t.contributor_email === email).length;
    }
    return newWorkTasks.filter(t => t.contributor_email === email).length;
  }

  async function submitReview(data) {
    setSubmitting(true);
    const newStatus = data.revision_needed ? 'needs_correction' : 'reviewed';
    
    const { error } = await supabase
      .from('tasks')
      .update({
        ...data,
        status: newStatus,
        reviewer_id: user.id,
        reviewer_email: user.email,
        reviewer_name: user.user_metadata?.full_name || user.email,
        review_date: new Date().toISOString()
      })
      .eq('id', selectedTask.id);

    if (error) {
      toast.error("Failed to submit review");
    } else {
      toast.success(data.revision_needed ? "Sent for correction" : "Review complete!");
      setSelectedTask(null);
      await init(); 
    }
    setSubmitting(false);
  }

  function getReviewedForDate(email) {
    return reviewed.filter(t => t.contributor_email === email && (!selectedDate || t.review_date?.split("T")[0] === selectedDate));
  }
  function getAllContribReviewed(email) { return reviewed.filter(t => t.contributor_email === email).length; }

  async function handleDeleteReviewed(ids) {
    const { error } = await supabase.from('tasks').delete().in('id', ids);
    if (!error) {
      setReviewed(prev => prev.filter(t => !ids.includes(t.id)));
      toast.success(`Deleted ${ids.length} review(s)`);
    }
  }

  // STATS
  const today = new Date().toISOString().split("T")[0];
  const weekStart = getWeekStart();
  const todayRev = reviewed.filter(t => t.review_date?.split("T")[0] === today);
  const reviewedToday = todayRev.length;
  const avgScoreToday = todayRev.length ? Math.round(todayRev.reduce((s, t) => s + (t.total_quality_score || 0), 0) / todayRev.length) : 0;
  const correctionsToday = todayRev.filter(t => t.correction_count > 0).length;
  const correctionRateToday = reviewedToday ? Math.round((correctionsToday / reviewedToday) * 100) : 0;
  const weekRev = reviewed.filter(t => t.review_date && new Date(t.review_date) >= weekStart);
  const avgScore = weekRev.length ? Math.round(weekRev.reduce((s, t) => s + (t.total_quality_score || 0), 0) / weekRev.length) : 0;
  const correctionsCount = weekRev.filter(t => t.correction_count > 0).length;
  const correctionRate = weekRev.length ? Math.round((correctionsCount / weekRev.length) * 100) : 0;
  const pendingTotal = allTasks.length;

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!assignment) return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center shadow-sm">
        <h2 className="text-amber-800 font-bold text-lg mb-2">No Reviewer Assignment</h2>
        <p className="text-amber-700 text-sm">Your account is not paired with an active project.</p>
      </div>
    </div>
  );

  if (selectedContributor) {
    return (
      <ReviewerTaskPanel
        selectedContributor={selectedContributor}
        selectedDate={selectedDate}
        contribTasks={getContribTasksForDate(selectedContributor.user_email)}
        alreadyReviewedToday={getReviewedForDate(selectedContributor.user_email)}
        selectedTask={selectedTask}
        setSelectedTask={setSelectedTask}
        onSubmit={submitReview}
        submitting={submitting}
        onBack={() => setSelectedContributor(null)}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-3xl p-8 text-white flex items-center gap-6 shadow-lg shadow-teal-900/20">
        <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner text-3xl">✓</div>
        <div>
          <h1 className="text-3xl font-black tracking-tight">Reviewer Command</h1>
          <p className="text-teal-100 font-medium opacity-90">{assignment?.geography} · {assignment?.project_type} · {pendingTotal} Tasks Pending</p>
        </div>
      </div>

      <ReviewerStatsBar
        pendingTotal={pendingTotal} reviewedToday={reviewedToday} totalReviewed={reviewed.length}
        avgScoreToday={avgScoreToday} avgScore={avgScore} correctionRateToday={correctionRateToday}
        corrections={correctionsCount} correctionRate={correctionRate} contributors={contributors}
      />

      <div className="flex gap-4 border-b border-slate-200 overflow-x-auto scrollbar-hide">
        {[
          { key: "new_work", label: `New Work (${newWorkTasks.length})` },
          { key: "corrections", label: `Re-Submissions (${reSubmissionTasks.length})` },
          { key: "done", label: `History (${reviewed.length})` }
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`pb-3 px-6 text-sm font-bold uppercase tracking-widest transition-all border-b-4 ${
              activeTab === tab.key ? "border-teal-600 text-teal-700" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "done" ? (
        <ReviewerHistoryTable reviewed={reviewed} onDelete={handleDeleteReviewed} />
      ) : (
        <ReviewerContributorList
          contributors={contributors} selectedDate={selectedDate} setSelectedDate={setSelectedDate}
          getContribTasksForDate={getContribTasksForDate} 
          getReviewedForDate={getReviewedForDate}
          getAllContribPending={(email) => getPendingCountForTab(email, activeTab)}
          getAllContribReviewed={getAllContribReviewed}
          onSelect={setSelectedContributor}
        />
      )}
      <Footer />
    </div>
  );
}










// import { useState, useEffect } from "react";
// import { supabase } from "@/api/supabaseClient"; // Swapped from base44
// import { toast } from "sonner";
// import Footer from "@/components/Footer";
// import ReviewerStatsBar from "@/components/reviewer/ReviewerStatsBar";
// import ReviewerContributorList from "@/components/reviewer/ReviewerContributorList";
// import ReviewerTaskPanel from "@/components/reviewer/ReviewerTaskPanel";

// const HISTORY_PAGE = 15;

// // Restored exactly: Week start logic for KPI calculations
// function getWeekStart() {
//   const now = new Date();
//   const day = now.getDay(); 
//   const diff = (day >= 2) ? day - 2 : day + 5;
//   const tuesday = new Date(now);
//   tuesday.setDate(now.getDate() - diff);
//   tuesday.setHours(0, 0, 0, 0);
//   return tuesday;
// }

// // Sub-component: ReviewerHistoryTable logic maintained
// function ReviewerHistoryTable({ reviewed, onDelete }) {
//   const [page, setPage] = useState(0);
//   const [filterDate, setFilterDate] = useState("");
//   const [selected, setSelected] = useState(new Set());
//   const [deleting, setDeleting] = useState(false);

//   const filtered = filterDate
//     ? reviewed.filter(t => t.review_date?.split("T")[0] === filterDate)
//     : reviewed;

//   const totalPages = Math.ceil(filtered.length / HISTORY_PAGE);
//   const paged = filtered.slice(page * HISTORY_PAGE, (page + 1) * HISTORY_PAGE);

//   const toggleSelect = (id) => setSelected(prev => {
//     const next = new Set(prev);
//     next.has(id) ? next.delete(id) : next.add(id);
//     return next;
//   });

//   const toggleAll = () => {
//     if (selected.size === paged.length) setSelected(new Set());
//     else setSelected(new Set(paged.map(t => t.id)));
//   };

//   const handleDelete = async () => {
//     if (!selected.size) return;
//     setDeleting(true);
//     await onDelete([...selected]);
//     setSelected(new Set());
//     setDeleting(false);
//   };

//   return (
//     <div className="space-y-3">
//       <div className="flex items-center gap-3 flex-wrap">
//         <div className="flex items-center gap-2">
//           <span className="text-sm text-slate-600 font-medium">Filter reviews:</span>
//           <input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setPage(0); }}
//             className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-teal-500 outline-none" />
//           {filterDate && <button onClick={() => setFilterDate("")} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>}
//         </div>
//         {selected.size > 0 && (
//           <button onClick={handleDelete} disabled={deleting}
//             className="ml-auto text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 font-semibold disabled:opacity-50">
//             {deleting ? "Deleting..." : `Delete ${selected.size} selected`}
//           </button>
//         )}
//       </div>

//       <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm min-w-[500px]">
//             <thead className="bg-slate-50 border-b border-slate-200">
//               <tr>
//                 <th className="p-3 w-8">
//                   <input type="checkbox" checked={paged.length > 0 && selected.size === paged.length} onChange={toggleAll} className="rounded border-slate-300" />
//                 </th>
//                 <th className="text-left p-3 text-slate-600 font-bold uppercase text-[10px] tracking-wider">URL</th>
//                 <th className="text-left p-3 text-slate-600 font-bold uppercase text-[10px] tracking-wider">Contributor</th>
//                 <th className="text-right p-3 text-slate-600 font-bold uppercase text-[10px] tracking-wider">Score</th>
//                 <th className="text-right p-3 text-slate-600 font-bold uppercase text-[10px] tracking-wider">Corr.</th>
//                 <th className="text-left p-3 text-slate-600 font-bold uppercase text-[10px] tracking-wider">Date</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-slate-100">
//               {paged.map(t => (
//                 <tr key={t.id} className={`hover:bg-slate-50 transition-colors ${selected.has(t.id) ? "bg-red-50/50" : ""}`}>
//                   <td className="p-3">
//                     <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} className="rounded border-slate-300" />
//                   </td>
//                   <td className="p-3 max-w-[160px] truncate">
//                     <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline text-xs font-mono">{t.url}</a>
//                   </td>
//                   <td className="p-3 text-slate-700 text-sm font-medium">{t.contributor_name || "—"}</td>
//                   <td className="p-3 text-right">
//                     <span className={`font-bold text-sm ${t.total_quality_score >= 90 ? "text-green-600" : t.total_quality_score >= 70 ? "text-amber-600" : "text-red-600"}`}>
//                       {t.total_quality_score}/100
//                     </span>
//                   </td>
//                   <td className="p-3 text-center text-slate-500 font-mono">{t.correction_count || 0}</td>
//                   <td className="p-3 text-slate-500 text-xs">{t.review_date ? new Date(t.review_date).toLocaleDateString() : "—"}</td>
//                 </tr>
//               ))}
//               {paged.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">No reviews found.</td></tr>}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default function ReviewerDashboard() {
//   const [user, setUser] = useState(null);
//   const [assignment, setAssignment] = useState(null);
//   const [contributors, setContributors] = useState([]);
//   const [allTasks, setAllTasks] = useState([]);
//   const [reviewed, setReviewed] = useState([]);
//   const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
//   const [selectedContributor, setSelectedContributor] = useState(null);
//   const [selectedTask, setSelectedTask] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [submitting, setSubmitting] = useState(false);
//   const [activeTab, setActiveTab] = useState("queue");

//   useEffect(() => { init(); }, []);

//   async function init() {
//     setLoading(true);
//     const { data: { user: authUser } } = await supabase.auth.getUser();
//     if (!authUser) return;
//     setUser(authUser);

//     // 1. Fetch this Reviewer's own assignment
//     const { data: assignments } = await supabase
//       .from('team_assignments')
//       .select('*')
//       .eq('user_id', authUser.id)
//       .eq('role', 'reviewer')
//       .eq('status', 'active')
//       .limit(1);

//     if (!assignments || assignments.length === 0) {
//       setLoading(false);
//       return;
//     }
//     const asgn = assignments[0];
//     setAssignment(asgn);

//     // 2. Load all contributor assignments paired with this reviewer
//     const { data: pairedAssignments } = await supabase
//       .from('team_assignments')
//       .select('*')
//       .eq('project_id', asgn.project_id)
//       .eq('geography', asgn.geography)
//       .eq('reviewer_id', authUser.id);

//     // 3. Build Contributor Map
//     const contribMap = {};
//     pairedAssignments?.forEach(pa => {
//       if (pa.role === "contributor" || pa.role === "team_lead") {
//         const key = pa.user_email;
//         contribMap[key] = {
//           id: pa.user_email,
//           user_id: pa.user_id,
//           user_email: pa.user_email,
//           user_name: pa.user_name || pa.user_email,
//           geography: pa.geography,
//           project_type: pa.project_type,
//           review_percentage: pa.review_percentage ?? 100,
//         };
//       }
//     });

//     const contribEmails = Object.keys(contribMap);

//     if (contribEmails.length > 0) {
//       // 4. Fetch Tasks for these contributors
//       const [pendingRes, reviewedRes] = await Promise.all([
//         supabase.from('tasks')
//           .select('*')
//           .eq('project_id', asgn.project_id)
//           .eq('geography', asgn.geography)
//           .eq('status', 'completed')
//           .in('contributor_email', contribEmails),
//         supabase.from('tasks')
//           .select('*')
//           .eq('project_id', asgn.project_id)
//           .eq('geography', asgn.geography)
//           .eq('status', 'reviewed')
//           .in('contributor_email', contribEmails)
//           .order('review_date', { ascending: false })
//           .limit(1000)
//       ]);

//       setAllTasks(pendingRes.data || []);
//       setReviewed(reviewedRes.data || []);

//       // 5. Backfill any contributors found in tasks but missing from assignments
//       [...(pendingRes.data || []), ...(reviewedRes.data || [])].forEach(t => {
//         if (t.contributor_email && !contribMap[t.contributor_email]) {
//           contribMap[t.contributor_email] = { 
//             id: t.contributor_email, 
//             user_email: t.contributor_email, 
//             user_name: t.contributor_name || t.contributor_email, 
//             geography: t.geography, 
//             project_type: t.project_type 
//           };
//         }
//       });
//     }

//     setContributors(Object.values(contribMap));
//     setLoading(false);
//   }

//   async function submitReview(data) {
//     setSubmitting(true);
    
//     // Determine the status based on whether a revision is needed
//     const newStatus = data.revision_needed ? 'needs_correction' : 'reviewed';
    
//     const { error } = await supabase
//       .from('tasks')
//       .update({
//         ...data,
//         status: newStatus,
//         reviewer_id: user.id,
//         reviewer_email: user.email,
//         reviewer_name: user.user_metadata?.full_name || user.email,
//         review_date: new Date().toISOString()
//       })
//       .eq('id', selectedTask.id);

//     if (error) {
//       toast.error("Failed to submit review");
//     } else {
//       toast.success(data.revision_needed ? "Sent for correction" : "Review complete!");
//       setSelectedTask(null);
//       await init(); // Refresh all data to keep the queue accurate
//     }
//     setSubmitting(false);
//   }

//   // BUSINESS LOGIC PRESERVED: Deterministic sampling for review percentage
//   function getContribTasksForDate(email) {
//     const contrib = contributors.find(c => c.user_email === email);
//     const reviewPct = contrib?.review_percentage ?? 100;
//     const tasks = allTasks.filter(t => t.contributor_email === email && (!selectedDate || t.date_completed?.split("T")[0] === selectedDate));
    
//     if (reviewPct >= 100) return tasks;
    
//     const count = Math.max(1, Math.round((reviewPct / 100) * tasks.length));
//     const sorted = [...tasks].sort((a, b) => a.id.localeCompare(b.id));
//     const step = sorted.length / count;
//     return Array.from({ length: count }, (_, i) => sorted[Math.floor(i * step)]);
//   }

//   function getReviewedForDate(email) {
//     return reviewed.filter(t => t.contributor_email === email && (!selectedDate || t.review_date?.split("T")[0] === selectedDate));
//   }
//   function getAllContribPending(email) { return allTasks.filter(t => t.contributor_email === email).length; }
//   function getAllContribReviewed(email) { return reviewed.filter(t => t.contributor_email === email).length; }

//   async function handleDeleteReviewed(ids) {
//     const { error } = await supabase.from('tasks').delete().in('id', ids);
//     if (!error) {
//       setReviewed(prev => prev.filter(t => !ids.includes(t.id)));
//       toast.success(`Deleted ${ids.length} review(s)`);
//     }
//   }

//   // STATS CALCULATION Logic preserved exactly
//   const today = new Date().toISOString().split("T")[0];
//   const weekStart = getWeekStart();
//   const todayRev = reviewed.filter(t => t.review_date?.split("T")[0] === today);
//   const reviewedToday = todayRev.length;
//   const avgScoreToday = todayRev.length ? Math.round(todayRev.reduce((s, t) => s + (t.total_quality_score || 0), 0) / todayRev.length) : 0;
//   const correctionsToday = todayRev.filter(t => t.correction_count > 0).length;
//   const correctionRateToday = reviewedToday ? Math.round((correctionsToday / reviewedToday) * 100) : 0;
//   const weekRev = reviewed.filter(t => t.review_date && new Date(t.review_date) >= weekStart);
//   const avgScore = weekRev.length ? Math.round(weekRev.reduce((s, t) => s + (t.total_quality_score || 0), 0) / weekRev.length) : 0;
//   const corrections = weekRev.filter(t => t.correction_count > 0).length;
//   const correctionRate = weekRev.length ? Math.round((corrections / weekRev.length) * 100) : 0;
//   const pendingTotal = allTasks.length;

//   if (loading) return (
//     <div className="flex items-center justify-center h-screen bg-slate-50">
//       <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
//     </div>
//   );

//   if (!assignment) return (
//     <div className="max-w-5xl mx-auto p-8">
//       <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center shadow-sm">
//         <h2 className="text-amber-800 font-bold text-lg mb-2">No Reviewer Assignment</h2>
//         <p className="text-amber-700 text-sm">Your account is not paired with an active project. Contact your administrator to be added to an assignment.</p>
//       </div>
//     </div>
//   );

//   if (selectedContributor) {
//     return (
//       <ReviewerTaskPanel
//         selectedContributor={selectedContributor}
//         selectedDate={selectedDate}
//         contribTasks={getContribTasksForDate(selectedContributor.user_email)}
//         alreadyReviewedToday={getReviewedForDate(selectedContributor.user_email)}
//         selectedTask={selectedTask}
//         setSelectedTask={setSelectedTask}
//         onSubmit={submitReview}
//         submitting={submitting}
//         onBack={() => setSelectedContributor(null)}
//       />
//     );
//   }

//   return (
//     <div className="max-w-6xl mx-auto p-4 space-y-6">
//       <div className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-3xl p-8 text-white flex items-center gap-6 shadow-lg shadow-teal-900/20">
//         <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner text-3xl">✓</div>
//         <div>
//           <h1 className="text-3xl font-black tracking-tight">Reviewer Command</h1>
//           <p className="text-teal-100 font-medium opacity-90">{assignment?.geography} · {assignment?.project_type} · {pendingTotal} Tasks Pending</p>
//         </div>
//       </div>

//       <ReviewerStatsBar
//         pendingTotal={pendingTotal} reviewedToday={reviewedToday} totalReviewed={reviewed.length}
//         avgScoreToday={avgScoreToday} avgScore={avgScore} correctionRateToday={correctionRateToday}
//         corrections={corrections} correctionRate={correctionRate} contributors={contributors}
//       />

//       <div className="flex gap-4 border-b border-slate-200 overflow-x-auto scrollbar-hide">
//         {[
//           { key: "queue", label: `Queue (${pendingTotal})` },
//           { key: "done", label: `History (${reviewed.length})` }
//         ].map(tab => (
//           <button key={tab.key} onClick={() => setActiveTab(tab.key)}
//             className={`pb-3 px-6 text-sm font-bold uppercase tracking-widest transition-all border-b-4 ${
//               activeTab === tab.key ? "border-teal-600 text-teal-700" : "border-transparent text-slate-400 hover:text-slate-600"
//             }`}>
//             {tab.label}
//           </button>
//         ))}
//       </div>

//       {activeTab === "queue" ? (
//         <ReviewerContributorList
//           contributors={contributors} selectedDate={selectedDate} setSelectedDate={setSelectedDate}
//           getContribTasksForDate={getContribTasksForDate} getReviewedForDate={getReviewedForDate}
//           getAllContribPending={getAllContribPending}
//           getAllContribReviewed={getAllContribReviewed}
//           onSelect={setSelectedContributor}
//         />
//       ) : (
//         <ReviewerHistoryTable reviewed={reviewed} onDelete={handleDeleteReviewed} />
//       )}
//       <Footer />
//     </div>
//   );
// }