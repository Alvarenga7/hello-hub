import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, User } from "lucide-react";
import { calculateAge, formatCpf, formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/patients")({
  component: PatientsPage,
});

interface Patient {
  id: string;
  name: string;
  birth_date: string | null;
  cpf: string | null;
  phone: string | null;
  address: string | null;
  education: string | null;
  profession: string | null;
}

const empty: Omit<Patient, "id"> = {
  name: "", birth_date: null, cpf: null, phone: null, address: null, education: null, profession: null,
};

function PatientsPage() {
  const { clinic } = useAuth();
  const [list, setList] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [form, setForm] = useState<Omit<Patient, "id">>(empty);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!clinic) return;
    const { data } = await supabase
      .from("patients").select("*").eq("clinic_id", clinic.id).order("name");
    setList(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clinic]);

  const filtered = list.filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.cpf ?? "").includes(q);
  });

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (p: Patient) => { setEditing(p); setForm({ ...p }); setOpen(true); };

  const save = async () => {
    if (!clinic) return;
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    const payload = {
      ...form,
      clinic_id: clinic.id,
      birth_date: form.birth_date || null,
    };
    const { error } = editing
      ? await supabase.from("patients").update(payload).eq("id", editing.id)
      : await supabase.from("patients").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Paciente atualizado" : "Paciente cadastrado");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("patients").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Paciente excluído");
    load();
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Pacientes</h1>
          <p className="text-muted-foreground">{list.length} cadastrado(s)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo paciente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar" : "Novo"} paciente</DialogTitle>
            </DialogHeader>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Data de nascimento</Label>
                <Input type="date" value={form.birth_date ?? ""} onChange={(e) => setForm({ ...form, birth_date: e.target.value || null })} />
              </div>
              <div>
                <Label>CPF</Label>
                <Input value={form.cpf ?? ""} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Profissão</Label>
                <Input value={form.profession ?? ""} onChange={(e) => setForm({ ...form, profession: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Endereço</Label>
                <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Escolaridade</Label>
                <Input value={form.education ?? ""} onChange={(e) => setForm({ ...form, education: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      <div className="grid gap-3">
        {loading && <p className="text-muted-foreground">Carregando...</p>}
        {!loading && filtered.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">Nenhum paciente encontrado.</Card>
        )}
        {filtered.map((p) => {
          const age = calculateAge(p.birth_date);
          return (
            <Card key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-accent/40 grid place-items-center shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-x-3">
                  {age !== null && <span>{age} anos</span>}
                  <span>{formatCpf(p.cpf)}</span>
                  {p.phone && <span>{p.phone}</span>}
                  {p.birth_date && <span>Nasc: {formatDate(p.birth_date)}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="icon" variant="ghost" onClick={() => openEdit(p)} aria-label="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir {p.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Todos os dados do paciente serão removidos: avaliações, prontuário, presença, agenda, financeiro e anexos. Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(p.id)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
