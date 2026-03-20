import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Info, Globe2, Lock, Unlock } from "lucide-react";

export default function AdminProjectDialog({ open, onOpenChange, form, setForm, onSave, saving, editingProject }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-t-8 border-t-indigo-600">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {editingProject ? "Update Project Details" : "Create New Project"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Project Details */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-slate-500">Project Name *</Label>
              <Input 
                value={form.name} 
                onChange={e => set("name", e.target.value)} 
                placeholder="e.g. African Hints" 
                className="focus-visible:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500">Project Type *</Label>
                <Select value={form.project_type} onValueChange={v => set("project_type", v)}>
                  <SelectTrigger className="bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hints">Hints</SelectItem>
                    <SelectItem value="duplicates">Duplicates</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500">Status</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger className="bg-slate-50 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-slate-500">Client / Source</Label>
              <Input 
                value={form.client_name} 
                onChange={e => set("client_name", e.target.value)} 
                placeholder="FamilySearch" 
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-slate-500">Project Description</Label>
              <Textarea 
                value={form.description} 
                onChange={e => set("description", e.target.value)} 
                rows={3} 
                placeholder="Briefly describe project scope..."
                className="resize-none"
              />
            </div>
          </div>

          {/* Geography Status Legend / Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">Geography Access Logic</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Locked</span>
                  <span className="text-[9px] text-slate-400">Default state</span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Open</span>
                  <span className="text-[9px] text-slate-400">Allows batches</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 items-start text-[10px] text-slate-500 leading-relaxed pt-1">
              <Info className="w-3 h-3 mt-0.5 text-indigo-500 shrink-0" />
              <p>
                Geographies are added automatically via <strong>Assignments</strong>. 
                Use the Project Card to toggle access once assignments exist.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-4 mt-2 border-t border-slate-200 rounded-b-lg">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-500 text-xs font-semibold">
            Cancel
          </Button>
          <Button 
            onClick={onSave} 
            disabled={saving || !form.name} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 px-6"
          >
            {saving ? "Saving..." : editingProject ? "Save Changes" : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}