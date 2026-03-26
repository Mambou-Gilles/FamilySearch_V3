import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom"; // Added for URL sync
import { supabase } from "@/api/supabaseClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BarChart2, Users, AlertTriangle, Calendar, TrendingUp, Upload, Download } from "lucide-react";
import Footer from "@/components/Footer";
import KpiCard from "@/components/KpiCard";
import BulkTaskUpload from "@/components/BulkTaskUpload";
import BulkProfileUpload from "@/components/BulkProfileUpload";
import { ManagerExportModal } from "@/components/ExportCsvModal";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import TeamPerformanceTab from "@/components/manager/TeamPerformanceTab";
import ManagerUserTab from "@/components/manager/ManagerUserTab";
import ManagerChartsTab from "@/components/manager/ManagerChartsTab";
import ManagerEscalationsTab from "@/components/manager/ManagerEscalationsTab";
import ManagerAssignDialog from "@/components/manager/ManagerAssignDialog";
import ManagerAssignmentsTab from "@/components/manager/ManagerAssignmentsTab.jsx";
import GeographyControlPanel from "@/components/manager/GeographyControlPanel";
import ReviewerPairingTab from "@/components/manager/ReviewerPairingTab";
import ManagerInsightsPanel from "@/components/manager/ManagerInsightsPanel";

const DEFAULT_ASSIGN = { user_email: "", user_name: "", role: "contributor", reviewer_email: "", team_lead_email: "", work_percentage: 100 };

function dateInRange(dateStr, from, to) {
  if (!dateStr) return false;
  const d = dateStr.split("T")[0];
  return d >= from && d <= to;
}

