import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom"; // Added useLocation for reactive updates
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import {
  LayoutDashboard, Users, FolderKanban, ClipboardCheck,
  LogOut, Menu, X, ChevronRight, Shield, BarChart2, Inbox, UserMinus
} from "lucide-react";
import ChatBox from "@/components/ChatBox";

// --- Helpers ---
function useDateTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function isNewUser(user) {
  if (!user?.created_at) return false;
  const created = new Date(user.created_at);
  const diff = Date.now() - created.getTime();
  return diff < 1000 * 60 * 60 * 24; 
}

const ROLE_NAV = {
  admin: [
    { label: "Dashboard", page: "AdminDashboard", icon: Shield },
    { label: "Projects", page: "AdminDashboard", icon: FolderKanban, tab: "projects" },
    { label: "Users", page: "AdminDashboard", icon: Users, tab: "users" },
    { label: "Assignments", page: "AdminDashboard", icon: ClipboardCheck, tab: "assignments" },
    { label: "Stats", page: "AdminDashboard", icon: BarChart2, tab: "charts" },
    { label: "Attrition", page: "AttritionList", icon: UserMinus },
  ],
  manager: [
    { label: "Tasks", page: "ManagerDashboard", icon: BarChart2, tab:"team" },
    { label: "User Management", page: "ManagerDashboard", icon: Users, tab: "users" },
    { label: "Assignments", page: "ManagerDashboard", icon: ClipboardCheck, tab: "assignments" },
    { label: "Geography", page: "ManagerDashboard", icon: FolderKanban, tab: "geography" },
    { label: "Pairing & Quality", page: "ManagerDashboard", icon: Users, tab: "reviewer-pairing" },
    { label: "Stats", page: "ManagerDashboard", icon: Users, tab: "overview" },
    { label: "Escalations", page: "ManagerDashboard", icon: Users, tab: "escalations" },
    { label: "Attrition", page: "AttritionList", icon: UserMinus },
  ],
  team_lead: [
    { label: "Dashboard", page: "TeamLeadDashboard", icon: Users },
    { label: "Team Performance", page: "TeamLeadDashboard", icon: BarChart2, tab: "contributors" },
    { label: "Attrition", page: "AttritionList", icon: UserMinus },
  ],
  reviewer: [{ label: "Review Queue", page: "ReviewerDashboard", icon: ClipboardCheck }],
  contributor: [{ label: "My Workspace", page: "ContributorDashboard", icon: Inbox }],
  client: [{ label: "Reports", page: "ClientDashboard", icon: BarChart2 }]
};

const PAGE_TO_TITLE = {
  AdminDashboard: "Admin Panel",
  ManagerDashboard: "Manager Dashboard",
  TeamLeadDashboard: "Team Lead",
  ReviewerDashboard: "Review Queue",
  ContributorDashboard: "My Workspace",
  ClientDashboard: "Project Reports",
  AttritionList: "Attrition Log",
  Home: "FamilySearch Hub"
};

const HIDDEN_LAYOUT_PAGES = ["Home", "Login", "ForgotPassword", "ResetPassword"];
const CHAT_ENABLED_ROLES = ["contributor", "reviewer", "team_lead", "manager", "admin"];

export default function Layout({ children, currentPageName }) {
  const { user, logout } = useAuth();
  const location = useLocation(); // Hook to listen for URL changes
  const [mobileOpen, setMobileOpen] = useState(false);
  const now = useDateTime();

  if (HIDDEN_LAYOUT_PAGES.includes(currentPageName)) {
    return <>{children}</>;
  }

  // Parse the current tab from the URL
  const urlParams = new URLSearchParams(location.search);
  const currentTab = urlParams.get("tab");

  const role = user?.role || "contributor";
  const navItems = ROLE_NAV[role] || ROLE_NAV.contributor;
  const showChat = CHAT_ENABLED_ROLES.includes(role);

  const firstName = user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  const greeting = isNewUser(user) ? `Welcome, ${firstName}` : `Welcome back, ${firstName}`;
  
  const dateStr = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-x-hidden">
      <style>{`
        :root { --indigo: #6366f1; }
        * { box-sizing: border-box; }
      `}</style>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight">FamilySearch</p>
              <p className="text-xs text-slate-500">Project Hub</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            
            // STRICT ACTIVE CHECK:
            // Matches if the page is the same AND (the tab matches OR neither have a tab)
            const isActive = currentPageName === item.page && (
              item.tab ? currentTab === item.tab : !currentTab
            );

            return (
              <Link
                key={item.page + (item.tab || "")}
                to={item.tab ? createPageUrl(item.page) + `?tab=${item.tab}` : createPageUrl(item.page)}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto text-indigo-400" />}
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="p-4 border-t border-slate-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-indigo-700">
                  {(user.full_name || user.email || "?")[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 truncate">{user.full_name || "User"}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium capitalize">{role.replace('_', ' ')}</span>
              <button onClick={logout} className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors">
                <LogOut className="w-3 h-3" /> Sign out
              </button>
            </div>
          </div>
        )}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 md:ml-60 flex flex-col min-h-screen min-w-0">
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 h-14 flex items-center gap-3">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <span className="text-sm font-semibold text-slate-700 md:hidden">
            {PAGE_TO_TITLE[currentPageName] || currentPageName}
          </span>
          
          <div className="flex-1" />
          
          {user && (
            <div className="flex items-center gap-2 text-right">
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-slate-800">{greeting}</p>
                <p className="text-[10px] text-slate-400">{dateStr} · {timeStr}</p>
              </div>
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-indigo-700">{firstName[0]?.toUpperCase()}</span>
              </div>
            </div>
          )}
        </header>

        <main className="flex-1">
          {children}
        </main>
      </div>

      {showChat && user && <ChatBox user={user} />}
    </div>
  );
}




