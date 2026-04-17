import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface ClinicData {
  id: string;
  name: string;
  email: string;
  logo_url: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  active: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isSuperAdmin: boolean;
  clinic: ClinicData | null;
  loading: boolean;
  refreshClinic: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: roles }, { data: clinics }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("clinics").select("*").eq("owner_id", uid).maybeSingle(),
    ]);
    setIsSuperAdmin(!!roles?.some((r) => r.role === "super_admin"));
    setClinic(clinics ?? null);
  };

  const refreshClinic = async () => {
    if (user) await loadProfile(user.id);
  };

  useEffect(() => {
    // 1) Listener primeiro
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // defer para evitar deadlock
        setTimeout(() => {
          loadProfile(sess.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        setIsSuperAdmin(false);
        setClinic(null);
        setLoading(false);
      }
    });

    // 2) Sessão inicial
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        loadProfile(sess.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, user, isSuperAdmin, clinic, loading, refreshClinic, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
