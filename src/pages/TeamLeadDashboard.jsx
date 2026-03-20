import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Users, TrendingUp, AlertTriangle, Star } from "lucide-react";
import Footer from "@/components/Footer";
import KpiCard from "@/components/KpiCard";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import TeamLeadContributorsTab from "@/components/teamlead/TeamLeadContributorsTab";
import TeamLeadChartsTab from "@/components/teamlead/TeamLeadChartsTab";
import TeamLeadAnalyticsTab from "@/components/teamlead/TeamLeadAnalyticsTab";
import TeamManagementTab from "@/components/teamlead/TeamManagementTab";
import EditUserModal from "@/components/teamlead/EditUserModal";
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

function dateInRange(dateStr, from, to) {
  if (!dateStr) return false;
  const d = dateStr.split("T")[0];
  return d >= from && d <= to;
}

export default function TeamLeadDashboard() {
  const [user, setUser] = useState(null);
  const [myAssignment, setMyAssignment] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Alert States
  const [editingUser, setEditingUser] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [confirmStatusUpdate, setConfirmStatusUpdate] = useState(null); // { email, status }

  const urlParams = new URLSearchParams(window.location.search);
  const defaultTab = urlParams.get("tab") || "contributors";

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);

  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      setLoading(false);
      return;
    }
    setUser(authUser);

    const { data: myAssigns } = await supabase
      .from('team_assignments')
      .select('*')
      .eq('user_email', authUser.email)
      .eq('role', 'team_lead')
      .eq('status', 'active');

    if (!myAssigns?.length) { 
      setLoading(false); 
      return; 
    }
    
    const asgn = myAssigns[0];
    setMyAssignment(asgn);

    const [allAssignsRes, tasksRes] = await Promise.all([
      supabase
        .from('team_assignments')
        .select('*, daily_target')
        .eq('project_id', asgn.project_id)
        .eq('geography', asgn.geography),
      supabase
        .from('tasks')
        .select('*')
        .eq('project_id', asgn.project_id)
        .eq('geography', asgn.geography)
        .order('date_completed', { ascending: false, nullsFirst: false })
        .limit(1000)
    ]);

    const myTeam = (allAssignsRes.data || []).filter(a =>
      a.user_email !== authUser.email &&
      (a.role === "contributor" || a.role === "reviewer") &&
      a.team_lead_email === authUser.email
    );

    setAssignments(myTeam); 
    setTasks(tasksRes.data || []);
    setLoading(false);
  }

  // --- Logic Handlers ---

  async function executeStatusUpdate() {
    if (!confirmStatusUpdate) return;
    const { email, status } = confirmStatusUpdate;
    const loadingToast = toast.loading(`Updating ${email}...`);
    
    try {
      const { data, error } = await supabase
        .from('team_assignments')
        .update({ status })
        .eq('user_email', email)
        .eq('team_lead_email', user.email)
        .select();

      if (error) throw error;
      
      setAssignments(prev => prev.map(a => 
        a.user_email === email ? { ...a, status } : a
      ));
      toast.success(`User is now ${status}`, { id: loadingToast });
    } catch (err) {
      toast.error(`Error: ${err.message}`, { id: loadingToast });
    } finally {
      setConfirmStatusUpdate(null);
    }
  }

  async function handleUpdateUserInfo(oldEmail, updatedData) {
    const loadingToast = toast.loading("Updating member information...");
    try {
      const { error } = await supabase
        .from('team_assignments')
        .update({
          user_name: updatedData.user_name,
          user_email: updatedData.user_email
        })
        .eq('user_email', oldEmail)
        .eq('team_lead_email', user.email);

      if (error) throw error;

      setAssignments(prev => prev.map(a => 
        a.user_email === oldEmail ? { ...a, ...updatedData } : a
      ));
      toast.success("Member updated successfully", { id: loadingToast });
    } catch (err) {
      toast.error(err.message, { id: loadingToast });
    }
  }

  // --- Calculations ---

  const rangedTasks = tasks.filter(t => dateInRange(t.date_completed, dateFrom, dateTo));
  const completed = rangedTasks.filter(t => ["completed","in_review","needs_correction","reviewed"].includes(t.status));
  const reviewed = tasks.filter(t => t.status === "reviewed" && t.review_date && dateInRange(t.review_date, dateFrom, dateTo));
  const needsCorrection = tasks.filter(t => t.status === "needs_correction");
  const avgScore = reviewed.length ? Math.round(reviewed.reduce((s, t) => s + (t.total_quality_score || 0), 0) / reviewed.length) : 0;

  const activeAssignments = assignments.filter(a => a.status === 'active');
  const contributors = activeAssignments.filter(a => a.role === "contributor");
  const reviewers = activeAssignments.filter(a => a.role === "reviewer");

  function getContribStats(email) {
    const ct = rangedTasks.filter(t => t.contributor_email === email);
    const done = ct.filter(t => ["completed","in_review","needs_correction","reviewed"].includes(t.status));
    const rev = ct.filter(t => t.status === "reviewed");
    const corr = ct.filter(t => (t.correction_count || 0) > 0);
    const avgQ = rev.length ? Math.round(rev.reduce((s, t) => s + (t.total_quality_score || 0), 0) / rev.length) : null;
    const errorRate = rev.length ? Math.round((corr.length / rev.length) * 100) : null;
    return { completed: done.length, reviewed: rev.length, corrections: corr.length, avgQ, errorRate };
  }

  function getReviewerStats(email) {
    const rev = tasks.filter(t => 
      t.reviewer_email === email && t.status === "reviewed" && t.review_date && dateInRange(t.review_date, dateFrom, dateTo)
    );
    const flagged = rev.filter(t => (t.correction_count || 0) > 0);
    const accuracy = rev.length ? Math.round(((rev.length - flagged.length) / rev.length) * 100) : null;
    return { reviewed: rev.length, correctionsFound: flagged.length, accuracy };
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-2xl p-6 text-white flex items-center gap-4 shadow-xl">
        <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md"><Users className="w-6 h-6 text-white" /></div>
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Team Lead Hub</h1>
          <p className="text-indigo-100 text-xs font-medium tracking-wide opacity-80 uppercase">
            {myAssignment?.geography} · {myAssignment?.project_type} · {activeAssignments.length} Active Members
          </p>
        </div>
      </div>

      <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Active Squad" value={activeAssignments.length} icon={Users} color="indigo" />
        <KpiCard title="Completed (range)" value={completed.length} icon={TrendingUp} color="green" />
        <KpiCard title="Needs Correction" value={needsCorrection.length} icon={AlertTriangle} color="amber" />
        <KpiCard title="Avg Quality Score" value={`${avgScore}/100`} icon={Star} color={avgScore >= 90 ? "green" : "red"} />
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="contributors" className="rounded-lg px-6 font-bold">Performance</TabsTrigger>
          <TabsTrigger value="management" className="rounded-lg px-6 font-bold">Management</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-lg px-6 font-bold">Analytics</TabsTrigger>
          <TabsTrigger value="charts" className="rounded-lg px-6 font-bold">Charts</TabsTrigger>
        </TabsList>

        <TabsContent value="management" className="mt-6">
          <TeamManagementTab 
            contributors={assignments.filter(a => a.role === 'contributor')} 
            reviewers={assignments.filter(a => a.role === 'reviewer')} 
            tasks={tasks}
            onUpdateStatus={(email, status) => setConfirmStatusUpdate({ email, status })}
            onEditUser={(u) => { setEditingUser(u); setIsEditModalOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="contributors" className="mt-6">
          <TeamLeadContributorsTab
            allMembers={activeAssignments} contributors={contributors} reviewers={reviewers}
            getContribStats={getContribStats} getReviewerStats={getReviewerStats}
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <TeamLeadAnalyticsTab tasks={tasks} contributors={activeAssignments} getContribStats={getContribStats} getReviewerStats={getReviewerStats} />
        </TabsContent>

        <TabsContent value="charts" className="mt-6">
          <TeamLeadChartsTab tasks={tasks} contributors={activeAssignments} getContribStats={getContribStats} />
        </TabsContent>
      </Tabs>

      {/* --- Modals & Overlays --- */}
      <EditUserModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        user={editingUser} 
        onSave={handleUpdateUserInfo} 
      />

      <AlertDialog open={!!confirmStatusUpdate} onOpenChange={() => setConfirmStatusUpdate(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-tight">Confirm Status Change</AlertDialogTitle>
            <AlertDialogDescription className="font-medium">
              Are you sure you want to change the status of <b>{confirmStatusUpdate?.email}</b> to <b>{confirmStatusUpdate?.status}</b>? 
              This will affect their access to the dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeStatusUpdate}
              className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold"
            >
              Confirm Update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
}










// import { useState, useEffect } from "react";

// import { supabase } from "@/api/supabaseClient";

// import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// import { toast } from "sonner";

// import { Users, TrendingUp, AlertTriangle, Star } from "lucide-react";

// import Footer from "@/components/Footer";

// import KpiCard from "@/components/KpiCard";

// import DateRangeFilter from "@/components/shared/DateRangeFilter";

// import TeamLeadContributorsTab from "@/components/teamlead/TeamLeadContributorsTab";

// import TeamLeadChartsTab from "@/components/teamlead/TeamLeadChartsTab";

// import TeamLeadAnalyticsTab from "@/components/teamlead/TeamLeadAnalyticsTab";



// function dateInRange(dateStr, from, to) {

//   if (!dateStr) return false;

//   const d = dateStr.split("T")[0];

//   return d >= from && d <= to;

// }



// export default function TeamLeadDashboard() {

//   const [user, setUser] = useState(null);

//   const [myAssignment, setMyAssignment] = useState(null);

//   const [assignments, setAssignments] = useState([]);

//   const [tasks, setTasks] = useState([]);

//   const [loading, setLoading] = useState(true);

//   const urlParams = new URLSearchParams(window.location.search);

//   const defaultTab = urlParams.get("tab") || "contributors";



//   const today = new Date().toISOString().split("T")[0];

//   const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString().split("T")[0];

//   const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);

//   const [dateTo, setDateTo] = useState(today);



//   useEffect(() => { init(); }, []);



//   async function init() {

//     setLoading(true);

   

//     const { data: { user: authUser } } = await supabase.auth.getUser();

//     if (!authUser) {

//       setLoading(false);

//       return;

//     }

//     setUser(authUser);



//     // Get the Team Lead's own active assignment

//     const { data: myAssigns } = await supabase

//       .from('team_assignments')

//       .select('*')

//       .eq('user_email', authUser.email)

//       .eq('role', 'team_lead')

//       .eq('status', 'active');



//     if (!myAssigns?.length) {

//       setLoading(false);

//       return;

//     }

   

//     const asgn = myAssigns[0];

//     setMyAssignment(asgn);



//     // Parallel fetch: All assignments for this project/geo AND the most recent 1000 tasks

//     const [allAssignsRes, tasksRes] = await Promise.all([

//       supabase

//         .from('team_assignments')

//         .select('*')

//         .eq('project_id', asgn.project_id)

//         .eq('geography', asgn.geography),

//       supabase

//         .from('tasks')

//         .select('*')

//         .eq('project_id', asgn.project_id)

//         .eq('geography', asgn.geography)

//         .order('date_completed', { ascending: false, nullsFirst: false })

//         .limit(1000)

//     ]);



//     // Only include team members explicitly assigned under this team lead

//     const myTeam = (allAssignsRes.data || []).filter(a =>

//       a.user_email !== authUser.email &&

//       (a.role === "contributor" || a.role === "reviewer") &&

//       a.team_lead_email === authUser.email

//     );



//     setAssignments(myTeam);

//     setTasks(tasksRes.data || []);

//     setLoading(false);

//   }



//   const rangedTasks = tasks.filter(t => dateInRange(t.date_completed, dateFrom, dateTo));

//   const completed = rangedTasks.filter(t => ["completed","in_review","needs_correction","reviewed"].includes(t.status));

//   const reviewed = tasks.filter(t => t.status === "reviewed" && t.review_date && dateInRange(t.review_date, dateFrom, dateTo));

//   const needsCorrection = tasks.filter(t => t.status === "needs_correction");

//   const avgScore = reviewed.length ? Math.round(reviewed.reduce((s, t) => s + (t.total_quality_score || 0), 0) / reviewed.length) : 0;



//   const contributors = assignments.filter(a => a.role === "contributor");

//   const reviewers = assignments.filter(a => a.role === "reviewer");



//   function getContribStats(email) {

//     const ct = rangedTasks.filter(t => t.contributor_email === email);

//     const done = ct.filter(t => ["completed","in_review","needs_correction","reviewed"].includes(t.status));

//     const rev = ct.filter(t => t.status === "reviewed");

//     const corr = ct.filter(t => (t.correction_count || 0) > 0);

//     const avgQ = rev.length ? Math.round(rev.reduce((s, t) => s + (t.total_quality_score || 0), 0) / rev.length) : null;

//     const errorRate = rev.length ? Math.round((corr.length / rev.length) * 100) : null;

//     const correctedTasks = rev.filter(t => t.correction_count > 0);

//     const qualAfterCorrection = correctedTasks.length ? Math.round(correctedTasks.reduce((s, t) => s + (t.total_quality_score || 0), 0) / correctedTasks.length) : null;

//     return { completed: done.length, reviewed: rev.length, corrections: corr.length, avgQ, errorRate, qualAfterCorrection };

//   }



//   function getReviewerStats(email) {

//     const rev = tasks.filter(t => t.reviewer_email === email && t.status === "reviewed" && t.review_date && dateInRange(t.review_date, dateFrom, dateTo));

//     return { reviewed: rev.length };

//   }



//   if (loading) return (

//     <div className="flex items-center justify-center h-64">

//       <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />

//     </div>

//   );



//   return (

//     <div className="max-w-6xl mx-auto p-6 space-y-6">

//       {!myAssignment && (

//         <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">

//           No team lead assignment found for your account.

//         </div>

//       )}

     

//       <div className="bg-gradient-to-br from-violet-600 to-violet-900 rounded-2xl p-6 text-white flex items-center gap-4">

//         <div className="p-3 bg-white/10 rounded-xl"><Users className="w-6 h-6 text-white" /></div>

//         <div>

//           <h1 className="text-2xl font-extrabold tracking-tight">Team Lead Dashboard</h1>

//           <p className="text-violet-200 text-sm mt-0.5">{myAssignment?.geography} · {myAssignment?.project_type} · {contributors.length} contributors</p>

//         </div>

//       </div>



//       <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} />



//       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

//         <KpiCard title="My Students" value={assignments.length} icon={Users} color="indigo" />

//         <KpiCard title="Completed (range)" value={completed.length} icon={TrendingUp} color="green" />

//         <KpiCard title="Needs Correction" value={needsCorrection.length} icon={AlertTriangle} color="amber" />

//         <KpiCard title="Avg Quality Score" value={`${avgScore}/100`} icon={Star} color={avgScore >= 90 ? "green" : "red"} subtitle="Reviewed in range" />

//       </div>



//       <Tabs defaultValue={defaultTab}>

//         <TabsList>

//           <TabsTrigger value="contributors">My Students ({assignments.length})</TabsTrigger>

//           <TabsTrigger value="analytics">Analytics</TabsTrigger>

//           <TabsTrigger value="charts">Charts</TabsTrigger>

//         </TabsList>



//         <TabsContent value="contributors" className="mt-4">

//           <TeamLeadContributorsTab

//             allMembers={assignments} contributors={contributors} reviewers={reviewers}

//             getContribStats={getContribStats} getReviewerStats={getReviewerStats}

//           />

//         </TabsContent>



//         <TabsContent value="analytics" className="mt-4">

//           <TeamLeadAnalyticsTab tasks={tasks} contributors={assignments} getContribStats={getContribStats} getReviewerStats={getReviewerStats} />

//         </TabsContent>



//         <TabsContent value="charts" className="mt-4">

//           <TeamLeadChartsTab tasks={tasks} contributors={assignments} getContribStats={getContribStats} />

//         </TabsContent>

//       </Tabs>

//       <Footer />

//     </div>

//   );

// }