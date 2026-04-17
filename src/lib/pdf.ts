import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, formatTime, calculateAge } from "@/lib/format";

interface Clinic {
  id: string;
  name: string;
  email: string;
  logo_url: string | null;
}

export async function generateClinicReportPdf(clinic: Clinic) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(20, 60, 80);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.text(clinic.name, 14, 13);
  doc.setFontSize(10);
  doc.text(`Relatório completo — ${formatDate(new Date())}`, 14, 22);
  doc.text(clinic.email, pageW - 14, 22, { align: "right" });
  doc.setTextColor(0);

  let y = 38;
  const sectionTitle = (title: string) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(14);
    doc.setTextColor(20, 60, 80);
    doc.text(title, 14, y);
    y += 4;
    doc.setDrawColor(20, 60, 80);
    doc.line(14, y, pageW - 14, y);
    y += 6;
    doc.setTextColor(0);
  };

  // Pacientes
  const { data: patients = [] } = await supabase
    .from("patients")
    .select("*")
    .eq("clinic_id", clinic.id)
    .order("name");

  sectionTitle(`Pacientes (${patients?.length ?? 0})`);
  if (patients && patients.length) {
    autoTable(doc, {
      startY: y,
      head: [["Nome", "Idade", "CPF", "Telefone"]],
      body: patients.map((p) => [
        p.name,
        calculateAge(p.birth_date)?.toString() ?? "-",
        p.cpf ?? "-",
        p.phone ?? "-",
      ]),
      headStyles: { fillColor: [20, 60, 80] },
      styles: { fontSize: 9 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(10);
    doc.text("Nenhum paciente cadastrado.", 14, y);
    y += 10;
  }

  // Avaliações
  const { data: evaluations = [] } = await supabase
    .from("evaluations")
    .select("*, patients(name)")
    .eq("clinic_id", clinic.id);

  sectionTitle(`Avaliações (${evaluations?.length ?? 0})`);
  evaluations?.forEach((ev: any) => {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Paciente: ${ev.patients?.name ?? "-"}`, 14, y); y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const fields = [
      ["Diagnóstico clínico", ev.clinical_diagnosis],
      ["Anamnese", ev.anamnesis],
      ["Queixa principal", ev.main_complaint],
      ["História da moléstia atual", ev.current_disease_history],
      ["História patológica pregressa", ev.past_pathological_history],
      ["Medicamentos", ev.medications],
      ["Exames complementares", ev.complementary_exams],
      ["Proposta de tratamento", ev.treatment_proposal],
    ];
    fields.forEach(([label, val]) => {
      if (val) {
        const text = `${label}: ${val}`;
        const lines = doc.splitTextToSize(text, pageW - 28);
        if (y + lines.length * 4 > 280) { doc.addPage(); y = 20; }
        doc.text(lines, 14, y);
        y += lines.length * 4 + 2;
      }
    });
    y += 4;
  });

  // Prontuário
  const { data: records = [] } = await supabase
    .from("medical_records")
    .select("*, patients(name)")
    .eq("clinic_id", clinic.id)
    .order("session_date");

  if (y > 250) { doc.addPage(); y = 20; }
  sectionTitle(`Prontuário — Evoluções (${records?.length ?? 0})`);
  records?.forEach((r: any) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(
      `${r.patients?.name ?? "-"} — Sessão ${r.session_number} (${formatDate(r.session_date)})`,
      14,
      y,
    );
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (r.pathology) {
      const pl = doc.splitTextToSize(`Patologia: ${r.pathology}`, pageW - 28);
      doc.text(pl, 14, y);
      y += pl.length * 4 + 1;
    }
    const ev = doc.splitTextToSize(`Evolução: ${r.evolution}`, pageW - 28);
    if (y + ev.length * 4 > 280) { doc.addPage(); y = 20; }
    doc.text(ev, 14, y);
    y += ev.length * 4 + 4;
  });

  // Presença
  const { data: attendance = [] } = await supabase
    .from("attendance")
    .select("*, patients(name)")
    .eq("clinic_id", clinic.id)
    .order("attendance_date", { ascending: false });

  if (y > 250) { doc.addPage(); y = 20; }
  sectionTitle(`Presença (${attendance?.length ?? 0})`);
  if (attendance && attendance.length) {
    autoTable(doc, {
      startY: y,
      head: [["Data", "Paciente", "Entrada", "Saída"]],
      body: attendance.map((a: any) => [
        formatDate(a.attendance_date),
        a.patients?.name ?? "-",
        formatTime(a.check_in),
        formatTime(a.check_out),
      ]),
      headStyles: { fillColor: [20, 60, 80] },
      styles: { fontSize: 9 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Financeiro
  const { data: payments = [] } = await supabase
    .from("payments")
    .select("*, patients(name)")
    .eq("clinic_id", clinic.id)
    .order("due_date", { ascending: false });

  if (y > 250) { doc.addPage(); y = 20; }
  sectionTitle(`Financeiro (${payments?.length ?? 0})`);
  if (payments && payments.length) {
    autoTable(doc, {
      startY: y,
      head: [["Vencimento", "Paciente", "Valor", "Status", "Pago em"]],
      body: payments.map((p: any) => [
        formatDate(p.due_date),
        p.patients?.name ?? "-",
        formatCurrency(Number(p.amount)),
        p.status,
        p.payment_date ? formatDate(p.payment_date) : "-",
      ]),
      headStyles: { fillColor: [20, 60, 80] },
      styles: { fontSize: 9 },
    });
  }

  // Footer pages
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Página ${i} de ${total}`, pageW - 14, 290, { align: "right" });
    doc.text(`${clinic.name} — ClinicSaaS`, 14, 290);
  }

  doc.save(`${clinic.name.replace(/\s+/g, "_")}_relatorio.pdf`);
}