export default function ManagerDashboard() {
  const location = useLocation(); // Listen to URL changes
  const navigate = useNavigate(); // To update URL when clicking tabs manually
  
  const [user, setUser] = useState(null);
  const [myAssignment, setMyAssignment] = useState(null);
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignDialog, setAssignDialog] = useState(false);
  const [editingAssign, setEditingAssign] = useState(null);
  const [assignForm, setAssignForm] = useState(DEFAULT_ASSIGN);
  const [savingAssign, setSavingAssign] = useState(false);
  const [bulkTaskOpen, setBulkTaskOpen] = useState(false);
  const [bulkProfileOpen, setBulkProfileOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState(new Set());

  // --- TAB SYNC LOGIC ---
  const [activeTab, setActiveTab] = useState(new URLSearchParams(location.search).get("tab") || "team");

  useEffect(() => {
      const channel = supabase
        .channel('schema-db-changes')
        .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'profiles' }, 
          () => onRefresh() // Trigger a re-fetch whenever a profile changes
        )
        .subscribe()
  
      return () => supabase.removeChannel(channel)
    }, [])

  // Update internal state when URL changes (e.g., clicking Sidebar)
  useEffect(() => {
    const tabFromUrl = new URLSearchParams(location.search).get("tab") || "team";
    setActiveTab(tabFromUrl);
  }, [location.search]);

  // Update URL when clicking tabs manually inside the page
  const handleTabChange = (value) => {
    setActiveTab(value);
    navigate(`?tab=${value}`, { replace: true });
  };
  // ----------------------

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);

  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { setLoading(false); return; }
    setUser(authUser);

    const { data: myAssigns, error: assignError } = await supabase
      .from('team_assignments')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('role', 'manager')
      .eq('status', 'active');

    if (assignError || !myAssigns?.length) { setLoading(false); return; }
    
    const asgn = myAssigns[0];
    setMyAssignment(asgn);
    const projectId = asgn.project_id;
    const geography = asgn.geography;

    const [projRes, taskRes, assignRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('tasks').select('*').eq('project_id', projectId).order('date_completed', { ascending: false }).limit(2000),
      supabase.from('team_assignments').select('*').eq('project_id', projectId).eq('geography', geography)
    ]);

    setProject(projRes.data || null);
    setTasks(taskRes.data || []);
    setAssignments(assignRes.data || []);

    const teamEmails = (assignRes.data || []).map(x => x.user_email).filter(Boolean);
    if (teamEmails.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('*')
        .in('email', teamEmails)
        .eq('status', 'active');
      setProfiles(profs || []);
    }
    setLoading(false);
  }

  const geography = myAssignment?.geography;
  const projectId = myAssignment?.project_id;

  const rangedTasks = tasks.filter(t => dateInRange(t.date_completed, dateFrom, dateTo));
  const allCompleted = tasks.filter(t => ["completed","in_review","needs_correction","reviewed"].includes(t.status));
  const rangedCompleted = rangedTasks.filter(t => ["completed","in_review","needs_correction","reviewed"].includes(t.status));
  const reviewedInRange = tasks.filter(t => t.status === "reviewed" && t.review_date && dateInRange(t.review_date, dateFrom, dateTo));
  const avgScore = reviewedInRange.length ? Math.round(reviewedInRange.reduce((s, t) => s + (t.total_quality_score || 0), 0) / reviewedInRange.length) : 0;
  const escalations = tasks.filter(t => t.hint_result?.includes("Escalation") || t.duplicate_result?.includes("Escalate") || t.tree_work_review?.includes("Escalation") || t.tree_work_review?.includes("FS Needed"));

  const contributors = assignments.filter(a => a.role === "contributor");
  const reviewers = assignments.filter(a => a.role === "reviewer");

  function getContribStats(email) {
    const ct = rangedTasks.filter(t => t.contributor_email === email);
    const done = ct.filter(t => ["completed","in_review","needs_correction","reviewed"].includes(t.status));
    const rev = ct.filter(t => t.status === "reviewed");
    const corr = ct.filter(t => (t.correction_count || 0) > 0);
    const avgQ = rev.length ? Math.round(rev.reduce((s, t) => s + (t.total_quality_score || 0), 0) / rev.length) : null;
    const errorRate = rev.length ? Math.round((corr.length / rev.length) * 100) : null;
    const correctedTasks = rev.filter(t => t.correction_count > 0);
    const qualAfterCorrection = correctedTasks.length ? Math.round(correctedTasks.reduce((s, t) => s + (t.total_quality_score || 0), 0) / correctedTasks.length) : null;
    return { completed: done.length, reviewed: rev.length, corrections: corr.length, avgQ, errorRate, qualAfterCorrection };
  }

  function getReviewerStats(email) {
  // Get all tasks this reviewer has finalized in the date range
  const rev = tasks.filter(t => 
    t.reviewer_email === email && 
    t.status === "reviewed" && 
    t.review_date && 
    dateInRange(t.review_date, dateFrom, dateTo)
  );

  // How many of the tasks they reviewed actually had errors?
  const flaggedForCorrection = rev.filter(t => (t.correction_count || 0) > 0);

  // Reviewer Accuracy % 
  // (Tasks they passed as "Clean" / Total Tasks they Reviewed)
  const accuracy = rev.length 
    ? Math.round(((rev.length - flaggedForCorrection.length) / rev.length) * 100) 
    : null;

  return { 
    reviewed: rev.length, 
    correctionsFound: flaggedForCorrection.length,
    accuracy 
  };
}

  // function getReviewerStats(email) {
  //   const rev = tasks.filter(t => t.reviewer_email === email && t.status === "reviewed" && t.review_date && dateInRange(t.review_date, dateFrom, dateTo));
  //   return { reviewed: rev.length };
  // }

  async function saveAssignment() {
    setSavingAssign(true);
    try {
      if (editingAssign) {
        const { error } = await supabase.from('team_assignments').update(assignForm).eq('id', editingAssign.id);
        if (error) throw error;
        toast.success("Updated");
      } else {
        const { error } = await supabase.rpc('admin_add_user_to_team', {
          p_email: assignForm.user_email,
          p_full_name: assignForm.user_name,
          p_role: assignForm.role,
          p_project_id: projectId,
          p_project_type: project?.project_type?.toLowerCase(),
          p_geography: geography
        });
        if (error) throw error;
        toast.success("Added");
      }
      setAssignDialog(false); 
      setEditingAssign(null); 
      setAssignForm(DEFAULT_ASSIGN);
      const { data: newAsgns } = await supabase.from('team_assignments').select('*').eq('project_id', projectId).eq('geography', geography);
      setAssignments(newAsgns || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingAssign(false);
    }
  }

  // async function deleteAssignment(id, a) {
  //   try {
  //     await supabase.from('attrition').insert({ email: a.user_email, full_name: a.user_name, role: a.role, geography: a.geography, project_id: a.project_id, date_of_attrition: new Date().toISOString() });
  //     const { error } = await supabase.from('team_assignments').delete().eq('id', id);
  //     if (error) throw error;
  //     setAssignments(prev => prev.filter(x => x.id !== id));
  //     setSelectedUsers(prev => { const n = new Set(prev); n.delete(id); return n; });
  //     toast.success("Removed");
  //   } catch (err) {
  //     toast.error(err.message);
  //   }
  // }

  async function deleteAssignment(id, a) {
    const profile = profiles.find(p => p.email === a.user_email);
    if (!profile) {
      toast.error("Could not find profile.");
      return;
    }

    if (!confirm(`Move ${a.user_name} to attrition?`)) return;

    try {
      const { error } = await supabase.rpc('admin_attrite_user', {
        p_profile_id: profile.id,
        p_email: a.user_email,
        p_full_name: a.user_name,
        p_role: a.role,
        p_byu_id: profile.byu_pathway_id || null, // Ensure this is sent
        p_cohort: profile.cohort || "",
        p_geography: a.geography,
        p_project_id: a.project_id,
        p_project_type: project?.project_type,
        p_deleted_by: user.email,
        p_notes: "Removed via Manager Dashboard"
      });

      if (error) throw error;

      toast.success("User moved to attrition.");
      // Refresh local lists
      setAssignments(prev => prev.filter(x => x.id !== id));
      setProfiles(prev => prev.filter(p => p.email !== a.user_email));
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function deleteSelectedUsers() {
    if (!selectedUsers.size) return;
    if (!confirm(`Move ${selectedUsers.size} selected users to attrition history?`)) return;

    const toAttrite = assignments.filter(a => selectedUsers.has(a.id));
    
    try {
      const promises = toAttrite.map(a => {
        const p = profiles.find(prof => prof.email === a.user_email);
        return supabase.rpc('admin_attrite_user', {
          p_profile_id: p?.id,
          p_email: a.user_email,
          p_full_name: a.user_name,
          p_role: a.role,
          p_cohort: p?.cohort || "",
          p_geography: a.geography,
          p_project_id: a.project_id,
          p_project_type: project?.project_type?.toLowerCase(),
          p_deleted_by: user.email,
          p_notes: "Bulk Attrition"
        });
      });

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) throw new Error(`${errors.length} updates failed.`);

      toast.success(`${selectedUsers.size} users moved to attrition.`);
      
      // Refresh data
      setSelectedUsers(new Set());
      const { data: newAsgns } = await supabase.from('team_assignments').select('*').eq('project_id', projectId).eq('geography', geography);
      setAssignments(newAsgns || []);
      // Re-run the refresh logic to update profiles too
      onRefresh(); 

    } catch (err) {
      toast.error(err.message);
    }
  }

  async function fetchAssignments() {
  if (!projectId || !geography) return;
  const { data, error } = await supabase
    .from('team_assignments')
    .select('*')
    .eq('project_id', projectId)
    .eq('geography', geography);
    
  if (error) {
    toast.error("Error refreshing assignments: " + error.message);
  } else {
    setAssignments(data || []);
  }
}

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {!myAssignment && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          No manager assignment found for your account.
        </div>
      )}

      <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-2xl p-6 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-xl"><BarChart2 className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Manager Dashboard</h1>
            <p className="text-indigo-200 text-sm mt-0.5">{project?.name} · {geography} · {project?.project_type}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setExportOpen(true)} className="bg-white/20 hover:bg-white/30 text-white border-white/30 border">
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => setBulkTaskOpen(true)} className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold">
            <Upload className="w-4 h-4 mr-1" /> Upload Tasks
          </Button>
        </div>
      </div>

      <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Total URLs" value={tasks.length} icon={BarChart2} color="indigo" />
        <KpiCard title="Completed (range)" value={rangedCompleted.length} icon={TrendingUp} color="green" subtitle={`${tasks.length ? Math.round(allCompleted.length / tasks.length * 100) : 0}% overall`} />
        <KpiCard title="Avg Quality Score" value={`${avgScore}/100`} icon={BarChart2} color={avgScore >= 90 ? "green" : "amber"} subtitle="In date range" />
        <KpiCard title="Escalations" value={escalations.length} icon={AlertTriangle} color="red" />
      </div>

      {/* MODIFIED TABS COMPONENT */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="flex w-max min-w-full">
            <TabsTrigger value="team">Team Performance</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="assignments">Assignments ({assignments.length})</TabsTrigger>
            <TabsTrigger value="reviewer-pairing">Reviewer Pairing</TabsTrigger>
            <TabsTrigger value="geography">Geography Control</TabsTrigger>
            <TabsTrigger value="overview">Charts</TabsTrigger>
            <TabsTrigger value="escalations">Escalations ({escalations.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="team" className="mt-4">
          <TeamPerformanceTab
            contributors={contributors} reviewers={reviewers}
            rangedTasks={rangedTasks} getContribStats={getContribStats} getReviewerStats={getReviewerStats}
            selectedUsers={selectedUsers} setSelectedUsers={setSelectedUsers}
            onAdd={() => { setEditingAssign(null); setAssignForm(DEFAULT_ASSIGN); setAssignDialog(true); }}
            onEdit={(a) => { setEditingAssign(a); setAssignForm({ user_email: a.user_email, user_name: a.user_name, role: a.role, reviewer_email: a.reviewer_email||"", team_lead_email: a.team_lead_email||"", work_percentage: a.work_percentage||100 }); setAssignDialog(true); }}
            onDelete={deleteAssignment}
            onDeleteSelected={deleteSelectedUsers}
            setBulkProfileOpen={setBulkProfileOpen}
          />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <ManagerUserTab
            profiles={profiles}
            assignments={assignments}
            myAssignment={myAssignment}
            setBulkProfileOpen={setBulkProfileOpen}
            onRefreshProfiles={async () => {
              // 1. Fetch assignments first to get the list of relevant emails
              const { data: asgnData } = await supabase
                .from('team_assignments')
                .select('*')
                .eq('project_id', projectId)
                .eq('geography', geography);

              const emails = asgnData?.map(a => a.user_email) || [];

              // 2. Only fetch profiles that match those emails
              const { data: profData } = await supabase
                .from('profiles')
                .select('*')
                .in('email', emails)
                .eq('status', 'active');

              setAssignments(asgnData || []);
              setProfiles(profData || []);
            }}
          />
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <ManagerAssignmentsTab
            assignments={assignments}
            myAssignment={myAssignment}
            onAdd={() => { setEditingAssign(null); setAssignForm(DEFAULT_ASSIGN); setAssignDialog(true); }}
            onEdit={(a) => { setEditingAssign(a); setAssignForm({ user_email: a.user_email, user_name: a.user_name, role: a.role, reviewer_email: a.reviewer_email||"", team_lead_email: a.team_lead_email||"", work_percentage: a.work_percentage||100 }); setAssignDialog(true); }}
            onDelete={deleteAssignment}
            onRefresh={fetchAssignments}
          />
        </TabsContent>

        <TabsContent value="reviewer-pairing" className="mt-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <ReviewerPairingTab
              assignments={assignments}
              myAssignment={myAssignment}
              onRefresh={async () => {
                const { data } = await supabase.from('team_assignments').select('*').eq('project_id', projectId).eq('geography', geography);
                setAssignments(data || []);
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="geography" className="mt-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <GeographyControlPanel project={project} myAssignment={myAssignment} tasks={tasks} />
          </div>
        </TabsContent>

        <TabsContent value="overview" className="mt-4">
          <div className="space-y-5">
            <ManagerInsightsPanel tasks={tasks} contributors={contributors} getContribStats={getContribStats} />
            <ManagerChartsTab tasks={tasks} contributors={contributors} getContribStats={getContribStats} />
          </div>
        </TabsContent>

        <TabsContent value="escalations" className="mt-4">
          <ManagerEscalationsTab escalations={escalations} />
        </TabsContent>
      </Tabs>

      {/* Modals & Dialogs */}
      {bulkTaskOpen && (
        <BulkTaskUpload open={bulkTaskOpen} onClose={() => setBulkTaskOpen(false)} projectId={projectId} projectType={project?.project_type || "hints"} cohort=""
          onSuccess={async () => { 
            const { data } = await supabase
              .from('tasks')
              .select('*')
              .eq('project_id', projectId) 
              .order('date_completed', { ascending: false })
              .limit(2000);
            setTasks(data || []);
          }} />
      )}
      {bulkProfileOpen && (
        <BulkProfileUpload
          open={bulkProfileOpen}
          onClose={() => setBulkProfileOpen(false)}
          myAssignment={myAssignment}
          project={project}
          onSuccess={async () => {
            const [profRes, asgnRes] = await Promise.all([
              supabase.from('profiles').select('*'),
              supabase.from('team_assignments').select('*').eq('project_id', projectId).eq('geography', geography)
            ]);
            const teamEmails = (asgnRes.data || []).map(x => x.user_email).filter(Boolean);
            setProfiles((profRes.data || []).filter(p => teamEmails.includes(p.email)));
            setAssignments(asgnRes.data || []);
          }}
        />
      )}
      <ManagerExportModal open={exportOpen} onClose={() => setExportOpen(false)} tasks={tasks} projectName={project?.name} dateFrom={dateFrom} dateTo={dateTo} />
      <ManagerAssignDialog open={assignDialog} onOpenChange={setAssignDialog} form={assignForm} setForm={setAssignForm} editingAssign={editingAssign} onSave={saveAssignment} saving={savingAssign} />

      <Footer />
    </div>
  );
}

