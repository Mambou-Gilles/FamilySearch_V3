import AdminDashboard from './pages/AdminDashboard';
import AttritionList from './pages/AttritionList';
import ClientDashboard from './pages/ClientDashboard';
import ContributorDashboard from './pages/ContributorDashboard';
import Home from './pages/Home';
import Login from './pages/Login'; // <--- Added this
import ManagerDashboard from './pages/ManagerDashboard';
import ReviewerDashboard from './pages/ReviewerDashboard';
import TeamLeadDashboard from './pages/TeamLeadDashboard';
import ResetPassword from './pages/ResetPassword'; // <--- Added this
import __Layout from './Layout.jsx';

export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "AttritionList": AttritionList,
    "ClientDashboard": ClientDashboard,
    "ContributorDashboard": ContributorDashboard,
    "Home": Home,
    "Login": Login,
    "ResetPassword": ResetPassword,
    "ManagerDashboard": ManagerDashboard,
    "ReviewerDashboard": ReviewerDashboard,
    "TeamLeadDashboard": TeamLeadDashboard,
}

export const pagesConfig = {
    mainPage: "Home", // Usually Home is the best entry point to redirect by role
    Pages: PAGES,
    Layout: __Layout,
};