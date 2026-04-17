import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, FileDown, Shield, Building2 } from "lucide-react";
import { generateClinicReportPdf } from "@/lib/pdf";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/admin")({
  component: AdminPage,
});

interface Clinic {
  id: string;
  owner_id: string;
  name: string;
  email: string;
  logo_url: string | null;
  active: boolean;
  created_at: string;
}

function AdminPage() {
  const { isSuperAdmin, signOut } = useAuth();
  const [list, setList] = useState<Clinic[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Clinic | null>(null);
  const [editName, setEditName] = useState("");

  const load = async () => {
    const { data } = await supabase.from("clinics").select("*").order("created_at", { ascending: false });
    setList(data ?? []);
  };

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-20">
        <Shield className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="text-muted-foreground mt-2">Apenas Super Admin pode acessar esta área.</p>
        <Button onClick={() => signOut()} variant="outline" className="mt-4">Sair</Button>
      </div>
    );
  }

  const toggleActive = async (c: Clinic) => {
    const { error } = await supabase.from("clinics").update({ active: !c.active }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Clínica ${!c.active ? "ativada" : "desativada"}`);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("clinics").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Clínica excluída");
    load();
  };

  const openEdit = (c: Clinic) => { setEditing(c); setEditName(c.name); setEditOpen(true); };
  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from("clinics").update({ name: editName }).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Atualizada");
    setEditOpen(false);
    load();
  };

  const generatePdf = async (c: Clinic) => {
    try {
      await generateClinicReportPdf(c);
      toast.success("PDF gerado");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl gradient-primary grid place-items-center">
          <Shield className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Painel Admin</h1>
          <p className="text-muted-foreground">{list.length} clínica(s) cadastrada(s)</p>
        </div>
      </div>

      <div className="grid gap-3">
        {list.map((c) => (
          <Card key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            {c.logo_url ? (
              <img src={c.logo_url} alt={c.name} className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-accent/40 grid place-items-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{c.name}</div>
              <div className="text-sm text-muted-foreground truncate">{c.email}</div>
              <div className="text-xs text-muted-foreground">Criada em {formatDate(c.created_at)}</div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={c.active} onCheckedChange={() => toggleActive(c)} />
              <span className="text-sm text-muted-foreground">{c.active ? "Ativa" : "Inativa"}</span>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => generatePdf(c)} title="Backup PDF">
                <FileDown className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {c.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      TODOS os dados desta clínica (pacientes, prontuário, financeiro, anexos) serão removidos permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(c.id)}>Excluir definitivamente</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        ))}
        {list.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">Nenhuma clínica cadastrada.</Card>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar clínica</DialogTitle></DialogHeader>
          <div>
            <Label>Nome</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
