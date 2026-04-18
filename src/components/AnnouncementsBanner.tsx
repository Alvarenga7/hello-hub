import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { X, Info, CheckCircle2, AlertTriangle, AlertOctagon } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  expires_at: string | null;
  created_at: string;
}

const typeStyles: Record<string, { bg: string; icon: typeof Info }> = {
  info: { bg: "bg-blue-500/10 border-blue-500/30 text-blue-100", icon: Info },
  sucesso: { bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-100", icon: CheckCircle2 },
  aviso: { bg: "bg-amber-500/10 border-amber-500/30 text-amber-100", icon: AlertTriangle },
  alerta: { bg: "bg-destructive/10 border-destructive/30 text-destructive-foreground", icon: AlertOctagon },
};

export function AnnouncementsBanner() {
  const { user, isSuperAdmin } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!user || isSuperAdmin) return;
    const load = async () => {
      const [{ data: ann }, { data: dis }] = await Promise.all([
        supabase
          .from("announcements")
          .select("*")
          .eq("active", true)
          .order("created_at", { ascending: false }),
        supabase.from("announcement_dismissals").select("announcement_id").eq("user_id", user.id),
      ]);
      const dismissedIds = new Set((dis ?? []).map((d) => d.announcement_id));
      const now = new Date();
      const visible = (ann ?? []).filter(
        (a) =>
          !dismissedIds.has(a.id) && (!a.expires_at || new Date(a.expires_at) > now),
      );
      setItems(visible);
    };
    load();
  }, [user, isSuperAdmin]);

  const dismiss = async (id: string) => {
    if (!user) return;
    setItems((prev) => prev.filter((a) => a.id !== id));
    await supabase.from("announcement_dismissals").insert({
      announcement_id: id,
      user_id: user.id,
    });
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {items.map((a) => {
        const style = typeStyles[a.type] ?? typeStyles.info;
        const Icon = style.icon;
        return (
          <div
            key={a.id}
            className={`relative rounded-lg border px-4 py-3 pr-10 flex gap-3 ${style.bg}`}
          >
            <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{a.title}</div>
              <div className="text-sm opacity-90 whitespace-pre-wrap">{a.message}</div>
            </div>
            <button
              onClick={() => dismiss(a.id)}
              className="absolute top-2 right-2 opacity-60 hover:opacity-100 transition"
              aria-label="Dispensar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
