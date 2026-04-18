-- Tabela de avisos
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  expires_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Super admin gerencia tudo
CREATE POLICY "Super admin manages announcements"
ON public.announcements
FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Clínicas leem avisos ativos e não expirados
CREATE POLICY "Authenticated users read active announcements"
ON public.announcements
FOR SELECT
USING (
  active = true
  AND (expires_at IS NULL OR expires_at > now())
  AND auth.uid() IS NOT NULL
);

CREATE TRIGGER update_announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de dispensas (cada usuário pode ocultar um aviso)
CREATE TABLE public.announcement_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dismissals"
ON public.announcement_dismissals
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());