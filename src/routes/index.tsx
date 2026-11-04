import { createBrowserRouter } from "react-router";
import ProtectedRoute from "./ProtectedRoute";
// import SignupPage from "@/pages/Signup";
import ChatPage from "@/pages/Chat";
import GroupChatPage from "@/pages/GroupChat";
import Rootlayout from "@/layout/rootlayout";
import DashboardPage from "@/pages/Dashboard";
import SettingsPage from "@/pages/setting";
import PrivacyPolicyPage from "@/pages/Privacy-policy";
import HomePage from "@/pages/Test";
import PersonaAILoginPage from "@/pages/Login2";
import UploadPage from "@/pages/Upload";
import SsoLandingPage from "@/pages/SsoLanding";

const Router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    path: "/privacy-policy",
    element: <PrivacyPolicyPage />,
  },
  {
    path: "/login",
    element: <ProtectedRoute element={<PersonaAILoginPage />} reverse />,
  },
  {
    // SSO launch landing (from the SSO portal). Not guarded either way: it is
    // how a signed-out user signs in, and it replaces any current session.
    path: "/sso",
    element: <SsoLandingPage />,
  },
  // {
  //   path: "/sign-up",
  //   element: <ProtectedRoute element={<SignupPage />} reverse />,
  // },
  {
    path: "/chat",
    element: <ProtectedRoute element={<Rootlayout />} />,
    children: [
      {
        index: true,
        element: <ChatPage />,
      },
      {
        path: ":id",
        element: <ChatPage />,
      },
    ],
  },
  {
    path: "/group-chat",
    element: <ProtectedRoute element={<Rootlayout />} />,
    children: [
      {
        path: ":groupId",
        element: <GroupChatPage />,
      },
    ],
  },
  {
    // Post-create data-file upload step (before the persona builder chat).
    path: "/upload",
    element: <ProtectedRoute element={<Rootlayout />} />,
    children: [
      {
        path: ":projectId",
        element: <UploadPage />,
      },
    ],
  },
  {
    path: "/",
    element: <ProtectedRoute element={<Rootlayout />} />,
    children: [
      {
        path: "/dashboard",
        element: <DashboardPage />,
      },
      {
        path: "/settings",
        element: <SettingsPage />,
      },
    ],
  },
]);

export default Router;
