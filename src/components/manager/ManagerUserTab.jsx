import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Upload, RefreshCw, Edit2, UserPlus, Trash2, 
  UserMinus, Search, AlertTriangle, CheckCircle2, XCircle, Clock
} from "lucide-react";
import { supabase } from "@/api/supabaseClient"; 
import { toast } from "sonner";
import TablePagination from "@/components/shared/TablePagination";
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

const PAGE_SIZE = 15;
const EMPTY_USER = { full_name: "", email: "", system_role: "contributor", status: "active", cohort: "" };

export default function ManagerUserTab({ profiles = [], assignments = [], setBulkProfileOpen, onRefreshProfiles, myAssignment }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(0);
  
  // Filters
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog & Form States
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const [attritionOpen, setAttritionOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [targetForm, setTargetForm] = useState({ profile: null, value: "" });
  const [attritionData, setAttritionData] = useState({ targets: [], reason: "", loading: false });
  const [deleteData, setDeleteData] = useState({ ids: [], title: "", desc: "" });
  const [processing, setProcessing] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  const [bulkTarget, setBulkTarget] = useState("");
  const [savingBulk, setSavingBulk] = useState(false);

  // Derive Cohorts for Filter
  const cohorts = [...new Set(profiles.map(p => p.cohort).filter(Boolean))].sort();
  // 1. First, strictly limit profiles to ONLY those that have an assignment in THIS project
  // const projectAssignments = assignments.filter(a => a.project_id === myAssignment?.project_id);
  // const projectUserEmails = new Set(projectAssignments.map(a => a.user_email));
  const projectEmails = new Set(assignments.map(a => a.user_email));

  // Enriched Data for Table Logic
  const enriched = profiles
    .filter(p => projectEmails.has(p.email))// Safeguard: If they aren't assigned, don't show them
    .filter(p => p.status === 'active') 
    .map(p => {
      const assign = assignments.find(a => a.user_email === p.email);
      return { 
        ...p, 
        daily_target_assignment: assign?.daily_target, 
        assignment_id: assign?.id,
        geography: assign?.geography 
      };
    });

    // 3. Apply your UI filters (Search, Role, Status) on top of the project-specific list
  const filtered = enriched.filter(p => {
    if (roleFilter !== "all" && p.system_role !== roleFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    
    // Updated Sync Filters
    if (syncFilter === "synced" && !p.synced) return false;
    if (syncFilter === "not_synced" && p.synced) return false;
    if (syncFilter === "pending" && (!p.synced || p.last_login)) return false; // Invited but no login
    if (syncFilter === "confirmed" && !p.last_login) return false; // Has logged in
    
    if (cohortFilter !== "all" && p.cohort !== cohortFilter) return false;
    const search = searchQuery.toLowerCase();
    if (search && !p.full_name?.toLowerCase().includes(search) && !p.email?.toLowerCase().includes(search)) return false;
    return true;
  });

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // --- Handlers ---
  const toggleAll = (checked) => setSelectedIds(checked ? new Set(paged.map(p => p.id)) : new Set());
  const toggleOne = (id) => setSelectedIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  // --- Updated Handlers to match Admin Dashboard Logic ---

  async function handleSyncSelected() {
    const toSync = filtered.filter(p => selectedIds.has(p.id) && !p.synced);
    if (!toSync.length) return;

    setSyncing(true);
    try {
      // 1. Get current session for Authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Session expired. Please log in again.");
        return;
      }

      for (const user of toSync) {
        const { error } = await supabase.functions.invoke("invite-user", {
          body: {
            email: user.email.toLowerCase(),
            full_name: user.full_name,
            role: user.system_role,
            // We pass profileId so the Edge Function knows which row to update
            profileId: user.id 
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (error) {
          console.error(`Sync failed for ${user.email}:`, error);
          toast.error(`Failed to sync ${user.email}`);
          continue;
        }
      }

      toast.success("Sync process completed.");
      onRefreshProfiles();
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Sync Error:", err);
      toast.error("Unexpected error during sync.");
    } finally {
      setSyncing(false);
    }
  }

  // Refreshing statuses also uses the same Edge Function (to check Auth state)
  async function handleRefreshStatuses() {
    const syncedUsers = profiles.filter(p => p.synced);
    if (!syncedUsers.length) return;

    setSyncing(true);
    const toastId = toast.loading("Updating login statuses...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      for (const user of syncedUsers) {
        await supabase.functions.invoke('invite-user', {
          body: { 
            email: user.email.toLowerCase(), 
            profileId: user.id, 
            full_name: user.full_name, 
            role: user.system_role 
          },
          headers: {
            Authorization: `Bearer ${session?.access_token}`
          }
        });
      }
      toast.success("Statuses refreshed");
    } catch (err) {
      toast.error("Status refresh failed");
    } finally {
      toast.dismiss(toastId);
      setSyncing(false);
      onRefreshProfiles();
    }
  }

  // Nudge function (Resend Invite)
  async function handleNudge(user) {
    setSyncing(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    const { error } = await supabase.functions.invoke('invite-user', {
      body: { 
        email: user.email.toLowerCase(), 
        profileId: user.id, 
        full_name: user.full_name, 
        role: user.system_role 
      },
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      }
    });
    
    if (!error) toast.success(`Reminder sent to ${user.email}`);
    else toast.error("Failed to send reminder");
    
    setSyncing(false);
    onRefreshProfiles();
  }

  async function handleSaveUser() {
    setProcessing(true);
    try {
      if (userForm.id) {
        // 1. Update existing user using your 'admin_and_manager_update_user' RPC
        const { error } = await supabase.rpc('admin_and_manager_update_user', {
          p_user_id: userForm.id,
          p_full_name: userForm.full_name || "",
          p_role: userForm.system_role,
          p_status: userForm.status.toLowerCase(),
          p_cohort: userForm.cohort || "",
          p_byu_id: userForm.byu_pathway_id || "", // Ensure this is in your update RPC too!
          p_email: userForm.email
        });
        if (error) throw error;

      } else {
        // 2. Create NEW user using the 'admin_add_user_to_team' RPC
        const { error } = await supabase.rpc('admin_add_user_to_team', {
          p_email: userForm.email.toLowerCase().trim(),
          p_full_name: userForm.full_name,
          p_role: userForm.system_role,
          p_project_id: myAssignment.project_id,
          p_geography: userForm.geography || myAssignment.geography,
          p_project_type: myAssignment.project_type,
          p_cohort: userForm.cohort || "",
          p_byu_id: userForm.byu_pathway_id || "" // Passing the new ID here
        });
        if (error) throw error;
      }

      toast.success("User synchronized successfully");
      setEditUserOpen(false);
      setAddUserOpen(false);
      onRefreshProfiles(); 

    } catch (err) { 
      console.error("Save Error:", err);
      toast.error(err.message); 
    } finally { 
      setProcessing(false); 
    }
  }

  async function handleUpdateTarget() {
    if (!targetForm.profile?.assignment_id) return;
    setProcessing(true);
    const { error } = await supabase.from('team_assignments')
      .update({ daily_target: Number(targetForm.value) })
      .eq('id', targetForm.profile.assignment_id);
    
    if (!error) {
      toast.success("Target updated");
      setTargetDialogOpen(false);
      onRefreshProfiles();
    }
    setProcessing(false);
  }


  async function handleConfirmAttrition() {
    if (!attritionData.reason.trim()) {
      toast.error("Please provide a reason.");
      return;
    }

    setAttritionData(prev => ({ ...prev, loading: true }));
    
    try {
      // This RPC handles: 1. Moving to attrition table 2. Deleting assignment 3. Setting profile to inactive
      const attritionPromises = attritionData.targets.map(p => 
        supabase.rpc('admin_attrite_user', {
          p_profile_id: p.id,
          p_email: p.email,
          p_full_name: p.full_name,
          p_role: p.system_role,
          p_cohort: p.cohort || "",
          p_geography: p.geography || myAssignment?.geography,
          p_project_id: myAssignment?.project_id,
          p_project_type: myAssignment?.project_type,
          p_deleted_by: myAssignment?.user_email,
          p_notes: attritionData.reason
        })
      );

      await Promise.all(attritionPromises);

      toast.success(`${attritionData.targets.length} user(s) moved to attrition history.`);
      
      setAttritionOpen(false);
      setSelectedIds(new Set());
      onRefreshProfiles(); // This triggers the parent to re-fetch, and our new filter above will hide them.
      
    } catch (err) {
      console.error("Attrition Error:", err);
      toast.error(`Attrition failed: ${err.message}`);
    } finally {
      setAttritionData(prev => ({ ...prev, loading: false }));
    }
  }

  async function handlePermanentDelete() {
    const idsToDelete = [...deleteData.ids];
    if (idsToDelete.length === 0) return;

    const targetUser = enriched.find(p => p.id === idsToDelete[0]);
    const expectedMatch = idsToDelete.length === 1 
      ? targetUser?.full_name 
      : `${idsToDelete.length} USERS`;

    if (deleteConfirmInput.trim().toLowerCase() !== expectedMatch?.toLowerCase()) {
      toast.error(`Confirmation mismatch. Please type: ${expectedMatch}`);
      return;
    }

    setProcessing(true);
    try {
      // 1. Delete assignments first
      await supabase.from('team_assignments').delete().in('user_id', idsToDelete);

      // 2. Delete from profiles AND check the count
      const { error, count } = await supabase
        .from('profiles')
        .delete({ count: 'exact' }) // This tells us if anything actually happened
        .in('id', idsToDelete);

      if (error) throw error;

      if (count === 0) {
        throw new Error("Delete failed: You may not have database permission to remove these records.");
      }

      toast.success(`${count} record(s) permanently purged.`);
      
      setDeleteDialogOpen(false);
      setDeleteConfirmInput("");
      setSelectedIds(new Set());
      onRefreshProfiles();

    } catch (err) {
      console.error("Purge Error:", err);
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  }

  // --- Date Formatter ---
  const formatLoginDate = (dateStr) => {
        if (!dateStr) return <span className="text-[10px] text-slate-300 italic">No activity yet</span>;
        const d = new Date(dateStr);
        return (
          <div className="flex flex-col leading-tight">
            <span className="text-slate-700 font-medium">{d.toLocaleDateString()}</span>
            <span className="text-[10px] text-indigo-500 font-medium">
              Active at {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit'})}
            </span>
          </div>
        );
      };

    async function saveBulkTarget() {
      if (!bulkTarget || isNaN(bulkTarget)) return;
      
      setSavingBulk(true);
      try {
        // Get all contributors from your profiles list
        const contributorEmails = profiles
          .filter(p => p.system_role === 'contributor')
          .map(p => p.email);

        if (contributorEmails.length === 0) {
          toast.error("No contributors found in this project.");
          return;
        }

        // 2. Perform the update in team_assignments table
        const { error } = await supabase
          .from('team_assignments')
          .update({ daily_target: Number(bulkTarget) })
          .eq('project_id', myAssignment?.project_id)
          .in('user_email', contributorEmails);

        if (error) throw error;

        toast.success(`Target set to ${bulkTarget} for ${contributorEmails.length} contributors`);
        setBulkTarget("");
        onRefreshProfiles();
      } catch (err) {
        console.error("Bulk Target Error:", err);
        toast.error("Failed to apply bulk target");
      } finally {
        setSavingBulk(false);
      }
    }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">User Management</h3>
          <p className="text-[11px] text-slate-500 font-medium">{profiles.length} total profiles available</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleRefreshStatuses} disabled={syncing} variant="outline" className="border-slate-200 text-slate-600">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} /> 
            Refresh Status
          </Button>
          {selectedIds.size > 0 && (
            <Button size="sm" onClick={handleSyncSelected} disabled={syncing} className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} /> Sync ({filtered.filter(p => selectedIds.has(p.id) && !p.synced).length})
            </Button>
          )}
          <Button size="sm" onClick={() => { setUserForm(EMPTY_USER); setAddUserOpen(true); }} variant="outline" className="border-slate-200"><UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add User</Button>
          <Button size="sm" onClick={() => setBulkProfileOpen(true)} variant="outline" className="border-slate-200"><Upload className="w-3.5 h-3.5 mr-1.5" /> Bulk CSV</Button>
        </div>
      </div>

      {/* Search, Bulk Target, and Filters Row */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        
        {/* 1. Search Bar - Reduced Width */}
        <div className="relative w-full max-w-xs">
          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Find User</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Name or email..." 
              value={searchQuery} 
              onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm h-10" 
            />
          </div>
        </div>

        {/* 2. Bulk Target Setter (Contributors Only) */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-1.5 px-3 flex gap-3 items-center shadow-sm h-10 flex-1 min-w-[300px]">
          <div className="flex flex-col border-r border-slate-200 pr-3">
            <span className="text-[9px] font-bold text-indigo-600 uppercase leading-none">Bulk Contributor</span>
            <span className="text-[9px] text-slate-400 font-medium italic">Target</span>
          </div>
          
          <input 
            type="number" 
            value={bulkTarget} 
            onChange={e => setBulkTarget(e.target.value)} 
            placeholder="0" 
            className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white w-16 h-7 outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
          />
          
          <Button 
            size="sm" 
            onClick={saveBulkTarget} 
            disabled={savingBulk || !bulkTarget} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-7 px-3 text-[11px] font-bold rounded-lg"
          >
            {savingBulk ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Apply"}
          </Button>
        </div>

        {/* 3. Filters - Compact Row */}
        <div className="flex items-center gap-2 flex-wrap">
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="h-10 text-[12px] border-slate-200 rounded-xl px-3 bg-white shadow-sm outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Roles</option>
            <option value="contributor">Contributor</option>
            <option value="reviewer">Reviewer</option>
            <option value="team_lead">Team Lead</option>
          </select>

          <select value={syncFilter} onChange={e => setSyncFilter(e.target.value)} className="h-10 text-[12px] border-slate-200 rounded-xl px-3 bg-white text-indigo-600 font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">Auth (All)</option>
            <option value="not_synced">Not Invited</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
          </select>

          <select value={cohortFilter} onChange={e => setCohortFilter(e.target.value)} className="h-10 text-[12px] border-slate-200 rounded-xl px-3 bg-white shadow-sm outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Cohorts</option>
            {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Bulk Action Strip */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 shadow-sm animate-in fade-in">
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">{selectedIds.size} Selected</span>
          <Button size="sm" onClick={() => {
            setAttritionData({ targets: filtered.filter(p => selectedIds.has(p.id)), reason: "", loading: false });
            setAttritionOpen(true);
          }} className="bg-amber-600 hover:bg-amber-700 text-white h-8"><UserMinus className="w-3.5 h-3.5 mr-1.5" /> Bulk Attrite</Button>
          
          <Button size="sm" variant="ghost" onClick={() => {
            setDeleteData({ ids: Array.from(selectedIds), title: `Delete ${selectedIds.size} Users`, desc: "This permanently removes profiles and work assignments. Action is irreversible." });
            setDeleteDialogOpen(true);
          }} className="text-red-600 hover:bg-red-50 h-8 font-bold"><Trash2 className="w-3.5 h-3.5 mr-1.5" /> Bulk Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-slate-400 h-8 ml-auto">Cancel</Button>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-4 w-10"><Checkbox checked={paged.length > 0 && paged.every(p => selectedIds.has(p.id))} onCheckedChange={toggleAll} /></th>
                <th className="p-4">User Details</th>
                <th className="p-4">Role / Status</th>
                <th className="p-4 text-center">Synced</th>
                <th className="p-4"><div className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> Last Login</div></th>
                <th className="p-4">Target</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map(p => (
                <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors ${selectedIds.has(p.id) ? 'bg-indigo-50/40' : ''}`}>
                  <td className="p-4"><Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleOne(p.id)} /></td>
                  <td className="p-4">
                    <div className="font-bold text-slate-900 leading-tight">{p.full_name}</div>
                    <div className="text-[11px] text-slate-400 font-medium">{p.email}</div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] text-indigo-500 font-mono font-bold uppercase">
                        {p.cohort || "No Cohort"}
                      </span>
                      {p.byu_pathway_id && (
                        <span className="text-[10px] text-slate-400 font-mono italic">
                          • ID: {p.byu_pathway_id}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 items-start">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">{p.system_role}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${p.status === 'active' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700'}`}>
                        {p.status}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    {p.status === 'attrited' ? (
                      <div className="flex flex-col items-center">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-bold uppercase">Attrited</span>
                        <button 
                          onClick={() => {
                            setUserForm(p); 
                            setEditUserOpen(true); 
                          }} 
                          className="text-[8px] text-indigo-600 hover:underline mt-1 font-bold"
                        >
                          Restore?
                        </button>
                      </div>
                    ) : !p.synced ? (
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Unsynced</span>
                        <button onClick={() => handleNudge(p)} className="text-[8px] text-indigo-600 hover:underline mt-1 font-bold">Invite</button>
                      </div>
                    ) : !p.last_login ? (
                      <div className="flex flex-col items-center">
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-bold uppercase animate-pulse">Pending</span>
                        <button onClick={() => handleNudge(p)} className="text-[8px] text-amber-600 hover:underline mt-1 font-bold">Resend?</button>
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-[9px] font-bold uppercase">Confirmed</span>
                    )}
                  </td>
                  <td className="p-4">
                    {formatLoginDate(p.last_login)}
                  </td>
                  <td className="p-4">
                    <button onClick={() => { setTargetForm({ profile: p, value: p.daily_target_assignment || "0" }); setTargetDialogOpen(true); }} className="hover:text-indigo-600 flex items-center gap-1.5 font-mono group">
                      {p.daily_target_assignment ?? "0"} <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setUserForm(p); setEditUserOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Edit Profile">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setAttritionData({ targets: [p], reason: "", loading: false }); setAttritionOpen(true); }} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Attrite User">
                        <UserMinus className="w-4 h-4" />
                      </button>
                      <button onClick={() => { 
                        setDeleteData({ ids: [p.id], title: "Permanent Delete", desc: `Are you sure you want to completely purge ${p.full_name}?` });
                        setDeleteDialogOpen(true);
                      }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Purge Record">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} total={totalPages} onPage={setPage} count={filtered.length} size={PAGE_SIZE} />
      </div>

      {/* --- Modals & Dialogs --- */}
      
      {/* Edit/Add Profile */}
      <Dialog open={addUserOpen || editUserOpen} onOpenChange={(v) => { setAddUserOpen(v); setEditUserOpen(v); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{userForm.id ? "Update Profile" : "Create New User"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Full Name</label>
              <input type="text" value={userForm.full_name} onChange={e => setUserForm({...userForm, full_name: e.target.value})} className="w-full text-sm border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {!userForm.id && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Email Address</label>
                <input type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className="w-full text-sm border p-2.5 rounded-xl" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">System Role</label>
                <select value={userForm.system_role} onChange={e => setUserForm({...userForm, system_role: e.target.value})} className="w-full text-sm border p-2.5 rounded-xl bg-white">
                  <option value="contributor">Contributor</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="team_lead">Team Lead</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Status</label>
                <select value={userForm.status} onChange={e => setUserForm({...userForm, status: e.target.value})} className="w-full text-sm border p-2.5 rounded-xl bg-white">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            {/* Cohort & BYU ID Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cohort</label>
                <input 
                  type="text" 
                  value={userForm.cohort || ""} 
                  onChange={e => setUserForm({...userForm, cohort: e.target.value})} 
                  className="w-full text-sm border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" 
                  placeholder="e.g. March 2026" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">BYU ID</label>
                <input 
                  type="text" 
                  value={userForm.byu_pathway_id || ""} 
                  onChange={e => setUserForm({...userForm, byu_pathway_id: e.target.value})} 
                  className="w-full text-sm border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                  placeholder="00000000" 
                />
              </div>
            </div>
            <Button onClick={handleSaveUser} disabled={processing} className="w-full bg-indigo-600 text-white font-bold h-11 rounded-xl shadow-lg shadow-indigo-100">
              {processing ? "Processing..." : userForm.id ? "Update User" : "Register User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Target Setting */}
      <Dialog open={targetDialogOpen} onOpenChange={setTargetDialogOpen}>
        <DialogContent className="max-w-[280px]">
          <DialogHeader><DialogTitle className="text-sm">Daily Performance Target</DialogTitle></DialogHeader>
          <div className="flex gap-2 items-center pt-2">
            <input type="number" value={targetForm.value} onChange={e => setTargetForm({...targetForm, value: e.target.value})} className="w-full border p-2.5 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" autoFocus />
            <Button onClick={handleUpdateTarget} disabled={processing} className="bg-indigo-600 text-white font-bold">Set</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attrition Workflow */}
      <Dialog open={attritionOpen} onOpenChange={setAttritionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-amber-600 flex items-center gap-2 font-bold tracking-tight"><UserMinus className="w-5 h-5" /> Attrition Logging</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-500 font-medium italic">This will log {attritionData.targets.length} user(s) into the attrition history and remove active project access.</p>
            <textarea value={attritionData.reason} onChange={e => setAttritionData({...attritionData, reason: e.target.value})} placeholder="Reason for leaving (e.g., Performance, Career move)..." className="w-full border p-3 rounded-xl text-sm min-h-[100px] outline-none focus:ring-2 focus:ring-amber-500" />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAttritionOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleConfirmAttrition} disabled={attritionData.loading || !attritionData.reason.trim()} className="bg-amber-600 text-white font-bold rounded-xl shadow-md shadow-amber-100">Confirm</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permanent Purge AlertDialog with Safety Check */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setDeleteConfirmInput("");
      }}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <AlertTriangle className="w-6 h-6" />
              <AlertDialogTitle className="text-lg font-bold">{deleteData.title}</AlertDialogTitle>
            </div>
            <div className="text-slate-600 font-medium space-y-3">
              <p>{deleteData.desc}</p>
              
              <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                <p className="text-[11px] text-red-700 font-bold uppercase mb-2">
                  To confirm, type: <span className="underline decoration-red-400">
                    {deleteData.ids.length === 1 
                      ? enriched.find(p => p.id === deleteData.ids[0])?.full_name 
                      : `${deleteData.ids.length} USERS`}
                  </span>
                </p>
                <input 
                  type="text" 
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  placeholder="Type exactly as shown..."
                  className="w-full p-2.5 border border-red-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-red-500 outline-none bg-white text-slate-900"
                />
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex gap-2">
            <AlertDialogCancel className="bg-slate-100 border-none rounded-xl m-0">Cancel</AlertDialogCancel>
            {/* Using standard Button here instead of AlertDialogAction for reliability */}
            <Button 
              onClick={handlePermanentDelete} 
              disabled={processing || !deleteConfirmInput.trim()}
              className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-100 disabled:opacity-50"
            >
              {processing ? "Purging..." : "Confirm Purge"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}









// import { useState, useEffect } from "react";
// import { Button } from "@/components/ui/button";
// import { Checkbox } from "@/components/ui/checkbox";
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// import { Upload, RefreshCw, Edit2, UserPlus, Trash2, UserMinus, Search } from "lucide-react";
// import { supabase } from "@/api/supabaseClient"; 
// import { toast } from "sonner";
// import {
//   AlertDialog,
//   AlertDialogAction,
//   AlertDialogCancel,
//   AlertDialogContent,
//   AlertDialogDescription,
//   AlertDialogFooter,
//   AlertDialogHeader,
//   AlertDialogTitle,
// } from "@/components/ui/alert-dialog";

// const EMPTY_USER = { full_name: "", email: "", system_role: "contributor", status: "active" };

// function AddUserDialog({ open, onOpenChange, onSave, myAssignment }) {
//   const [form, setForm] = useState({ ...EMPTY_USER, geography: "" });
//   const [geoStates, setGeoStates] = useState([]);
//   const [loadingGeos, setLoadingGeos] = useState(false);
//   const [saving, setSaving] = useState(false);

//   useEffect(() => {
//     if (open && myAssignment?.project_id) {
//       loadOpenGeographies();
//     }
//   }, [open, myAssignment?.project_id]);

//   async function loadOpenGeographies() {
//     setLoadingGeos(true);
//     const { data, error } = await supabase
//       .from('project_geography_states')
//       .select('geography, status')
//       .eq('project_id', myAssignment.project_id)
//       .eq('status', 'open');

//     if (!error && data) {
//       setGeoStates(data);
//       if (data.length > 0) setForm(f => ({ ...f, geography: data[0].geography }));
//     }
//     setLoadingGeos(false);
//   }

//   async function handleSave() {
//     if (!form.email || !form.full_name || !form.geography) { 
//       toast.error("Please fill in all fields, including Geography"); 
//       return; 
//     }
//     setSaving(true);
//     try {
//       const { error } = await supabase.rpc('admin_add_user_to_team', {
//         p_email: form.email,
//         p_full_name: form.full_name,
//         p_role: form.system_role,
//         p_project_id: myAssignment.project_id,
//         p_project_type: myAssignment.project_type,
//         p_geography: form.geography
//       });
//       if (error) throw error;
//       toast.success(`${form.full_name} added to ${form.geography}`);
//       setForm({ ...EMPTY_USER, geography: "" });
//       onOpenChange(false);
//       onSave();
//     } catch (err) {
//       toast.error(err.message);
//     } finally {
//       setSaving(false);
//     }
//   }

//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="max-w-sm">
//         <DialogHeader><DialogTitle>Add User to Project</DialogTitle></DialogHeader>
//         <div className="space-y-3 mt-2">
//           {[["Full Name", "full_name", "text"], ["Email", "email", "email"]].map(([label, key, type]) => (
//             <div key={key}>
//               <label className="text-xs text-slate-500 block mb-1">{label}</label>
//               <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
//                 className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
//             </div>
//           ))}
//           <div>
//             <label className="text-xs text-slate-500 block mb-1">Role</label>
//             <select value={form.system_role} onChange={e => setForm(f => ({ ...f, system_role: e.target.value }))}
//               className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
//               <option value="contributor">Contributor</option>
//               <option value="reviewer">Reviewer</option>
//               <option value="team_lead">Team Lead</option>
//             </select>
//           </div>
//           <div>
//             <label className="text-xs text-slate-500 block mb-1">Assign to Geography</label>
//             {loadingGeos ? (
//               <div className="text-[10px] text-slate-400 animate-pulse">Loading open geographies...</div>
//             ) : (
//               <select value={form.geography} onChange={e => setForm(f => ({ ...f, geography: e.target.value }))}
//                 className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white font-medium text-indigo-600">
//                 <option value="" disabled>Select an open geography...</option>
//                 {geoStates.map(g => <option key={g.geography} value={g.geography}>{g.geography}</option>)}
//               </select>
//             )}
//             {geoStates.length === 0 && !loadingGeos && (
//               <p className="text-[10px] text-red-500 mt-1">⚠ No geographies are currently OPEN.</p>
//             )}
//           </div>
//           <div className="flex gap-2 pt-4 justify-end">
//             <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
//             <Button size="sm" disabled={saving || geoStates.length === 0} onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
//               {saving ? "Adding..." : "Add & Assign"}
//             </Button>
//           </div>
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// }

// function AttritionDialog({ open, onOpenChange, onConfirm, count, loading }) {
//   const [reason, setReason] = useState("");
//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="max-w-sm">
//         <DialogHeader><DialogTitle className="text-amber-600">Confirm Attrition</DialogTitle></DialogHeader>
//         <div className="space-y-4 py-2">
//           <p className="text-sm text-slate-600">Moving <span className="font-bold text-slate-900">{count} user(s)</span> to the attrition log.</p>
//           <div>
//             <label className="text-xs text-slate-500 block mb-1">Reason for Submission</label>
//             <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Provide a reason (e.g., Performance, Resignation)"
//               className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white min-h-[100px] outline-none focus:ring-2 focus:ring-amber-500" />
//           </div>
//         </div>
//         <div className="flex gap-2 justify-end">
//           <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
//           <Button size="sm" disabled={loading || !reason.trim()} onClick={() => { onConfirm(reason); setReason(""); }} className="bg-amber-600 hover:bg-amber-700 text-white">
//             {loading ? "Processing..." : "Confirm Attrition"}
//           </Button>
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// }

// export default function ManagerUserTab({ profiles = [], assignments = [], setBulkProfileOpen, onRefreshProfiles, myAssignment }) {
//   const [selectedIds, setSelectedIds] = useState(new Set());
//   const [syncing, setSyncing] = useState(false);
//   const [roleFilter, setRoleFilter] = useState("all");
//   const [statusFilter, setStatusFilter] = useState("all");
//   const [syncFilter, setSyncFilter] = useState("all");
//   const [cohortFilter, setCohortFilter] = useState("all");
//   const [searchQuery, setSearchQuery] = useState("");
//   const [bulkTarget, setBulkTarget] = useState("");
//   const [bulkRole, setBulkRole] = useState("contributor");
//   const [savingTarget, setSavingTarget] = useState(false);
//   const [addUserOpen, setAddUserOpen] = useState(false);
//   const [individualTarget, setIndividualTarget] = useState({ open: false, profile: null, value: "" });
//   const [savingIndividual, setSavingIndividual] = useState(false);
//   const [editingProfile, setEditingProfile] = useState(null);
//   const [editForm, setEditForm] = useState({});
//   const [savingEdit, setSavingEdit] = useState(false);
//   const [deletingIds, setDeletingIds] = useState(new Set());
//   const [attritionModal, setAttritionModal] = useState({ open: false, targetProfiles: [], loading: false });

//   // --- Shadcn Confirm State ---
//   const [confirmDelete, setConfirmDelete] = useState({ open: false, title: "", desc: "", action: null });

//   const [page, setPage] = useState(0);
//   const PAGE_SIZE = 15;

//   const cohorts = [...new Set(profiles.map(p => p.cohort).filter(Boolean))].sort();

//   const enriched = profiles.map(p => {
//     const assign = assignments.find(a => a.user_email === p.email);
//     return { ...p, daily_target_assignment: assign?.daily_target, assignment_id: assign?.id };
//   });

//   const filtered = enriched.filter(p => {
//     if (roleFilter !== "all" && p.system_role !== roleFilter) return false;
//     if (statusFilter !== "all" && p.status !== statusFilter) return false;
//     if (syncFilter === "synced" && !p.synced) return false;
//     if (syncFilter === "not_synced" && p.synced) return false;
//     if (cohortFilter !== "all" && p.cohort !== cohortFilter) return false;
//     if (searchQuery && !p.full_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
//     return true;
//   });

//   const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
//   const pagedFiltered = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
//   const unsyncedSelected = filtered.filter(p => selectedIds.has(p.id) && !p.synced);

//   function toggleAll(checked) { setSelectedIds(checked ? new Set(pagedFiltered.map(p => p.id)) : new Set()); }
//   function toggleOne(id) { setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

//   async function syncToAuth() {
//     if (!unsyncedSelected.length) return;
//     setSyncing(true);
//     try {
//       for (const p of unsyncedSelected) {
//         const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(p.email, {
//           data: { full_name: p.full_name, role: p.system_role }
//         });
//         if (!inviteError) await supabase.from('profiles').update({ synced: true }).eq('id', p.id);
//       }
//       toast.success(`${unsyncedSelected.length} user(s) synced to Auth`);
//       onRefreshProfiles();
//       setSelectedIds(new Set());
//     } catch (err) { toast.error("Sync failed"); } finally { setSyncing(false); }
//   }

//   async function saveBulkTarget() {
//     if (!bulkTarget || isNaN(Number(bulkTarget))) return;
//     setSavingTarget(true);
//     const targetIds = assignments.filter(a => a.role === bulkRole).map(a => a.id);
//     await supabase.from('team_assignments').update({ daily_target: Number(bulkTarget) }).in('id', targetIds);
//     toast.success(`Daily target set to ${bulkTarget} for all ${bulkRole}s`);
//     setSavingTarget(false);
//     setBulkTarget("");
//     onRefreshProfiles();
//   }

//   async function performAttrition(p, reason) {
//     const assign = assignments.find(a => a.user_email === p.email);
//     const { error: rpcError } = await supabase.rpc('admin_attrite_user', {
//       p_profile_id: p.id,
//       p_email: p.email,
//       p_full_name: p.full_name,
//       p_role: p.system_role || p.role,
//       p_byu_id: p.byu_pathway_id || "",
//       p_cohort: p.cohort || "",
//       p_geography: assign?.geography || myAssignment?.geography,
//       p_project_id: assign?.project_id || myAssignment?.project_id,
//       p_deleted_by: myAssignment?.user_email,
//       p_notes: reason
//     });
    
//     if (rpcError) throw rpcError;
//     if (p.synced) {
//       await supabase.functions.invoke('manage-auth-users', { body: { action: 'delete', email: p.email } });
//     }
//   }

//   async function handleConfirmAttrition(reason) {
//     setAttritionModal(prev => ({ ...prev, loading: true }));
//     try {
//       for (const p of attritionModal.targetProfiles) {
//         await performAttrition(p, reason);
//       }
//       toast.success(`Successfully processed ${attritionModal.targetProfiles.length} user(s).`);
//       setAttritionModal({ open: false, targetProfiles: [], loading: false });
//       setSelectedIds(new Set());
//       onRefreshProfiles();
//     } catch (err) {
//       toast.error("Attrition failed: " + err.message);
//     } finally {
//       setAttritionModal(prev => ({ ...prev, loading: false }));
//     }
//   }

//   function openEditProfile(p) {
//     setEditingProfile(p);
//     setEditForm({ full_name: p.full_name, email: p.email, system_role: p.system_role, status: p.status || "active", cohort: p.cohort || "" });
//   }

//   async function saveEditProfile() {
//     if (!editForm.full_name || !editForm.email) { toast.error("Name and email are required"); return; }
//     setSavingEdit(true);
//     await supabase.from('profiles').update(editForm).eq('id', editingProfile.id);
//     toast.success("User updated");
//     setSavingEdit(false);
//     setEditingProfile(null);
//     onRefreshProfiles();
//   }

//   async function saveIndividualTargetFromDialog() {
//     const { profile, value } = individualTarget;
//     if (!profile?.assignment_id || isNaN(Number(value))) return;
//     setSavingIndividual(true);
//     await supabase.from('team_assignments').update({ daily_target: Number(value) }).eq('id', profile.assignment_id);
//     toast.success(`Daily target set to ${value} for ${profile.full_name}`);
//     setSavingIndividual(false);
//     setIndividualTarget({ open: false, profile: null, value: "" });
//     onRefreshProfiles();
//   }

//   async function deleteProfile(profileId) {
//     const p = profiles.find(x => x.id === profileId);
//     if (!confirm(`Permanently delete ${p?.full_name}? This cannot be undone.`)) return;
//     setDeletingIds(prev => new Set([...prev, profileId]));
//     const assign = assignments.find(a => a.user_email === p?.email);
//     if (assign) await supabase.from('team_assignments').delete().eq('id', assign.id);
//     await supabase.from('profiles').delete().eq('id', profileId);
//     toast.success("User permanently deleted");
//     setDeletingIds(prev => { const n = new Set(prev); n.delete(profileId); return n; });
//     onRefreshProfiles();
//   }

//   async function deleteSelected() {
//     const ids = [...selectedIds];
//     if (!confirm(`Permanently delete ${ids.length} user(s)? This cannot be undone.`)) return;
//     for (const id of ids) {
//       const p = profiles.find(x => x.id === id);
//       if (p) {
//         const assign = assignments.find(a => a.user_email === p.email);
//         if (assign) await supabase.from('team_assignments').delete().eq('id', assign.id);
//       }
//       await supabase.from('profiles').delete().eq('id', id);
//     }
//     toast.success(`${ids.length} user(s) permanently deleted`);
//     setSelectedIds(new Set());
//     onRefreshProfiles();
//   }

//   return (
//     <div className="space-y-5">
//       <AddUserDialog open={addUserOpen} onOpenChange={setAddUserOpen} onSave={onRefreshProfiles} myAssignment={myAssignment} />
//       <AttritionDialog open={attritionModal.open} onOpenChange={v => setAttritionModal(p => ({ ...p, open: v }))} 
//         onConfirm={handleConfirmAttrition} count={attritionModal.targetProfiles.length} loading={attritionModal.loading} />

//       {/* Edit Profile Dialog */}
//       <Dialog open={!!editingProfile} onOpenChange={v => !v && setEditingProfile(null)}>
//         <DialogContent className="max-w-sm">
//           <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
//           <div className="space-y-3 mt-2">
//             {[["Full Name", "full_name", "text"], ["Email", "email", "email"]].map(([label, key, type]) => (
//               <div key={key}>
//                 <label className="text-xs text-slate-500 block mb-1">{label}</label>
//                 <input type={type} value={editForm[key] || ""} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
//                   className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white" />
//               </div>
//             ))}
//             <div>
//               <label className="text-xs text-slate-500 block mb-1">Role</label>
//               <select value={editForm.system_role || "contributor"} onChange={e => setEditForm(f => ({ ...f, system_role: e.target.value }))}
//                 className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
//                 <option value="contributor">Contributor</option>
//                 <option value="reviewer">Reviewer</option>
//                 <option value="team_lead">Team Lead</option>
//                 <option value="manager">Manager</option>
//               </select>
//             </div>
//             <div className="flex gap-2 pt-2 justify-end">
//               <Button variant="outline" size="sm" onClick={() => setEditingProfile(null)}>Cancel</Button>
//               <Button size="sm" disabled={savingEdit} onClick={saveEditProfile} className="bg-indigo-600 hover:bg-indigo-700 text-white">Save Changes</Button>
//             </div>
//           </div>
//         </DialogContent>
//       </Dialog>

//       {/* Individual Daily Target Dialog */}
//       <Dialog open={individualTarget.open} onOpenChange={v => !v && setIndividualTarget({ open: false, profile: null, value: "" })}>
//         <DialogContent className="max-w-sm">
//           <DialogHeader><DialogTitle>Set Daily Target</DialogTitle></DialogHeader>
//           <p className="text-sm text-slate-600">Setting target for <span className="font-semibold">{individualTarget.profile?.full_name}</span></p>
//           <div className="mt-2">
//             <input type="number" value={individualTarget.value} onChange={e => setIndividualTarget(t => ({ ...t, value: e.target.value }))}
//               className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white" autoFocus />
//           </div>
//           <div className="flex gap-2 justify-end pt-2">
//             <Button variant="outline" size="sm" onClick={() => setIndividualTarget({ open: false, profile: null, value: "" })}>Cancel</Button>
//             <Button size="sm" disabled={savingIndividual || !individualTarget.value} onClick={saveIndividualTargetFromDialog} className="bg-indigo-600 text-white">Save Target</Button>
//           </div>
//         </DialogContent>
//       </Dialog>

//       {/* Header */}
//       <div className="flex items-center justify-between flex-wrap gap-3">
//         <div>
//           <h3 className="text-sm font-semibold text-slate-800">Team Profiles</h3>
//           <p className="text-xs text-slate-500">{profiles.length} profiles · {profiles.filter(p => p.synced).length} synced</p>
//         </div>
//         <div className="flex gap-2">
//           {unsyncedSelected.length > 0 && (
//             <Button size="sm" onClick={syncToAuth} disabled={syncing} className="bg-green-600 hover:bg-green-700 text-white">
//               <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`} /> Sync to Auth ({unsyncedSelected.length})
//             </Button>
//           )}
//           <Button size="sm" onClick={() => setAddUserOpen(true)} variant="outline"><UserPlus className="w-4 h-4 mr-1" /> Add User</Button>
//           <Button size="sm" onClick={() => setBulkProfileOpen(true)} variant="outline"><Upload className="w-4 h-4 mr-1" /> Bulk CSV</Button>
//         </div>
//       </div>

//       {/* Search and Bulk Target Row */}
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//         {/* Search Bar */}
//         <div className="relative">
//           <Search className="w-4 h-4 absolute left-3 top-1/3 -translate-y-1/2 text-slate-400" />
//           <input type="text" placeholder="Search specific user by name..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
//             className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
//         </div>

//         {/* Bulk Target Setter */}
//         <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex gap-3 flex-wrap items-center">
//           <select value={bulkRole} onChange={e => setBulkRole(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
//             <option value="contributor">Contributors</option>
//             <option value="reviewer">Reviewers</option>
//           </select>
//           <input type="number" value={bulkTarget} onChange={e => setBulkTarget(e.target.value)} placeholder="Target" className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white w-24" />
//           <Button size="sm" onClick={saveBulkTarget} disabled={savingTarget || !bulkTarget} className="bg-indigo-600 text-white h-9">Apply Bulk</Button>
//         </div>
//       </div>

//       {/* Bulk action bar */}
//       {selectedIds.size > 0 && (
//         <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 animate-in fade-in slide-in-from-top-2">
//           <span className="text-sm text-amber-800 font-semibold">{selectedIds.size} users selected</span>
//           <Button size="sm" onClick={() => setAttritionModal({ open: true, targetProfiles: profiles.filter(p => selectedIds.has(p.id)), loading: false })} className="bg-amber-600 text-white">
//             <UserMinus className="w-4 h-4 mr-1.5" /> Attrite & Remove
//           </Button>
//           <Button size="sm" variant="ghost" onClick={deleteSelected} className="text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4 mr-1.5" /> Permanent Delete</Button>
//           <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-slate-500">Cancel</Button>
//         </div>
//       )}

//       {/* Filters */}
//       <div className="flex gap-3 flex-wrap items-center">
//         <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(0); }} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
//           <option value="all">All Roles</option>
//           <option value="contributor">Contributor</option>
//           <option value="reviewer">Reviewer</option>
//           <option value="team_lead">Team Lead</option>
//           <option value="manager">Manager</option>
//         </select>
//         <select value={cohortFilter} onChange={e => { setCohortFilter(e.target.value); setPage(0); }} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
//           <option value="all">All Cohorts</option>
//           {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
//         </select>
//         <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
//           <option value="all">All Statuses</option>
//           <option value="active">Active</option>
//           <option value="inactive">Inactive</option>
//         </select>
//         <span className="text-xs text-slate-400">{filtered.length} shown</span>
//       </div>

//       {/* Table Section */}
//       <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm">
//             <thead className="bg-slate-50 border-b border-slate-200">
//               <tr>
//                 <th className="p-3 w-10"><Checkbox checked={pagedFiltered.length > 0 && pagedFiltered.every(p => selectedIds.has(p.id))} onCheckedChange={toggleAll} /></th>
//                 <th className="text-left p-3 text-slate-600 font-medium">Name</th>
//                 <th className="text-left p-3 text-slate-600 font-medium">Email</th>
//                 <th className="text-left p-3 text-slate-600 font-medium">Role</th>
//                 <th className="text-left p-3 text-slate-600 font-medium">Cohort</th>
//                 <th className="text-left p-3 text-slate-600 font-medium">Status</th>
//                 <th className="text-left p-3 text-slate-600 font-medium">Synced</th>
//                 <th className="text-left p-3 text-slate-600 font-medium">Logged In</th>
//                 <th className="text-left p-3 text-slate-600 font-medium">Last Login</th>
//                 <th className="text-left p-3 text-slate-600 font-medium">Daily Target</th>
//                 <th className="text-left p-3 text-slate-600 font-medium">Actions</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-slate-100">
//               {pagedFiltered.map(p => (
//                 <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(p.id) ? "bg-indigo-50" : ""}`}>
//                   <td className="p-3"><Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleOne(p.id)} /></td>
//                   <td className="p-3 font-medium text-slate-900">{p.full_name}</td>
//                   <td className="p-3 text-slate-500 text-xs">{p.email}</td>
//                   <td className="p-3"><span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{p.system_role}</span></td>
//                   <td className="p-3 text-xs text-slate-500">{p.cohort || "—"}</td>
//                   <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === "active" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{p.status}</span></td>
//                   <td className="p-3">
//                     {p.synced 
//                       ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">Synced</span>
//                       : <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">Not Synced</span>}
//                   </td>
//                   <td className="p-3">
//                     {p.logged_in 
//                       ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">Yes</span>
//                       : <span className="text-xs text-slate-400">No</span>}
//                   </td>
//                   <td className="p-3 text-xs text-slate-500">
//                     {p.last_login ? new Date(p.last_login).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
//                   </td>
//                   <td className="p-3">
//                     {(p.system_role === "contributor" || p.system_role === "reviewer") && p.assignment_id ? (
//                       <button onClick={() => setIndividualTarget({ open: true, profile: p, value: p.daily_target_assignment || "" })}
//                         className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-600 group">
//                         <span>{p.daily_target_assignment ?? <span className="text-slate-300">—</span>}</span>
//                         <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-indigo-400" />
//                       </button>
//                     ) : <span className="text-xs text-slate-300">—</span>}
//                   </td>
//                   <td className="p-3">
//                     <div className="flex items-center gap-1">
//                       <button onClick={() => openEditProfile(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
//                       <button onClick={() => setAttritionModal({ open: true, targetProfiles: [p], loading: false })} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><UserMinus className="w-3.5 h-3.5" /></button>
//                       <button onClick={() => deleteProfile(p.id)} disabled={deletingIds.has(p.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /></button>
//                     </div>
//                   </td>
//                 </tr>
//               ))}
//               {pagedFiltered.length === 0 && (
//                 <tr><td colSpan={11} className="p-8 text-center text-slate-400">No profiles match the selected filters or search</td></tr>
//               )}
//             </tbody>
//           </table>
//         </div>

//         {/* Pagination Section */}
//         {totalPages > 1 && (
//           <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
//             <p className="text-xs text-slate-500">Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
//             <div className="flex gap-1">
//               <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-40">‹</button>
//               {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => Math.max(0, page - 2) + i).filter(p => p < totalPages).map(p => (
//                 <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 text-xs rounded font-medium ${page === p ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-200"}`}>{p + 1}</button>
//               ))}
//               <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-40">›</button>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
