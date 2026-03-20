import { useState, useMemo, Fragment } from "react";
import SortHeader from "@/components/shared/SortHeader";
import TablePagination from "@/components/shared/TablePagination";
import { ChevronDown, ChevronRight, Users, ShieldCheck, Search, X } from "lucide-react";

const REVIEWER_PAGE = 10;

export default function TeamLeadContributorsTab({ 
  contributors, 
  reviewers, 
  getContribStats, 
  getReviewerStats 
}) {
  const [reviewerSortField, setReviewerSortField] = useState("user_name");
  const [reviewerSortDir, setReviewerSortDir] = useState("asc");
  const [reviewerPage, setReviewerPage] = useState(0);
  const [expandedReviewer, setExpandedReviewer] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const toggleReviewer = (email) => {
    setExpandedReviewer(expandedReviewer === email ? null : email);
  };

  const { pagedReviewers, totalPages, totalCount } = useMemo(() => {
    // Map stats and assigned contributors to each reviewer
    let data = reviewers.map(rev => {
      const stats = getReviewerStats(rev.user_email);
      const team = contributors
        .filter(c => c.reviewer_email === rev.user_email)
        .map(c => ({ ...c, ...getContribStats(c.user_email) }));
      
      return { 
        ...rev, 
        ...stats, 
        team, 
        teamCount: team.length 
      };
    });

    // Filtering logic (Search by Reviewer Name/Email or their Contributors)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(rev => 
        rev.user_name?.toLowerCase().includes(q) || 
        rev.user_email?.toLowerCase().includes(q) ||
        rev.team.some(t => t.user_name?.toLowerCase().includes(q))
      );
    }

    // Sorting logic
    const sorted = [...data].sort((x, y) => {
      const av = x[reviewerSortField] ?? "";
      const bv = y[reviewerSortField] ?? "";
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return reviewerSortDir === "asc" ? cmp : -cmp;
    });

    return {
      pagedReviewers: sorted.slice(reviewerPage * REVIEWER_PAGE, (reviewerPage + 1) * REVIEWER_PAGE),
      totalPages: Math.ceil(sorted.length / REVIEWER_PAGE),
      totalCount: sorted.length
    };
  }, [reviewers, contributors, getReviewerStats, getContribStats, reviewerSortField, reviewerSortDir, reviewerPage, searchQuery]);

  const onSort = (f) => {
    if (reviewerSortField === f) setReviewerSortDir(d => d === "asc" ? "desc" : "asc");
    else { setReviewerSortField(f); setReviewerSortDir("asc"); }
    setReviewerPage(0);
  };

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Reviewer Teams
          </h3>
          <p className="text-[11px] text-slate-500">Click a reviewer to see their assigned contributors and student performance</p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            placeholder="Search teams..." 
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setReviewerPage(0); }}
            className="flex h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-8 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="w-12 px-3 py-3"></th>
                <SortHeader label="Reviewer Name" field="user_name" s={reviewerSortField} d={reviewerSortDir} onSort={onSort} />
                <SortHeader label="Team" field="teamCount" s={reviewerSortField} d={reviewerSortDir} onSort={onSort} right />
                <SortHeader label="Reviews Done" field="reviewed" s={reviewerSortField} d={reviewerSortDir} onSort={onSort} right />
                <SortHeader label="Corrections Found" field="correctionsFound" s={reviewerSortField} d={reviewerSortDir} onSort={onSort} right />
                <SortHeader label="Accuracy %" field="accuracy" s={reviewerSortField} d={reviewerSortDir} onSort={onSort} right />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedReviewers.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400 font-medium">No team members found.</td></tr>
              ) : (
                pagedReviewers.map(rev => (
                  <Fragment key={rev.user_email}>
                    <tr 
                      className={`cursor-pointer transition-all ${expandedReviewer === rev.user_email ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                      onClick={() => toggleReviewer(rev.user_email)}
                    >
                      <td className="p-3 text-center">
                        <div className="flex justify-center">
                          {expandedReviewer === rev.user_email ? 
                            <ChevronDown className="w-4 h-4 text-indigo-600" /> : 
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                          }
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{rev.user_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{rev.user_email}</div>
                      </td>
                      <td className="p-3 text-right">
                         <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-bold text-[11px]">
                           <Users className="w-3 h-3 text-indigo-500" /> {rev.teamCount}
                         </span>
                      </td>
                      <td className="p-3 text-right font-medium text-indigo-700">{rev.reviewed}</td>
                      <td className="p-3 text-right text-amber-600 font-medium">{rev.correctionsFound}</td>
                      <td className="p-3 text-right">
                        {rev.accuracy !== null ? (
                          <span className={rev.accuracy >= 90 ? "text-green-600 font-bold" : "text-amber-600 font-bold"}>
                            {rev.accuracy}%
                          </span>
                        ) : "—"}
                      </td>
                    </tr>

                    {expandedReviewer === rev.user_email && (
                      <tr>
                        <td colSpan={6} className="p-0 bg-slate-50/30">
                          <div className="px-6 py-4">
                            <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
                              <table className="w-full text-[12px]">
                                <thead className="bg-slate-100 border-b border-slate-200 text-slate-500 font-bold">
                                  <tr>
                                    <th className="p-2 pl-4 text-left uppercase tracking-tight">Contributor</th>
                                    <th className="p-2 text-right">Done</th>
                                    <th className="p-2 text-right">Reviewed</th>
                                    <th className="p-2 text-right">Correction</th>
                                    <th className="p-2 text-right">Error %</th>
                                    <th className="p-2 pr-4 text-right">Final Score</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {rev.team.length === 0 ? (
                                    <tr><td colSpan={6} className="p-6 text-center text-slate-400 italic">No contributors assigned.</td></tr>
                                  ) : (
                                    rev.team.map(c => (
                                      <tr key={c.user_email} className="hover:bg-indigo-50/20">
                                        <td className="p-2 pl-4">
                                          <div className="font-medium text-slate-800">{c.user_name}</div>
                                          <div className="text-[10px] text-slate-400">{c.user_email}</div>
                                        </td>
                                        <td className="p-2 text-right text-indigo-600 font-medium">{c.completed}</td>
                                        <td className="p-2 text-right text-green-700 font-medium">{c.reviewed}</td>
                                        <td className="p-2 text-right text-slate-500 font-medium">{c.corrections}</td>
                                        <td className="p-2 text-right">
                                          <span className={c.errorRate > 10 ? "text-red-500 font-bold" : "text-green-600"}>
                                            {c.errorRate}%
                                          </span>
                                        </td>
                                        <td className="p-2 pr-4 text-right font-bold text-slate-700">
                                          {c.qualAfterCorrection}/100
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <TablePagination 
            page={reviewerPage} 
            total={totalPages} 
            onPage={setReviewerPage} 
            count={totalCount} 
            size={REVIEWER_PAGE} 
          />
        )}
      </div>
    </div>
  );
}









// import SortHeader from "@/components/shared/SortHeader";
// import TablePagination from "@/components/shared/TablePagination";
// import { useState } from "react";

// const CONTRIB_PAGE = 15;
// const REVIEWER_PAGE = 10;

// export default function TeamLeadContributorsTab({ contributors, reviewers, getContribStats, getReviewerStats }) {
//   const [contribSortField, setContribSortField] = useState("user_name");
//   const [contribSortDir, setContribSortDir] = useState("asc");
//   const [contribPage, setContribPage] = useState(0);
//   const [reviewerSortField, setReviewerSortField] = useState("user_name");
//   const [reviewerSortDir, setReviewerSortDir] = useState("asc");
//   const [reviewerPage, setReviewerPage] = useState(0);

//   // Map stats to contributors
//   const contribWithStats = contributors.map(a => ({ ...a, ...getContribStats(a.user_email) }));
//   const sortedContribs = [...contribWithStats].sort((x, y) => {
//     const av = x[contribSortField] ?? ""; const bv = y[contribSortField] ?? "";
//     const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
//     return contribSortDir === "asc" ? cmp : -cmp;
//   });
  
//   const contribPages = Math.ceil(sortedContribs.length / CONTRIB_PAGE);
//   const pagedContribs = sortedContribs.slice(contribPage * CONTRIB_PAGE, (contribPage + 1) * CONTRIB_PAGE);
  
//   const contribSort = (f) => { 
//     if (contribSortField === f) setContribSortDir(d => d === "asc" ? "desc" : "asc"); 
//     else { setContribSortField(f); setContribSortDir("asc"); } 
//     setContribPage(0); 
//   };

//   // Map stats to reviewers (including the new accuracy metrics)
//   const revWithStats = reviewers.map(a => ({ ...a, ...getReviewerStats(a.user_email) }));
//   const sortedReviewers = [...revWithStats].sort((x, y) => {
//     const av = x[reviewerSortField] ?? ""; const bv = y[reviewerSortField] ?? "";
//     const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
//     return reviewerSortDir === "asc" ? cmp : -cmp;
//   });

//   const reviewerPages = Math.ceil(sortedReviewers.length / REVIEWER_PAGE);
//   const pagedReviewers = sortedReviewers.slice(reviewerPage * REVIEWER_PAGE, (reviewerPage + 1) * REVIEWER_PAGE);
  
//   const reviewerSort = (f) => { 
//     if (reviewerSortField === f) setReviewerSortDir(d => d === "asc" ? "desc" : "asc"); 
//     else { setReviewerSortField(f); setReviewerSortDir("asc"); } 
//     setReviewerPage(0); 
//   };

//   return (
//     <div className="space-y-6">
//       {/* Contributors Table - Kept as previous */}
//       <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
//         <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
//           <h3 className="text-sm font-semibold text-slate-800">My Students ({contributors.length})</h3>
//         </div>
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm">
//             <thead className="bg-slate-50 border-b border-slate-200">
//               <tr>
//                 <SortHeader label="Name" field="user_name" s={contribSortField} d={contribSortDir} onSort={contribSort} />
//                 <SortHeader label="Email" field="user_email" s={contribSortField} d={contribSortDir} onSort={contribSort} />
//                 <SortHeader label="Completed" field="completed" s={contribSortField} d={contribSortDir} onSort={contribSort} right />
//                 <SortHeader label="Reviewed" field="reviewed" s={contribSortField} d={contribSortDir} onSort={contribSort} right />
//                 <SortHeader label="Corrections" field="corrections" s={contribSortField} d={contribSortDir} onSort={contribSort} right />
//                 <SortHeader label="Error Rate" field="errorRate" s={contribSortField} d={contribSortDir} onSort={contribSort} right />
//                 <SortHeader label="Avg Score" field="avgQ" s={contribSortField} d={contribSortDir} onSort={contribSort} right />
//                 <SortHeader label="Score After Fix" field="qualAfterCorrection" s={contribSortField} d={contribSortDir} onSort={contribSort} right />
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-slate-100">
//               {pagedContribs.map(a => (
//                 <tr key={a.id} className="hover:bg-slate-50 transition-colors">
//                   <td className="p-3 font-medium text-slate-900">{a.user_name}</td>
//                   <td className="p-3 text-slate-400 text-xs font-mono">{a.user_email}</td>
//                   <td className="p-3 text-right font-semibold text-indigo-700">{a.completed}</td>
//                   <td className="p-3 text-right text-green-700">{a.reviewed}</td>
//                   <td className="p-3 text-right text-slate-600">{a.corrections}</td>
//                   <td className="p-3 text-right">
//                     {a.errorRate !== null ? (
//                       <span className={a.errorRate > 10 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
//                         {a.errorRate}%
//                       </span>
//                     ) : "—"}
//                   </td>
//                   <td className="p-3 text-right">
//                     {a.avgQ !== null ? (
//                       <span className={a.avgQ >= 90 ? "text-green-600 font-semibold" : "text-amber-600 font-semibold"}>
//                         {a.avgQ}/100
//                       </span>
//                     ) : "—"}
//                   </td>
//                   <td className="p-3 text-right">
//                     {a.qualAfterCorrection !== null ? (
//                       <span className={a.qualAfterCorrection >= 90 ? "text-green-600 font-semibold" : "text-amber-600 font-semibold"}>
//                         {a.qualAfterCorrection}/100
//                       </span>
//                     ) : "—"}
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//         {contribPages > 1 && (
//           <TablePagination page={contribPage} total={contribPages} onPage={setContribPage} count={sortedContribs.length} size={CONTRIB_PAGE} />
//         )}
//       </div>

//       {/* Reviewers Table - Updated with Accuracy Metrics */}
//       <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
//         <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
//           <h3 className="text-sm font-semibold text-slate-800">Reviewers ({reviewers.length})</h3>
//         </div>
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm">
//             <thead className="bg-slate-50 border-b border-slate-200">
//               <tr>
//                 <SortHeader label="Name" field="user_name" s={reviewerSortField} d={reviewerSortDir} onSort={reviewerSort} />
//                 <SortHeader label="Email" field="user_email" s={reviewerSortField} d={reviewerSortDir} onSort={reviewerSort} />
//                 <SortHeader label="Reviews Done" field="reviewed" s={reviewerSortField} d={reviewerSortDir} onSort={reviewerSort} right />
//                 <SortHeader label="Corrections Found" field="correctionsFound" s={reviewerSortField} d={reviewerSortDir} onSort={reviewerSort} right />
//                 <SortHeader label="Accuracy %" field="accuracy" s={reviewerSortField} d={reviewerSortDir} onSort={reviewerSort} right />
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-slate-100">
//               {pagedReviewers.length === 0 && (
//                 <tr><td colSpan={5} className="p-6 text-center text-slate-400">No reviewers yet</td></tr>
//               )}
//               {pagedReviewers.map(a => (
//                 <tr key={a.id} className="hover:bg-slate-50 transition-colors">
//                   <td className="p-3 font-medium text-slate-900">{a.user_name}</td>
//                   <td className="p-3 text-slate-400 text-xs font-mono">{a.user_email}</td>
//                   <td className="p-3 text-right font-semibold text-indigo-700">{a.reviewed}</td>
//                   <td className="p-3 text-right text-amber-600 font-medium">{a.correctionsFound}</td>
//                   <td className="p-3 text-right">
//                     {a.accuracy !== null ? (
//                       <span className={a.accuracy >= 90 ? "text-green-600 font-bold" : "text-amber-600 font-bold"}>
//                         {a.accuracy}%
//                       </span>
//                     ) : "—"}
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//         {reviewerPages > 1 && (
//           <TablePagination page={reviewerPage} total={reviewerPages} onPage={setReviewerPage} count={sortedReviewers.length} size={REVIEWER_PAGE} />
//         )}
//       </div>
//     </div>
//   );
// }