import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, DollarSign, AlertTriangle, CheckCircle2, FileDown, Activity } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { generateClinicReportPdf } from "@/lib/pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

interface Stats {
  patients: number;
  pendingAmount: number;
  paidAmount: number;
  overdue: number;
}

function Dashboard() {
  const { clinic } = useAuth();
  const [stats, setStats] = useState<Stats>({ patients: 0, pendingAmount: 0, paidAmount: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!clinic) return;
    const load = async () => {
      // mark overdue first
      await supabase
        .from("payments")
        .update({ status: "atrasado" })
        .eq("clinic_id", clinic.id)
        .eq("status", "pendente")
        .lt("due_date", new Date().toISOString().slice(0, 10));

      const [pCount, payments] = await Promise.all([
        supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinic.id),
        supabase.from("payments").select("amount, status").eq("clinic_id", clinic.id),
      ]);
      const list = payments.data ?? [];
      setStats({
        patients: pCount.count ?? 0,
        pendingAmount: list.filter((p) => p.status === "pendente").reduce((s, p) => s + Number(p.amount), 0),
        paidAmount: list.filter((p) => p.status === "pago").reduce((s, p) => s + Number(p.amount), 0),
        overdue: list.filter((p) => p.status === "atrasado").length,
      });
      setLoading(false);
    };
    load();
  }, [clinic]);

  const handlePdf = async () => {
    if (!clinic) return;
    setGenerating(true);
    try {
      await generateClinicReportPdf(clinic);
      toast.success("PDF gerado!");
    } catch (e: any) {
      toast.error("Erro ao gerar PDF", { description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  if (!clinic) return null;

  const cards = [
    { label: "Pacientes", value: stats.patients, icon: Users, color: "text-primary" },
    { label: "Pendentes", value: formatCurrency(stats.pendingAmount), icon: DollarSign, color: "text-warning" },
    { label: "Recebido", value: formatCurrency(stats.paidAmount), icon: CheckCircle2, color: "text-success" },
    { label: "Atrasados", value: stats.overdue, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          {clinic.logo_url ? (
            <img src={clinic.logo_url} alt={clinic.name} className="h-16 w-16 rounded-xl object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-xl gradient-primary grid place-items-center">
              <Activity className="h-8 w-8 text-primary-foreground" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold">{clinic.name}</h1>
            <p className="text-muted-foreground">Visão geral da clínica</p>
          </div>
        </div>
        <Button onClick={handlePdf} disabled={generating}>
          <FileDown className="h-4 w-4 mr-2" />
          {generating ? "Gerando..." : "Gerar PDF"}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5 hover:shadow-elegant transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <div className="text-2xl font-bold">{loading ? "..." : c.value}</div>
          </Card>
        ))}
      </div>

      {stats.overdue > 0 && (
        <Card className="p-5 border-destructive/40 bg-destructive/10">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <div className="font-medium">Você tem {stats.overdue} pagamento(s) atrasado(s)</div>
              <div className="text-sm text-muted-foreground">Acesse o módulo financeiro para revisar.</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
