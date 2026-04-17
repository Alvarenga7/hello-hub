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
import { Plus, Pencil, Trash2, Search, DollarSign, QrCode } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import QRCode from "qrcode";

export const Route = createFileRoute("/app/finance")({
  component: FinancePage,
});

interface Payment {
  id: string;
  patient_id: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: "pendente" | "pago" | "atrasado";
  description: string | null;
  patients?: { name: string; cpf: string | null };
}
interface PatientLite { id: string; name: string }

const STATUS_COLOR: Record<string, string> = {
  pendente: "bg-warning/20 text-warning border-warning/40",
  pago: "bg-success/20 text-success border-success/40",
  atrasado: "bg-destructive/20 text-destructive border-destructive/40",
};

// Gera payload PIX EMV (estático, copia-e-cola)
function buildPixPayload({ key, name, city, amount, txid }: {
  key: string; name: string; city: string; amount?: number; txid?: string;
}): string {
  const f = (id: string, val: string) => id + String(val.length).padStart(2, "0") + val;
  const merchantAccount = f("00", "BR.GOV.BCB.PIX") + f("01", key);
  let payload =
    f("00", "01") +
    f("26", merchantAccount) +
    f("52", "0000") +
    f("53", "986") +
    (amount ? f("54", amount.toFixed(2)) : "") +
    f("58", "BR") +
    f("59", name.substring(0, 25)) +
    f("60", city.substring(0, 15)) +
    f("62", f("05", (txid ?? "***").substring(0, 25)));
  payload += "6304";
  // CRC16-CCITT
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return payload + crc.toString(16).toUpperCase().padStart(4, "0");
}

