import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  auth,
  onAuthStateChanged,
  type User,
  signInWithEmailAndPassword,
  signOut,
} from "./firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  orgSlug: string | null;
  login: (email: string, password: string, orgSlug: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ORG_STORAGE_KEY = "teamchat_org_slug";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgSlug, setOrgSlug] = useState<string | null>(
    localStorage.getItem(ORG_STORAGE_KEY),
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string, org: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setOrgSlug(org);
      localStorage.setItem(ORG_STORAGE_KEY, org);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setOrgSlug(null);
    localStorage.removeItem(ORG_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, loading, orgSlug, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

