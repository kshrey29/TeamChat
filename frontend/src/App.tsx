import React from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { LoginPage } from "./components/LoginPage";
import { ChatLayout } from "./components/ChatLayout";

function AppInner() {
  const { user, loading, orgSlug } = useAuth();

  if (loading) {
    return <div className="full-center">Loading...</div>;
  }

  if (!user || !orgSlug) {
    return <LoginPage />;
  }

  return <ChatLayout />;
}

export function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

