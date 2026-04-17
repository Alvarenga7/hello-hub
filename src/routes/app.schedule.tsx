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
import { Plus, Pencil, Trash2, Search, CalendarDays } from "lucide-react";
import { formatDate, formatTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/schedule")({
  component: SchedulePage,
});

interface Appt {
  id: string;
  patient_id: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  notes: string | null;
  status: string;
  patients?: { name: string; cpf: string | null };
}
interface PatientLite { id: string; name: string }

function SchedulePage() {
  const { clinic } = useAuth();
  const [list, setList] = useState<Appt[]>([]);
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appt | null>(null);
  const [form, setForm] = useState({
    patient_id: "",
    appointment_date: new Date().toISOString().slice(0, 10),
    appointment_time: "08:00",
    duration_minutes: 60,
    notes: "",
    status: "agendado",
  });

  const load = async () => {
    if (!clinic) return;
    const [a, p] = await Promise.all([
      supabase.from("appointments").select("*, patients(name, cpf)")
        .eq("clinic_id", clinic.id)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true }),
      supabase.from("patients").select("id, name").eq("clinic_id", clinic.id).order("name"),
    ]);
    setList((a.data as any) ?? []);
    setPatients(p.data ?? []);
  };

  useEffect(() => { load(); }, [clinic]);

  const filtered = list.filter((a) => {
    const q = search.toLowerCase();
    return (a.patients?.name ?? "").toLowerCase().includes(q) || (a.patients?.cpf ?? "").includes(q);
  });

  const groups = filtered.reduce<Record<string, Appt[]>>((acc, item) => {
    (acc[item.appointment_date] ||= []).push(item);
    return acc;
  }, {});

  const openNew = () => {
    setEditing(null);
    setForm({
      patient_id: "",
      appointment_date: new Date().toISOString().slice(0, 10),
      appointment_time: "08:00",
      duration_minutes: 60,
      notes: "",
      status: "agendado",
    });
    setOpen(true);
  };
  const openEdit = (a: Appt) => {
    setEditing(a);
    setForm({
      patient_id: a.patient_id,
      appointment_date: a.appointment_date,
      appointment_time: a.appointment_time.substring(0, 5),
      duration_minutes: a.duration_minutes,
      notes: a.notes ?? "",
      status: a.status,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!clinic) return;
    if (!form.patient_id) { toast.error("Selecione o paciente"); return; }
    const payload = { ...form, clinic_id: clinic.id };
    const { error } = editing
      ? await supabase.from("appointments").update(payload).eq("id", editing.id)
      : await supabase.from("appointments").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    load();
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Agenda</h1>
          <p className="text-muted-foreground">Próximos atendimentos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo agendamento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar" : "Novo"} agendamento</DialogTitle>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data *</Label>
                  <Input type="date" value={form.appointment_date}
                    onChange={(e) => setForm({ ...form, appointment_date: e.target.value })} />
                </div>
                <div>
                  <Label>Hora *</Label>
                  <Input type="time" value={form.appointment_time}
                    onChange={(e) => setForm({ ...form, appointment_time: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Duração (min)</Label>
                  <Input type="number" min={15} step={15} value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agendado">Agendado</SelectItem>
                      <SelectItem value="confirmado">Confirmado</SelectItem>
                      <SelectItem value="realizado">Realizado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea rows={3} value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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

      {Object.keys(groups).length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">Nenhum agendamento encontrado.</Card>
      )}

      {Object.entries(groups).map(([date, items]) => (
        <div key={date} className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
            <CalendarDays className="h-4 w-4" />
            {formatDate(date)} {date === today && <span className="text-warning normal-case">· hoje</span>}
          </div>
          <div className="grid gap-2">
            {items.map((a) => (
              <Card key={a.id} className="p-4 flex items-center gap-4">
                <div className="text-center shrink-0 w-16">
                  <div className="text-lg font-bold">{formatTime(a.appointment_time)}</div>
                  <div className="text-xs text-muted-foreground">{a.duration_minutes}min</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.patients?.name}</div>
                  {a.notes && <div className="text-sm text-muted-foreground truncate">{a.notes}</div>}
                  <div className="text-xs text-muted-foreground capitalize mt-0.5">{a.status}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => openEdit(a)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(a.id)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
