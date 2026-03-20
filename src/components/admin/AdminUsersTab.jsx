import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Edit, Trash2, RefreshCw, UserPlus, UserMinus, UserX } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { supabase } from "@/api/supabaseClient";
import { toast } from "sonner";

const ADMIN_ADDABLE_ROLES = ["client", "manager", "team_lead"];

export default function AdminUsersTab({ profiles, onRefresh }) {
  const [syncFilter, setSyncFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [syncing, setSyncing] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [addProfileOpen, setAddProfileOpen] = useState(false);
  const [addForm, setAddForm] = useState({ full_name: "", email: "", system_role: "manager", byu_pathway_id: "", status: "active" });
  const [addingProfile, setAddingProfile] = useState(false);

  // AlertDialog State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ title: "", desc: "", action: null });

  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const cohorts = [...new Set(profiles.map(p => p.cohort).filter(Boolean))].sort();

  const filteredProfiles = profiles.filter(p => {
    if (syncFilter === "synced" && !p.synced) return false;
    if (syncFilter === "unsynced" && p.synced) return false;
    if (syncFilter === "pending" && (!p.synced || p.last_login)) return false; // NEW
    if (syncFilter === "confirmed" && !p.last_login) return false;
    if (roleFilter !== "all" && p.system_role !== roleFilter) return false;
    if (cohortFilter !== "all" && p.cohort !== cohortFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredProfiles.length / PAGE_SIZE);
  const pagedProfiles = filteredProfiles.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const allSelected = pagedProfiles.length > 0 && pagedProfiles.every(p => selected.has(p.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); pagedProfiles.forEach(p => n.delete(p.id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); pagedProfiles.forEach(p => n.add(p.id)); return n; });
    }
  }

  // --- ACTIONS ---

  async function handleAttrite(prList) {
    for (const pr of prList) {
      const { data: assigns } = await supabase.from('team_assignments').select('*').eq('user_email', pr.email);
      const assign = assigns?.[0];

      await supabase.from('attrition').insert([{
        email: pr.email,
        full_name: pr.full_name,
        role: pr.system_role,
        byu_pathway_id: pr.byu_pathway_id || "",
        cohort: pr.cohort || "",
        geography: assign?.geography || "",
        project_id: assign?.project_id || "",
        date_of_attrition: new Date().toISOString(),
        deleted_by: "admin"
      }]);

      await supabase.from('team_assignments').delete().eq('user_email', pr.email);
      await supabase.from('profiles').delete().eq('id', pr.id);
    }
    toast.success(`${prList.length} user(s) moved to attrition log`);
    setSelected(new Set());
    if (onRefresh) onRefresh();
  }

  async function handleDelete(prList) {
    for (const pr of prList) {
      await supabase.from('team_assignments').delete().eq('user_email', pr.email);
      await supabase.from('profiles').delete().eq('id', pr.id);
    }
    toast.success(`${prList.length} profile(s) permanently deleted`);
    setSelected(new Set());
    if (onRefresh) onRefresh();
  }

  // --- CONFIRMATION TRIGGERS ---

  const triggerAttrite = (pr) => {
    setConfirmConfig({
      title: "Confirm Attrition",
      desc: `Move ${pr.full_name} to the Attrition Log? This will remove all their active assignments.`,
      action: () => handleAttrite([pr])
    });
    setConfirmOpen(true);
  };

  const triggerDelete = (pr) => {
    setConfirmConfig({
      title: "Permanent Deletion",
      desc: `Are you sure you want to delete ${pr.full_name}? This action is irreversible.`,
      action: () => handleDelete([pr])
    });
    setConfirmOpen(true);
  };

  const triggerBulkDelete = () => {
    const prList = profiles.filter(p => selected.has(p.id));
    setConfirmConfig({
      title: `Delete ${prList.length} Users`,
      desc: `You are about to permanently delete ${prList.length} selected profiles. Continue?`,
      action: () => handleDelete(prList)
    });
    setConfirmOpen(true);
  };

  // --- EXISTING LOGIC ---
  
  async function syncToAuth() {
  const toSync = profiles.filter(p => selected.has(p.id) && !p.synced);

  if (!toSync.length) {
    toast.info("All selected users are already synced");
    return;
  }

  setSyncing(true);
  let successCount = 0;
  let failCount = 0;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error("Your session has expired. Please log in again.");
      return;
    }

    for (const p of toSync) {
      try {
        const { error } = await supabase.functions.invoke("invite-user", {
          body: {
            email: p.email,
            profileId: p.id,
            fullName: p.full_name,
            role: p.system_role,
          },
        });

        if (error) throw error;
        successCount++;
      } catch (err) {
        console.error(`Sync error for ${p.email}:`, err);
        failCount++;
      }
    }

    if (successCount > 0) toast.success(`Sent ${successCount} invitation(s)`);
    if (failCount > 0) toast.error(`Failed to invite ${failCount} user(s)`);
  } finally {
    setSyncing(false);
    setSelected(new Set());
    if (onRefresh) onRefresh();
  }
}


  // async function syncToAuth() {
  //   const toSync = profiles.filter(p => selected.has(p.id) && !p.synced);
    
  //   if (!toSync.length) { 
  //     toast.info("All selected users are already synced"); 
  //     return; 
  //   }

  //   setSyncing(true);
  //   let successCount = 0;
  //   let failCount = 0;

  //   for (const p of toSync) {
  //     try {
  //       const { data, error } = await supabase.functions.invoke('invite-user', {
  //         body: { 
  //           email: p.email, 
  //           profileId: p.id,      // Matching 'profileId' from our Edge Function
  //           fullName: p.full_name, // Pass the name for the Auth metadata
  //           role: p.system_role   // Crucial: This sets Lead, Client, or Manager
  //         },
  //         headers: {
  //           // The secret handshake that bypasses the 401
  //           'x-service-key': import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  //         }
  //       });

  //       if (error) throw error;
  //       successCount++;
  //     } catch (err) {
  //       console.error(`Sync error for ${p.email}:`, err);
  //       failCount++;
  //     }
  //   }

  //   if (successCount > 0) toast.success(`Sent ${successCount} invitation(s)`);
  //   if (failCount > 0) toast.error(`Failed to invite ${failCount} user(s)`);
    
  //   setSyncing(false);
  //   setSelected(new Set());
  //   if (onRefresh) onRefresh();
  // }

  async function refreshSyncStatuses() {
    const syncedUsers = profiles.filter(p => p.synced);
    if (syncedUsers.length === 0) return;

    setSyncing(true);
    toast.loading("Checking invite statuses...");

    for (const p of syncedUsers) {
      // Calling the same Edge Function updates the last_login column
      await supabase.functions.invoke('invite-user', {
        body: { email: p.email, profileId: p.id, fullName: p.full_name, role: p.system_role },
        headers: { 'x-service-key': import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY }
      });
    }

    toast.dismiss();
    toast.success("Sync statuses updated");
    setSyncing(false);
    if (onRefresh) onRefresh();
  }

  function openEdit(pr) {
    setEditingProfile(pr);
    setEditForm({ 
      full_name: pr.full_name, 
      email: pr.email, 
      system_role: pr.system_role, 
      byu_pathway_id: pr.byu_pathway_id || "", 
      cohort: pr.cohort || "", 
      status: pr.status || "active", 
      report_to: pr.report_to || "" 
    });
  }

  async function saveEdit() {
    setSavingEdit(true);
    const { error } = await supabase.from('profiles').update(editForm).eq('id', editingProfile.id);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
    setSavingEdit(false);
    setEditingProfile(null);
    if (onRefresh) onRefresh();
  }

  async function addProfile() {
    setAddingProfile(true);
    const { error } = await supabase.from('profiles').insert([{ ...addForm, synced: false }]);
    if (error) toast.error(error.message);
    else toast.success("Profile added");
    setAddingProfile(false);
    setAddProfileOpen(false);
    setAddForm({ full_name: "", email: "", system_role: "manager", byu_pathway_id: "", status: "active" });
    if (onRefresh) onRefresh();
  }

  async function nudgeUser(p) {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('invite-user', {
        body: { 
          email: p.email, 
          profileId: p.id, 
          fullName: p.full_name, 
          role: p.system_role 
        },
        headers: { 'x-service-key': import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY }
      });

      if (error) throw error;
      toast.success(`Reminder sent to ${p.email}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error("Nudge failed: " + err.message);
    } finally {
      setSyncing(false);
    }
  }

  const needsInvite = profiles.filter(p => selected.has(p.id) && (!p.synced || !p.last_login));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-800">User Management</h2>
        <p className="text-xs text-slate-500 mt-0.5">Manage system profiles and invite users via Supabase Auth</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">System Profiles</h3>
            <p className="text-xs text-slate-500">{profiles.length} total · {profiles.filter(p=>p.synced).length} synced</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setSelected(new Set()); setPage(0); }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20">
              <option value="all">All Roles</option>
              {["admin", "manager", "team_lead", "reviewer", "contributor", "client"].map(r => (
                <option key={r} value={r}>{r.replace("_", " ")}</option>
              ))}
            </select>

            <select 
              value={syncFilter} 
              onChange={e => { setSyncFilter(e.target.value); setSelected(new Set()); setPage(0); }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Sync Status</option>
              <option value="unsynced">Not Invited</option>
              <option value="pending">Pending (Invited)</option>
              <option value="confirmed">Confirmed (Logged In)</option>
            </select>
            
            <select value={cohortFilter} onChange={e => { setCohortFilter(e.target.value); setSelected(new Set()); setPage(0); }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20">
              <option value="all">All Cohorts</option>
              {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {selected.size > 0 && needsInvite.length > 0 && (
              <Button size="sm" onClick={syncToAuth} disabled={syncing} className="bg-amber-600 hover:bg-amber-700 text-white">
                <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Inviting..." : `Nudge/Invite (${needsInvite.length})`}
              </Button>
            )}

            {selected.size > 0 && (
              <Button size="sm" onClick={triggerBulkDelete} variant="destructive">
                <Trash2 className="w-4 h-4 mr-1" /> Delete ({selected.size})
              </Button>
            )}

            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshSyncStatuses} 
              disabled={syncing}
              className="border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
              Refresh Status
            </Button>

            <Button size="sm" onClick={() => setAddProfileOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
              <UserPlus className="w-4 h-4 mr-1" /> Add Profile
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="p-3 w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></th>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Role</th>
                <th className="text-left p-3 font-medium">Cohort</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Synced</th>
                <th className="p-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedProfiles.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-slate-400">No profiles found matching your filters.</td></tr>
              ) : (
                pagedProfiles.map(pr => (
                  <tr key={pr.id} className={`hover:bg-slate-50 transition-colors ${selected.has(pr.id) ? "bg-indigo-50/40" : ""}`}>
                    <td className="p-3">
                      <Checkbox checked={selected.has(pr.id)} onCheckedChange={() => {
                        setSelected(prev => { const n = new Set(prev); n.has(pr.id) ? n.delete(pr.id) : n.add(pr.id); return n; });
                      }} />
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-900">{pr.full_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{pr.email}</div>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] uppercase font-bold tracking-tight bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                        {pr.system_role}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-500">{pr.cohort || "—"}</td>
                    <td className="p-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${pr.status === "active" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {pr.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                    {!pr.synced ? (
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Unsynced</span>
                    ) : !pr.last_login ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase tracking-tighter animate-pulse">Pending</span>
                        <button 
                          onClick={() => nudgeUser(pr)} 
                          className="text-[9px] text-amber-600 hover:underline font-medium"
                        >
                          Resend Invite?
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold uppercase tracking-tighter">Confirmed</span>
                    )}
                  </td>
                    {/* <td className="p-3">
                      {pr.synced
                        ? <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Invite Sent</span>
                        : <span className="text-xs text-slate-400 italic">Not invited</span>}
                    </td> */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(pr)} className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-md hover:bg-indigo-50">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => triggerAttrite(pr)} title="Attrite User" className="text-slate-400 hover:text-orange-600 p-1.5 rounded-md hover:bg-orange-50">
                          <UserX className="w-4 h-4" />
                        </button>
                        <button onClick={() => triggerDelete(pr)} className="text-slate-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500 font-medium">Page {page + 1} of {totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</Button>
            </div>
          </div>
        )}
      </div>

      {/* Global Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmConfig.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmConfig.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => { confirmConfig.action?.(); setConfirmOpen(false); }}
              className="bg-red-600 hover:bg-red-700"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Profile Dialog */}
      <Dialog open={addProfileOpen} onOpenChange={setAddProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Profile</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold text-slate-500">Full Name *</Label>
              <Input value={addForm.full_name} onChange={e => setAddForm(f => ({...f, full_name: e.target.value}))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold text-slate-500">Email *</Label>
              <Input value={addForm.email} onChange={e => setAddForm(f => ({...f, email: e.target.value}))} type="email" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold text-slate-500">Role *</Label>
              <Select value={addForm.system_role} onValueChange={v => setAddForm(f => ({...f, system_role: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADMIN_ADDABLE_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setAddProfileOpen(false)}>Cancel</Button>
            <Button onClick={addProfile} disabled={addingProfile || !addForm.full_name || !addForm.email} className="bg-indigo-600">
              {addingProfile ? "Adding..." : "Add Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={!!editingProfile} onOpenChange={v => !v && setEditingProfile(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-slate-500">Full Name</Label>
                <Input value={editForm.full_name || ""} onChange={e => setEditForm(f => ({...f, full_name: e.target.value}))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-slate-500">Role</Label>
                <Select value={editForm.system_role} onValueChange={v => setEditForm(f => ({...f, system_role: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["admin","manager","team_lead","reviewer","contributor","client"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold text-slate-500">Cohort</Label>
              <Input value={editForm.cohort || ""} onChange={e => setEditForm(f => ({...f, cohort: e.target.value}))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold text-slate-500">Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({...f, status: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProfile(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={savingEdit} className="bg-indigo-600">
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}










// import { useState } from "react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Checkbox } from "@/components/ui/checkbox";
// import { CheckCircle2, Edit, Trash2, RefreshCw, UserPlus, UserMinus } from "lucide-react";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
// import { supabase } from "@/api/supabaseClient";
// import { toast } from "sonner";

// const ADMIN_ADDABLE_ROLES = ["client", "manager", "team_lead"];

// export default function AdminUsersTab({ profiles, onRefresh }) {
//   const [syncFilter, setSyncFilter] = useState("all");
//   const [roleFilter, setRoleFilter] = useState("all");
//   const [cohortFilter, setCohortFilter] = useState("all");
//   const [selected, setSelected] = useState(new Set());
//   const [syncing, setSyncing] = useState(false);
//   const [editingProfile, setEditingProfile] = useState(null);
//   const [editForm, setEditForm] = useState({});
//   const [savingEdit, setSavingEdit] = useState(false);
//   const [addProfileOpen, setAddProfileOpen] = useState(false);
//   const [addForm, setAddForm] = useState({ full_name: "", email: "", system_role: "manager", byu_pathway_id: "", status: "active" });
//   const [addingProfile, setAddingProfile] = useState(false);

//   const [page, setPage] = useState(0);
//   const PAGE_SIZE = 15;

//   const cohorts = [...new Set(profiles.map(p => p.cohort).filter(Boolean))].sort();

//   const filteredProfiles = profiles.filter(p => {
//     if (syncFilter === "synced" && !p.synced) return false;
//     if (syncFilter === "unsynced" && p.synced) return false;
//     if (roleFilter !== "all" && p.system_role !== roleFilter) return false;
//     if (cohortFilter !== "all" && p.cohort !== cohortFilter) return false;
//     return true;
//   });

//   const totalPages = Math.ceil(filteredProfiles.length / PAGE_SIZE);
//   const pagedProfiles = filteredProfiles.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

//   const allSelected = pagedProfiles.length > 0 && pagedProfiles.every(p => selected.has(p.id));

//   function toggleAll() {
//     if (allSelected) {
//       setSelected(prev => { const n = new Set(prev); pagedProfiles.forEach(p => n.delete(p.id)); return n; });
//     } else {
//       setSelected(prev => { const n = new Set(prev); pagedProfiles.forEach(p => n.add(p.id)); return n; });
//     }
//   }

//   async function syncToAuth() {
//     const toSync = profiles.filter(p => selected.has(p.id) && !p.synced);
//     if (!toSync.length) { toast.info("All selected users are already synced"); return; }
    
//     setSyncing(true);
//     let successCount = 0;
//     let failCount = 0;

//     for (const p of toSync) {
//       try {
//         // Invoke the Edge Function created in /supabase/functions/invite-user
//         const { error } = await supabase.functions.invoke('invite-user', {
//           body: { user_id: p.id, email: p.email }
//         });

//         if (error) throw error;
//         successCount++;
//       } catch (err) {
//         console.error(`Failed to invite ${p.email}:`, err);
//         failCount++;
//       }
//     }

//     if (successCount > 0) toast.success(`Sent ${successCount} invitation email(s)`);
//     if (failCount > 0) toast.error(`Failed to invite ${failCount} user(s)`);
    
//     setSyncing(false);
//     setSelected(new Set());
//     if (onRefresh) onRefresh();
//   }

//   async function attriteProfiles(prList) {
//     if (!confirm(`Attrite ${prList.length} user(s)? This will move them to the Attrition Log.`)) return;
    
//     for (const pr of prList) {
//       // Get current assignments to include in log (Supabase syntax)
//       const { data: assigns } = await supabase
//         .from('team_assignments')
//         .select('*')
//         .eq('user_email', pr.email);
        
//       const assign = assigns?.[0];

//       // Create Attrition entry
//       await supabase.from('attrition').insert([{
//         email: pr.email,
//         full_name: pr.full_name,
//         role: pr.system_role,
//         byu_pathway_id: pr.byu_pathway_id || "",
//         cohort: pr.cohort || "",
//         geography: assign?.geography || "",
//         project_id: assign?.project_id || "",
//         date_of_attrition: new Date().toISOString(),
//         deleted_by: "admin"
//       }]);

//       // Cleanup
//       await supabase.from('team_assignments').delete().eq('user_email', pr.email);
//       await supabase.from('profiles').delete().eq('id', pr.id);
//     }
    
//     toast.success(`${prList.length} user(s) attrited`);
//     setSelected(new Set());
//     if (onRefresh) onRefresh();
//   }

//   async function deleteProfile(pr) {
//     if (!confirm(`Permanently delete ${pr.full_name}? This cannot be undone.`)) return;
//     await supabase.from('team_assignments').delete().eq('user_email', pr.email);
//     await supabase.from('profiles').delete().eq('id', pr.id);
//     toast.success("Profile permanently deleted");
//     if (onRefresh) onRefresh();
//   }

//   async function deleteSelectedProfiles() {
//     const prList = profiles.filter(p => selected.has(p.id));
//     if (!confirm(`Permanently delete ${prList.length} user(s)?`)) return;
    
//     for (const pr of prList) {
//       await supabase.from('team_assignments').delete().eq('user_email', pr.email);
//       await supabase.from('profiles').delete().eq('id', pr.id);
//     }
    
//     toast.success(`${prList.length} user(s) permanently deleted`);
//     setSelected(new Set());
//     if (onRefresh) onRefresh();
//   }

//   function openEdit(pr) {
//     setEditingProfile(pr);
//     setEditForm({ 
//       full_name: pr.full_name, 
//       email: pr.email, 
//       system_role: pr.system_role, 
//       byu_pathway_id: pr.byu_pathway_id || "", 
//       cohort: pr.cohort || "", 
//       status: pr.status || "active", 
//       report_to: pr.report_to || "" 
//     });
//   }

//   async function saveEdit() {
//     setSavingEdit(true);
//     const { error } = await supabase
//       .from('profiles')
//       .update(editForm)
//       .eq('id', editingProfile.id);

//     if (error) toast.error(error.message);
//     else toast.success("Profile updated");
    
//     setSavingEdit(false);
//     setEditingProfile(null);
//     if (onRefresh) onRefresh();
//   }

//   async function addProfile() {
//     setAddingProfile(true);
//     const { error } = await supabase
//       .from('profiles')
//       .insert([{ ...addForm, synced: false }]);

//     if (error) toast.error(error.message);
//     else toast.success("Profile added");
    
//     setAddingProfile(false);
//     setAddProfileOpen(false);
//     setAddForm({ full_name: "", email: "", system_role: "manager", byu_pathway_id: "", status: "active" });
//     if (onRefresh) onRefresh();
//   }

//   const unsyncedSelected = profiles.filter(p => selected.has(p.id) && !p.synced);

//   return (
//     <div className="space-y-6">
//       <div>
//         <h2 className="text-base font-semibold text-slate-800">User Management</h2>
//         <p className="text-xs text-slate-500 mt-0.5">Manage system profiles and invite users via Supabase Auth</p>
//       </div>

//       <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
//         <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
//           <div>
//             <h3 className="text-sm font-semibold text-slate-800">System Profiles</h3>
//             <p className="text-xs text-slate-500">{profiles.length} total · {profiles.filter(p=>p.synced).length} synced</p>
//           </div>
//           <div className="flex gap-2 flex-wrap items-center">
//             <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setSelected(new Set()); setPage(0); }}
//               className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
//               <option value="all">All Roles</option>
//               {["admin", "manager", "team_lead", "reviewer", "contributor", "client"].map(r => (
//                 <option key={r} value={r}>{r.replace("_", " ")}</option>
//               ))}
//             </select>
            
//             <select value={cohortFilter} onChange={e => { setCohortFilter(e.target.value); setSelected(new Set()); setPage(0); }}
//               className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
//               <option value="all">All Cohorts</option>
//               {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
//             </select>

//             {selected.size > 0 && unsyncedSelected.length > 0 && (
//               <Button size="sm" onClick={syncToAuth} disabled={syncing} className="bg-green-600 hover:bg-green-700 text-white">
//                 <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
//                 {syncing ? "Inviting..." : `Invite to Auth (${unsyncedSelected.length})`}
//               </Button>
//             )}

//             {selected.size > 0 && (
//               <Button size="sm" onClick={deleteSelectedProfiles} className="bg-red-600 hover:bg-red-700 text-white">
//                 <Trash2 className="w-4 h-4 mr-1" /> Delete ({selected.size})
//               </Button>
//             )}

//             <Button size="sm" onClick={() => setAddProfileOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
//               <UserPlus className="w-4 h-4 mr-1" /> Add Profile
//             </Button>
//           </div>
//         </div>

//         <div className="overflow-x-auto">
//           <table className="w-full text-sm">
//             <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
//               <tr>
//                 <th className="p-3 w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></th>
//                 <th className="text-left p-3 font-medium">Name</th>
//                 <th className="text-left p-3 font-medium">Role</th>
//                 <th className="text-left p-3 font-medium">Cohort</th>
//                 <th className="text-left p-3 font-medium">Status</th>
//                 <th className="text-left p-3 font-medium">Synced</th>
//                 <th className="p-3 text-right font-medium">Actions</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-slate-100">
//               {pagedProfiles.length === 0 && (
//                 <tr><td colSpan={7} className="p-6 text-center text-slate-400">No profiles found</td></tr>
//               )}
//               {pagedProfiles.map(pr => (
//                 <tr key={pr.id} className={`hover:bg-slate-50 transition-colors ${selected.has(pr.id) ? "bg-indigo-50/40" : ""}`}>
//                   <td className="p-3">
//                     <Checkbox checked={selected.has(pr.id)} onCheckedChange={() => {
//                       setSelected(prev => { const n = new Set(prev); n.has(pr.id) ? n.delete(pr.id) : n.add(pr.id); return n; });
//                     }} />
//                   </td>
//                   <td className="p-3">
//                     <div className="font-medium text-slate-900">{pr.full_name}</div>
//                     <div className="text-[10px] text-slate-400 font-mono">{pr.email}</div>
//                   </td>
//                   <td className="p-3">
//                     <span className="text-[10px] uppercase font-bold tracking-tight bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
//                       {pr.system_role}
//                     </span>
//                   </td>
//                   <td className="p-3 text-xs text-slate-500">{pr.cohort || "—"}</td>
//                   <td className="p-3">
//                     <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${pr.status === "active" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
//                       {pr.status}
//                     </span>
//                   </td>
//                   <td className="p-3">
//                     {pr.synced
//                       ? <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Invite Sent</span>
//                       : <span className="text-xs text-slate-400 italic">Not invited</span>}
//                   </td>
//                   <td className="p-3 text-right">
//                     <div className="flex items-center justify-end gap-1">
//                       <button onClick={() => openEdit(pr)} className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-md hover:bg-indigo-50">
//                         <Edit className="w-4 h-4" />
//                       </button>
//                       <button onClick={() => deleteProfile(pr)} className="text-slate-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50">
//                         <Trash2 className="w-4 h-4" />
//                       </button>
//                     </div>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>

//         {totalPages > 1 && (
//           <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
//             <p className="text-xs text-slate-500">Page {page + 1} of {totalPages}</p>
//             <div className="flex gap-1">
//               <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</Button>
//               <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</Button>
//             </div>
//           </div>
//         )}
//       </div>

//       {/* Add Profile Dialog */}
//       <Dialog open={addProfileOpen} onOpenChange={setAddProfileOpen}>
//         <DialogContent className="max-w-md">
//           <DialogHeader><DialogTitle>Add Profile</DialogTitle></DialogHeader>
//           <div className="space-y-3">
//             <div className="space-y-1">
//               <Label className="text-xs">Full Name *</Label>
//               <Input value={addForm.full_name} onChange={e => setAddForm(f => ({...f, full_name: e.target.value}))} />
//             </div>
//             <div className="space-y-1">
//               <Label className="text-xs">Email *</Label>
//               <Input value={addForm.email} onChange={e => setAddForm(f => ({...f, email: e.target.value}))} type="email" />
//             </div>
//             <div className="space-y-1">
//               <Label className="text-xs">Role *</Label>
//               <Select value={addForm.system_role} onValueChange={v => setAddForm(f => ({...f, system_role: v}))}>
//                 <SelectTrigger><SelectValue /></SelectTrigger>
//                 <SelectContent>
//                   {ADMIN_ADDABLE_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
//                 </SelectContent>
//               </Select>
//             </div>
//           </div>
//           <DialogFooter>
//             <Button variant="outline" onClick={() => setAddProfileOpen(false)}>Cancel</Button>
//             <Button onClick={addProfile} disabled={addingProfile || !addForm.full_name || !addForm.email} className="bg-indigo-600">
//               {addingProfile ? "Adding..." : "Add Profile"}
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>

//       {/* Edit Profile Dialog */}
//       <Dialog open={!!editingProfile} onOpenChange={v => !v && setEditingProfile(null)}>
//         <DialogContent className="max-w-md">
//           <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
//           <div className="space-y-3 py-2">
//             <div className="grid grid-cols-2 gap-3">
//               <div className="space-y-1">
//                 <Label className="text-xs">Full Name</Label>
//                 <Input value={editForm.full_name || ""} onChange={e => setEditForm(f => ({...f, full_name: e.target.value}))} />
//               </div>
//               <div className="space-y-1">
//                 <Label className="text-xs">Role</Label>
//                 <Select value={editForm.system_role} onValueChange={v => setEditForm(f => ({...f, system_role: v}))}>
//                   <SelectTrigger><SelectValue /></SelectTrigger>
//                   <SelectContent>
//                     {["admin","manager","team_lead","reviewer","contributor","client"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
//                   </SelectContent>
//                 </Select>
//               </div>
//             </div>
//             <div className="space-y-1">
//               <Label className="text-xs">Cohort</Label>
//               <Input value={editForm.cohort || ""} onChange={e => setEditForm(f => ({...f, cohort: e.target.value}))} />
//             </div>
//             <div className="space-y-1">
//               <Label className="text-xs">Status</Label>
//               <Select value={editForm.status} onValueChange={v => setEditForm(f => ({...f, status: v}))}>
//                 <SelectTrigger><SelectValue /></SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="active">Active</SelectItem>
//                   <SelectItem value="inactive">Inactive</SelectItem>
//                 </SelectContent>
//               </Select>
//             </div>
//           </div>
//           <DialogFooter>
//             <Button variant="outline" onClick={() => setEditingProfile(null)}>Cancel</Button>
//             <Button onClick={saveEdit} disabled={savingEdit} className="bg-indigo-600">
//               {savingEdit ? "Saving..." : "Save Changes"}
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }









