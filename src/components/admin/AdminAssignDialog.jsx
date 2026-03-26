import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, ListIcon } from "lucide-react";
import { supabase } from "@/api/supabaseClient";

export default function AdminAssignDialog({ open, onOpenChange, form, setForm, projects, profiles, assignments, onSave, saving }) {
  const [mode, setMode] = useState(null); // "manager" | "team_lead"
  const [existingGeos, setExistingGeos] = useState([]);
  const [isManualGeo, setIsManualGeo] = useState(false);
  const [loadingGeos, setLoadingGeos] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode(null);
      setExistingGeos([]);
      setIsManualGeo(false);
    }
  }, [open]);

  // Fetch geographies when project changes
  useEffect(() => {
    if (mode === "manager" && form.project_id) {
      const fetchGeos = async () => {
        setLoadingGeos(true);
        const { data } = await supabase
          .from('project_geography_states')
          .select('geography')
          .eq('project_id', form.project_id);
        
        const geos = data ? data.map(d => d.geography) : [];
        setExistingGeos(geos);
        
        // If no geos exist for this project yet, default to manual input
        if (geos.length === 0) setIsManualGeo(true);
        else setIsManualGeo(false);
        
        setLoadingGeos(false);
      };
      fetchGeos();
    }
  }, [mode, form.project_id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const managers = (profiles || []).filter(p => p.system_role === "manager");
  const teamLeads = (profiles || []).filter(p => p.system_role === "team_lead");

  function handleManagerSelect(email) {
    const mgr = managers.find(m => m.email === email);
    set("user_email", email);
    if (mgr) set("user_name", mgr.full_name);
    set("role", "manager");
  }

  function handleTeamLeadSelect(email) {
    const tl = teamLeads.find(t => t.email === email);
    set("user_email", email);
    if (tl) set("user_name", tl.full_name);
    set("role", "team_lead");
  }

  // Initial selection screen
  if (!mode) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Assignment</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 mb-4">Choose the type of assignment to create:</p>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => { setMode("manager"); setForm(f => ({ ...f, role: "manager" })); }}
              className="border-2 border-indigo-200 hover:border-indigo-500 rounded-xl p-4 text-center transition-colors group"
            >
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-indigo-200 transition-colors">
                <span className="text-indigo-700 font-bold text-xs">MGR</span>
              </div>
              <p className="text-sm font-semibold text-slate-800">Manager</p>
              <p className="text-xs text-slate-500 mt-0.5">Assign to project & geography</p>
            </button>
            <button 
              onClick={() => { setMode("team_lead"); setForm(f => ({ ...f, role: "team_lead" })); }}
              className="border-2 border-purple-200 hover:border-purple-500 rounded-xl p-4 text-center transition-colors group"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-purple-200 transition-colors">
                <span className="text-purple-700 font-bold text-xs">TL</span>
              </div>
              <p className="text-sm font-semibold text-slate-800">Team Lead</p>
              <p className="text-xs text-slate-500 mt-0.5">Inherit from manager</p>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (mode === "manager") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Manager Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Project *</Label>
              <Select value={form.project_id} onValueChange={v => {
                const p = projects.find(x => x.id === v);
                setForm(f => ({ ...f, project_id: v, project_type: p?.project_type || f.project_type, geography: "" }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label>Geography *</Label>
                {existingGeos.length > 0 && (
                  <button 
                    type="button" 
                    onClick={() => { setIsManualGeo(!isManualGeo); set("geography", ""); }}
                    className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:underline"
                  >
                    {isManualGeo ? <ListIcon className="w-3 h-3"/> : <PlusCircle className="w-3 h-3"/>}
                    {isManualGeo ? "Select Existing" : "Add New Geography"}
                  </button>
                )}
              </div>
              
              {!form.project_id ? (
                <div className="h-10 border border-slate-200 rounded-md bg-slate-50 flex items-center px-3 text-xs text-slate-400 italic">
                  Select a project first...
                </div>
              ) : isManualGeo || existingGeos.length === 0 ? (
                <Input 
                  value={form.geography} 
                  onChange={e => set("geography", e.target.value)} 
                  placeholder="Enter new geography name" 
                  autoFocus
                />
              ) : (
                <Select value={form.geography} onValueChange={v => set("geography", v)}>
                  <SelectTrigger disabled={loadingGeos}>
                    <SelectValue placeholder={loadingGeos ? "Loading..." : "Select existing geography"} />
                  </SelectTrigger>
                  <SelectContent>
                    {existingGeos.map(geo => (
                      <SelectItem key={geo} value={geo}>{geo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Manager *</Label>
              {managers.length > 0 ? (
                <Select value={form.user_email} onValueChange={handleManagerSelect}>
                  <SelectTrigger><SelectValue placeholder="Select manager from profiles" /></SelectTrigger>
                  <SelectContent>
                    {managers.map(m => <SelectItem key={m.id} value={m.email}>{m.full_name} ({m.email})</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <Input value={form.user_email} onChange={e => set("user_email", e.target.value)} placeholder="manager@example.com" type="email" />
                  <p className="text-[11px] text-slate-400">No manager profiles found. Enter email manually.</p>
                </div>
              )}
            </div>

            {(managers.length > 0 || !form.user_email.includes("@")) && (
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input value={form.user_name} onChange={e => set("user_name", e.target.value)} placeholder="Jane Doe" />
              </div>
            )}
            
            {form.user_name && form.user_email && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-sm text-indigo-700">
                <span className="font-medium">{form.user_name}</span> · {form.user_email}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Back</Button>
            <Button onClick={onSave} disabled={saving || !form.project_id || !form.user_email || !form.geography} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {saving ? "Saving..." : "Assign Manager"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Team Lead Mode
  const managerAssignments = (assignments || []).filter(a => a.role === "manager" && a.status === "active");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Team Lead Assignment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Manager Assignment (Project + Geography) *</Label>
            {managerAssignments.length > 0 ? (
              <Select 
                value={form.team_lead_email ? `${form.team_lead_email}||${form.project_id}||${form.geography}` : ""} 
                onValueChange={v => {
                  const [mgrEmail, projectId, geography] = v.split("||");
                  const mgrAssign = managerAssignments.find(a => a.user_email === mgrEmail && a.project_id === projectId && a.geography === geography);
                  setForm(f => ({
                    ...f,
                    team_lead_email: mgrEmail,
                    project_id: projectId,
                    project_type: mgrAssign?.project_type || f.project_type,
                    geography: geography,
                  }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select manager + project/geography" /></SelectTrigger>
                <SelectContent>
                  {managerAssignments.map(a => (
                    <SelectItem key={`${a.user_email}||${a.project_id}||${a.geography}`} value={`${a.user_email}||${a.project_id}||${a.geography}`}>
                      {a.user_name} · {projects.find(p => p.id === a.project_id)?.name || a.project_id} · {a.geography}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <Input value={form.team_lead_email} onChange={e => set("team_lead_email", e.target.value)} placeholder="manager@example.com" />
                <p className="text-xs text-amber-600">No active manager assignments found. Please create a Manager assignment first.</p>
              </div>
            )}
            <p className="text-[11px] text-slate-400">The team lead will inherit the selected manager's project and geography.</p>
          </div>

          {form.project_id && (
            <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-sm text-purple-700">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-70">Inherited Context:</span>
              <div className="mt-1">
                Project: <span className="font-bold">{projects.find(p => p.id === form.project_id)?.name || form.project_id}</span>
              </div>
              <div>
                Geography: <span className="font-bold">{form.geography}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Team Lead *</Label>
            {teamLeads.length > 0 ? (
              <Select value={form.user_email} onValueChange={handleTeamLeadSelect}>
                <SelectTrigger><SelectValue placeholder="Select team lead from profiles" /></SelectTrigger>
                <SelectContent>
                  {teamLeads.map(t => <SelectItem key={t.id} value={t.email}>{t.full_name} ({t.email})</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <Input value={form.user_email} onChange={e => set("user_email", e.target.value)} placeholder="teamlead@example.com" type="email" />
                <p className="text-[11px] text-slate-400">No team lead profiles found. Enter manually.</p>
              </div>
            )}
          </div>
          
          {(teamLeads.length === 0 || !form.user_email.includes("@")) && (
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={form.user_name} onChange={e => set("user_name", e.target.value)} placeholder="John Doe" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setMode(null)}>Back</Button>
          <Button 
            onClick={onSave} 
            disabled={saving || !form.user_email || !form.team_lead_email} 
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {saving ? "Saving..." : "Assign Team Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
