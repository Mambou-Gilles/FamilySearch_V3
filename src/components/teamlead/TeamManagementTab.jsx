import React, { useState, useMemo } from 'react';
import { 
  Search, Edit2, UserMinus, UserCheck,
  AlertCircle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function TeamManagementTab({ 
  contributors = [], 
  reviewers = [], 
  tasks = [], 
  onUpdateStatus,
  onEditUser 
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [selectedUsers, setSelectedUsers] = useState([]);

  // 1. Process Master List
  const allStaff = useMemo(() => {
    const combined = [...contributors, ...reviewers];
    const todayStr = new Date().toISOString().split('T')[0];
    
    return combined.map(user => {
      const isReviewer = user.role === 'reviewer';
      
      // Calculate daily production based on role
      const completedToday = tasks.filter(t => {
        const matchesUser = isReviewer 
          ? t.reviewer_email === user.user_email 
          : t.contributor_email === user.user_email;
        
        const dateToMatch = isReviewer ? t.review_date : t.date_completed;
        const matchesDate = dateToMatch?.startsWith(todayStr);
        
        return matchesUser && matchesDate;
      }).length;

      return {
        ...user,
        daily: completedToday,
        // Reviewers don't have a numeric target in this view
        target: isReviewer ? null : (user.daily_target || 0)
      };
    });
  }, [contributors, reviewers, tasks]);

  // 2. Filter Logic
  const filteredStaff = useMemo(() => {
    return allStaff.filter(user => {
      const matchesSearch = (user.user_name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (user.user_email || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesCohort = cohortFilter === "all" || user.cohort === cohortFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      
      return matchesSearch && matchesRole && matchesCohort && matchesStatus;
    });
  }, [allStaff, searchQuery, roleFilter, cohortFilter, statusFilter]);

  // 3. Selection Handlers
  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredStaff.length && filteredStaff.length > 0) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredStaff.map(u => u.user_email));
    }
  };

  const toggleSelectUser = (email) => {
    setSelectedUsers(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const cohorts = [...new Set(allStaff.map(u => u.cohort).filter(Boolean))];

  return (
    <div className="flex flex-col gap-4">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search name or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-50 border-none h-10 ring-0 focus-visible:ring-1 focus-visible:ring-indigo-500"
          />
        </div>

        <select 
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 outline-none"
        >
          <option value="all">All Roles</option>
          <option value="contributor">Contributor</option>
          <option value="reviewer">Reviewer</option>
        </select>

        <select 
          value={cohortFilter}
          onChange={(e) => setCohortFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 outline-none"
        >
          <option value="all">All Cohorts</option>
          {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 outline-none"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="attrited">Attrited</option>
        </select>

        {selectedUsers.length > 0 && (
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => toast.info(`Bulk action for ${selectedUsers.length} users`)}
            className="h-10 rounded-xl font-bold"
          >
            Bulk Action ({selectedUsers.length})
          </Button>
        )}
      </div>

      {/* Unified Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="p-4 w-10">
                  <Checkbox 
                    checked={selectedUsers.length === filteredStaff.length && filteredStaff.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="p-4 text-[10px] uppercase font-black text-slate-400 tracking-widest">Name & Contact</th>
                <th className="p-4 text-[10px] uppercase font-black text-slate-400 tracking-widest text-center">Role</th>
                <th className="p-4 text-[10px] uppercase font-black text-slate-400 tracking-widest text-center">Status</th>
                <th className="p-4 text-[10px] uppercase font-black text-slate-400 tracking-widest text-center">Daily / Target</th>
                <th className="p-4 text-[10px] uppercase font-black text-slate-400 tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStaff.map((user) => {
                const isAttrited = user.status === 'attrited';
                const isReviewer = user.role === 'reviewer';
                const progress = user.target ? Math.min((user.daily / user.target) * 100, 100) : 0;

                return (
                  <tr key={user.user_email} className={`hover:bg-slate-50/50 transition-colors ${isAttrited ? 'opacity-60 bg-slate-50/30' : ''}`}>
                    <td className="p-4">
                      <Checkbox 
                        checked={selectedUsers.includes(user.user_email)}
                        onCheckedChange={() => toggleSelectUser(user.user_email)}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${isReviewer ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {user.user_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{user.user_name}</div>
                          <div className="text-[10px] text-slate-400 font-medium italic">{user.user_email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-[9px] uppercase px-2 py-0.5 rounded-md font-black border ${isReviewer ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {isAttrited ? (
                        <Badge variant="outline" className="text-[9px] uppercase bg-slate-100 text-slate-500 border-slate-200">Attrited</Badge>
                      ) : (
                        <Badge className="text-[9px] uppercase bg-emerald-500 hover:bg-emerald-500 text-white border-none">Active</Badge>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-[10px] font-black text-slate-700">
                          {user.daily} {isReviewer ? <span className="text-slate-400 font-medium">Reviewed</span> : `/ ${user.target}`}
                        </div>
                        {!isReviewer && user.target > 0 && (
                          <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${user.daily >= user.target ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        {!isAttrited && (
                          <button 
                            onClick={() => onEditUser(user)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Edit User"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => onUpdateStatus(user.user_email, isAttrited ? 'active' : 'attrited')}
                          className={`p-2 rounded-lg transition-all ${isAttrited ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                          title={isAttrited ? "Reinstate" : "Attrite"}
                        >
                          {isAttrited ? <UserCheck className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredStaff.length === 0 && (
            <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-slate-50/50">
              <AlertCircle className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm font-bold">No matching team members found</p>
              <Button 
                variant="link" 
                onClick={() => { setSearchQuery(""); setRoleFilter("all"); setStatusFilter("all"); }} 
                className="text-indigo-600 text-xs"
              >
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}









// import React, { useState } from 'react';
// import { 
//   UserCheck, UserMinus, ShieldCheck, 
//   Users, ChevronDown, MoreVertical, Mail, MapPin 
// } from 'lucide-react';

// // We now explicitly take contributors and reviewers as separate props
// export default function TeamManagementTab({ 
//   contributors = [], 
//   reviewers = [], 
//   tasks = [], 
//   onUpdateStatus 
// }) {
//   const [showInactive, setShowInactive] = useState(false);

//   // Combine for a "Master Roster" but keep role logic
//   const allStaff = [...contributors, ...reviewers];
  
//   const activeStaff = allStaff.filter(s => s.status !== 'attrited');
//   const inactiveStaff = allStaff.filter(s => s.status === 'attrited');

//   const UserCard = ({ user, isActive }) => {
//     const isReviewer = user.role === 'reviewer';
    
//     // Workload calculation
//     const pendingTasks = tasks.filter(t => t.assigned_to === user.user_email && t.status === 'pending').length;
//     const completedToday = tasks.filter(t => 
//       t.assigned_to === user.user_email && 
//       t.date_completed?.startsWith(new Date().toISOString().split('T')[0])
//     ).length;

//     return (
//       <div className={`bg-white border ${isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all`}>
//         <div className="flex justify-between items-start">
//           <div className="flex gap-4">
//             <div className={`relative w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${isActive ? (isReviewer ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-600') : 'bg-slate-100 text-slate-400'}`}>
//               {user.user_name?.charAt(0) || 'U'}
//               {isReviewer && isActive && (
//                 <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
//                   <ShieldCheck className="w-4 h-4 text-green-600" />
//                 </div>
//               )}
//             </div>
//             <div>
//               <div className="flex items-center gap-2">
//                 <h4 className="text-sm font-bold text-slate-900">{user.user_name}</h4>
//                 <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${isReviewer ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
//                   {user.role}
//                 </span>
//               </div>
//               <p className="text-xs text-slate-500 mt-0.5 font-medium italic">{user.user_email}</p>
//             </div>
//           </div>
//         </div>

//         <div className="grid grid-cols-2 gap-4 mt-6 border-t border-slate-50 pt-4">
//           <div>
//             <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Pending</p>
//             <p className="text-lg font-black text-slate-800">{pendingTasks}</p>
//           </div>
//           <div>
//             <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Today</p>
//             <p className="text-lg font-black text-slate-800">{completedToday}</p>
//           </div>
//         </div>

//         {isActive ? (
//           <div className="mt-4 flex gap-2">
//             <button className="flex-1 text-xs font-bold py-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 border border-slate-200 transition-colors">
//               Reassign
//             </button>
//             <button 
//               onClick={() => onUpdateStatus(user.user_email, 'attrited')}
//               className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors"
//               title="Attrite User"
//             >
//               <UserMinus className="w-4 h-4" />
//             </button>
//           </div>
//         ) : (
//           <button 
//             onClick={() => onUpdateStatus(user.user_email, 'active')}
//             className="w-full mt-4 text-xs font-bold py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm"
//           >
//             Reinstate Member
//           </button>
//         )}
//       </div>
//     );
//   };

//   return (
//     <div className="flex flex-col gap-8">
//       {/* Active Management Section */}
//       <section>
//         <div className="flex items-end justify-between mb-6">
//           <div>
//             <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
//               <Users className="w-6 h-6 text-indigo-600" />
//               Active Squad
//             </h3>
//             <p className="text-sm text-slate-500 font-medium">Currently assigned to your geography</p>
//           </div>
//           <div className="text-right">
//             <span className="text-2xl font-black text-indigo-600">{activeStaff.length}</span>
//             <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Total Staff</p>
//           </div>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
//           {activeStaff.map(u => <UserCard key={u.user_email} user={u} isActive={true} />)}
//         </div>
//       </section>

//       {/* Attrited Archive Section */}
//       {inactiveStaff.length > 0 && (
//         <section className="pt-8 border-t-2 border-dashed border-slate-100">
//           <button 
//             onClick={() => setShowInactive(!showInactive)}
//             className="group flex items-center gap-3 text-slate-400 hover:text-slate-600 transition-all"
//           >
//             <div className={`p-1 rounded-full bg-slate-100 group-hover:bg-slate-200 transition-colors ${showInactive ? 'rotate-180' : ''}`}>
//               <ChevronDown className="w-4 h-4" />
//             </div>
//             <span className="text-xs font-black uppercase tracking-[0.2em]">
//               Attrited Members ({inactiveStaff.length})
//             </span>
//           </button>

//           {showInactive && (
//             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-6">
//               {inactiveStaff.map(u => <UserCard key={u.user_email} user={u} isActive={false} />)}
//             </div>
//           )}
//         </section>
//       )}
//     </div>
//   );
// }