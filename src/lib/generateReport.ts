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
    const [y, m, d] = reportDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dateStr = dateObj.toLocaleDateString('en-GB', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    doc.text(`${subtitle} • ${dateStr}`, margin, 30);
    currentY = 50;
  };

  const addSectionTitle = (title: string, color: [number, number, number], icon?: string) => {
    if (currentY > pageHeight - 90) { doc.addPage(); currentY = margin; }
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
  
  const drawProgressBar = (label: string, done: number, progress: number, backlog: number, total: number, y: number) => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.textMain[0], colors.textMain[1], colors.textMain[2]);
    doc.text(`${label} (${total} total)`, margin, y);
    
    const barWidth = 170;
    const h = 8;
    const yBar = y + 4;
    
    if (total === 0) {
      doc.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
      doc.rect(margin, yBar, barWidth, h, 'F');
    } else {
      const wDone = (done / total) * barWidth;
      const wProg = (progress / total) * barWidth;
      const wBack = (backlog / total) * barWidth;
      
      let curX = margin;
      if (wDone > 0) {
        doc.setFillColor(16, 185, 129); // Success
        doc.rect(curX, yBar, wDone, h, 'F');
        curX += wDone;
      }
      if (wProg > 0) {
        doc.setFillColor(245, 158, 11); // Warning
        doc.rect(curX, yBar, wProg, h, 'F');
        curX += wProg;
      }
      if (wBack > 0) {
        doc.setFillColor(239, 68, 68); // Danger
        doc.rect(curX, yBar, wBack, h, 'F');
      }
    }

    // Legend
    const yLeg = yBar + h + 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    
    doc.setFillColor(16, 185, 129);
    doc.rect(margin, yLeg - 3, 4, 4, 'F');
    doc.text(`Done (${done})`, margin + 6, yLeg);
    
    doc.setFillColor(245, 158, 11);
    doc.rect(margin + 45, yLeg - 3, 4, 4, 'F');
    doc.text(`In Progress (${progress})`, margin + 51, yLeg);
    
    doc.setFillColor(239, 68, 68);
    doc.rect(margin + 105, yLeg - 3, 4, 4, 'F');
    doc.text(`Backlog (${backlog})`, margin + 111, yLeg);
  };

  drawProgressBar(
    "New Tickets", 
    data.tickets.done, 
    data.tickets.inProgress, 
    data.tickets.backlog, 
    data.tickets.totalCreatedToday, 
    currentY
  );
  currentY += 35;

  drawProgressBar(
    "New Tasks", 
    data.tasks.done, 
    data.tasks.inProgress + (data.tasks.review || 0), 
    data.tasks.backlog, 
    data.tasks.totalCreatedToday, 
    currentY
  );
  currentY += 35;

  addSummaryCards([
    { label: "Manpower (Shift 1)", value: data.attendance.shift1 || 0, color: colors.primary },
    { label: "Manpower (Shift 2)", value: data.attendance.shift2 || 0, color: colors.accent },
    { label: "Manpower (Shift 3)", value: data.attendance.shift3 || 0, color: colors.purple },
    { label: "Manpower (Normal)", value: data.attendance.shiftNormal || 0, color: colors.success },
  ]);

  addSummaryCards([
    { label: "Weekly Projects", value: data.projects.totalActive || 0, color: colors.warning },
    { label: "Weekly Leaves", value: data.leaves.total || 0, color: colors.danger },
    { label: "OT Requests", value: data.overtime.total || 0, color: colors.accent },
    { label: "Present Today", value: data.attendance.present || 0, color: colors.success },
  ]);

  // Removed Daily Activities Log

  // --- PAGE 2: DETAILED BREAKDOWN ---
  doc.addPage();
  currentY = margin;
  addHeader("IT Operations Daily Report", "DETAILED BREAKDOWN");

  // Tickets
  const ticketRecords = data.tickets.recent.length ? data.tickets.recent : [{ id: '-', title: 'No active tickets', status: '-', priority: '-' }];
  addSectionTitle("New Tickets (06:30 Cut-off)", colors.danger);
  autoTable(doc, {
    startY: currentY,
    head: [['ID', 'Title', 'Status', 'Priority']],
    body: ticketRecords.map((t: any) => [t.id, t.title, t.status, t.priority]),
    theme: 'grid',
    headStyles: { fillColor: colors.danger, textColor: 255 },
    styles: { fontSize: 9 },
    alternateRowStyles: { fillColor: colors.bgLight },
    margin: { left: margin, right: margin },
    pageBreak: 'auto',
    didParseCell: function(celldata) {
      if (celldata.section === 'body' && celldata.column.index === 2) {
        const val = celldata.cell.raw;
        if (val === 'Done') celldata.cell.styles.textColor = [16, 185, 129];
        else if (val === 'In Progress' || val === 'Review') celldata.cell.styles.textColor = [245, 158, 11];
        else if (val === 'Backlog') celldata.cell.styles.textColor = [239, 68, 68];
      }
    }
  });
  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Tasks
  const taskRecords = data.tasks.recent && data.tasks.recent.length ? data.tasks.recent : [{ id: '-', title: 'No active tasks', status: '-', priority: '-', assignee: '-' }];
  addSectionTitle("New Tasks (06:30 Cut-off)", colors.success);
  autoTable(doc, {
    startY: currentY,
    head: [['ID', 'Title', 'Assignee', 'Status', 'Priority']],
    body: taskRecords.map((t: any) => [t.id, t.title, t.assignee, t.status, t.priority]),
    theme: 'grid',
    headStyles: { fillColor: colors.success, textColor: 255 },
    styles: { fontSize: 9 },
    alternateRowStyles: { fillColor: colors.bgLight },
    margin: { left: margin, right: margin },
    pageBreak: 'auto',
    didParseCell: function(celldata) {
      if (celldata.section === 'body' && celldata.column.index === 3) {
        const val = celldata.cell.raw;
        if (val === 'Done') celldata.cell.styles.textColor = [16, 185, 129];
        else if (val === 'In Progress' || val === 'Review') celldata.cell.styles.textColor = [245, 158, 11];
        else if (val === 'Backlog') celldata.cell.styles.textColor = [239, 68, 68];
      }
    }
  });
  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Attendance
  const recordsAtt = data.attendance.records.length ? data.attendance.records : [{ name: '-', shift: '-' }];
  addSectionTitle("Attendance Layout", colors.success);
  autoTable(doc, {
    startY: currentY,
    head: [['Name', 'Shift']],
    body: recordsAtt.map((r: any) => [r.name, r.shift]),
    theme: 'grid',
    headStyles: { fillColor: colors.success, textColor: 255 },
    styles: { fontSize: 9 },
    alternateRowStyles: { fillColor: colors.bgLight },
    margin: { left: margin, right: margin },
    pageBreak: 'avoid',
  });
  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Active Projects
  addSectionTitle("Weekly Active Projects", colors.purple);
  const activeProjects = data.projects.list;
  const projectBody = activeProjects.length 
    ? activeProjects.map((p: any) => [p.name, p.pic, `${p.progress}%`, p.status, p.end_date]) 
    : [['-', 'No active projects found this week', '-', '-', '-']];
  
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
  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Manpower Status
  addSectionTitle("Manpower Details", colors.primary);
  autoTable(doc, {
    startY: currentY,
    head: [['Name', 'Emp. Status', 'Contract Dur.', 'Leave Bal.', 'Account']],
    body: data.members.manpower.map((m: any) => [m.name, m.employment_status, m.contract_duration + ' mo', m.leave_balance + ' days', m.status]),
    theme: 'grid',
    headStyles: { fillColor: colors.primary, textColor: 255 },
    styles: { fontSize: 9 },
    alternateRowStyles: { fillColor: colors.bgLight },
    margin: { left: margin, right: margin },
  });
  currentY = (doc as any).lastAutoTable.finalY + 15;

  doc.addPage();
  currentY = margin;
  addHeader("IT Operations Daily Report", "LEAVE & OVERTIME");

  // Weekly Leaves
  addSectionTitle("Weekly Leave Requests", colors.danger);
  const leavesBody = data.leaves.records.length 
    ? data.leaves.records.map((l: any) => [l.name, l.type, l.start, l.end, l.status])
    : [['-', '-', 'No leaves requested this week', '-', '-']];
  autoTable(doc, {
    startY: currentY,
    head: [['Name', 'Leave Type', 'Start Date', 'End Date', 'Status']],
    body: leavesBody,
    theme: 'grid',
    headStyles: { fillColor: colors.danger, textColor: 255 },
    styles: { fontSize: 9 },
    alternateRowStyles: { fillColor: colors.bgLight },
    margin: { left: margin, right: margin },
  });
  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Overtime Tracking
  addSectionTitle("Overtime Requests (Today)", colors.accent);
  const otBody = data.overtime.records.length 
    ? data.overtime.records.map((o: any) => [o.name, o.hours + ' hrs', o.reason, o.status])
    : [['-', '-', 'No overtime logged today', '-']];
  autoTable(doc, {
    startY: currentY,
    head: [['Name', 'Hours', 'Reason', 'Status']],
    body: otBody,
    theme: 'grid',
    headStyles: { fillColor: colors.accent, textColor: 255 },
    styles: { fontSize: 9 },
    alternateRowStyles: { fillColor: colors.bgLight },
    margin: { left: margin, right: margin },
  });
  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Global Page Footer
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...colors.bgLight);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    doc.setTextColor(...colors.textMuted);
    doc.setFontSize(8);
    const genTime = new Date(data.generatedAt).toLocaleString('en-GB');
    doc.text(`Daily Report for ${dateStr}`, margin, pageHeight - 6);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 15, pageHeight - 6);
  }

  return doc;
}
