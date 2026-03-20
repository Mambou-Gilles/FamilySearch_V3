import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RefreshCw, Lock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function BatchRequestDialog({ open, onOpenChange, assignment, onConfirm, requesting }) {
  const [batchSize, setBatchSize] = useState(20);
  const [geoStatus, setGeoStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const steps = [10, 20, 30, 40, 50];

  // Logic: Check if the assigned geography is OPEN every time the dialog is shown
  useEffect(() => {
    if (open && assignment?.geography && assignment?.project_id) {
      checkGeographyStatus();
    }
  }, [open, assignment]);

  async function checkGeographyStatus() {
    setCheckingStatus(true);
    try {
      const { data, error } = await supabase
        .from('project_geography_states')
        .select('status')
        .eq('project_id', assignment.project_id)
        .eq('geography', assignment.geography)
        .single();

      if (error) throw error;
      setGeoStatus(data?.status || "locked");
    } catch (err) {
      console.error("Error fetching geo status:", err);
      setGeoStatus("unknown");
    } finally {
      setCheckingStatus(false);
    }
  }

  const isLocked = geoStatus !== "open";
  const canRequest = !isLocked && !requesting && !!assignment && !checkingStatus;

  function handleSliderChange([val]) {
    // Snap to nearest step
    const nearest = steps.reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a);
    setBatchSize(nearest);
  }

  function handleConfirm() {
    if (!canRequest) {
      toast.error("Cannot request tasks: Geography is not open.");
      return;
    }
    onConfirm(batchSize);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            Request Task Batch
            {checkingStatus && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
          </DialogTitle>
        </DialogHeader>

        {assignment ? (
          <div className="space-y-3">
            {/* Assignment Summary Card */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 space-y-1">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-bold">
                <span className="text-indigo-400">Project</span>
                <span className="text-indigo-900">{assignment.project_type || 'General'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-bold">
                <span className="text-indigo-400">Geography</span>
                <span className="text-indigo-900">{assignment.geography}</span>
              </div>
            </div>

            {/* Status Warning Banner */}
            {!checkingStatus && isLocked && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg animate-in fade-in slide-in-from-top-1">
                <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-bold uppercase tracking-tight">Access Restricted</p>
                  <p className="opacity-90">
                    This geography is currently <span className="font-bold underline">{geoStatus || 'Locked'}</span>. 
                    Please wait for a manager to open it.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
            <AlertCircle className="w-4 h-4" />
            No active assignment found for your profile.
          </div>
        )}

        {/* Batch Selection - Disabled if locked */}
        <div className={`py-4 space-y-4 transition-opacity duration-300 ${isLocked ? "opacity-30 pointer-events-none" : "opacity-100"}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Batch Size</p>
            <span className="text-3xl font-black text-indigo-600">{batchSize}</span>
          </div>

          <Slider
            min={10}
            max={50}
            step={10}
            value={[batchSize]}
            onValueChange={handleSliderChange}
            className="w-full"
          />

          <div className="flex justify-between px-1">
            {steps.map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setBatchSize(v)}
                className={`text-[10px] font-bold w-8 h-5 rounded transition-all ${
                  batchSize === v 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)} 
            disabled={requesting}
            className="text-slate-500 font-bold text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canRequest}
            className={`flex-1 font-bold shadow-lg transition-all ${
              canRequest 
                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100" 
                : "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed"
            }`}
          >
            {requesting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Request {batchSize} Tasks
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}









// import { useState } from "react";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Slider } from "@/components/ui/slider";
// import { RefreshCw } from "lucide-react";

// export default function BatchRequestDialog({ open, onOpenChange, assignment, onConfirm, requesting }) {
//   const [batchSize, setBatchSize] = useState(20);

//   const steps = [10, 20, 30, 40, 50];

//   function handleSliderChange([val]) {
//     // Snap to nearest step
//     const nearest = steps.reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a);
//     setBatchSize(nearest);
//   }

//   function handleConfirm() {
//     onConfirm(batchSize);
//   }

//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="max-w-sm">
//         <DialogHeader>
//           <DialogTitle className="text-base font-bold text-slate-800">Request Task Batch</DialogTitle>
//         </DialogHeader>

//         {/* This block correctly reflects the Project/Geo from your Supabase team_assignments table */}
//         {assignment ? (
//           <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 space-y-1">
//             <div className="flex items-center justify-between text-xs">
//               <span className="text-indigo-500 font-medium">Project</span>
//               <span className="text-indigo-800 font-semibold capitalize">
//                 {assignment.project_type || 'Unknown'}
//               </span>
//             </div>
//             <div className="flex items-center justify-between text-xs">
//               <span className="text-indigo-500 font-medium">Geography</span>
//               <span className="text-indigo-800 font-semibold">
//                 {assignment.geography || 'N/A'}
//               </span>
//             </div>
//           </div>
//         ) : (
//           <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
//             Warning: No active assignment detected.
//           </div>
//         )}

//         <div className="py-2 space-y-4">
//           <div className="flex items-center justify-between">
//             <p className="text-sm font-medium text-slate-700">How many tasks?</p>
//             <span className="text-2xl font-extrabold text-indigo-600">{batchSize}</span>
//           </div>

//           <Slider
//             min={10}
//             max={50}
//             step={10}
//             value={[batchSize]}
//             onValueChange={handleSliderChange}
//             className="w-full"
//           />

//           <div className="flex justify-between text-xs text-slate-400">
//             {steps.map(v => (
//               <button
//                 key={v}
//                 type="button"
//                 onClick={() => setBatchSize(v)}
//                 className={`w-8 h-6 rounded font-medium transition-colors ${
//                   batchSize === v ? "bg-indigo-600 text-white" : "hover:bg-slate-100 text-slate-500"
//                 }`}
//               >
//                 {v}
//               </button>
//             ))}
//           </div>
//         </div>

//         <DialogFooter className="gap-2">
//           <Button variant="outline" onClick={() => onOpenChange(false)} disabled={requesting}>
//             Cancel
//           </Button>
//           <Button
//             onClick={handleConfirm}
//             disabled={requesting || !assignment}
//             className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
//           >
//             <RefreshCw className={`w-4 h-4 mr-1.5 ${requesting ? "animate-spin" : ""}`} />
//             {requesting ? "Requesting..." : `Request ${batchSize} Tasks`}
//           </Button>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   );
// }