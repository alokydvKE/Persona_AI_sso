import { Navigate } from "react-router";
import { type JSX } from "react";

interface ProtectedRouteProps {
  element: JSX.Element;
  reverse?: boolean;
  adminOnly?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  element,
  reverse = false,
  adminOnly = false,
}) => {
  const token = localStorage.getItem("token");

  const isAuthenticated = !!token;

  if (!isAuthenticated) {
    localStorage.clear();
  }

  if (reverse) {
    return isAuthenticated ? <Navigate to="/" replace /> : element;
  }

  if (adminOnly) {
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }

    return element;
  }

  return isAuthenticated ? element : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
