import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Download } from "lucide-react";

// Convert array of objects to CSV and download
function downloadCsv(rows, headers, filename) {
  if (!rows.length) return;
  const csvRows = [
    headers.map(h => h.label).join(","),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h.key] ?? "";
        const str = String(val);
        return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(",")
    )
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Manager export modal — select headers from their project tasks
export function ManagerExportModal({ open, onClose, tasks, projectName, dateFrom: initFrom, dateTo: initTo }) {
  const ALL_HEADERS = [
    { key: "url", label: "URL" },
    { key: "geography", label: "Geography" },
    { key: "cohort", label: "Cohort" },
    { key: "project_type", label: "Project Type" },
    { key: "status", label: "Status" },
    { key: "batch_id", label: "Batch ID" },
    { key: "contributor_name", label: "Contributor" },
    { key: "contributor_email", label: "Contributor Email" },
    { key: "date_completed", label: "Date Completed" },
    { key: "original_completion_date", label: "Original Completion Date" },
    { key: "time_spent_contributor", label: "Time Spent (Contributor)" },
    { key: "contributor_notes", label: "Contributor Notes" },
    { key: "hint_result", label: "Hint Result" },
    { key: "qualifications_created", label: "Qualifications Created" },
    { key: "new_persons_added", label: "New Persons Added" },
    { key: "member_connected", label: "Member Connected" },
    { key: "new_person_available", label: "New Person Available" },
    { key: "duplicate_result", label: "Duplicate Result" },
    { key: "duplicates_resolved", label: "Duplicates Resolved" },
    { key: "data_conflicts", label: "Data Conflicts" },
    { key: "qualification_status", label: "Qualification Status" },
    { key: "revision_needed", label: "Revision Needed" },
    { key: "reviewer_name", label: "Reviewer" },
    { key: "reviewer_email", label: "Reviewer Email" },
    { key: "review_date", label: "Review Date" },
    { key: "tree_work_review", label: "Tree Work Review" },
    { key: "doc_results", label: "Doc Results" },
    { key: "time_spent_reviewer", label: "Time Spent (Reviewer)" },
    { key: "reviewer_notes", label: "Reviewer Notes" },
    { key: "quality_score_tree", label: "Score: Tree" },
    { key: "quality_score_doc", label: "Score: Doc" },
    { key: "total_quality_score", label: "Total Quality Score" },
    { key: "correction_count", label: "Corrections" },
  ];

  const today = new Date().toISOString().split("T")[0];
  const thirtyAgo = new Date(Date.now() - 30 * 864e5).toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(initFrom || thirtyAgo);
  const [dateTo, setDateTo] = useState(initTo || today);
  const [selected, setSelected] = useState(
    new Set(["url", "geography", "cohort", "status", "contributor_name", "date_completed", "total_quality_score", "correction_count", "reviewer_name", "review_date"])
  );

  const toggle = (key) => setSelected(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const filteredTasks = tasks.filter(t => {
    const d = (t.date_completed || "").split("T")[0];
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });

  function doExport() {
    const orderedHeaders = ALL_HEADERS.filter(h => selected.has(h.key));
    downloadCsv(filteredTasks, orderedHeaders, `${projectName || "export"}_${dateFrom}_${dateTo}.csv`);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-600" />
            Export CSV — {projectName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">Date Range</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={dateTo} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom} max={today} className="h-8 text-sm" />
              </div>
              <div className="mt-4 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                <strong>{filteredTasks.length}</strong> rows to export
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Select Columns</p>
              <div className="flex gap-2">
                <button onClick={() => setSelected(new Set(ALL_HEADERS.map(h => h.key)))} className="text-xs text-indigo-600 hover:underline">Select All</button>
                <span className="text-slate-300">|</span>
                <button onClick={() => setSelected(new Set())} className="text-xs text-slate-500 hover:underline">Clear</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-3 border border-slate-200">
              {ALL_HEADERS.map(h => (
                <div key={h.key} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selected.has(h.key) ? "bg-indigo-50" : "hover:bg-white"}`}
                  onClick={() => toggle(h.key)}>
                  <Checkbox id={`col-${h.key}`} checked={selected.has(h.key)} onCheckedChange={() => toggle(h.key)} />
                  <Label htmlFor={`col-${h.key}`} className="text-xs cursor-pointer">{h.label}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={selected.size === 0 || filteredTasks.length === 0} onClick={doExport} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Download className="w-4 h-4 mr-2" /> Export {filteredTasks.length} Rows
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Client export modal — pick project type, project, geo, date range, then headers
export function ClientExportModal({ open, onClose, projects, tasks }) {
  const today = new Date().toISOString().split("T")[0];
  const thirtyAgo = new Date(Date.now() - 30 * 864e5).toISOString().split("T")[0];

  const [selectedProjectType, setSelectedProjectType] = useState("all");
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [selectedGeo, setSelectedGeo] = useState("all");
  const [dateFrom, setDateFrom] = useState(thirtyAgo);
  const [dateTo, setDateTo] = useState(today);

  // Column definitions remain consistent with Supabase schema keys
  const HINTS_HEADERS = [
    { key: "url", label: "URL" },
    { key: "geography", label: "Geography" },
    { key: "cohort", label: "Cohort" },
    { key: "status", label: "Status" },
    { key: "contributor_name", label: "Contributor" },
    { key: "date_completed", label: "Date Completed" },
    { key: "hint_result", label: "Hint Result" },
    { key: "qualifications_created", label: "Qualifications Created" },
    { key: "new_persons_added", label: "New Persons Added" },
    { key: "member_connected", label: "Member Connected" },
    { key: "time_spent_contributor", label: "Time Spent" },
    { key: "contributor_notes", label: "Contributor Notes" },
    { key: "revision_needed", label: "Revision Needed" },
    { key: "reviewer_name", label: "Reviewer" },
    { key: "review_date", label: "Review Date" },
    { key: "tree_work_review", label: "Tree Work Review" },
    { key: "doc_results", label: "Doc Results" },
    { key: "reviewer_notes", label: "Reviewer Notes" },
    { key: "quality_score_tree", label: "Score: Tree" },
    { key: "quality_score_doc", label: "Score: Doc" },
    { key: "total_quality_score", label: "Quality Score" },
    { key: "correction_count", label: "Corrections" },
  ];
  
  const DUPS_HEADERS = [
    { key: "url", label: "URL" },
    { key: "geography", label: "Geography" },
    { key: "cohort", label: "Cohort" },
    { key: "status", label: "Status" },
    { key: "contributor_name", label: "Contributor" },
    { key: "date_completed", label: "Date Completed" },
    { key: "duplicate_result", label: "Duplicate Result" },
    { key: "duplicates_resolved", label: "Duplicates Resolved" },
    { key: "qualifications_created", label: "Qualifications Created" },
    { key: "time_spent_contributor", label: "Time Spent" },
    { key: "data_conflicts", label: "Data Conflicts" },
    { key: "revision_needed", label: "Revision Needed" },
    { key: "reviewer_name", label: "Reviewer" },
    { key: "review_date", label: "Review Date" },
    { key: "tree_work_review", label: "Tree Work Review" },
    { key: "reviewer_notes", label: "Reviewer Notes" },
    { key: "total_quality_score", label: "Quality Score" },
    { key: "correction_count", label: "Corrections" },
  ];

  const ALL_HEADERS = [
    { key: "url", label: "URL" },
    { key: "geography", label: "Geography" },
    { key: "cohort", label: "Cohort" },
    { key: "project_type", label: "Project Type" },
    { key: "status", label: "Status" },
    { key: "contributor_name", label: "Contributor" },
    { key: "date_completed", label: "Date Completed" },
    { key: "hint_result", label: "Hint Result" },
    { key: "duplicate_result", label: "Duplicate Result" },
    { key: "qualifications_created", label: "Qualifications Created" },
    { key: "time_spent_contributor", label: "Time Spent" },
    { key: "revision_needed", label: "Revision Needed" },
    { key: "reviewer_name", label: "Reviewer" },
    { key: "review_date", label: "Review Date" },
    { key: "total_quality_score", label: "Quality Score" },
    { key: "correction_count", label: "Corrections" },
  ];

  // Cascade: projects filtered by selected type
  const filteredProjects = selectedProjectType === "all"
    ? projects
    : projects.filter(p => p.project_type === selectedProjectType);

  const selectedProj = selectedProjectId !== "all" ? projects.find(p => p.id === selectedProjectId) : null;
  const effectiveType = selectedProj?.project_type || (selectedProjectType !== "all" ? selectedProjectType : null);
  const AVAILABLE_HEADERS = effectiveType === "hints" ? HINTS_HEADERS : effectiveType === "duplicates" ? DUPS_HEADERS : ALL_HEADERS;

  const [selected, setSelected] = useState(new Set(AVAILABLE_HEADERS.map(h => h.key)));

  // Geos available given project/type selection
  const geos = (() => {
    let base = tasks;
    if (selectedProjectId !== "all") {
      base = base.filter(t => t.project_id === selectedProjectId);
    } else if (selectedProjectType !== "all") {
      const ids = filteredProjects.map(p => p.id);
      base = base.filter(t => ids.includes(t.project_id));
    } else {
      const ids = projects.map(p => p.id);
      base = base.filter(t => ids.includes(t.project_id));
    }
    return [...new Set(base.map(t => t.geography).filter(Boolean))].sort();
  })();

  const toggle = (key) => setSelected(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  function handleTypeChange(type) {
    setSelectedProjectType(type);
    setSelectedProjectId("all");
    setSelectedGeo("all");
  }

  function handleProjectChange(pid) {
    setSelectedProjectId(pid);
    setSelectedGeo("all");
    const proj = projects.find(p => p.id === pid);
    const etype = proj?.project_type || (selectedProjectType !== "all" ? selectedProjectType : null);
    const headers = etype === "hints" ? HINTS_HEADERS : etype === "duplicates" ? DUPS_HEADERS : ALL_HEADERS;
    setSelected(new Set(headers.map(h => h.key)));
  }

  // Count rows matching all filters
  const rowCount = tasks.filter(t => {
    if (selectedProjectId !== "all" && t.project_id !== selectedProjectId) return false;
    if (selectedProjectId === "all") {
      const ids = filteredProjects.map(p => p.id);
      if (!ids.includes(t.project_id)) return false;
    }
    if (selectedGeo !== "all" && t.geography !== selectedGeo) return false;
    const d = (t.date_completed || "").split("T")[0];
    return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
  }).length;

  function doExport() {
    const filteredTasks = tasks.filter(t => {
      if (selectedProjectId !== "all" && t.project_id !== selectedProjectId) return false;
      if (selectedProjectId === "all") {
        const ids = filteredProjects.map(p => p.id);
        if (!ids.includes(t.project_id)) return false;
      }
      if (selectedGeo !== "all" && t.geography !== selectedGeo) return false;
      const d = (t.date_completed || "").split("T")[0];
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
    const orderedHeaders = AVAILABLE_HEADERS.filter(h => selected.has(h.key));
    const namePart = selectedProj?.name || (selectedProjectType !== "all" ? selectedProjectType : "all-projects");
    const geoPart = selectedGeo !== "all" ? `_${selectedGeo}` : "";
    downloadCsv(filteredTasks, orderedHeaders, `${namePart}${geoPart}_${dateFrom}_${dateTo}.csv`);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-600" /> Export Project Data
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Filters row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-slate-600 mb-1 block">Project Type</Label>
              <select value={selectedProjectType} onChange={e => handleTypeChange(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
                <option value="all">All Types</option>
                <option value="hints">Hints</option>
                <option value="duplicates">Duplicates</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1 block">Project</Label>
              <select value={selectedProjectId} onChange={e => handleProjectChange(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
                <option value="all">All Projects</option>
                {filteredProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1 block">Geography</Label>
              <select value={selectedGeo} onChange={e => setSelectedGeo(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
                <option value="all">All Geographies</option>
                {geos.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

           {/* Date range */}     
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Date Range (completion date)</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={dateTo} className="h-8 text-sm w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom} max={today} className="h-8 text-sm w-40" />
              </div>
              <div className="mt-4 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-medium">
                {rowCount} rows
              </div>
            </div>
          </div>

           {/* Column selection */}     
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Select Columns</p>
              <div className="flex gap-2">
                <button onClick={() => setSelected(new Set(AVAILABLE_HEADERS.map(h => h.key)))} className="text-xs text-indigo-600 hover:underline">All</button>
                <span className="text-slate-300">|</span>
                <button onClick={() => setSelected(new Set())} className="text-xs text-slate-500 hover:underline">None</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-50 rounded-xl p-3 border border-slate-200">
              {AVAILABLE_HEADERS.map(h => (
                <div key={h.key} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selected.has(h.key) ? "bg-indigo-50" : "hover:bg-white"}`}
                  onClick={() => toggle(h.key)}>
                  <Checkbox id={`ccol-${h.key}`} checked={selected.has(h.key)} onCheckedChange={() => toggle(h.key)} />
                  <Label htmlFor={`ccol-${h.key}`} className="text-xs cursor-pointer">{h.label}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={selected.size === 0 || rowCount === 0} onClick={doExport} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Download className="w-4 h-4 mr-2" /> Export {rowCount} Rows
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}