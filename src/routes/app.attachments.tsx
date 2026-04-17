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
import { Upload, Trash2, Search, Paperclip, Download } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/attachments")({
  component: AttachmentsPage,
});

interface Att {
  id: string;
  patient_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  patients?: { name: string; cpf: string | null };
}
interface PatientLite { id: string; name: string }

function AttachmentsPage() {
  const { clinic } = useAuth();
  const [list, setList] = useState<Att[]>([]);
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!clinic) return;
    const [a, p] = await Promise.all([
      supabase.from("attachments").select("*, patients(name, cpf)").eq("clinic_id", clinic.id).order("created_at", { ascending: false }),
      supabase.from("patients").select("id, name").eq("clinic_id", clinic.id).order("name"),
    ]);
    setList((a.data as any) ?? []);
    setPatients(p.data ?? []);
  };

  useEffect(() => { load(); }, [clinic]);

  const filtered = list.filter((a) => {
    const q = search.toLowerCase();
    return (a.patients?.name ?? "").toLowerCase().includes(q)
      || (a.patients?.cpf ?? "").includes(q)
      || a.file_name.toLowerCase().includes(q);
  });

  const upload = async () => {
    if (!clinic || !file || !patientId) {
      toast.error("Selecione paciente e arquivo");
      return;
    }
    setUploading(true);
    const ts = Date.now();
    const path = `${clinic.id}/${patientId}/${ts}_${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("patient-attachments").upload(path, file);
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }
    const { error } = await supabase.from("attachments").insert({
      clinic_id: clinic.id,
      patient_id: patientId,
      file_name: file.name,
      file_path: path,
      file_type: file.type,
      file_size: file.size,
    });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Anexo enviado");
    setOpen(false);
    setFile(null);
    setPatientId("");
    load();
  };

  const download = async (a: Att) => {
    const { data, error } = await supabase.storage
      .from("patient-attachments")
      .createSignedUrl(a.file_path, 300);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (a: Att) => {
    await supabase.storage.from("patient-attachments").remove([a.file_path]);
    const { error } = await supabase.from("attachments").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    load();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Anexos</h1>
          <p className="text-muted-foreground">PDFs e imagens vinculados aos pacientes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Upload className="h-4 w-4 mr-2" />Novo anexo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar anexo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Paciente *</Label>
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Arquivo (PDF ou imagem)</Label>
                <Input type="file" accept="application/pdf,image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={upload} disabled={uploading}>
                {uploading ? "Enviando..." : "Enviar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, CPF ou arquivo..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </Card>

      <div className="grid gap-2">
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">Nenhum anexo encontrado.</Card>
        )}
        {filtered.map((a) => (
          <Card key={a.id} className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent/40 grid place-items-center shrink-0">
              <Paperclip className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{a.file_name}</div>
              <div className="text-sm text-muted-foreground">
                {a.patients?.name} · {formatDate(a.created_at)}
                {a.file_size && <span> · {(a.file_size / 1024).toFixed(0)} KB</span>}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => download(a)}>
              <Download className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir anexo?</AlertDialogTitle>
                  <AlertDialogDescription>O arquivo será removido permanentemente.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remove(a)}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Card>
        ))}
      </div>
    </div>
  );
}
