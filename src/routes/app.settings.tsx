import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { clinic, refreshClinic } = useAuth();
  const [name, setName] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (clinic) {
      setName(clinic.name);
      setPixKey(clinic.pix_key ?? "");
      setPixType(clinic.pix_key_type ?? "");
    }
  }, [clinic]);

  const save = async () => {
    if (!clinic) return;
    setSaving(true);
    let logoUrl = clinic.logo_url;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `${clinic.owner_id ?? clinic.id}/logo_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("clinic-logos").upload(path, logoFile, { upsert: true });
      if (upErr) {
        setSaving(false);
        toast.error("Falha no upload da logo: " + upErr.message);
        return;
      }
      const { data: pub } = supabase.storage.from("clinic-logos").getPublicUrl(path);
      logoUrl = pub.publicUrl;
    }
    const { error } = await supabase.from("clinics").update({
      name, pix_key: pixKey || null, pix_key_type: pixType || null, logo_url: logoUrl,
    }).eq("id", clinic.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Configurações salvas");
    await refreshClinic();
  };

  if (!clinic) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Identidade e PIX da clínica</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-4">
          {clinic.logo_url ? (
            <img src={clinic.logo_url} alt="Logo" className="h-20 w-20 rounded-xl object-cover" />
          ) : (
            <div className="h-20 w-20 rounded-xl bg-accent/40 grid place-items-center text-muted-foreground">
              Sem logo
            </div>
          )}
          <div className="flex-1">
            <Label>Trocar logo</Label>
            <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        <div>
          <Label>Nome da clínica</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Tipo da chave PIX</Label>
            <Select value={pixType} onValueChange={setPixType}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
                <SelectItem value="aleatoria">Aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Chave PIX</Label>
            <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="sua chave PIX" />
          </div>
        </div>

        <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-2">Informações da conta</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <div>E-mail: {clinic.email}</div>
          <div>Status: {clinic.active ? "Ativa" : "Inativa"}</div>
          <div>ID: {clinic.id}</div>
        </div>
      </Card>
    </div>
  );
}
