import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Search, Filter, Layers, Users, ChevronLeft, ChevronRight, Edit2, X, Check } from "lucide-react"; // Added Edit2, X, Check
import StatusBadge from "@/components/StatusBadge";
import SortableTableHeader from "@/components/SortableTableHeader";
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

// Added 'onUpdateManager' to props
export default function AdminAssignmentsTab({ assignments, projects, profiles, onAdd, onDelete, onDeleteSelected, onUpdateManager }) {
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [geoFilter, setGeoFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [sortField, setSortField] = useState("user_name");
  const [sortDir, setSortDir] = useState("asc");

  // --- New State for Editing ---
  const [editingId, setEditingId] = useState(null);
  const [newManagerId, setNewManagerId] = useState("");

  // --- Shadcn Alert State ---
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ title: "", desc: "", action: null });

  // Get list of all available managers from assignments to populate dropdown
  const allManagers = useMemo(() => {
    if (!profiles) return [];
    return profiles
      .filter(p => p.system_role === 'manager') // Only show actual managers
      .map(p => ({
        id: p.id,
        name: p.full_name || p.email,
        email: p.email
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles]);

  const teamCounts = useMemo(() => {
    const counts = {};
    assignments.forEach(a => {
      if (a.role === 'manager') return;
      const key = `${a.project_id}-${a.geography}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [assignments]);

  const availableProjects = useMemo(() => projects || [], [projects]);
  
  const availableGeos = useMemo(() => {
    const subset = projectFilter === "all" 
      ? assignments 
      : assignments.filter(a => a.project_id === projectFilter);
    return [...new Set(subset.map(a => a.geography).filter(Boolean))].sort();
  }, [assignments, projectFilter]);

  const roles = [...new Set(assignments.map(a => a.role).filter(Boolean))];

  const filtered = assignments
    .filter(a => {
      if (projectFilter !== "all" && a.project_id !== projectFilter) return false;
      if (geoFilter !== "all" && a.geography !== geoFilter) return false;
      if (roleFilter !== "all" && a.role !== roleFilter) return false;

      if (projectFilter === "all" && geoFilter === "all" && roleFilter === "all" && !search) {
        if (a.role !== "manager") return false;
      }

      if (search && 
          !a.user_name?.toLowerCase().includes(search.toLowerCase()) && 
          !a.user_email?.toLowerCase().includes(search.toLowerCase())) return false;
      
      return true;
    })
    .sort((x, y) => {
      const av = (x[sortField] || "").toString();
      const bv = (y[sortField] || "").toString();
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const allPageSelected = paged.length > 0 && paged.every(a => selected.has(a.id));

  // --- Confirmation Triggers ---
  const triggerDeleteOne = (id, assignment) => {
    setConfirmConfig({
      title: "Remove Assignment?",
      desc: `Are you sure you want to remove ${assignment.user_name} from ${projects.find(p => p.id === assignment.project_id)?.name}? This will stop their access to this specific project.`,
      action: () => onDelete(id, assignment)
    });
    setConfirmOpen(true);
  };

  const triggerDeleteSelected = () => {
    const toDelete = assignments.filter(a => selected.has(a.id));
    setConfirmConfig({
      title: `Remove ${toDelete.length} Assignments?`,
      desc: `You are about to delete ${toDelete.length} selected team assignments. This action cannot be undone.`,
      action: () => {
        onDeleteSelected(toDelete);
        setSelected(new Set());
      }
    });
    setConfirmOpen(true);
  };

  function handleSort(field) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
    setPage(0);
  }

  function toggleOne(id) {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function togglePage() {
    const n = new Set(selected);
    if (allPageSelected) paged.forEach(a => n.delete(a.id));
    else paged.forEach(a => n.add(a.id));
    setSelected(n);
  }

  // --- New Edit Functions ---
  const startEdit = (assignment) => {
    setEditingId(assignment.id);
    setNewManagerId(assignment.user_id); // Default to current manager
  };

  const saveEdit = (assignmentId) => {
    if (onUpdateManager) {
      onUpdateManager(assignmentId, newManagerId);
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" /> Team Assignments
          </h2>
          <p className="text-xs text-slate-500">
            {projectFilter === "all" ? "System Overview: Showing Primary Managers" : `Viewing team for project`}
          </p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button size="sm" variant="destructive" onClick={triggerDeleteSelected}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete ({selected.size})
            </Button>
          )}
          <Button size="sm" onClick={onAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
            <Plus className="w-4 h-4 mr-1" /> Add Assignment
          </Button>
        </div>
      </div>

      {/* Filter Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            value={search} 
            onChange={e => { setSearch(e.target.value); setPage(0); }} 
            placeholder="Search name/email..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Project</span>
          <select 
            value={projectFilter} 
            onChange={e => { setProjectFilter(e.target.value); setGeoFilter("all"); setPage(0); }}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:bg-white outline-none"
          >
            <option value="all">All Projects</option>
            {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Geo</span>
          <select 
            value={geoFilter} 
            disabled={projectFilter === "all" && availableGeos.length === 0}
            onChange={e => { setGeoFilter(e.target.value); setPage(0); }}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:bg-white outline-none disabled:opacity-50"
          >
            <option value="all">All Geographies</option>
            {availableGeos.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Role</span>
          <select 
            value={roleFilter} 
            onChange={e => { setRoleFilter(e.target.value); setPage(0); }}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:bg-white outline-none"
          >
            <option value="all">All Roles</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-3 w-10"><Checkbox checked={allPageSelected} onCheckedChange={togglePage} /></th>
                <SortableTableHeader label="User" field="user_name" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
                <SortableTableHeader label="Role" field="role" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
                <SortableTableHeader label="Project & Geography" field="geography" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
                <th className="p-3 text-left text-slate-600 font-medium">Team Size</th>
                <SortableTableHeader label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
                <th className="p-3 text-right text-slate-600 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <Filter className="w-8 h-8 opacity-20 mx-auto mb-2" />
                    <p>No matches found.</p>
                  </td>
                </tr>
              ) : (
                paged.map(a => {
                  const isManager = a.role === 'manager';
                  const count = teamCounts[`${a.project_id}-${a.geography}`] || 0;
                  const isEditing = editingId === a.id;

                  return (
                    <tr key={a.id} className={`hover:bg-slate-50 transition-colors ${selected.has(a.id) ? "bg-indigo-50/40" : ""}`}>
                      <td className="p-3">
                        <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleOne(a.id)} />
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <select 
                              value={newManagerId}
                              onChange={(e) => setNewManagerId(e.target.value)}
                              className="text-xs border border-slate-200 rounded px-1 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              {allManagers.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                               <button onClick={() => saveEdit(a.id)} className="text-[10px] flex items-center text-green-600 hover:text-green-700 font-bold">
                                 <Check className="w-3 h-3 mr-0.5" /> Save
                               </button>
                               <button onClick={() => setEditingId(null)} className="text-[10px] flex items-center text-slate-400 hover:text-slate-600 font-bold">
                                 <X className="w-3 h-3 mr-0.5" /> Cancel
                               </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="font-medium text-slate-900">{a.user_name}</div>
                            <div className="text-[11px] text-slate-400">{a.user_email}</div>
                          </>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          isManager ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {a.role}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="text-slate-700 font-medium truncate max-w-[150px]">
                          {projects.find(p => p.id === a.project_id)?.name || "—"}
                        </div>
                        <div className="text-xs text-slate-400">{a.geography || "N/A"}</div>
                      </td>
                      <td className="p-3">
                        {isManager ? (
                          <div className="flex items-center gap-1.5 text-indigo-600 font-bold bg-indigo-50 w-fit px-2 py-1 rounded-md border border-indigo-100">
                            <Users className="w-3 h-3" />
                            <span>{count}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="p-3"><StatusBadge status={a.status} /></td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          {isManager && !isEditing && (
                            <button 
                              onClick={() => startEdit(a)} 
                              className="text-slate-300 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition-all"
                              title="Replace Manager"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => triggerDeleteOne(a.id, a)} className="text-slate-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Restore Full Pagination UI */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="text-slate-900">{page * PAGE_SIZE + 1}</span> to <span className="text-slate-900">{Math.min((page + 1) * PAGE_SIZE, filtered.length)}</span> of <span className="text-slate-900">{filtered.length}</span> assignments
            </div>
            <div className="flex items-center gap-1">
              <button 
                disabled={page === 0} 
                onClick={() => setPage(p => p - 1)} 
                className="p-1 rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1 mx-1">
                {Array.from({ length: totalPages }, (_, i) => {
                  if (i === 0 || i === totalPages - 1 || (i >= page - 1 && i <= page + 1)) {
                    return (
                      <button 
                        key={i} 
                        onClick={() => setPage(i)} 
                        className={`w-7 h-7 text-xs rounded font-bold transition-all ${
                          page === i 
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                          : "text-slate-600 hover:bg-slate-200 bg-white border border-slate-200"
                        }`}
                      >
                        {i + 1}
                      </button>
                    );
                  }
                  if (i === 1 || i === totalPages - 2) {
                    return <span key={i} className="text-slate-400 px-1 italic">...</span>;
                  }
                  return null;
                })}
              </div>

              <button 
                disabled={page >= totalPages - 1} 
                onClick={() => setPage(p => p + 1)} 
                className="p-1 rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- Shadcn AlertDialog --- */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmConfig.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmConfig.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                confirmConfig.action?.();
                setConfirmOpen(false);
              }}
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
















// import { useState, useMemo } from "react";
// import { Button } from "@/components/ui/button";
// import { Checkbox } from "@/components/ui/checkbox";
// import { Plus, Trash2, Search, Filter, Layers, Users, ChevronLeft, ChevronRight } from "lucide-react";
// import StatusBadge from "@/components/StatusBadge";
// import SortableTableHeader from "@/components/SortableTableHeader";
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

// const PAGE_SIZE = 15;

// export default function AdminAssignmentsTab({ assignments, projects, onAdd, onDelete, onDeleteSelected }) {
//   const [search, setSearch] = useState("");
//   const [projectFilter, setProjectFilter] = useState("all");
//   const [geoFilter, setGeoFilter] = useState("all");
//   const [roleFilter, setRoleFilter] = useState("all");
//   const [page, setPage] = useState(0);
//   const [selected, setSelected] = useState(new Set());
//   const [sortField, setSortField] = useState("user_name");
//   const [sortDir, setSortDir] = useState("asc");

//   // --- Shadcn Alert State ---
//   const [confirmOpen, setConfirmOpen] = useState(false);
//   const [confirmConfig, setConfirmConfig] = useState({ title: "", desc: "", action: null });

//   const teamCounts = useMemo(() => {
//     const counts = {};
//     assignments.forEach(a => {
//       if (a.role === 'manager') return;
//       const key = `${a.project_id}-${a.geography}`;
//       counts[key] = (counts[key] || 0) + 1;
//     });
//     return counts;
//   }, [assignments]);

//   const availableProjects = useMemo(() => projects || [], [projects]);
  
//   const availableGeos = useMemo(() => {
//     const subset = projectFilter === "all" 
//       ? assignments 
//       : assignments.filter(a => a.project_id === projectFilter);
//     return [...new Set(subset.map(a => a.geography).filter(Boolean))].sort();
//   }, [assignments, projectFilter]);

//   const roles = [...new Set(assignments.map(a => a.role).filter(Boolean))];

//   const filtered = assignments
//     .filter(a => {
//       if (projectFilter !== "all" && a.project_id !== projectFilter) return false;
//       if (geoFilter !== "all" && a.geography !== geoFilter) return false;
//       if (roleFilter !== "all" && a.role !== roleFilter) return false;

//       if (projectFilter === "all" && geoFilter === "all" && roleFilter === "all" && !search) {
//         if (a.role !== "manager") return false;
//       }

//       if (search && 
//           !a.user_name?.toLowerCase().includes(search.toLowerCase()) && 
//           !a.user_email?.toLowerCase().includes(search.toLowerCase())) return false;
      
//       return true;
//     })
//     .sort((x, y) => {
//       const av = (x[sortField] || "").toString();
//       const bv = (y[sortField] || "").toString();
//       return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
//     });

//   const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
//   const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
//   const allPageSelected = paged.length > 0 && paged.every(a => selected.has(a.id));

//   // --- Confirmation Triggers ---
//   const triggerDeleteOne = (id, assignment) => {
//     setConfirmConfig({
//       title: "Remove Assignment?",
//       desc: `Are you sure you want to remove ${assignment.user_name} from ${projects.find(p => p.id === assignment.project_id)?.name}? This will stop their access to this specific project.`,
//       action: () => onDelete(id, assignment)
//     });
//     setConfirmOpen(true);
//   };

//   const triggerDeleteSelected = () => {
//     const toDelete = assignments.filter(a => selected.has(a.id));
//     setConfirmConfig({
//       title: `Remove ${toDelete.length} Assignments?`,
//       desc: `You are about to delete ${toDelete.length} selected team assignments. This action cannot be undone.`,
//       action: () => {
//         onDeleteSelected(toDelete);
//         setSelected(new Set());
//       }
//     });
//     setConfirmOpen(true);
//   };

//   function handleSort(field) {
//     if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
//     else { setSortField(field); setSortDir("asc"); }
//     setPage(0);
//   }

//   function toggleOne(id) {
//     setSelected(prev => {
//       const n = new Set(prev);
//       if (n.has(id)) n.delete(id); else n.add(id);
//       return n;
//     });
//   }

//   function togglePage() {
//     const n = new Set(selected);
//     if (allPageSelected) paged.forEach(a => n.delete(a.id));
//     else paged.forEach(a => n.add(a.id));
//     setSelected(n);
//   }

//   return (
//     <div className="space-y-4">
//       <div className="flex items-center justify-between flex-wrap gap-3">
//         <div>
//           <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
//             <Layers className="w-4 h-4 text-indigo-500" /> Team Assignments
//           </h2>
//           <p className="text-xs text-slate-500">
//             {projectFilter === "all" ? "System Overview: Showing Primary Managers" : `Viewing team for project`}
//           </p>
//         </div>
//         <div className="flex gap-2">
//           {selected.size > 0 && (
//             <Button size="sm" variant="destructive" onClick={triggerDeleteSelected}>
//               <Trash2 className="w-4 h-4 mr-1" /> Delete ({selected.size})
//             </Button>
//           )}
//           <Button size="sm" onClick={onAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
//             <Plus className="w-4 h-4 mr-1" /> Add Assignment
//           </Button>
//         </div>
//       </div>

//       {/* Filter Grid */}
//       <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
//         <div className="relative">
//           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
//           <input 
//             value={search} 
//             onChange={e => { setSearch(e.target.value); setPage(0); }} 
//             placeholder="Search name/email..."
//             className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" 
//           />
//         </div>

//         <div className="flex items-center gap-2">
//           <span className="text-[10px] font-bold text-slate-400 uppercase">Project</span>
//           <select 
//             value={projectFilter} 
//             onChange={e => { setProjectFilter(e.target.value); setGeoFilter("all"); setPage(0); }}
//             className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:bg-white outline-none"
//           >
//             <option value="all">All Projects</option>
//             {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
//           </select>
//         </div>

//         <div className="flex items-center gap-2">
//           <span className="text-[10px] font-bold text-slate-400 uppercase">Geo</span>
//           <select 
//             value={geoFilter} 
//             disabled={projectFilter === "all" && availableGeos.length === 0}
//             onChange={e => { setGeoFilter(e.target.value); setPage(0); }}
//             className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:bg-white outline-none disabled:opacity-50"
//           >
//             <option value="all">All Geographies</option>
//             {availableGeos.map(g => <option key={g} value={g}>{g}</option>)}
//           </select>
//         </div>

//         <div className="flex items-center gap-2">
//           <span className="text-[10px] font-bold text-slate-400 uppercase">Role</span>
//           <select 
//             value={roleFilter} 
//             onChange={e => { setRoleFilter(e.target.value); setPage(0); }}
//             className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:bg-white outline-none"
//           >
//             <option value="all">All Roles</option>
//             {roles.map(r => <option key={r} value={r}>{r}</option>)}
//           </select>
//         </div>
//       </div>

//       <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm">
//             <thead className="bg-slate-50 border-b border-slate-200">
//               <tr>
//                 <th className="p-3 w-10"><Checkbox checked={allPageSelected} onCheckedChange={togglePage} /></th>
//                 <SortableTableHeader label="User" field="user_name" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
//                 <SortableTableHeader label="Role" field="role" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
//                 <SortableTableHeader label="Project & Geography" field="geography" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
//                 <th className="p-3 text-left text-slate-600 font-medium">Team Size</th>
//                 <SortableTableHeader label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
//                 <th className="p-3 text-right text-slate-600 font-medium">Actions</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-slate-100">
//               {paged.length === 0 ? (
//                 <tr>
//                   <td colSpan={7} className="p-12 text-center text-slate-400">
//                     <Filter className="w-8 h-8 opacity-20 mx-auto mb-2" />
//                     <p>No matches found.</p>
//                   </td>
//                 </tr>
//               ) : (
//                 paged.map(a => {
//                   const isManager = a.role === 'manager';
//                   const count = teamCounts[`${a.project_id}-${a.geography}`] || 0;

//                   return (
//                     <tr key={a.id} className={`hover:bg-slate-50 transition-colors ${selected.has(a.id) ? "bg-indigo-50/40" : ""}`}>
//                       <td className="p-3">
//                         <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleOne(a.id)} />
//                       </td>
//                       <td className="p-3">
//                         <div className="font-medium text-slate-900">{a.user_name}</div>
//                         <div className="text-[11px] text-slate-400">{a.user_email}</div>
//                       </td>
//                       <td className="p-3">
//                         <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
//                           isManager ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
//                         }`}>
//                           {a.role}
//                         </span>
//                       </td>
//                       <td className="p-3">
//                         <div className="text-slate-700 font-medium truncate max-w-[150px]">
//                           {projects.find(p => p.id === a.project_id)?.name || "—"}
//                         </div>
//                         <div className="text-xs text-slate-400">{a.geography || "N/A"}</div>
//                       </td>
//                       <td className="p-3">
//                         {isManager ? (
//                           <div className="flex items-center gap-1.5 text-indigo-600 font-bold bg-indigo-50 w-fit px-2 py-1 rounded-md border border-indigo-100">
//                             <Users className="w-3 h-3" />
//                             <span>{count}</span>
//                           </div>
//                         ) : (
//                           <span className="text-slate-300">—</span>
//                         )}
//                       </td>
//                       <td className="p-3"><StatusBadge status={a.status} /></td>
//                       <td className="p-3 text-right">
//                         <button onClick={() => triggerDeleteOne(a.id, a)} className="text-slate-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all">
//                           <Trash2 className="w-4 h-4" />
//                         </button>
//                       </td>
//                     </tr>
//                   );
//                 })
//               )}
//             </tbody>
//           </table>
//         </div>

//         {/* Restore Full Pagination UI */}
//         {totalPages > 1 && (
//           <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
//             <div className="text-xs text-slate-500 font-medium">
//               Showing <span className="text-slate-900">{page * PAGE_SIZE + 1}</span> to <span className="text-slate-900">{Math.min((page + 1) * PAGE_SIZE, filtered.length)}</span> of <span className="text-slate-900">{filtered.length}</span> assignments
//             </div>
//             <div className="flex items-center gap-1">
//               <button 
//                 disabled={page === 0} 
//                 onClick={() => setPage(p => p - 1)} 
//                 className="p-1 rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
//               >
//                 <ChevronLeft className="w-4 h-4" />
//               </button>
              
//               <div className="flex items-center gap-1 mx-1">
//                 {Array.from({ length: totalPages }, (_, i) => {
//                   if (i === 0 || i === totalPages - 1 || (i >= page - 1 && i <= page + 1)) {
//                     return (
//                       <button 
//                         key={i} 
//                         onClick={() => setPage(i)} 
//                         className={`w-7 h-7 text-xs rounded font-bold transition-all ${
//                           page === i 
//                           ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
//                           : "text-slate-600 hover:bg-slate-200 bg-white border border-slate-200"
//                         }`}
//                       >
//                         {i + 1}
//                       </button>
//                     );
//                   }
//                   if (i === 1 || i === totalPages - 2) {
//                     return <span key={i} className="text-slate-400 px-1 italic">...</span>;
//                   }
//                   return null;
//                 })}
//               </div>

//               <button 
//                 disabled={page >= totalPages - 1} 
//                 onClick={() => setPage(p => p + 1)} 
//                 className="p-1 rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
//               >
//                 <ChevronRight className="w-4 h-4" />
//               </button>
//             </div>
//           </div>
//         )}
//       </div>

//       {/* --- Shadcn AlertDialog --- */}
//       <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
//         <AlertDialogContent>
//           <AlertDialogHeader>
//             <AlertDialogTitle>{confirmConfig.title}</AlertDialogTitle>
//             <AlertDialogDescription>{confirmConfig.desc}</AlertDialogDescription>
//           </AlertDialogHeader>
//           <AlertDialogFooter>
//             <AlertDialogCancel>Cancel</AlertDialogCancel>
//             <AlertDialogAction 
//               className="bg-red-600 hover:bg-red-700"
//               onClick={() => {
//                 confirmConfig.action?.();
//                 setConfirmOpen(false);
//               }}
//             >
//               Confirm Delete
//             </AlertDialogAction>
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>
//     </div>
//   );
// }
