import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, ShieldAlert } from "lucide-react";

// Restricted roles for Manager-level access
const ROLES = ["team_lead", "reviewer", "contributor"];

export default function ManagerAssignDialog({ open, onOpenChange, form, setForm, editingAssign, onSave, saving }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingAssign ? "Edit Assignment" : "New Team Assignment"}
          </DialogTitle>
          <DialogDescription>
            Assign roles and geographies to team members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Section 1: Identity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-slate-500">Email Address *</Label>
              <Input 
                value={form.user_email} 
                onChange={e => set("user_email", e.target.value)} 
                type="email" 
                placeholder="user@example.com"
                disabled={!!editingAssign} 
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-slate-500">Full Name *</Label>
              <Input 
                value={form.user_name} 
                onChange={e => set("user_name", e.target.value)} 
                placeholder="John Doe"
                className="h-9"
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section 2: Role & Workload */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-slate-500">Role</Label>
              <Select value={form.role} onValueChange={v => set("role", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-slate-500">Allocation %</Label>
              <Input 
                type="number" 
                min={10} 
                max={100} 
                value={form.work_percentage} 
                onChange={e => set("work_percentage", Number(e.target.value))} 
                className="h-9"
              />
            </div>
          </div>

          {/* Section 3: Project & Geography (CRITICAL for Batch Logic) */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <Globe className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-tight">Project Context</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Geography *</Label>
                <Input 
                  value={form.geography} 
                  onChange={e => set("geography", e.target.value)} 
                  placeholder="e.g. USA, UK, FR"
                  className="h-8 text-sm border-slate-300"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Project ID/Type</Label>
                <Input 
                  value={form.project_type} 
                  onChange={e => set("project_type", e.target.value)} 
                  placeholder="e.g. RLHF_V2"
                  className="h-8 text-sm border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Reporting Lines */}
          <div className="space-y-3 border-l-2 border-indigo-100 pl-3 ml-1">
            {(form.role === "contributor" || form.role === "reviewer") && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Team Lead Email</Label>
                <Input 
                  value={form.team_lead_email} 
                  onChange={e => set("team_lead_email", e.target.value)} 
                  placeholder="lead@example.com"
                  className="h-9 bg-white"
                />
              </div>
            )}
            {form.role === "contributor" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Assigned Reviewer Email</Label>
                <Input 
                  value={form.reviewer_email} 
                  onChange={e => set("reviewer_email", e.target.value)} 
                  placeholder="reviewer@example.com"
                  className="h-9 bg-white"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-500">
            Cancel
          </Button>
          <Button 
            onClick={onSave} 
            disabled={saving || !form.user_email || !form.geography} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold min-w-[100px]"
          >
            {saving ? "Saving..." : editingAssign ? "Update Assignment" : "Create Assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}