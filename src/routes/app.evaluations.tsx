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
import { Plus, Pencil, Trash2, Search, ClipboardList } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/evaluations")({
  component: EvaluationsPage,
});

interface Evaluation {
  id: string;
  patient_id: string;
  clinical_diagnosis: string | null;
  anamnesis: string | null;
  main_complaint: string | null;
  current_disease_history: string | null;
  past_pathological_history: string | null;
  medications: string | null;
  complementary_exams: string | null;
  treatment_proposal: string | null;
  patients?: { name: string; cpf: string | null };
}

interface PatientLite { id: string; name: string; cpf: string | null }

const FIELDS: { key: keyof Evaluation; label: string }[] = [
  { key: "clinical_diagnosis", label: "Diagnóstico clínico" },
  { key: "anamnesis", label: "Anamnese" },
  { key: "main_complaint", label: "Queixa principal" },
  { key: "current_disease_history", label: "História da moléstia atual" },
  { key: "past_pathological_history", label: "História patológica pregressa" },
  { key: "medications", label: "Medicamentos e dosagens" },
  { key: "complementary_exams", label: "Exames complementares" },
  { key: "treatment_proposal", label: "Proposta de tratamento" },
];

const empty = {
  patient_id: "",
  clinical_diagnosis: "", anamnesis: "", main_complaint: "",
  current_disease_history: "", past_pathological_history: "",
  medications: "", complementary_exams: "", treatment_proposal: "",
};

function EvaluationsPage() {
  const { clinic } = useAuth();
  const [list, setList] = useState<Evaluation[]>([]);
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Evaluation | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);

  const load = async () => {
    if (!clinic) return;
    const [ev, pt] = await Promise.all([
      supabase.from("evaluations").select("*, patients(name, cpf)").eq("clinic_id", clinic.id).order("created_at", { ascending: false }),
      supabase.from("patients").select("id, name, cpf").eq("clinic_id", clinic.id).order("name"),
    ]);
    setList((ev.data as any) ?? []);
    setPatients(pt.data ?? []);
  };

  useEffect(() => { load(); }, [clinic]);

  const filtered = list.filter((e) => {
    const q = search.toLowerCase();
    return (e.patients?.name ?? "").toLowerCase().includes(q) || (e.patients?.cpf ?? "").includes(q);
  });

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (e: Evaluation) => {
    setEditing(e);
    setForm({
      patient_id: e.patient_id,
      clinical_diagnosis: e.clinical_diagnosis ?? "",
      anamnesis: e.anamnesis ?? "",
      main_complaint: e.main_complaint ?? "",
      current_disease_history: e.current_disease_history ?? "",
      past_pathological_history: e.past_pathological_history ?? "",
      medications: e.medications ?? "",
      complementary_exams: e.complementary_exams ?? "",
      treatment_proposal: e.treatment_proposal ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!clinic) return;
    if (!form.patient_id) { toast.error("Selecione o paciente"); return; }
    const payload = { ...form, clinic_id: clinic.id };
    const { error } = editing
      ? await supabase.from("evaluations").update(payload).eq("id", editing.id)
      : await supabase.from("evaluations").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("evaluations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    load();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Avaliações</h1>
          <p className="text-muted-foreground">Avaliação completa do paciente</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova avaliação</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar" : "Nova"} avaliação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Paciente *</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {FIELDS.map((f) => (
                <div key={f.key as string}>
                  <Label>{f.label}</Label>
                  <Textarea
                    rows={3}
                    value={(form as any)[f.key] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                </div>
              ))}
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

      <div className="grid gap-4">
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">Nenhuma avaliação encontrada.</Card>
        )}
        {filtered.map((e) => (
          <Card key={e.id} className="p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/40 grid place-items-center shrink-0">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div className="font-semibold">{e.patients?.name}</div>
                {FIELDS.map((f) => {
                  const val = (e as any)[f.key];
                  if (!val) return null;
                  return (
                    <div key={f.key as string}>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">{f.label}</div>
                      <div className="whitespace-pre-wrap break-words text-sm">{val}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => openEdit(e)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir avaliação?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(e.id)}>Excluir</AlertDialogAction>
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