// import { useState, useEffect } from "react";
// import { Link } from "react-router-dom";
// import { createPageUrl } from "@/utils";
// import { useAuth } from "@/lib/AuthContext"; // Use our new Supabase Auth
// import {
//   LayoutDashboard, Users, FolderKanban, ClipboardCheck,
//   LogOut, Menu, X, ChevronRight, Shield, BarChart2, Inbox, UserMinus
// } from "lucide-react";
// import ChatBox from "@/components/ChatBox";

// // --- Helpers ---
// function useDateTime() {
//   const [now, setNow] = useState(new Date());
//   useEffect(() => {
//     const id = setInterval(() => setNow(new Date()), 60000);
//     return () => clearInterval(id);
//   }, []);
//   return now;
// }

// function isNewUser(user) {
//   if (!user?.created_at) return false; // Supabase uses created_at
//   const created = new Date(user.created_at);
//   const diff = Date.now() - created.getTime();
//   return diff < 1000 * 60 * 60 * 24; 
// }

// // --- Constants ---
// const ROLE_NAV = {
//   admin: [
//     { label: "Dashboard", page: "AdminDashboard", icon: Shield },
//     { label: "Projects", page: "AdminDashboard", icon: FolderKanban, tab: "projects" },
//     { label: "Users", page: "AdminDashboard", icon: Users, tab: "users" },
//     { label: "Assignments", page: "AdminDashboard", icon: ClipboardCheck, tab: "assignments" },
//     { label: "Stats", page: "AdminDashboard", icon: BarChart2, tab: "charts" },
//     { label: "Attrition", page: "AttritionList", icon: UserMinus },
//   ],
//   manager: [
//     { label: "Dashboard", page: "ManagerDashboard", icon: BarChart2 },
//     { label: "Tasks", page: "ManagerDashboard", icon: ClipboardCheck, tab: "team" },
//     { label: "Geography", page: "ManagerDashboard", icon: FolderKanban, tab: "geography" },
//     { label: "Pairing & Quality", page: "ManagerDashboard", icon: Users, tab: "reviewer-pairing" },
//     { label: "User Management", page: "ManagerDashboard", icon: Users, tab: "users" },
//     { label: "Attrition", page: "AttritionList", icon: UserMinus },
//   ],
//   team_lead: [
//     { label: "Dashboard", page: "TeamLeadDashboard", icon: Users },
//     { label: "Team Performance", page: "TeamLeadDashboard", icon: BarChart2, tab: "contributors" },
//     { label: "Attrition", page: "AttritionList", icon: UserMinus },
//   ],
//   reviewer: [{ label: "Review Queue", page: "ReviewerDashboard", icon: ClipboardCheck }],
//   contributor: [{ label: "My Workspace", page: "ContributorDashboard", icon: Inbox }],
//   client: [{ label: "Reports", page: "ClientDashboard", icon: BarChart2 }]
// };

// const PAGE_TO_TITLE = {
//   AdminDashboard: "Admin Panel",
//   ManagerDashboard: "Manager Dashboard",
//   TeamLeadDashboard: "Team Lead",
//   ReviewerDashboard: "Review Queue",
//   ContributorDashboard: "My Workspace",
//   ClientDashboard: "Project Reports",
//   AttritionList: "Attrition Log",
//   Home: "FamilySearch Hub"
// };

