import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/")({
  component: AuthPage,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app/dashboard" });
  },
});

function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"login" | "signup">("login");

  // login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // signup (clinic)
  const [clinicName, setClinicName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPass, setSignupPass] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Erro ao entrar", { description: error.message });
      return;
    }
    toast.success("Bem-vindo!");
    const dest =
      email === "henriquehastenreiter@gmail.com" ? "/app/admin" : "/app/dashboard";
    window.location.href = dest;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPass.length < 6) {
      toast.error("Senha deve ter ao menos 6 caracteres");
      return;
    }
    setLoading(true);

    // 1) Cria conta (auto-confirm está habilitado)
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPass,
      options: { emailRedirectTo: `${window.location.origin}/app/dashboard` },
    });
    if (signUpErr && !/already registered/i.test(signUpErr.message)) {
      setLoading(false);
      toast.error("Erro ao cadastrar", { description: signUpErr.message });
      return;
    }

    // 2) Garante sessão ativa via login (funciona mesmo se já existia)
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: signupEmail,
      password: signupPass,
    });
    if (signInErr) {
      setLoading(false);
      toast.error("Erro ao iniciar sessão", { description: signInErr.message });
      return;
    }

    const userId = signInData.user?.id ?? signUpData.user?.id;
    if (!userId) {
      setLoading(false);
      toast.error("Falha ao obter usuário");
      return;
    }

    // Super admin não cria clínica
    if (signupEmail === "henriquehastenreiter@gmail.com") {
      setLoading(false);
      toast.success("Super Admin logado!");
      window.location.href = "/app/admin";
      return;
    }

    // 3) Upload logo (opcional)
    let logoUrl: string | null = null;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `${userId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("clinic-logos")
        .upload(path, logoFile, { upsert: true });
      if (!upErr) {
        const { data: pub } = supabase.storage.from("clinic-logos").getPublicUrl(path);
        logoUrl = pub.publicUrl;
      }
    }

    // 4) Cria clínica (idempotente: ignora se já existe)
    const { data: existing } = await supabase
      .from("clinics")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();

    if (!existing) {
      const { error: cErr } = await supabase.from("clinics").insert({
        owner_id: userId,
        name: clinicName,
        email: signupEmail,
        logo_url: logoUrl,
      });
      if (cErr) {
        setLoading(false);
        toast.error("Erro ao criar clínica", { description: cErr.message });
        return;
      }
    }

    setLoading(false);
    toast.success("Clínica pronta!");
    window.location.href = "/app/dashboard";
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Hero */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-card via-background to-accent/30 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute top-20 left-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        </div>
        <div className="relative flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-primary grid place-items-center shadow-elegant">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">ClinicSaaS</span>
        </div>
        <div className="relative space-y-6">
          <h1 className="text-5xl font-bold leading-tight text-balance">
            Gestão completa para sua{" "}
            <span className="gradient-primary bg-clip-text text-transparent">clínica</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            Pacientes, prontuário eletrônico, agenda, financeiro com PIX e relatórios em PDF — tudo
            em um único lugar, com isolamento total de dados.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>✓ Multi-clínica com dados isolados</li>
            <li>✓ Evolução sequencial de sessões</li>
            <li>✓ PIX QR Code automático</li>
            <li>✓ Backup completo em PDF</li>
          </ul>
        </div>
        <div className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} ClinicSaaS. Todos os direitos reservados.
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <Card className="w-full max-w-md p-8 shadow-card border-border/60">
          <div className="lg:hidden mb-6 flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl gradient-primary grid place-items-center">
              <Activity className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">ClinicSaaS</span>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
            <TabsList className="grid grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar clínica</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <Label htmlFor="cname">Nome da clínica</Label>
                  <Input
                    id="cname"
                    required
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="Ex: Clínica Vida"
                  />
                </div>
                <div>
                  <Label htmlFor="semail">E-mail</Label>
                  <Input
                    id="semail"
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="spass">Senha (mín. 6)</Label>
                  <Input
                    id="spass"
                    type="password"
                    required
                    minLength={6}
                    value={signupPass}
                    onChange={(e) => setSignupPass(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="logo">Logo (opcional)</Label>
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando..." : "Criar clínica"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
