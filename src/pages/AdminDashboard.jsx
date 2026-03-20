import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, FolderKanban, Users, BarChart2, Clock } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import Footer from "@/components/Footer";
import AdminProjectsTab from "@/components/admin/AdminProjectsTab";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminAssignmentsTab from "@/components/admin/AdminAssignmentsTab";
import AdminChartsTab from "@/components/admin/AdminChartsTab";
import AdminProjectDialog from "@/components/admin/AdminProjectDialog";
import AdminAssignDialog from "@/components/admin/AdminAssignDialog";
import BulkTaskUpload from "@/components/BulkTaskUpload";

const DEFAULT_PROJECT = { name: "", project_type: "hints", description: "", client_name: "", status: "active" };
const DEFAULT_ASSIGNMENT = { project_id: "", project_type: "hints", geography: "", user_email: "", user_name: "", role: "manager", team_lead_email: "", work_percentage: 100 };

export default function AdminDashboard() {
  const [projects, setProjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [geoStates, setGeoStates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [projectDialog, setProjectDialog] = useState(false);
  const [assignDialog, setAssignDialog] = useState(false);
  const [projectForm, setProjectForm] = useState(DEFAULT_PROJECT);
  const [assignForm, setAssignForm] = useState(DEFAULT_ASSIGNMENT);
  const [saving, setSaving] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [projTypeFilter, setProjTypeFilter] = useState("all");
  const [totalTaskCount, setTotalTaskCount] = useState(0);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadContext, setUploadContext] = useState({ id: null, type: "hints" });
  
  const urlParams = new URLSearchParams(window.location.search);
  const defaultTab = urlParams.get("tab") || "projects";

  useEffect(() => { 
    init(); 
  }, []);

  async function init() {
    setLoading(true);
    try {
      const [pRes, aRes, tRes, prRes, gsRes, tCountRes] = await Promise.all([
        supabase.from('projects').select('*'),
        supabase.from('team_assignments').select('*'),
        supabase.from('tasks').select('*').order('created_date', { ascending: false }).limit(500),
        supabase.from('profiles').select('*'),
        supabase.from('project_geography_states').select('*'),
        supabase.from('tasks').select('*', { count: 'exact', head: true })
      ]);

      if (pRes.error) throw pRes.error;
      
      setProjects(pRes.data || []);
      setAssignments(aRes.data || []);
      setTasks(tRes.data || []);
      setProfiles(prRes.data || []);
      setGeoStates(gsRes.data || []);

      // Store the true total count in a new state variable
    setTotalTaskCount(tCountRes.count || 0);
    } catch (err) {
      toast.error("Initialization failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveProject() {
    setSaving(true);
    try {
      if (editingProject) {
        const { error } = await supabase
          .from('projects')
          .update(projectForm)
          .eq('id', editingProject.id);
        if (error) throw error;
        toast.success("Project updated");
      } else {
        const { error } = await supabase
          .from('projects')
          .insert([projectForm]);
        if (error) throw error;
        toast.success("Project created");
      }
      
      setProjectDialog(false);
      setEditingProject(null);
      setProjectForm(DEFAULT_PROJECT);
      
      // Refresh project list
      const { data } = await supabase.from('projects').select('*');
      setProjects(data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(id) {
    // if (!confirm("Delete this project and all its data?")) return;
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      toast.success("Deleted");
      setProjects(p => p.filter(x => x.id !== id));
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function saveAssignment() {
  setSaving(true);
  try {
    let geoStateId = null;

    // 1. Validation: Ensure we have a project and geography
    if (!assignForm.project_id || !assignForm.geography) {
      throw new Error("Project and Geography are required");
    }

    // 2. Auto-register geography in project_geography_states if not present
    const { data: existing } = await supabase
      .from('project_geography_states')
      .select('id')
      .eq('project_id', assignForm.project_id)
      .eq('geography', assignForm.geography)
      .maybeSingle();

    if (existing) {
      geoStateId = existing.id;
    } else {
      const { data: newState, error: geoError } = await supabase
        .from('project_geography_states')
        .insert([{
          project_id: assignForm.project_id,
          geography: assignForm.geography,
          status: "locked" // Default state
        }])
        .select()
        .single();
      
      if (geoError) throw geoError;
      geoStateId = newState.id;
    }

    // 3. LOOKUP UUIDs: Map emails from the form to IDs from the profiles table
    // We search the 'profiles' state you already have loaded in the dashboard
    const selectedUser = profiles.find(p => p.email === assignForm.user_email);
    const selectedLead = profiles.find(p => p.email === assignForm.team_lead_email);

    if (!selectedUser) {
      throw new Error(`Could not find a profile for email: ${assignForm.user_email}`);
    }

    // 4. PREPARE FINAL DATA: Combine form data with looked-up IDs
    const finalAssignmentData = {
      ...assignForm,
      user_id: selectedUser.id,                // The person being assigned
      team_lead_id: selectedLead?.id || null,  // The lead (if applicable)
      geo_state_id: geoStateId,
      status: "active"                         // Ensure it's active for RLS
    };

    // 5. INSERT INTO DATABASE
    const { error: assignError } = await supabase
      .from('team_assignments')
      .insert([finalAssignmentData]);

    if (assignError) throw assignError;

    // SUCCESS: Reset UI and Refresh data
    toast.success("Assignment created successfully");
    setAssignDialog(false);
    setAssignForm(DEFAULT_ASSIGNMENT);
    
    // Refresh Assignments and GeoStates so the UI updates immediately
    const [aNew, gsNew] = await Promise.all([
      supabase.from('team_assignments').select('*'),
      supabase.from('project_geography_states').select('*')
    ]);
    setAssignments(aNew.data || []);
    setGeoStates(gsNew.data || []);

  } catch (err) {
    console.error("Assignment Error:", err);
    toast.error(err.message);
  } finally {
    setSaving(false);
  }
}

  async function deleteAssignment(id) {
    // if (!confirm("Remove this user from the project?")) return;
    
    try {
      // We skip the attrition insert here as per your new logic
      const { error: delError } = await supabase
        .from('team_assignments')
        .delete()
        .eq('id', id);

      if (delError) throw delError;

      toast.success("User removed from project");
      setAssignments(prev => prev.filter(x => x.id !== id));
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function deleteSelectedAssignments(toDelete) {
    // if (!confirm(`Remove ${toDelete.length} users from these projects?`)) return;

    try {
      const idsToDelete = toDelete.map(a => a.id);
      
      const { error: delError } = await supabase
        .from('team_assignments')
        .delete()
        .in('id', idsToDelete);

      if (delError) throw delError;

      toast.success(`${toDelete.length} assignments removed`);
      setAssignments(prev => prev.filter(a => !idsToDelete.includes(a.id)));
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function updateAssignmentManager(assignmentId, newManagerId) {
    try {
      // Find the new manager's email and name from our profiles state
      const newManagerProfile = profiles.find(p => p.id === newManagerId);
      
      if (!newManagerProfile) throw new Error("Selected manager profile not found");

      const { error } = await supabase
        .from('team_assignments')
        .update({ 
          user_id: newManagerId,
          user_email: newManagerProfile.email,
          user_name: newManagerProfile.full_name || newManagerProfile.email
        })
        .eq('id', assignmentId);

      if (error) throw error;

      toast.success("Manager updated successfully");
      
      // Refresh local assignments state
      const { data } = await supabase.from('team_assignments').select('*');
      setAssignments(data || []);
      
    } catch (err) {
      console.error("Update Manager Error:", err);
      // toast.error("Failed to update manager: " + err.message);
      if (err.code === '23505') { 
        toast.error("This person is already assigned to this project in another role.");
      } else {
        // Catch-all for any other unexpected errors
        toast.error("Failed to update manager: " + err.message);
      }
    }
  }

  const handleOpenUpload = (project) => {
  setUploadContext({ id: project.id, type: project.project_type });
  setUploadDialog(true);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white flex items-center gap-4">
        <div className="p-3 bg-white/10 rounded-xl"><Shield className="w-6 h-6 text-white" /></div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Admin Panel</h1>
          <p className="text-slate-400 text-sm mt-0.5">Full system management · {projects.filter(p=>p.status==="active").length} active projects</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard title="Projects" value={projects.length} icon={FolderKanban} color="indigo" subtitle={`${projects.filter(p=>p.status==="active").length} active`} />
        <KpiCard title="Assignments" value={assignments.length} icon={Users} color="green" />
        <KpiCard title="Total Inventory" value={totalTaskCount} icon={BarChart2} color="blue" subtitle="Total URLs uploaded"  />
        <KpiCard title="Active Backlog" value={tasks.filter(t => t.status === "available").length} icon={Clock} color="amber" subtitle="Awaiting Contribution" />
        <KpiCard title="Profiles" value={profiles.length} icon={Users} color="slate" subtitle={`${profiles.filter(p=>p.synced).length} synced`} />
      </div>

      <Tabs defaultValue={defaultTab}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="bg-slate-100 flex w-max min-w-full">
            <TabsTrigger value="projects" className="whitespace-nowrap">Projects</TabsTrigger>
            <TabsTrigger value="users" className="whitespace-nowrap">User Management</TabsTrigger>
            <TabsTrigger value="assignments" className="whitespace-nowrap">Assignments</TabsTrigger>
            <TabsTrigger value="charts" className="whitespace-nowrap">Charts</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="projects" className="mt-4">
          <AdminProjectsTab
            projects={projects} tasks={tasks} assignments={assignments} geoStates={geoStates}
            projTypeFilter={projTypeFilter} setProjTypeFilter={setProjTypeFilter}
            onNew={() => { setEditingProject(null); setProjectForm(DEFAULT_PROJECT); setProjectDialog(true); }}
            onEdit={(p) => { setEditingProject(p); setProjectForm({ name: p.name, project_type: p.project_type, description: p.description||"", client_name: p.client_name||"", status: p.status }); setProjectDialog(true); }}
            onDelete={deleteProject}
            onUpload={handleOpenUpload}
          />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <AdminUsersTab
            profiles={profiles}
            onRefresh={async () => {
              const { data } = await supabase.from('profiles').select('*');
              setProfiles(data || []);
            }}
          />
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <AdminAssignmentsTab
            assignments={assignments} projects={projects} profiles={profiles}
            onAdd={() => { setAssignForm(DEFAULT_ASSIGNMENT); setAssignDialog(true); }}
            onDelete={deleteAssignment}
            onDeleteSelected={deleteSelectedAssignments}
            onUpdateManager={updateAssignmentManager}
          />
        </TabsContent>

        <TabsContent value="charts" className="mt-4">
          <AdminChartsTab tasks={tasks} projects={projects} />
        </TabsContent>
      </Tabs>

      <AdminProjectDialog
        open={projectDialog} onOpenChange={setProjectDialog}
        form={projectForm} setForm={setProjectForm}
        onSave={saveProject} saving={saving} editingProject={editingProject}
      />

      <AdminAssignDialog
        open={assignDialog} onOpenChange={setAssignDialog}
        form={assignForm} setForm={setAssignForm}
        projects={projects} profiles={profiles} assignments={assignments} onSave={saveAssignment} saving={saving}
      />

      {/* NEW: Bulk Task Upload Dialog */}
      <BulkTaskUpload 
        open={uploadDialog}
        onClose={() => setUploadDialog(false)}
        projectId={uploadContext.id}
        projectType={uploadContext.type}
        onSuccess={init} // Refresh stats/KPIs after a successful upload
      />

      <Footer />
    </div>
  );
}










// import { useState, useEffect } from "react";
// import { supabase } from "@/api/supabaseClient"; // Swapped base44 with supabase
// import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
// import { toast } from "sonner";
// import { Shield, FolderKanban, Users, BarChart2 } from "lucide-react";
// import KpiCard from "@/components/KpiCard";
// import Footer from "@/components/Footer";
// import AdminProjectsTab from "@/components/admin/AdminProjectsTab";
// import AdminUsersTab from "@/components/admin/AdminUsersTab";
// import AdminAssignmentsTab from "@/components/admin/AdminAssignmentsTab";
// import AdminChartsTab from "@/components/admin/AdminChartsTab";
// import AdminProjectDialog from "@/components/admin/AdminProjectDialog";
// import AdminAssignDialog from "@/components/admin/AdminAssignDialog";

// const DEFAULT_PROJECT = { name: "", project_type: "hints", description: "", client_name: "", status: "active" };
// const DEFAULT_ASSIGNMENT = { project_id: "", project_type: "hints", geography: "", user_email: "", user_name: "", role: "manager", team_lead_email: "", work_percentage: 100 };

// export default function AdminDashboard() {
//   const [projects, setProjects] = useState([]);
//   const [assignments, setAssignments] = useState([]);
//   const [profiles, setProfiles] = useState([]);
//   const [tasks, setTasks] = useState([]);
//   const [loading, setLoading] = useState(true);

//   const [projectDialog, setProjectDialog] = useState(false);
//   const [assignDialog, setAssignDialog] = useState(false);
//   const [projectForm, setProjectForm] = useState(DEFAULT_PROJECT);
//   const [assignForm, setAssignForm] = useState(DEFAULT_ASSIGNMENT);
//   const [saving, setSaving] = useState(false);
//   const [editingProject, setEditingProject] = useState(null);
//   const [projTypeFilter, setProjTypeFilter] = useState("all");
//   const urlParams = new URLSearchParams(window.location.search);
//   const defaultTab = urlParams.get("tab") || "projects";

 
//   async function init() {
//   try {
//     const [
//       { data: p }, 
//       { data: a }, 
//       { data: t }, 
//       { data: pr }
//     ] = await Promise.all([
//       supabase.from('projects').select('*').order('name'),
//       supabase.from('team_assignments').select('*'),
//       supabase.from('tasks').select('*').order('created_date', { ascending: false }).limit(500),
//       supabase.from('profiles').select('*')
//     ]);

//     setProjects(p || []);
//     setAssignments(a || []);
//     setTasks(t || []);
//     setProfiles(pr || []);
//   } catch (err) {
//     console.error("Init Error:", err.message);
//   } finally {
//     // Only update loading state once at the very end
//     setLoading(false);
//   }
// }

// // 3. Simple effect call
// useEffect(() => {
//   init();
//   // No cleanup needed if we aren't using isMounted
// }, []);

//   async function saveProject() {
//   setSaving(true);
//   try {
//     let error;
    
//     if (editingProject) {
//       const { error: updateError } = await supabase
//         .from('projects')
//         .update(projectForm)
//         .eq('id', editingProject.id);
//       error = updateError;
//     } else {
//       const { error: insertError } = await supabase
//         .from('projects')
//         .insert([projectForm]);
//       error = insertError;
//     }

//     if (error) {
//       console.error("Database Error:", error);
//       toast.error(`Failed to save: ${error.message}`);
//       setSaving(false);
//       return; // Stop here if the insert/update failed
//     }

//     toast.success(editingProject ? "Project updated" : "Project created");

//     // Refresh list with explicit ascending order
//     const { data, error: fetchError } = await supabase
//       .from('projects')
//       .select('*')
//       .order('name', { ascending: true });

//     if (fetchError) throw fetchError;

//     setProjects(data || []);
//     setProjectDialog(false); 
//     setEditingProject(null); 
//     setProjectForm(DEFAULT_PROJECT);

//   } catch (err) {
//     console.error("System Error:", err.message);
//     toast.error("An unexpected error occurred.");
//   } finally {
//     setSaving(false);
//   }
// }

//   async function deleteProject(id) {
//     if (!confirm("Delete this project and all its data?")) return;
//     const { error } = await supabase.from('projects').delete().eq('id', id);
//     if (!error) {
//       toast.success("Deleted");
//       setProjects(p => p.filter(x => x.id !== id));
//     }
//   }

//   async function saveAssignment() {
//     setSaving(true);
//     const { error } = await supabase.from('team_assignments').insert([assignForm]);
//     if (!error) {
//       toast.success("Assignment created");
//       const { data } = await supabase.from('team_assignments').select('*');
//       setAssignments(data || []);
//       setAssignDialog(false); 
//       setAssignForm(DEFAULT_ASSIGNMENT);
//     }
//     setSaving(false);
//   }

//   async function deleteAssignment(id, a) {
//     // 1. Record Attrition in Supabase
//     await supabase.from('attrition').insert([{
//       email: a.user_email,
//       full_name: a.user_name,
//       role: a.role,
//       geography: a.geography,
//       project_id: a.project_id,
//       date_of_attrition: new Date().toISOString(),
//     }]);

//     // 2. Delete the Assignment
//     const { error } = await supabase.from('team_assignments').delete().eq('id', id);
//     if (!error) {
//       toast.success("Removed & attrition recorded");
//       setAssignments(prev => prev.filter(x => x.id !== id));
//     }
//   }

//   async function deleteSelectedAssignments(toDelete) {
//     // Map objects to attrition records
//     const attritionData = toDelete.map(a => ({
//       email: a.user_email,
//       full_name: a.user_name,
//       role: a.role,
//       geography: a.geography,
//       project_id: a.project_id,
//       date_of_attrition: new Date().toISOString(),
//     }));

//     // Bulk insert into attrition and bulk delete from assignments
//     await supabase.from('attrition').insert(attritionData);
//     const { error } = await supabase.from('team_assignments').delete().in('id', toDelete.map(d => d.id));

//     if (!error) {
//       toast.success(`${toDelete.length} assignments removed`);
//       setAssignments(prev => prev.filter(a => !toDelete.find(d => d.id === a.id)));
//     }
//   }

//   if (loading) return (
//     <div className="flex items-center justify-center h-64">
//       <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
//     </div>
//   );

//   return (
//     <div className="max-w-7xl mx-auto p-6 space-y-6">
//       {/* Hero header - Unchanged Style */}
//       <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white flex items-center gap-4">
//         <div className="p-3 bg-white/10 rounded-xl"><Shield className="w-6 h-6 text-white" /></div>
//         <div>
//           <h1 className="text-2xl font-extrabold tracking-tight">Admin Panel</h1>
//           <p className="text-slate-400 text-sm mt-0.5">Full system management · {projects.filter(p=>p.status==="active").length} active projects</p>
//         </div>
//       </div>

//       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//         <KpiCard title="Projects" value={projects.length} icon={FolderKanban} color="indigo" subtitle={`${projects.filter(p=>p.status==="active").length} active`} />
//         <KpiCard title="Assignments" value={assignments.length} icon={Users} color="green" />
//         <KpiCard title="Total URLs" value={tasks.length} icon={BarChart2} color="amber" subtitle={`${tasks.filter(t=>["completed","reviewed"].includes(t.status)).length} completed`} />
//         <KpiCard title="Profiles" value={profiles.length} icon={Users} color="slate" subtitle={`${profiles.filter(p=>p.synced).length} synced`} />
//       </div>

//       <Tabs defaultValue={defaultTab}>
//         <div className="overflow-x-auto -mx-1 px-1">
//           <TabsList className="bg-slate-100 flex w-max min-w-full">
//             <TabsTrigger value="projects" className="whitespace-nowrap">Projects</TabsTrigger>
//             <TabsTrigger value="users" className="whitespace-nowrap">User Management</TabsTrigger>
//             <TabsTrigger value="assignments" className="whitespace-nowrap">Assignments</TabsTrigger>
//             <TabsTrigger value="charts" className="whitespace-nowrap">Charts</TabsTrigger>
//           </TabsList>
//         </div>

//         <TabsContent value="projects" className="mt-4">
//           <AdminProjectsTab
//             projects={projects} tasks={tasks} assignments={assignments}
//             projTypeFilter={projTypeFilter} setProjTypeFilter={setProjTypeFilter}
//             onNew={() => { setEditingProject(null); setProjectForm(DEFAULT_PROJECT); setProjectDialog(true); }}
//             onEdit={(p) => { setEditingProject(p); setProjectForm({ name: p.name, project_type: p.project_type, description: p.description||"", client_name: p.client_name||"", status: p.status }); setProjectDialog(true); }}
//             onDelete={deleteProject}
//           />
//         </TabsContent>

//         <TabsContent value="users" className="mt-4">
//           <AdminUsersTab
//             profiles={profiles}
//             onRefresh={async () => {
//               const { data } = await supabase.from('profiles').select('*');
//               setProfiles(data || []);
//             }}
//           />
//         </TabsContent>

//         <TabsContent value="assignments" className="mt-4">
//           <AdminAssignmentsTab
//             assignments={assignments} projects={projects}
//             onAdd={() => { setAssignForm(DEFAULT_ASSIGNMENT); setAssignDialog(true); }}
//             onDelete={deleteAssignment}
//             onDeleteSelected={deleteSelectedAssignments}
//           />
//         </TabsContent>

//         <TabsContent value="charts" className="mt-4">
//           <AdminChartsTab tasks={tasks} projects={projects} />
//         </TabsContent>
//       </Tabs>

//       <AdminProjectDialog
//         open={projectDialog} onOpenChange={setProjectDialog}
//         form={projectForm} setForm={setProjectForm}
//         onSave={saveProject} saving={saving} editingProject={editingProject}
//       />

//       <AdminAssignDialog
//         open={assignDialog} onOpenChange={setAssignDialog}
//         form={assignForm} setForm={setAssignForm}
//         projects={projects} profiles={profiles} assignments={assignments} onSave={saveAssignment} saving={saving}
//       />

//       <Footer />
//     </div>
//   );
// }