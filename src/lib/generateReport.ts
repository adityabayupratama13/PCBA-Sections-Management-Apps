import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function generateDailyReport(data: any, reportDate: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let currentY = margin;

  // Colors
  const colors = {
    primary: [30, 58, 138] as [number, number, number],   // deep navy
    accent: [59, 130, 246] as [number, number, number],   // blue-500
    success: [16, 185, 129] as [number, number, number],  // emerald-500
    warning: [245, 158, 11] as [number, number, number],  // amber-500
    danger: [239, 68, 68] as [number, number, number],    // red-500
    purple: [139, 92, 246] as [number, number, number],   // violet-500
    textMain: [15, 23, 42] as [number, number, number],   // slate-900
    textMuted: [100, 116, 139] as [number, number, number], // slate-500
    bgLight: [248, 250, 252] as [number, number, number],  // slate-50
    border: [226, 232, 240] as [number, number, number],   // slate-200
  };

  const addHeader = (title: string, subtitle: string) => {
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    // Add abstract shapes
    doc.setFillColor(255, 255, 255);
    doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
    doc.circle(pageWidth - 20, 10, 30, 'F');
    doc.circle(pageWidth + 10, 40, 40, 'F');
    doc.setGState(new (doc as any).GState({ opacity: 1 }));

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const dateStr = new Date(reportDate).toLocaleDateString('en-GB', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    doc.text(`${subtitle} • ${dateStr}`, margin, 30);
    currentY = 50;
  };

  const addSectionTitle = (title: string, color: [number, number, number], icon?: string) => {
    if (currentY > pageHeight - 40) { doc.addPage(); currentY = margin; }
    doc.setFillColor(...color);
    doc.roundedRect(margin, currentY, 6, 6, 1, 1, 'F');
    doc.setTextColor(...colors.textMain);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 10, currentY + 5);
    currentY += 12;
  };

  const addSummaryCards = (cards: { label: string; value: string | number; color: [number, number, number] }[]) => {
    const cardWidth = (pageWidth - (margin * 2) - ((cards.length - 1) * 5)) / cards.length;
    cards.forEach((card, i) => {
      const x = margin + (i * (cardWidth + 5));
      
      // Card BG
      doc.setFillColor(...colors.bgLight);
      doc.setDrawColor(...colors.border);
      doc.roundedRect(x, currentY, cardWidth, 22, 2, 2, 'FD');

      // Top colored bar
      doc.setFillColor(...card.color);
      doc.roundedRect(x, currentY, cardWidth, 2, 2, 2, 'F');
      doc.rect(x, currentY + 1, cardWidth, 1, 'F'); // flatten bottom of the rounded bar

      // Label
      doc.setTextColor(...colors.textMuted);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(card.label.toUpperCase(), x + 5, currentY + 8);

      // Value
      doc.setTextColor(...colors.textMain);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(String(card.value), x + 5, currentY + 16);
    });
    currentY += 30;
  };

  // --- PAGE 1: EXECUTIVES SUMMARY ---
  addHeader("IT Operations Daily Report", "EXECUTIVE SUMMARY");

  // Overall Stats
  addSectionTitle("Today's Overview", colors.purple);
  addSummaryCards([
    { label: "New Tickets", value: data.tickets.createdToday, color: colors.danger },
    { label: "Done Tickets", value: data.tickets.done, color: colors.success },
    { label: "New Tasks", value: data.tasks.createdToday, color: colors.accent },
    { label: "Overdue Tasks", value: data.tasks.overdue, color: colors.warning },
  ]);

  addSummaryCards([
    { label: "Total Members", value: data.members.total, color: colors.primary },
    { label: "Present Today", value: data.attendance.present, color: colors.success },
    { label: "Total Projects", value: data.projects.total, color: colors.purple },
    { label: "Pending Leave/OT", value: data.leaves.pending + data.overtime.pending, color: colors.warning },
  ]);

  // Daily Logs Table
  addSectionTitle("Daily Activities Log", colors.accent);
  autoTable(doc, {
    startY: currentY,
    head: [['Member', 'Activity', 'Hours', 'Location']],
    body: data.dailyLogs.records.map((r: any) => [r.member, r.activity, r.hours, r.location]),
    theme: 'grid',
    headStyles: { fillColor: colors.accent, textColor: 255, fontSize: 10 },
    bodyStyles: { fontSize: 9, textColor: colors.textMain },
    alternateRowStyles: { fillColor: colors.bgLight },
    margin: { left: margin, right: margin },
  });
  currentY = (doc as any).lastAutoTable.finalY + 15;

  // --- PAGE 2: DETAILED BREAKDOWN ---
  doc.addPage();
  currentY = margin;
  addHeader("IT Operations Daily Report", "DETAILED BREAKDOWN");

  // Tickets
  addSectionTitle("Tickets Status", colors.danger);
  autoTable(doc, {
    startY: currentY,
    head: [['ID', 'Title', 'Status', 'Priority']],
    body: data.tickets.recent.map((t: any) => [t.id, t.title, t.status, t.priority]),
    theme: 'grid',
    headStyles: { fillColor: colors.danger, textColor: 255 },
    styles: { fontSize: 9 },
    alternateRowStyles: { fillColor: colors.bgLight },
    margin: { left: margin, right: margin },
  });
  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Attendance & Overtime
  const recordsAtt = data.attendance.records.length ? data.attendance.records : [['-', 'No Records Found', '-', '-']];
  addSectionTitle("Attendance Status", colors.success);
  autoTable(doc, {
    startY: currentY,
    head: [['Name', 'Status', 'Time In', 'Time Out']],
    body: recordsAtt.map((r: any) => r[0] === '-' ? r : [r.name, r.status, r.time_in, r.time_out]),
    theme: 'grid',
    headStyles: { fillColor: colors.success, textColor: 255 },
    styles: { fontSize: 9 },
    alternateRowStyles: { fillColor: colors.bgLight },
    margin: { left: margin, right: margin },
  });
  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Active Projects
  addSectionTitle("Active Projects", colors.purple);
  const activeProjects = data.projects.list.filter((p: any) => p.status === 'Active' || p.status === 'Planning');
  const projectBody = activeProjects.length 
    ? activeProjects.map((p: any) => [p.name, p.pic, `${p.progress}%`, p.status, p.end_date]) 
    : [['-', 'No active projects found', '-', '-', '-']];
  
  autoTable(doc, {
    startY: currentY,
    head: [['Project Name', 'PIC', 'Progress', 'Status', 'Deadline']],
    body: projectBody,
    theme: 'grid',
    headStyles: { fillColor: colors.purple, textColor: 255 },
    styles: { fontSize: 9 },
    alternateRowStyles: { fillColor: colors.bgLight },
    margin: { left: margin, right: margin },
  });

  // Global Page Footer
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...colors.bgLight);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    doc.setTextColor(...colors.textMuted);
    doc.setFontSize(8);
    const genTime = new Date(data.generatedAt).toLocaleString('en-GB');
    doc.text(`Generated automatically by IT Apps on ${genTime}`, margin, pageHeight - 6);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 15, pageHeight - 6);
  }

  return doc;
}
