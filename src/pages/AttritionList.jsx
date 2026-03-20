import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { 
  Search, 
  ChevronUp, 
  ChevronDown, 
  ChevronsUpDown, 
  ChevronLeft, 
  ChevronRight, 
  UserMinus, 
  RefreshCcw,
  MessageSquare
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PAGE_SIZE = 20;

function SortHeader({ label, field, s, d, onSort, right = false }) {
  const active = s === field;
  return (
    <th
      className={`p-3 text-slate-600 font-medium cursor-pointer select-none hover:bg-slate-100 whitespace-nowrap ${right ? "text-right" : "text-left"}`}
      onClick={() => onSort(field)}
    >
      <span className={`inline-flex items-center gap-1 ${right ? "flex-row-reverse" : ""}`}>
        {label}
        {active
          ? d === "asc" ? <ChevronUp className="w-3 h-3 text-indigo-600" /> : <ChevronDown className="w-3 h-3 text-indigo-600" />
          : <ChevronsUpDown className="w-3 h-3 text-slate-300" />}
      </span>
    </th>
  );
}

export default function AttritionList() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reactivatingId, setReactivatingId] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [sortField, setSortField] = useState("date_of_attrition");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchAttritionData();
  }, []);

  async function fetchAttritionData() {
    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) return;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('system_role, email')
        .eq('email', user.email)
        .single();

      if (profileError || !profile) {
        toast.error("Profile setup incomplete. Please contact admin.");
        setLoading(false);
        return;
      }

      const myRole = profile.system_role || profile.role;
      let query = supabase.from('attrition').select('*');

      if (myRole !== "admin") {
        const { data: myAssigns } = await supabase
          .from('team_assignments')
          .select('project_id, geography')
          .eq('user_email', profile.email)
          .eq('status', 'active');

        if (!myAssigns || myAssigns.length === 0) {
          setRecords([]);
          setLoading(false);
          return;
        }

        const projectIds = [...new Set(myAssigns.map(a => a.project_id))];
        const geos = [...new Set(myAssigns.map(a => a.geography))];

        if (myRole === "manager") {
          query = query.in('project_id', projectIds);
        } else if (myRole === "team_lead") {
          query = query.in('project_id', projectIds).in('geography', geos);
        }
      }

      const { data, error: queryError } = await query.order('date_of_attrition', { ascending: false });
      
      if (queryError) throw queryError;
      setRecords(data || []);

    } catch (error) {
      toast.error("Failed to load records");
    } finally {
      setLoading(false);
    }
  }

  async function handleReactivate(record) {
    const confirmMsg = `Reactivate ${record.full_name}? This moves them back to the active list.`;
    if (!window.confirm(confirmMsg)) return;

    setReactivatingId(record.id);
    try {
      // 1. Update Profile (using the correct updated_date column)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          status: 'active',
          synced: false,
          updated_date: new Date().toISOString() 
        })
        .eq('email', record.email);

      if (profileError) throw profileError;

      // 2. Restore Team Assignment
      // Check your console for 'Assignment Error Details' if this still fails
      const { error: assignError } = await supabase
        .from('team_assignments')
        .insert([{
          user_id: record.user_id,         // UUID from profiles
          user_email: record.email,
          user_name: record.full_name,
          project_id: record.project_id,   // Must be a valid UUID
          project_type: record.project_type || 'unlabeled', // REQUIRED by schema
          geography: record.geography,
          role: record.role.toLowerCase(), // Ensure lowercase to match ENUM
          status: 'active',
          created_by: 'reactivation_flow'
        }]);
      
      if (assignError) {
          console.error("Assignment Error Details:", assignError);
          toast.error("Profile updated, but team assignment failed. Check console.");
      }

      // 3. Remove from Attrition Log
      const { error: attritionError } = await supabase
        .from('attrition')
        .delete()
        .eq('id', record.id);

      if (attritionError) throw attritionError;

      toast.success(`${record.full_name} is fully restored.`);
      setRecords(prev => prev.filter(r => r.id !== record.id));

    } catch (error) {
      console.error("Reactivation flow crashed:", error);
      toast.error("Failed to reactivate user.");
    } finally {
      setReactivatingId(null);
    }
  }

  function handleSort(field) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
    setPage(0);
  }

  const roles = [...new Set(records.map(r => r.role).filter(Boolean))];
  const cohorts = [...new Set(records.map(r => r.cohort).filter(Boolean))].sort();

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || 
      r.full_name?.toLowerCase().includes(q) || 
      r.email?.toLowerCase().includes(q) || 
      r.geography?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q);
    const matchRole = roleFilter === "all" || r.role === roleFilter;
    const matchCohort = cohortFilter === "all" || r.cohort === cohortFilter;
    return matchSearch && matchRole && matchCohort;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortField] ?? ""; const bv = b[sortField] ?? "";
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500 font-medium animate-pulse">Loading Attrition Data...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center shadow-sm border border-red-100">
            <UserMinus className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Attrition Log</h1>
            <p className="text-sm text-slate-500">History of removed team members and exit reasoning</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-red-100 text-red-700 px-4 py-1.5 rounded-full text-xs font-bold ring-1 ring-inset ring-red-600/20">
            {filtered.length} Total Records
          </span>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name, email, notes..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 h-10 border-slate-200 focus:ring-indigo-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(0); }}
          className="h-10 text-sm border border-slate-200 rounded-lg px-3 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
        >
          <option value="all">All Roles</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={cohortFilter}
          onChange={e => { setCohortFilter(e.target.value); setPage(0); }}
          className="h-10 text-sm border border-slate-200 rounded-lg px-3 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
        >
          <option value="all">All Cohorts</option>
          {cohorts.map(c => <option key={c} value={c}>Cohort {c}</option>)}
        </select>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <SortHeader label="Member" field="full_name" s={sortField} d={sortDir} onSort={handleSort} />
                <SortHeader label="Email" field="email" s={sortField} d={sortDir} onSort={handleSort} />
                <SortHeader label="Cohort" field="cohort" s={sortField} d={sortDir} onSort={handleSort} />
                <SortHeader label="Geo" field="geography" s={sortField} d={sortDir} onSort={handleSort} />
                <SortHeader label="Role" field="role" s={sortField} d={sortDir} onSort={handleSort} />
                <SortHeader label="Exit Date" field="date_of_attrition" s={sortField} d={sortDir} onSort={handleSort} />
                <th className="p-3 font-medium text-slate-500">Reasoning</th>
                <th className="p-3 text-right font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-20 text-center text-slate-400">No records found</td>
                </tr>
              ) : (
                paged.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{r.full_name || "—"}</div>
                    </td>
                    <td className="p-3 text-slate-500 text-xs font-mono">{r.email || "—"}</td>
                    <td className="p-3 text-center">
                       <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-600 uppercase">
                        {r.cohort || "—"}
                       </span>
                    </td>
                    <td className="p-3 text-slate-600">{r.geography || "—"}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-600 uppercase border border-slate-200">
                        {r.role || "—"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 whitespace-nowrap text-xs">
                      {r.date_of_attrition ? new Date(r.date_of_attrition).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td className="p-3 min-w-[200px]">
                      <div className="flex items-start gap-2 max-w-[250px]">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-slate-600 italic leading-relaxed line-clamp-2" title={r.notes}>
                          {r.notes || "No notes provided"}
                        </p>
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReactivate(r)}
                        disabled={reactivatingId === r.id}
                        className="h-8 px-3 text-[11px] font-bold uppercase tracking-tight border-indigo-200 text-indigo-600 hover:bg-indigo-600 hover:text-white gap-1.5"
                      >
                        <RefreshCcw className={`w-3 h-3 ${reactivatingId === r.id ? 'animate-spin' : ''}`} />
                        Reactivate
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Card */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/30">
            <p className="text-xs text-slate-500 font-medium">
              Showing <span className="text-slate-900">{page * PAGE_SIZE + 1}</span> to <span className="text-slate-900">{Math.min((page + 1) * PAGE_SIZE, sorted.length)}</span> of <span className="text-slate-900">{sorted.length}</span>
            </p>
            <div className="flex items-center gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 shadow-sm transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(pages, 5) }, (_, i) => (
                <button 
                  key={i} 
                  onClick={() => setPage(i)} 
                  className={`w-9 h-9 text-xs rounded-lg font-bold shadow-sm transition-all ${page === i ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
                >
                  {i + 1}
                </button>
              ))}
              <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 shadow-sm transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}




















// import { useState, useEffect } from "react";
// import { supabase } from "@/api/supabaseClient";
// import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, UserMinus } from "lucide-react";
// import { Input } from "@/components/ui/input";

// const PAGE_SIZE = 20;

// function SortHeader({ label, field, s, d, onSort, right = false }) {
//   const active = s === field;
//   return (
//     <th
//       className={`p-3 text-slate-600 font-medium cursor-pointer select-none hover:bg-slate-100 whitespace-nowrap ${right ? "text-right" : "text-left"}`}
//       onClick={() => onSort(field)}
//     >
//       <span className={`inline-flex items-center gap-1 ${right ? "flex-row-reverse" : ""}`}>
//         {label}
//         {active
//           ? d === "asc" ? <ChevronUp className="w-3 h-3 text-indigo-600" /> : <ChevronDown className="w-3 h-3 text-indigo-600" />
//           : <ChevronsUpDown className="w-3 h-3 text-slate-300" />}
//       </span>
//     </th>
//   );
// }

// export default function AttritionList() {
//   const [records, setRecords] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [search, setSearch] = useState("");
//   const [roleFilter, setRoleFilter] = useState("all");
//   const [cohortFilter, setCohortFilter] = useState("all");
//   const [sortField, setSortField] = useState("date_of_attrition");
//   const [sortDir, setSortDir] = useState("desc");
//   const [page, setPage] = useState(0);

//   useEffect(() => {
//     fetchAttritionData();
//   }, []);

//   async function fetchAttritionData() {
//   setLoading(true);
//   try {
//     // 1. Get the current authenticated user session
//     const { data: { user }, error: authError } = await supabase.auth.getUser();
    
//     if (authError || !user) {
//       console.error("No active session found");
//       return;
//     }

//     // 2. Fetch profile using EMAIL instead of ID (more reliable during migration)
//     const { data: profile, error: profileError } = await supabase
//       .from('profiles')
//       .select('system_role, email')
//       .eq('email', user.email) // Using email as the anchor
//       .single();

//     if (profileError || !profile) {
//       console.error("Profile not found in 'profiles' table for email:", user.email);
//       toast.error("Profile setup incomplete. Please contact admin.");
//       setLoading(false);
//       return;
//     }

//     // Determine the role (handling both column name possibilities)
//     const myRole = profile.system_role || profile.role;
//     let query = supabase.from('attrition').select('*');

//     if (myRole === "admin") {
//       // Admins see all
//     } else {
//       // 3. Get assignments to define scope
//       const { data: myAssigns } = await supabase
//         .from('team_assignments')
//         .select('project_id, geography')
//         .eq('user_email', profile.email)
//         .eq('status', 'active');

//       if (!myAssigns || myAssigns.length === 0) {
//         setRecords([]);
//         setLoading(false);
//         return;
//       }

//       const projectIds = [...new Set(myAssigns.map(a => a.project_id))];
//       const geos = [...new Set(myAssigns.map(a => a.geography))];

//       if (myRole === "manager") {
//         query = query.in('project_id', projectIds);
//       } else if (myRole === "team_lead") {
//         query = query.in('project_id', projectIds).in('geography', geos);
//       }
//     }

//     const { data, error: queryError } = await query.order('date_of_attrition', { ascending: false });
    
//     if (queryError) throw queryError;
//     setRecords(data || []);

//   } catch (error) {
//     console.error("Attrition Fetch Error:", error);
//     toast.error("Failed to load records");
//   } finally {
//     setLoading(false);
//   }
// }

//   function handleSort(field) {
//     if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
//     else { setSortField(field); setSortDir("asc"); }
//     setPage(0);
//   }

//   const roles = [...new Set(records.map(r => r.role).filter(Boolean))];
//   const cohorts = [...new Set(records.map(r => r.cohort).filter(Boolean))].sort();

//   const filtered = records.filter(r => {
//     const q = search.toLowerCase();
//     const matchSearch = !q || 
//       r.full_name?.toLowerCase().includes(q) || 
//       r.email?.toLowerCase().includes(q) || 
//       r.geography?.toLowerCase().includes(q);
//     const matchRole = roleFilter === "all" || r.role === roleFilter;
//     const matchCohort = cohortFilter === "all" || r.cohort === cohortFilter;
//     return matchSearch && matchRole && matchCohort;
//   });

//   const sorted = [...filtered].sort((a, b) => {
//     const av = a[sortField] ?? ""; const bv = b[sortField] ?? "";
//     const cmp = av < bv ? -1 : av > bv ? 1 : 0;
//     return sortDir === "asc" ? cmp : -cmp;
//   });

//   const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
//   const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

//   if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Loading...</div>;

//   return (
//     <div className="max-w-6xl mx-auto p-6 space-y-5">
//       {/* Header */}
//       <div className="flex items-center justify-between flex-wrap gap-3">
//         <div className="flex items-center gap-3">
//           <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
//             <UserMinus className="w-5 h-5 text-red-500" />
//           </div>
//           <div>
//             <h1 className="text-xl font-bold text-slate-900">Attrition Log</h1>
//             <p className="text-xs text-slate-500">Users removed from team assignments</p>
//           </div>
//         </div>
//         <div className="flex items-center gap-2 text-sm">
//           <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full font-semibold">{filtered.length} records</span>
//         </div>
//       </div>

//       {/* Filters */}
//       <div className="flex flex-wrap gap-3 items-center">
//         <div className="relative flex-1 min-w-48">
//           <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
//           <Input
//             placeholder="Search name, email, geography…"
//             value={search}
//             onChange={e => { setSearch(e.target.value); setPage(0); }}
//             className="pl-9 h-9 text-sm"
//           />
//         </div>
//         <select
//           value={roleFilter}
//           onChange={e => { setRoleFilter(e.target.value); setPage(0); }}
//           className="h-9 text-sm border border-slate-200 rounded-md px-3 bg-white text-slate-700"
//         >
//           <option value="all">All Roles</option>
//           {roles.map(r => <option key={r} value={r}>{r}</option>)}
//         </select>
//         <select
//           value={cohortFilter}
//           onChange={e => { setCohortFilter(e.target.value); setPage(0); }}
//           className="h-9 text-sm border border-slate-200 rounded-md px-3 bg-white text-slate-700"
//         >
//           <option value="all">All Cohorts</option>
//           {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
//         </select>
//       </div>

//       {/* Table */}
//       <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm">
//             <thead className="bg-slate-50 border-b border-slate-200">
//               <tr>
//                 <SortHeader label="Name" field="full_name" s={sortField} d={sortDir} onSort={handleSort} />
//                 <SortHeader label="Email" field="email" s={sortField} d={sortDir} onSort={handleSort} />
//                 <SortHeader label="BYU ID" field="byu_pathway_id" s={sortField} d={sortDir} onSort={handleSort} />
//                 <SortHeader label="Cohort" field="cohort" s={sortField} d={sortDir} onSort={handleSort} />
//                 <SortHeader label="Project" field="project_id" s={sortField} d={sortDir} onSort={handleSort} />
//                 <SortHeader label="Geography" field="geography" s={sortField} d={sortDir} onSort={handleSort} />
//                 <SortHeader label="Role" field="role" s={sortField} d={sortDir} onSort={handleSort} />
//                 <SortHeader label="Attrited Date" field="date_of_attrition" s={sortField} d={sortDir} onSort={handleSort} />
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-slate-100">
//               {paged.length === 0 ? (
//                 <tr><td colSpan={8} className="p-10 text-center text-slate-400">No attrition records found</td></tr>
//               ) : (
//                 paged.map(r => (
//                   <tr key={r.id} className="hover:bg-slate-50">
//                     <td className="p-3 font-medium text-slate-900">{r.full_name || "—"}</td>
//                     <td className="p-3 text-slate-500 text-xs">{r.email || "—"}</td>
//                     <td className="p-3 text-slate-500 font-mono text-xs">{r.byu_pathway_id || "—"}</td>
//                     <td className="p-3 text-xs text-slate-500">{r.cohort || "—"}</td>
//                     <td className="p-3 text-xs text-slate-500">{r.project_id || "—"}</td>
//                     <td className="p-3 text-slate-600">{r.geography || "—"}</td>
//                     <td className="p-3">
//                       <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">{r.role || "—"}</span>
//                     </td>
//                     <td className="p-3 text-slate-600 whitespace-nowrap">
//                       {r.date_of_attrition ? new Date(r.date_of_attrition).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
//                     </td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         </div>
        
//         {/* Pagination */}
//         {pages > 1 && (
//           <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
//             <p className="text-xs text-slate-500">
//               Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
//             </p>
//             <div className="flex items-center gap-1">
//               <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-40">
//                 <ChevronLeft className="w-4 h-4" />
//               </button>
//               {Array.from({ length: Math.min(pages, 5) }, (_, i) => Math.max(0, page - 2) + i).filter(p => p < pages).map(p => (
//                 <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 text-xs rounded font-medium ${page === p ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-200"}`}>{p + 1}</button>
//               ))}
//               <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-40">
//                 <ChevronRight className="w-4 h-4" />
//               </button>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }