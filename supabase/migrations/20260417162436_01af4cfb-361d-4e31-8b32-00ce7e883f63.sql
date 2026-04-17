
-- ============ ENUM DE ROLES ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'clinic_owner');

CREATE TYPE public.payment_status AS ENUM ('pendente', 'pago', 'atrasado');

-- ============ FUNÇÃO updated_at ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ CLÍNICAS ============
CREATE TABLE public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  logo_url TEXT,
  pix_key TEXT,
  pix_key_type TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinics_owner ON public.clinics(owner_id);
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_clinics_updated BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ FUNÇÕES SECURITY DEFINER ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
$$;

-- Retorna o clinic_id que o usuário atual possui (NULL se não tiver)
CREATE OR REPLACE FUNCTION public.current_user_clinic_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.clinics WHERE owner_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_owns_clinic(_clinic_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinics WHERE id = _clinic_id AND owner_id = auth.uid()
  )
$$;

-- ============ POLÍTICAS user_roles ============
CREATE POLICY "Users see their own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "Super admin manages roles" ON public.user_roles
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ============ POLÍTICAS clinics ============
CREATE POLICY "Owner or super admin reads clinic" ON public.clinics
  FOR SELECT USING (owner_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "Authenticated user creates own clinic" ON public.clinics
  FOR INSERT WITH CHECK (owner_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "Owner or super admin updates clinic" ON public.clinics
  FOR UPDATE USING (owner_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "Super admin deletes clinic" ON public.clinics
  FOR DELETE USING (public.is_super_admin());

-- ============ TRIGGER: criar role e promover super admin no signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'henriquehastenreiter@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'clinic_owner')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ PACIENTES ============
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE,
  cpf TEXT,
  phone TEXT,
  address TEXT,
  education TEXT,
  profession TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_patients_clinic ON public.patients(clinic_id);
CREATE INDEX idx_patients_name ON public.patients(name);
CREATE INDEX idx_patients_cpf ON public.patients(cpf);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Clinic members access patients" ON public.patients
  FOR ALL USING (public.user_owns_clinic(clinic_id) OR public.is_super_admin())
  WITH CHECK (public.user_owns_clinic(clinic_id) OR public.is_super_admin());

-- ============ AVALIAÇÕES ============
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  clinical_diagnosis TEXT,
  anamnesis TEXT,
  main_complaint TEXT,
  current_disease_history TEXT,
  past_pathological_history TEXT,
  medications TEXT,
  complementary_exams TEXT,
  treatment_proposal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evaluations_patient ON public.evaluations(patient_id);
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_evaluations_updated BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Clinic members access evaluations" ON public.evaluations
  FOR ALL USING (public.user_owns_clinic(clinic_id) OR public.is_super_admin())
  WITH CHECK (public.user_owns_clinic(clinic_id) OR public.is_super_admin());

-- ============ PRONTUÁRIO (sessões) ============
CREATE TABLE public.medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  session_number INT NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  pathology TEXT,
  evolution TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, session_number)
);
CREATE INDEX idx_records_patient ON public.medical_records(patient_id);
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_records_updated BEFORE UPDATE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Clinic members access records" ON public.medical_records
  FOR ALL USING (public.user_owns_clinic(clinic_id) OR public.is_super_admin())
  WITH CHECK (public.user_owns_clinic(clinic_id) OR public.is_super_admin());

-- ============ PRESENÇA ============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attendance_patient ON public.attendance(patient_id);
CREATE INDEX idx_attendance_date ON public.attendance(attendance_date);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Clinic members access attendance" ON public.attendance
  FOR ALL USING (public.user_owns_clinic(clinic_id) OR public.is_super_admin())
  WITH CHECK (public.user_owns_clinic(clinic_id) OR public.is_super_admin());

-- ============ AGENDA ============
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'agendado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_appointments_clinic_date ON public.appointments(clinic_id, appointment_date);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Clinic members access appointments" ON public.appointments
  FOR ALL USING (public.user_owns_clinic(clinic_id) OR public.is_super_admin())
  WITH CHECK (public.user_owns_clinic(clinic_id) OR public.is_super_admin());

-- ============ FINANCEIRO ============
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  status public.payment_status NOT NULL DEFAULT 'pendente',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_clinic ON public.payments(clinic_id);
CREATE INDEX idx_payments_status ON public.payments(status);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Clinic members access payments" ON public.payments
  FOR ALL USING (public.user_owns_clinic(clinic_id) OR public.is_super_admin())
  WITH CHECK (public.user_owns_clinic(clinic_id) OR public.is_super_admin());

-- ============ ANEXOS ============
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attachments_patient ON public.attachments(patient_id);
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members access attachments" ON public.attachments
  FOR ALL USING (public.user_owns_clinic(clinic_id) OR public.is_super_admin())
  WITH CHECK (public.user_owns_clinic(clinic_id) OR public.is_super_admin());

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('clinic-logos', 'clinic-logos', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('patient-attachments', 'patient-attachments', false)
  ON CONFLICT (id) DO NOTHING;

-- Policies clinic-logos (público para leitura, dono autenticado para escrita)
CREATE POLICY "Public read clinic logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'clinic-logos');
CREATE POLICY "Authenticated upload clinic logos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'clinic-logos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update clinic logos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'clinic-logos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete clinic logos" ON storage.objects
  FOR DELETE USING (bucket_id = 'clinic-logos' AND auth.uid() IS NOT NULL);

-- Policies patient-attachments (privado, pasta = clinic_id)
CREATE POLICY "Clinic owner reads attachments" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'patient-attachments' AND (
      public.user_owns_clinic(((storage.foldername(name))[1])::uuid)
      OR public.is_super_admin()
    )
  );
CREATE POLICY "Clinic owner uploads attachments" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'patient-attachments' AND (
      public.user_owns_clinic(((storage.foldername(name))[1])::uuid)
      OR public.is_super_admin()
    )
  );
CREATE POLICY "Clinic owner deletes attachments" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'patient-attachments' AND (
      public.user_owns_clinic(((storage.foldername(name))[1])::uuid)
      OR public.is_super_admin()
    )
  );
