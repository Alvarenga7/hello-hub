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
import { Pencil, Trash2, FileDown, Shield, Building2, Plus, Megaphone } from "lucide-react";
import { generateClinicReportPdf } from "@/lib/pdf";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

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

  // Nova clínica
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [creating, setCreating] = useState(false);

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

  const createClinic = async () => {
    if (!newName.trim() || !newEmail.trim() || newPass.length < 6) {
      toast.error("Preencha nome, e-mail e senha (mín. 6)");
      return;
    }
    setCreating(true);
    // Salva sessão atual (super admin) para restaurar depois
    const { data: currentSession } = await supabase.auth.getSession();

    // 1) cria conta da clínica
    const { data: signUp, error: sErr } = await supabase.auth.signUp({
      email: newEmail.trim(),
      password: newPass,
    });
    if (sErr && !/already registered/i.test(sErr.message)) {
      setCreating(false);
      toast.error("Erro", { description: sErr.message });
      return;
    }

    let ownerId = signUp.user?.id;
    if (!ownerId) {
      // já existia → tenta obter via signIn
      const { data: si } = await supabase.auth.signInWithPassword({
        email: newEmail.trim(),
        password: newPass,
      });
      ownerId = si.user?.id;
    }

    if (!ownerId) {
      setCreating(false);
      toast.error("Não foi possível obter o usuário (verifique e-mail/senha)");
      return;
    }

    // 2) insere clínica usando sessão atual (super admin tem permissão via RLS)
    if (currentSession.session) {
      await supabase.auth.setSession({
        access_token: currentSession.session.access_token,
        refresh_token: currentSession.session.refresh_token,
      });
    }

    const { error: cErr } = await supabase.from("clinics").insert({
      owner_id: ownerId,
      name: newName.trim(),
      email: newEmail.trim(),
    });

    setCreating(false);
    if (cErr) {
      toast.error("Erro ao criar clínica", { description: cErr.message });
      return;
    }
    toast.success("Clínica criada!");
    setNewOpen(false);
    setNewName(""); setNewEmail(""); setNewPass("");
    load();
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl gradient-primary grid place-items-center">
          <Shield className="h-6 w-6 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Painel Admin</h1>
          <p className="text-muted-foreground">{list.length} clínica(s) cadastrada(s)</p>
        </div>
      </div>

      <Tabs defaultValue="clinics">
        <TabsList>
          <TabsTrigger value="clinics" className="gap-2"><Building2 className="h-4 w-4" /> Clínicas</TabsTrigger>
          <TabsTrigger value="announcements" className="gap-2"><Megaphone className="h-4 w-4" /> Avisos</TabsTrigger>
        </TabsList>

        <TabsContent value="clinics" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setNewOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nova clínica
            </Button>
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
        </TabsContent>

        <TabsContent value="announcements">
          <AnnouncementsManager />
        </TabsContent>
      </Tabs>

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

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova clínica</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome da clínica</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Clínica Vida" />
            </div>
            <div>
              <Label>E-mail do proprietário</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="dono@clinica.com" />
            </div>
            <div>
              <Label>Senha inicial (mín. 6)</Label>
              <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">
                O proprietário usará esses dados para entrar e poderá trocar depois.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={createClinic} disabled={creating}>{creating ? "Criando..." : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

function AnnouncementsManager() {
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!title.trim() || !message.trim() || !user) {
      toast.error("Preencha título e mensagem");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("announcements").insert({
      title: title.trim(),
      message: message.trim(),
      type,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      created_by: user.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Aviso publicado!");
    setOpen(false);
    setTitle(""); setMessage(""); setType("info"); setExpiresAt("");
    load();
  };

  const toggleActive = async (a: Announcement) => {
    await supabase.from("announcements").update({ active: !a.active }).eq("id", a.id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("announcements").delete().eq("id", id);
    toast.success("Aviso excluído");
    load();
  };

  const isExpired = (a: Announcement) => a.expires_at && new Date(a.expires_at) <= new Date();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Crie avisos que aparecerão como banner para todas as clínicas.
        </p>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo aviso
        </Button>
      </div>

      <div className="grid gap-3">
        {items.map((a) => (
          <Card key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-semibold">{a.title}</div>
                <Badge variant="outline">{a.type}</Badge>
                {!a.active && <Badge variant="secondary">Inativo</Badge>}
                {isExpired(a) && <Badge variant="destructive">Expirado</Badge>}
              </div>
              <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.message}</div>
              <div className="text-xs text-muted-foreground mt-2">
                Criado em {formatDate(a.created_at)}
                {a.expires_at && ` · Expira em ${formatDate(a.expires_at)}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={a.active} onCheckedChange={() => toggleActive(a)} />
              <Button size="icon" variant="ghost" onClick={() => remove(a.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
        {items.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">Nenhum aviso criado.</Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo aviso</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Nova funcionalidade!" />
            </div>
            <div>
              <Label>Mensagem</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Descreva a novidade..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Informação</SelectItem>
                    <SelectItem value="sucesso">Sucesso</SelectItem>
                    <SelectItem value="aviso">Aviso</SelectItem>
                    <SelectItem value="alerta">Alerta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expira em (opcional)</Label>
                <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={create} disabled={saving}>{saving ? "Publicando..." : "Publicar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

