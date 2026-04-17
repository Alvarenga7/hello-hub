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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Clock } from "lucide-react";
import { formatDate, formatTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/attendance")({
  component: AttendancePage,
});

interface Att {
  id: string;
  patient_id: string;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  patients?: { name: string; cpf: string | null };
}
interface PatientLite { id: string; name: string }

function AttendancePage() {
  const { clinic } = useAuth();
  const [list, setList] = useState<Att[]>([]);
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Att | null>(null);
  const [form, setForm] = useState({
    patient_id: "",
    attendance_date: new Date().toISOString().slice(0, 10),
    check_in: "",
    check_out: "",
  });

  const load = async () => {
    if (!clinic) return;
    const [a, p] = await Promise.all([
      supabase.from("attendance").select("*, patients(name, cpf)").eq("clinic_id", clinic.id).order("attendance_date", { ascending: false }),
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

  // Agrupar por dia
  const groups = filtered.reduce<Record<string, Att[]>>((acc, item) => {
    (acc[item.attendance_date] ||= []).push(item);
    return acc;
  }, {});

  const openNew = () => {
    setEditing(null);
    setForm({
      patient_id: "",
      attendance_date: new Date().toISOString().slice(0, 10),
      check_in: "", check_out: "",
    });
    setOpen(true);
  };
  const openEdit = (a: Att) => {
    setEditing(a);
    setForm({
      patient_id: a.patient_id,
      attendance_date: a.attendance_date,
      check_in: a.check_in?.substring(0, 5) ?? "",
      check_out: a.check_out?.substring(0, 5) ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!clinic) return;
    if (!form.patient_id) { toast.error("Selecione o paciente"); return; }
    const payload = {
      clinic_id: clinic.id,
      patient_id: form.patient_id,
      attendance_date: form.attendance_date,
      check_in: form.check_in || null,
      check_out: form.check_out || null,
    };
    const { error } = editing
      ? await supabase.from("attendance").update(payload).eq("id", editing.id)
      : await supabase.from("attendance").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("attendance").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    load();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Presença</h1>
          <p className="text-muted-foreground">Registros agrupados por dia</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo registro</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar" : "Novo"} registro</DialogTitle>
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
              <div>
                <Label>Data *</Label>
                <Input type="date" value={form.attendance_date}
                  onChange={(e) => setForm({ ...form, attendance_date: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Entrada</Label>
                  <Input type="time" value={form.check_in}
                    onChange={(e) => setForm({ ...form, check_in: e.target.value })} />
                </div>
                <div>
                  <Label>Saída</Label>
                  <Input type="time" value={form.check_out}
                    onChange={(e) => setForm({ ...form, check_out: e.target.value })} />
                </div>
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
        <Card className="p-8 text-center text-muted-foreground">Nenhum registro encontrado.</Card>
      )}

      {Object.entries(groups).map(([date, items]) => (
        <div key={date} className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
            <Clock className="h-4 w-4" />
            {formatDate(date)}
          </div>
          <div className="grid gap-2">
            {items.map((a) => (
              <Card key={a.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.patients?.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Entrada: {formatTime(a.check_in)} · Saída: {formatTime(a.check_out)}
                  </div>
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
                      <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
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
