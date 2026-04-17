import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, FileText } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/records")({
  component: RecordsPage,
});

interface Record {
  id: string;
  patient_id: string;
  session_number: number;
  session_date: string;
  pathology: string | null;
  evolution: string;
  patients?: { name: string; cpf: string | null };
}
interface PatientLite { id: string; name: string }

function RecordsPage() {
  const { clinic } = useAuth();
  const [list, setList] = useState<Record[]>([]);
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Record | null>(null);
  const [form, setForm] = useState({
    patient_id: "", session_date: new Date().toISOString().slice(0, 10),
    pathology: "", evolution: "", session_number: 1,
  });

  const load = async () => {
    if (!clinic) return;
    const [r, p] = await Promise.all([
      supabase.from("medical_records").select("*, patients(name, cpf)").eq("clinic_id", clinic.id).order("session_date", { ascending: false }),
      supabase.from("patients").select("id, name").eq("clinic_id", clinic.id).order("name"),
    ]);
    setList((r.data as any) ?? []);
    setPatients(p.data ?? []);
  };

  useEffect(() => { load(); }, [clinic]);

  const filtered = list.filter((r) => {
    const q = search.toLowerCase();
    return (r.patients?.name ?? "").toLowerCase().includes(q) || (r.patients?.cpf ?? "").includes(q);
  });

  const openNew = async () => {
    setEditing(null);
    setForm({
      patient_id: "", session_date: new Date().toISOString().slice(0, 10),
      pathology: "", evolution: "", session_number: 1,
    });
    setOpen(true);
  };

  const handlePatientChange = async (patientId: string) => {
    if (!clinic) return;
    // calcula próximo número de sessão
    const { data } = await supabase
      .from("medical_records")
      .select("session_number")
      .eq("patient_id", patientId)
      .order("session_number", { ascending: false })
      .limit(1);
    const next = (data?.[0]?.session_number ?? 0) + 1;
    setForm({ ...form, patient_id: patientId, session_number: next });
  };

  const openEdit = (r: Record) => {
    setEditing(r);
    setForm({
      patient_id: r.patient_id,
      session_date: r.session_date,
      pathology: r.pathology ?? "",
      evolution: r.evolution,
      session_number: r.session_number,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!clinic) return;
    if (!form.patient_id) { toast.error("Selecione o paciente"); return; }
    if (!form.evolution.trim()) { toast.error("Evolução é obrigatória"); return; }
    const payload = { ...form, clinic_id: clinic.id };
    const { error } = editing
      ? await supabase.from("medical_records").update(payload).eq("id", editing.id)
      : await supabase.from("medical_records").insert(payload);
    if (error) {
      if (error.code === "23505") toast.error("Já existe sessão com esse número para este paciente");
      else toast.error(error.message);
      return;
    }
    toast.success("Salvo");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("medical_records").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    load();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Prontuário</h1>
          <p className="text-muted-foreground">Evolução por sessão (numeração sequencial)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova evolução</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar" : "Nova"} evolução</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Paciente *</Label>
                <Select
                  value={form.patient_id}
                  onValueChange={editing ? (v) => setForm({ ...form, patient_id: v }) : handlePatientChange}
                  disabled={!!editing}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nº sessão</Label>
                  <Input type="number" min={1} value={form.session_number}
                    onChange={(e) => setForm({ ...form, session_number: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={form.session_date}
                    onChange={(e) => setForm({ ...form, session_date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Patologia</Label>
                <Input value={form.pathology} onChange={(e) => setForm({ ...form, pathology: e.target.value })} />
              </div>
              <div>
                <Label>Evolução *</Label>
                <Textarea rows={6} value={form.evolution}
                  onChange={(e) => setForm({ ...form, evolution: e.target.value })} />
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
          <Input placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </Card>

      <div className="grid gap-3">
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">Nenhuma evolução encontrada.</Card>
        )}
        {filtered.map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/40 grid place-items-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-semibold">{r.patients?.name}</span>
                  <span className="text-sm text-muted-foreground">Sessão {r.session_number}</span>
                  <span className="text-sm text-muted-foreground">{formatDate(r.session_date)}</span>
                </div>
                {r.pathology && (
                  <div className="text-sm mt-1"><span className="text-muted-foreground">Patologia:</span> {r.pathology}</div>
                )}
                <div className="mt-2 whitespace-pre-wrap break-words text-sm">{r.evolution}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir evolução?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(r.id)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