// const HIDDEN_LAYOUT_PAGES = ["Home", "Login", "ForgotPassword", "ResetPassword"];
// const CHAT_ENABLED_ROLES = ["contributor", "reviewer", "team_lead", "manager", "admin"];

// export default function Layout({ children, currentPageName }) {
//   const { user, logout } = useAuth(); // Get user from Supabase Context
//   const [mobileOpen, setMobileOpen] = useState(false);
//   const now = useDateTime();

//   // 1. Check if this page should even have a layout
//   if (HIDDEN_LAYOUT_PAGES.includes(currentPageName)) {
//     return <>{children}</>;
//   }

//   const role = user?.role || "contributor";
//   const navItems = ROLE_NAV[role] || ROLE_NAV.contributor;
//   const showChat = CHAT_ENABLED_ROLES.includes(role);

//   const firstName = user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";
//   const greeting = isNewUser(user) ? `Welcome, ${firstName}` : `Welcome back, ${firstName}`;
  
//   const dateStr = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
//   const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

//   return (
//     <div className="min-h-screen bg-slate-50 flex overflow-x-hidden">
//       <style>{`
//         :root { --indigo: #6366f1; }
//         * { box-sizing: border-box; }
//       `}</style>

//       {/* Sidebar */}
//       <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200
//         ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        
//         {/* Logo */}
//         <div className="p-5 border-b border-slate-100">
//           <div className="flex items-center gap-2.5">
//             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
//               <LayoutDashboard className="w-4 h-4 text-white" />
//             </div>
//             <div>
//               <p className="text-sm font-bold text-slate-900 leading-tight">FamilySearch</p>
//               <p className="text-xs text-slate-500">Project Hub</p>
//             </div>
//           </div>
//         </div>

//         {/* Nav */}
//         <nav className="flex-1 p-3 space-y-1">
//           {navItems.map(item => {
//             const Icon = item.icon;
//             const isActive = currentPageName === item.page;
//             return (
//               <Link
//                 key={item.page + (item.tab || "")}
//                 to={item.tab ? createPageUrl(item.page) + `?tab=${item.tab}` : createPageUrl(item.page)}
//                 onClick={() => setMobileOpen(false)}
//                 className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
//                   ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
//               >
//                 <Icon className="w-4 h-4 flex-shrink-0" />
//                 {item.label}
//                 {isActive && <ChevronRight className="w-3 h-3 ml-auto text-indigo-400" />}
//               </Link>
//             );
//           })}
//         </nav>

//         {/* User Footer (Exactly as base44) */}
//         {user && (
//           <div className="p-4 border-t border-slate-100">
//             <div className="flex items-center gap-3 mb-3">
//               <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
//                 <span className="text-xs font-bold text-indigo-700">
//                   {(user.full_name || user.email || "?")[0].toUpperCase()}
//                 </span>
//               </div>
//               <div className="flex-1 min-w-0">
//                 <p className="text-xs font-medium text-slate-900 truncate">{user.full_name || "User"}</p>
//                 <p className="text-xs text-slate-400 truncate">{user.email}</p>
//               </div>
//             </div>
//             <div className="flex items-center justify-between">
//               <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium capitalize">{role.replace('_', ' ')}</span>
//               <button onClick={logout} className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors">
//                 <LogOut className="w-3 h-3" /> Sign out
//               </button>
//             </div>
//           </div>
//         )}
//       </aside>

//       {/* Mobile Overlay */}
//       {mobileOpen && (
//         <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
//       )}

//       {/* Main Content Area */}
//       <div className="flex-1 md:ml-60 flex flex-col min-h-screen min-w-0">
//         <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 h-14 flex items-center gap-3">
//           <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
//             {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
//           </button>
          
//           <span className="text-sm font-semibold text-slate-700 md:hidden">
//             {PAGE_TO_TITLE[currentPageName] || currentPageName}
//           </span>
          
//           <div className="flex-1" />
          
//           {user && (
//             <div className="flex items-center gap-2 text-right">
//               <div className="hidden sm:block">
//                 <p className="text-xs font-semibold text-slate-800">{greeting}</p>
//                 <p className="text-[10px] text-slate-400">{dateStr} · {timeStr}</p>
//               </div>
//               <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
//                 <span className="text-xs font-bold text-indigo-700">{firstName[0]?.toUpperCase()}</span>
//               </div>
//             </div>
//           )}
//         </header>

//         <main className="flex-1">
//           {children}
//         </main>
//       </div>

//       {showChat && user && <ChatBox user={user} />}
//     </div>
//   );
// }