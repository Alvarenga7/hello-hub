import { Outlet, createFileRoute, redirect, Link, useRouter, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Activity,
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  Clock,
  Calendar,
  DollarSign,
  Paperclip,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { AnnouncementsBanner } from "@/components/AnnouncementsBanner";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/" });
  },
  component: AppLayout,
});

const NAV = [
  { to: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/app/patients", icon: Users, label: "Pacientes" },
  { to: "/app/evaluations", icon: ClipboardList, label: "Avaliações" },
  { to: "/app/records", icon: FileText, label: "Prontuário" },
  { to: "/app/attendance", icon: Clock, label: "Presença" },
  { to: "/app/schedule", icon: Calendar, label: "Agenda" },
  { to: "/app/finance", icon: DollarSign, label: "Financeiro" },
  { to: "/app/attachments", icon: Paperclip, label: "Anexos" },
  { to: "/app/settings", icon: Settings, label: "Configurações" },
];

function AppLayout() {
  const { clinic, isSuperAdmin, signOut, loading, user } = useAuth();
  const router = useRouter();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.navigate({ to: "/" });
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Super admin sem clínica → vai pro painel admin
  if (isSuperAdmin && !clinic && !location.pathname.startsWith("/app/admin")) {
    if (typeof window !== "undefined") window.location.href = "/app/admin";
    return null;
  }

  // Usuário sem clínica e sem ser admin → forçar criação
  if (!isSuperAdmin && !clinic) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Sua conta não tem clínica vinculada</h1>
          <p className="text-muted-foreground text-sm">
            Entre em contato com o administrador ou crie uma nova conta com clínica.
          </p>
          <Button onClick={handleLogout} variant="outline">Sair</Button>
        </div>
      </div>
    );
  }

  const displayName = clinic?.name || "Painel Admin";

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
          {clinic?.logo_url ? (
            <img
              src={clinic.logo_url}
              alt={clinic.name}
              className="h-10 w-10 rounded-lg object-cover bg-card"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg gradient-primary grid place-items-center">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate text-sidebar-foreground">{displayName}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
          <button
            className="lg:hidden text-muted-foreground"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-2 overflow-y-auto">
          {clinic && NAV.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition mb-0.5 ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {isSuperAdmin && (
            <>
              <div className="mt-4 mb-1 px-3 text-xs uppercase text-muted-foreground/70 tracking-wider">
                Super Admin
              </div>
              <Link
                to="/app/admin"
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                  location.pathname.startsWith("/app/admin")
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                }`}
              >
                <Shield className="h-4 w-4" />
                Painel Admin
              </Link>
            </>
          )}
        </nav>

        <div className="p-2 border-t border-sidebar-border">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-sidebar-foreground/80"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border p-3 flex items-center gap-3">
          <button onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-semibold truncate">{displayName}</span>
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <AnnouncementsBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
