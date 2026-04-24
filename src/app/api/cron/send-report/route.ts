import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import juice from 'juice';
import { getReportData } from '@/lib/getReportData';
import { generateDailyReport } from '@/lib/generateReport';

export const dynamic = 'force-dynamic';


// Environment variables or passed arguments
const SMTP_HOST = process.env.SMTP_HOST || 'mail.giken.co.id';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER || 'traceability-system@giken.co.id';
const SMTP_PASS = process.env.SMTP_PASS || 'V^2#h@4)Q%7*p&8^D!4)r';

export async function POST(req: Request) {
  try {
    let dateToUse = new Date().toISOString().split('T')[0];
    
    // Check if a specific date was requested in the body
    try {
      const body = await req.json();
      if (body.date) dateToUse = body.date;
    } catch (e) {
      // No body or invalid JSON, fallback to today
    }

    const data = await getReportData(dateToUse);
    const today = dateToUse; // Use requested date for file naming and subject

    // 1. Fetch Recipients from global_settings Table
    const { getDb } = require('@/lib/db');
    const db = getDb();
    const [settingRows]: any = await db.query('SELECT setting_value FROM global_settings WHERE setting_key = "report_emails"');
    
    let toEmails = ['aditya@giken.co.id'];
    if (settingRows.length > 0) {
      try {
        toEmails = JSON.parse(settingRows[0].setting_value) || toEmails;
      } catch (e) {
        toEmails = [settingRows[0].setting_value];
      }
    }

    // Ticket calculation variables
    const totalTicketsSum = data.tickets.done + data.tickets.inProgress + data.tickets.backlog;
    const ticketDonePct = totalTicketsSum > 0 ? (data.tickets.done / totalTicketsSum) * 100 : 0;
    const ticketProgPct = totalTicketsSum > 0 ? (data.tickets.inProgress / totalTicketsSum) * 100 : 0;
    const ticketBackPct = totalTicketsSum > 0 ? (data.tickets.backlog / totalTicketsSum) * 100 : 100;

    // Attendance calculation variables
    const totalPresentSum = data.attendance.shift1 + data.attendance.shift2 + data.attendance.shift3 + data.attendance.shiftNormal;
    const shift1Pct = totalPresentSum > 0 ? (data.attendance.shift1 / totalPresentSum) * 100 : 0;
    const shift2Pct = totalPresentSum > 0 ? (data.attendance.shift2 / totalPresentSum) * 100 : 0;
    const shift3Pct = totalPresentSum > 0 ? (data.attendance.shift3 / totalPresentSum) * 100 : 0;
    const shiftNrmPct = totalPresentSum > 0 ? (data.attendance.shiftNormal / totalPresentSum) * 100 : 100;

    // 2. Render the PDF in memory
    const doc = await generateDailyReport(data, today);
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // 3. Configure Nodemailer Transport
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const dateStr = new Date(today).toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'});

    // 4. Construct the Raw CSS Template
    const rawHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>IT Operations Daily Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background-color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #334155; padding: 40px 16px; min-height: 100vh; }
  .email-container { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); }

  /* Header Block - Warm Blue Elegance */
  .header { background-color: #1e3a8a; background-image: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; padding: 40px 40px; position: relative; text-align: center; }
  .header-brand { font-size: 13px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #dbeafe; display: block; margin-bottom: 24px; }
  .header-image { display: block; margin: 0 auto 24px; max-width: 250px; width: 100%; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
  .header h1 { font-size: 30px; font-weight: 800; line-height: 1.2; margin-bottom: 12px; color: #ffffff; letter-spacing: -0.01em; }
  .header p { font-size: 16px; color: #eff6ff; font-weight: 500; line-height: 1.5; }

  /* Body Block */
  .body { padding: 40px; }

  /* Friendly Intro */
  .intro { font-size: 16px; line-height: 1.8; color: #475569; margin-bottom: 36px; padding-bottom: 32px; border-bottom: 2px dashed #f1f5f9; }
  .intro strong { color: #0f172a; font-weight: 700; display: block; margin-bottom: 12px; font-size: 18px; color: #1e3a8a; }

  .section-title { font-size: 20px; font-weight: 800; color: #1e293b; margin-bottom: 20px; }

  /* Simulated Dashboard Grid - Rounder and Softer */
  .kpi-table { width: 100%; border-collapse: separate; border-spacing: 16px 16px; margin-left: -16px; margin-bottom: 32px; width: calc(100% + 32px); }
  .kpi-card { background: #ffffff; border: 2px solid #f1f5f9; border-radius: 16px; padding: 24px; width: 50%; vertical-align: top; box-shadow: 0 4px 6px -4px rgba(0,0,0,0.05); }
  .kpi-title { font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 14px; }
  .kpi-value { font-size: 42px; font-weight: 800; color: #0f172a; line-height: 1; margin-bottom: 16px; font-family: monospace; letter-spacing: -0.05em; }
  .kpi-value span { font-size: 15px; color: #94a3b8; font-family: -apple-system, sans-serif; font-weight: 600; letter-spacing: normal; }
  
  /* Synthetic Charts */
  .kpi-chart-wrap { width: 100%; display: table; height: 8px; border-radius: 4px; overflow: hidden; background: #e2e8f0; margin-bottom: 12px; }
  .kpi-chart-segment { display: table-cell; height: 100%; }
  .kpi-desc { font-size: 12px; color: #64748b; font-weight: 500; }

  /* Colors */
  .text-blue { color: #2563eb !important; }
  .text-emerald { color: #10b981 !important; }
  .text-amber { color: #f59e0b !important; }
  .text-purple { color: #8b5cf6 !important; }
  .bg-blue { background-color: #2563eb !important; }
  .bg-emerald { background-color: #10b981 !important; }
  .bg-amber { background-color: #f59e0b !important; }
  .bg-purple { background-color: #8b5cf6 !important; }

  /* Standard Data Table */
  .data-table-wrap { width: 100%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 32px; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .data-table th { text-align: left; padding: 14px 16px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
  .data-table td { padding: 16px; border-bottom: 1px solid #f1f5f9; color: #475569; vertical-align: middle; }
  .data-table tr:last-child td { border-bottom: none; }
  .td-id { font-family: monospace; font-weight: 600; color: #64748b; font-size: 12px; }
  .td-title { font-weight: 600; color: #0f172a; }

  /* Badges */
  .badge { display: inline-block; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
  .badge-done { background: #dcfce7; color: #166534; }
  .badge-progress { background: #fef3c7; color: #92400e; }
  .badge-backlog { background: #f1f5f9; color: #475569; }
  .badge-medium { background: #eff6ff; color: #1e40af; }
  .badge-high { background: #fee2e2; color: #991b1b; }

  /* Button CTA */
  .btn-wrap { text-align: center; margin: 40px 0 20px; }
  .btn { display: inline-block; background-color: #3b82f6; background-image: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: #ffffff; padding: 18px 36px; font-size: 15px; font-weight: 800; text-decoration: none; border-radius: 12px; letter-spacing: 0.05em; text-transform: uppercase; box-shadow: 0 4px 12px rgba(37,99,235,0.3); }

  /* Footer */
  .footer { background-color: #f8fafc; padding: 32px 40px; color: #64748b; font-size: 13px; line-height: 1.6; text-align: center; border-top: 2px dashed #f1f5f9; }
  .no-data { text-align: center; padding: 40px; color: #94a3b8; font-size: 14px; font-style: italic; background: #f8fafc; border-radius: 16px; border: 2px dashed #e2e8f0; }
</style>
</head>
<body>
<div class="email-container">

  <!-- HEADER -->
  <div class="header">
    <div class="header-brand">&#9881; IT PCBA Management</div>
    <h1>IT Operations Performance</h1>
    <p>Automated Digital Overview &bull; ${dateStr}</p>
  </div>

  <!-- BODY -->
  <div class="body">

    <!-- FORMAL INTRO -->
    <div class="intro">
      <strong>To: General Management & Directorate</strong>
      Please find enclosed the comprehensive daily IT Operations metrics. This digitally synthesized dashboard reflects our systemic performance, tracking helpdesk resolution velocity, infrastructure project milestones, and real-time operational manpower measured accurately at the strict <strong>06:30 interval cutoff.</strong>
      <br><br>
      Our commitment to seamless, robust IT support is reflected in the automated aggregates below.
    </div>

    <!-- KPI DASHBOARD SIMULATION -->
    <h2 class="section-title">Performance Metrics Dashboard</h2>
    <table class="kpi-table" cellpadding="0" cellspacing="0">
      <tr>
        <td class="kpi-card">
          <div class="kpi-title">Helpdesk Tickets</div>
          <div class="kpi-value text-blue">${data.tickets.totalCreatedToday} <span>Created</span></div>
          
          <div class="kpi-chart-wrap">
            <div class="kpi-chart-segment bg-emerald" style="width: ${ticketDonePct}%"></div>
            <div class="kpi-chart-segment bg-amber" style="width: ${ticketProgPct}%"></div>
            <div class="kpi-chart-segment bg-purple" style="width: ${ticketBackPct}%"></div>
          </div>
          
          <div class="kpi-desc">
            <span class="text-emerald"><strong>${data.tickets.done}</strong></span> Done &bull; 
            <span class="text-amber"><strong>${data.tickets.inProgress}</strong></span> Progress &bull; 
            <span class="text-purple"><strong>${data.tickets.backlog}</strong></span> Backlog
          </div>
        </td>
        
        <td class="kpi-card">
          <div class="kpi-title">Project Infrastructure</div>
          <div class="kpi-value text-emerald">${data.projects.totalActive} <span>Active</span></div>
          
          <div class="kpi-chart-wrap">
            <div class="kpi-chart-segment bg-emerald" style="width: 75%"></div>
            <div class="kpi-chart-segment bg-blue" style="width: 25%"></div>
          </div>
          
          <div class="kpi-desc">
            Ongoing weekly deployments tracked automatically.
          </div>
        </td>
      </tr>
      <tr>
        <td class="kpi-card">
          <div class="kpi-title">Manpower Utilization</div>
          <div class="kpi-value text-purple">${data.attendance.present} <span>Present</span></div>
          
          <div class="kpi-chart-wrap">
            <div class="kpi-chart-segment bg-blue" style="width: ${shift1Pct}%"></div>
            <div class="kpi-chart-segment bg-amber" style="width: ${shift2Pct}%"></div>
            <div class="kpi-chart-segment bg-emerald" style="width: ${shift3Pct}%"></div>
            <div class="kpi-chart-segment bg-purple" style="width: ${shiftNrmPct}%"></div>
          </div>
          
          <div class="kpi-desc">
            <span class="text-blue"><strong>${data.attendance.shift1}</strong></span> S1 &bull; 
            <span class="text-amber"><strong>${data.attendance.shift2}</strong></span> S2 &bull; 
            <span class="text-emerald"><strong>${data.attendance.shift3}</strong></span> S3
          </div>
        </td>
        
        <td class="kpi-card">
          <div class="kpi-title">Overtime & Leave</div>
          <div class="kpi-value text-amber">${data.overtime.total + data.leaves.pending} <span>Events</span></div>
          
          <div class="kpi-chart-wrap">
            <div class="kpi-chart-segment bg-amber" style="width: 50%"></div>
            <div class="kpi-chart-segment bg-purple" style="width: 50%"></div>
          </div>
          
          <div class="kpi-desc">
            <span class="text-amber"><strong>${data.overtime.total}h</strong></span> Overtime &bull; 
            <span class="text-purple"><strong>${data.leaves.pending}</strong></span> Leaves
          </div>
        </td>
      </tr>
    </table>

    <!-- TICKETS TABLE -->
    <h2 class="section-title">Latest Helpdesk Engagements</h2>
    <div class="data-table-wrap">
      ${data.tickets.recent && data.tickets.recent.length > 0 ? `
      <table class="data-table">
        <thead>
          <tr>
            <th>Ticket ID</th>
            <th>Subject</th>
            <th>Priority</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.tickets.recent.map((t: any) => `
          <tr>
            <td class="td-id">TKT-${t.id}</td>
            <td class="td-title">${t.title}</td>
            <td><span class="badge badge-${t.priority?.toLowerCase() || 'medium'}">${t.priority || 'Medium'}</span></td>
            <td><span class="badge badge-${t.status === 'Done' ? 'done' : t.status === 'Backlog' ? 'backlog' : 'progress'}">${t.status}</span></td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      ` : `<div class="no-data">System logs indicate zero outstanding ticket creations today.</div>`}
    </div>

    <!-- TASKS TABLE -->
    <h2 class="section-title">Latest Task Delegations</h2>
    <div class="data-table-wrap">
      ${data.tasks.recent && data.tasks.recent.length > 0 ? `
      <table class="data-table">
        <thead>
          <tr>
            <th>Task ID</th>
            <th>Subject</th>
            <th>Assignee</th>
            <th>Priority</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.tasks.recent.map((t: any) => `
          <tr>
            <td class="td-id">TSK-${t.id}</td>
            <td class="td-title">${t.title}</td>
            <td><strong>${t.assignee}</strong></td>
            <td><span class="badge badge-${t.priority?.toLowerCase() || 'medium'}">${t.priority || 'Medium'}</span></td>
            <td><span class="badge badge-${t.status === 'Done' ? 'done' : t.status === 'Backlog' ? 'backlog' : 'progress'}">${t.status}</span></td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      ` : `<div class="no-data">No new task delegations logged for today.</div>`}
    </div>

    <!-- PROJECTS TABLE -->
    <h2 class="section-title">Active Weekly Projects</h2>
    <div class="data-table-wrap">
      ${data.projects.list && data.projects.list.length > 0 ? `
      <table class="data-table">
        <thead>
          <tr>
            <th>Project Title</th>
            <th>System PIC</th>
            <th>Progress Matrix</th>
          </tr>
        </thead>
        <tbody>
          ${data.projects.list.map((p: any) => `
          <tr>
            <td class="td-title">${p.name}</td>
            <td class="td-id">${p.pic || 'Unknown'}</td>
            <td>
              <div style="width: 100%; display: table; height: 6px; border-radius: 3px; overflow: hidden; background: #e2e8f0; margin-bottom: 6px;">
                 <div style="display: table-cell; height: 100%; border-radius: 3px; background: ${p.progress === 100 ? '#10b981' : '#3b82f6'}; width: ${p.progress || 0}%;"></div>
                 <div style="display: table-cell; height: 100%; width: ${100 - (p.progress || 0)}%;"></div>
              </div>
              <span style="font-size: 10px; font-weight: 700; color: #64748b;">${p.progress || 0}% COMPLETED</span>
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      ` : `<div class="no-data">No active enterprise projects logged this week.</div>`}
    </div>

    <!-- BUTTON CTA -->
    <div class="btn-wrap">
      <a href="http://113.212.162.101:3002/" class="btn">Access Full Dashboard</a>
    </div>

  </div>

  <!-- FOOTER -->
  <div class="footer">
    <strong>CONFIDENTIALITY NOTICE</strong><br><br>
    This automated broadcast contains proprietary internal operation metrics generated by the IT PCBA Executive Management Engine. Intended solely for Directorate and Management review.
  </div>

</div>
</body>
</html>`;

    // 5. Build inline CSS utilizing Juice
    const htmlBody = juice(rawHtml);

    // 6. Send the email
    const info = await transporter.sendMail({
      from: '"IT PCBA System" <' + SMTP_USER + '>',
      to: toEmails.join(', '),
      subject: `IT Daily Operations Report - ${today}`,
      html: htmlBody,
      attachments: [
        {
          filename: `IT_Daily_Report_${today}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }
      ],
    });

    console.log('Message sent: %s', info.messageId);

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('Email Generation Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send report', details: error.message },
      { status: 500 }
    );
  }
}
