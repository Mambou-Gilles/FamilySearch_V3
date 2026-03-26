import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient"; // Swapping to Supabase
import { toast } from "sonner";
import { Lock, Unlock, CheckCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_STYLE = {
  open: "bg-green-50 text-green-700 border-green-200",
  locked: "bg-slate-50 text-slate-500 border-slate-200",
  completed: "bg-indigo-50 text-indigo-600 border-indigo-200",
};

const STATUS_ICON = { open: Unlock, locked: Lock, completed: CheckCircle };

const COMPLETED_STATUSES = ["completed", "in_review", "needs_correction", "reviewed"];

export default function GeographyControlPanel({ project, myAssignment, tasks = [] }) {
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    if (project?.id) loadStates();
  }, [project?.id]);

  async function loadStates() {
    setLoading(true);
    const { data, error } = await supabase
      .from('project_geography_states')
      .select('*')
      .eq('project_id', project.id);
    
    if (error) toast.error("Failed to load geography states");
    else setStates(data || []);
    setLoading(false);
  }

  async function setGeographyStatus(geo, newStatus) {
    setSaving(geo);
    const state = states.find(s => s.geography === geo);
    if (!state) { setSaving(null); return; }

    try {
      if (newStatus === "open") {
        // Enforce the rule: Only one geography can be open at a time
        const othersOpen = states.filter(s => s.status === "open" && s.geography !== geo);
        
        if (othersOpen.length > 0) {
          await supabase
            .from('project_geography_states')
            .update({ status: "locked" })
            .in('id', othersOpen.map(s => s.id));
        }

        await supabase
          .from('project_geography_states')
          .update({
            status: "open",
            opened_by_email: myAssignment?.user_email,
            opened_at: new Date().toISOString(),
          })
          .eq('id', state.id);

        toast.success(`${geo} opened — all others locked`);
      } else {
        await supabase
          .from('project_geography_states')
          .update({ status: newStatus })
          .eq('id', state.id);
        
        toast.success(`${geo} set to ${newStatus}`);
      }
      await loadStates();
    } catch (err) {
      toast.error("An error occurred while updating status");
    } finally {
      setSaving(null);
    }
  }

  function getGeoMetrics(geo) {
    const geoTasks = tasks.filter(t => t.geography === geo);
    const total = geoTasks.length;
    const completed = geoTasks.filter(t => COMPLETED_STATUSES.includes(t.status)).length;
    const available = geoTasks.filter(t => t.status === "available").length;
    const remaining = total - completed;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, available, remaining, pct };
  }

  if (loading) return <div className="text-sm text-slate-400 py-4 italic">Fetching geography statuses...</div>;

  if (!states.length) return (
    <div className="text-sm text-slate-400 py-8 text-center border-2 border-dashed rounded-xl">
      No geographies registered. Add an assignment to initialize geographies.
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Globe className="w-5 h-5 text-indigo-600" />
        <h3 className="text-base font-bold text-slate-800">Geography Access Control</h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-auto bg-slate-100 px-2 py-1 rounded">
          Strict Access Mode
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {states.map(state => {
          const geo = state.geography;
          const status = state?.status || "locked";
          const Icon = STATUS_ICON[status] || Lock;
          const isSaving = saving === geo;
          const isMyGeo = myAssignment?.geography === geo;
          const m = getGeoMetrics(geo);
          const readyToComplete = m.available === 0 && m.remaining === 0 && m.total > 0;

          return (
            <div key={geo} className={`border-2 transition-all rounded-xl p-4 flex flex-col justify-between ${STATUS_STYLE[status]} ${status === 'open' ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}>
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold leading-tight">{geo}</p>
                      {isMyGeo && <p className="text-[10px] font-bold uppercase opacity-60">Primary</p>}
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border border-current`}>{status}</span>
                </div>

                {/* Metrics */}
                {m.total > 0 ? (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-[11px] font-bold opacity-80 uppercase">
                      <span>Progress</span>
                      <span>{m.pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-current opacity-50 transition-all duration-500" style={{ width: `${m.pct}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                        <div className="text-center bg-white/30 rounded p-1">
                            <p className="text-xs font-bold">{m.available}</p>
                            <p className="text-[9px] uppercase opacity-60">Avail</p>
                        </div>
                        <div className="text-center bg-white/30 rounded p-1">
                            <p className="text-xs font-bold">{m.remaining}</p>
                            <p className="text-[9px] uppercase opacity-60">Pend</p>
                        </div>
                        <div className="text-center bg-white/30 rounded p-1">
                            <p className="text-xs font-bold">{m.completed}</p>
                            <p className="text-[9px] uppercase opacity-60">Done</p>
                        </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] font-medium opacity-50 mt-4 italic">No tasks currently uploaded.</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                {status !== "open" && status !== "completed" && (
                  <Button size="sm" onClick={() => setGeographyStatus(geo, "open")} disabled={isSaving}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold h-8">
                    {isSaving ? "..." : "Open"}
                  </Button>
                )}
                {status === "open" && (
                  <Button size="sm" onClick={() => setGeographyStatus(geo, "locked")} disabled={isSaving}
                    variant="outline" className="flex-1 h-8 font-bold border-slate-300">
                    {isSaving ? "..." : "Lock"}
                  </Button>
                )}
                {status !== "completed" && (
                  <Button size="sm" onClick={() => setGeographyStatus(geo, "completed")} disabled={isSaving}
                    variant="outline" className="flex-1 h-8 font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-100">
                    {isSaving ? "..." : "Complete"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