function FinancePage() {
  const { clinic } = useAuth();
  const [list, setList] = useState<Payment[]>([]);
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [form, setForm] = useState({
    patient_id: "",
    amount: 0,
    due_date: new Date().toISOString().slice(0, 10),
    payment_date: "",
    status: "pendente" as Payment["status"],
    description: "",
  });
  const [pixOpen, setPixOpen] = useState(false);
  const [pixData, setPixData] = useState<{ payload: string; qr: string; payment: Payment } | null>(null);

  const load = async () => {
    if (!clinic) return;
    // marca atrasados
    await supabase
      .from("payments").update({ status: "atrasado" })
      .eq("clinic_id", clinic.id).eq("status", "pendente")
      .lt("due_date", new Date().toISOString().slice(0, 10));

    const [pay, pat] = await Promise.all([
      supabase.from("payments").select("*, patients(name, cpf)").eq("clinic_id", clinic.id).order("due_date", { ascending: false }),
      supabase.from("patients").select("id, name").eq("clinic_id", clinic.id).order("name"),
    ]);
    setList((pay.data as any) ?? []);
    setPatients(pat.data ?? []);
  };

  useEffect(() => { load(); }, [clinic]);

  const filtered = list.filter((p) => {
    const q = search.toLowerCase();
    return (p.patients?.name ?? "").toLowerCase().includes(q) || (p.patients?.cpf ?? "").includes(q);
  });

  const openNew = () => {
    setEditing(null);
    setForm({
      patient_id: "", amount: 0,
      due_date: new Date().toISOString().slice(0, 10),
      payment_date: "", status: "pendente", description: "",
    });
    setOpen(true);
  };
  const openEdit = (p: Payment) => {
    setEditing(p);
    setForm({
      patient_id: p.patient_id,
      amount: Number(p.amount),
      due_date: p.due_date,
      payment_date: p.payment_date ?? "",
      status: p.status,
      description: p.description ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!clinic) return;
    if (!form.patient_id) { toast.error("Selecione o paciente"); return; }
    if (form.amount <= 0) { toast.error("Valor deve ser maior que zero"); return; }
    const payload = {
      clinic_id: clinic.id,
      patient_id: form.patient_id,
      amount: form.amount,
      due_date: form.due_date,
      payment_date: form.payment_date || null,
      status: form.status,
      description: form.description || null,
    };
    const { error } = editing
      ? await supabase.from("payments").update(payload).eq("id", editing.id)
      : await supabase.from("payments").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    load();
  };

  const setStatus = async (p: Payment, status: Payment["status"]) => {
    const update: any = { status };
    if (status === "pago") update.payment_date = new Date().toISOString().slice(0, 10);
    if (status !== "pago") update.payment_date = null;
    await supabase.from("payments").update(update).eq("id", p.id);
    toast.success(`Marcado como ${status}`);
    load();
  };

  const showPix = async (p: Payment) => {
    if (!clinic?.pix_key) {
      toast.error("Configure a chave PIX em Configurações primeiro");
      return;
    }
    const payload = buildPixPayload({
      key: clinic.pix_key,
      name: clinic.name,
      city: "BRASIL",
      amount: Number(p.amount),
      txid: p.id.replace(/-/g, "").substring(0, 25),
    });
    const qr = await QRCode.toDataURL(payload, { width: 280, margin: 1 });
    setPixData({ payload, qr, payment: p });
    setPixOpen(true);
  };

  const totals = {
    pendente: filtered.filter((p) => p.status === "pendente").reduce((s, p) => s + Number(p.amount), 0),
    pago: filtered.filter((p) => p.status === "pago").reduce((s, p) => s + Number(p.amount), 0),
    atrasado: filtered.filter((p) => p.status === "atrasado").reduce((s, p) => s + Number(p.amount), 0),
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground">Fluxo de caixa</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo lançamento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar" : "Novo"} lançamento</DialogTitle>
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
                  <Label>Valor (R$) *</Label>
                  <Input type="number" step="0.01" min={0} value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Vencimento *</Label>
                  <Input type="date" value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="atrasado">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data de pagamento</Label>
                  <Input type="date" value={form.payment_date}
                    onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Pendente</div><div className="text-xl font-bold text-warning">{formatCurrency(totals.pendente)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Recebido</div><div className="text-xl font-bold text-success">{formatCurrency(totals.pago)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Atrasado</div><div className="text-xl font-bold text-destructive">{formatCurrency(totals.atrasado)}</div></Card>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </Card>

      <div className="grid gap-2">
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">Nenhum lançamento encontrado.</Card>
        )}
        {filtered.map((p) => (
          <Card key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent/40 grid place-items-center shrink-0">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{p.patients?.name}</div>
              <div className="text-sm text-muted-foreground flex flex-wrap gap-x-3">
                <span>Venc: {formatDate(p.due_date)}</span>
                {p.payment_date && <span>Pago em: {formatDate(p.payment_date)}</span>}
                {p.description && <span className="truncate">{p.description}</span>}
              </div>
            </div>
            <div className="text-lg font-semibold">{formatCurrency(Number(p.amount))}</div>
            <span className={`text-xs px-2 py-1 rounded-full border capitalize ${STATUS_COLOR[p.status]}`}>{p.status}</span>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => showPix(p)} title="Gerar PIX">
                <QrCode className="h-4 w-4" />
              </Button>
              <Select value={p.status} onValueChange={(v: any) => setStatus(p, v)}>
                <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(p.id)}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={pixOpen} onOpenChange={setPixOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagamento PIX</DialogTitle>
          </DialogHeader>
          {pixData && (
            <div className="space-y-4 text-center">
              <div className="text-2xl font-bold">{formatCurrency(Number(pixData.payment.amount))}</div>
              <div className="text-sm text-muted-foreground">{pixData.payment.patients?.name}</div>
              <img src={pixData.qr} alt="QR Code PIX" className="mx-auto rounded-lg bg-white p-2" />
              <div>
                <Label>PIX Copia e Cola</Label>
                <Input readOnly value={pixData.payload} onClick={(e) => (e.target as HTMLInputElement).select()} />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(pixData.payload);
                  toast.success("Código copiado!");
                }}
              >
                Copiar código
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
