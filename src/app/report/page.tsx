'use client';
import { useState } from 'react';
import { FileText, Calendar, Download, RefreshCw, BarChart3, Clock, Users, ShieldAlert, CheckCircle2, Settings, Send, X, Plus, Mail } from 'lucide-react';
import { generateDailyReport } from '@/lib/generateReport';
import { toast } from 'sonner';
import { Modal } from '@/components/Modal';

export default function ReportPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailList, setEmailList] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [isSavingEmails, setIsSavingEmails] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);

  // Load emails configured
  const fetchEmails = async () => {
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      if (json.report_emails && Array.isArray(json.report_emails)) {
        setEmailList(json.report_emails);
      }
    } catch(e) { console.error(e); }
  };

  const handleSaveEmails = async () => {
    setIsSavingEmails(true);
    try {
       await fetch('/api/settings', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ report_emails: emailList })
       });
       toast.success('Recipient list saved successfully');
       setIsEmailModalOpen(false);
    } catch(e) {
       toast.error('Failed to save settings');
    } finally {
       setIsSavingEmails(false);
    }
  };

  const addEmail = () => {
    if (!newEmail || !newEmail.includes('@')) return toast.error('Valid email required');
    if (emailList.includes(newEmail)) return toast.error('Email already in list');
    setEmailList([...emailList, newEmail]);
    setNewEmail('');
  };

  const currentEmails = emailList.length > 0 ? emailList : ['aditya@giken.co.id'];

  const handleDirectDispatch = async () => {
    setIsSendingReport(true);
    toast.info('Synthesizing and transmitting report...');
    try {
      const res = await fetch('/api/cron/send-report', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to dispatch email');
      toast.success('Email successfully routed to ' + currentEmails.length + ' recipients!');
    } catch(e: any) {
      toast.error(e.message || 'Error transmitting email');
    } finally {
      setIsSendingReport(false);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/report?date=${date}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch');
      setData(json);
      toast.success('Data loaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!data) return;
    try {
      const doc = await generateDailyReport(data, date);
      doc.save(`IT-Daily-Report-${date}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      toast.error('Failed to generate PDF');
    }
  };

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-6 border-b border-border">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Daily Report</h1>
            <p className="text-muted-foreground mt-1">Generate comprehensive PDF reports of IT Operations.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            <div className="flex gap-2">
              <button 
                onClick={() => { fetchEmails(); setIsEmailModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-surface text-foreground rounded-xl border border-border hover:bg-surface-hover text-sm font-medium transition-colors shadow-sm"
              >
                <Settings className="w-4 h-4" /> Recipients
              </button>
              <button 
                onClick={handleDirectDispatch}
                disabled={isSendingReport}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 text-sm font-medium transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-sm"
              >
                {isSendingReport ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Mail Report
              </button>
            </div>

            <div className="flex bg-surface p-1 rounded-xl border border-border shadow-sm">
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="px-4 py-2 bg-transparent text-sm font-medium outline-none text-foreground color-scheme-dark" 
              />
              <button 
                onClick={fetchReportData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium ml-1 transition-colors"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                Fetch Data
              </button>
            </div>
          </div>
        </div>

        {/* Data Preview */}
        {!data && !loading && (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground border-2 border-dashed border-border rounded-3xl bg-surface/50">
            <Calendar className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm font-medium">Select a date and click Fetch Data to preview.</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground font-medium animate-pulse">Aggregating IT Operations Data...</p>
            </div>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center bg-gradient-to-r from-primary/10 to-transparent p-4 rounded-2xl border border-primary/20">
              <div className="flex items-center gap-3 text-primary">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold text-sm">Data ready for {new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <button onClick={downloadPDF} className="flex items-center gap-2 px-6 py-2.5 bg-success text-white rounded-xl hover:bg-success/90 text-sm font-bold shadow-lg shadow-success/20 transition-all hover:-translate-y-0.5">
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="col-span-1 p-5 rounded-2xl bg-surface border border-border">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">New Tickets</div>
                <div className="flex items-baseline gap-2 mb-4">
                  <div className="text-3xl font-bold text-foreground">{data.tickets.totalCreatedToday}</div>
                  <div className="text-xs font-medium text-danger flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> logged today</div>
                </div>
                {/* Visual Chart Bar */}
                <div className="h-2.5 w-full bg-surface-hover rounded-full overflow-hidden flex mb-2">
                  <div className="bg-success h-full" style={{ width: `${(data.tickets.done / (data.tickets.totalCreatedToday || 1)) * 100}%` }}></div>
                  <div className="bg-warning h-full" style={{ width: `${(data.tickets.inProgress / (data.tickets.totalCreatedToday || 1)) * 100}%` }}></div>
                  <div className="bg-danger h-full" style={{ width: `${(data.tickets.backlog / (data.tickets.totalCreatedToday || 1)) * 100}%` }}></div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground font-medium">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-success"></div> Done ({data.tickets.done})</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-warning"></div> In Prog ({data.tickets.inProgress})</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-danger"></div> Backlog ({data.tickets.backlog})</span>
                </div>
              </div>

              <div className="col-span-1 p-5 rounded-2xl bg-surface border border-border">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">New Tasks</div>
                <div className="flex items-baseline gap-2 mb-4">
                  <div className="text-3xl font-bold text-foreground">{data.tasks.totalCreatedToday}</div>
                  <div className="text-xs font-medium text-success flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> assigned today</div>
                </div>
                {/* Visual Chart Bar */}
                <div className="h-2.5 w-full bg-surface-hover rounded-full overflow-hidden flex mb-2">
                  <div className="bg-success h-full" style={{ width: `${(data.tasks.done / (data.tasks.totalCreatedToday || 1)) * 100}%` }}></div>
                  <div className="bg-warning h-full" style={{ width: `${((data.tasks.inProgress + data.tasks.review) / (data.tasks.totalCreatedToday || 1)) * 100}%` }}></div>
                  <div className="bg-danger h-full" style={{ width: `${(data.tasks.backlog / (data.tasks.totalCreatedToday || 1)) * 100}%` }}></div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground font-medium">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-success"></div> Done ({data.tasks.done})</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-warning"></div> In Prog ({data.tasks.inProgress + data.tasks.review})</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-danger"></div> Backlog ({data.tasks.backlog})</span>
                </div>
              </div>

              <div className="col-span-1 p-5 rounded-2xl bg-surface border border-border flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Attendance</div>
                  <div className="text-3xl font-bold text-foreground">{data.attendance.present} <span className="text-lg text-muted-foreground font-normal">/ {data.members.total}</span></div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs font-medium text-primary">
                  <Users className="w-3.5 h-3.5" />
                  members present across all shifts today
                </div>
              </div>
            </div>
            
            <div className="p-6 rounded-3xl bg-surface border border-border text-center">
              <p className="text-muted-foreground text-sm">Full details including Projects, Leaves, Overtime, and Audit Logs will be included in the exported PDF.</p>
            </div>
          </div>
        )}
        
        
      </div>

      <Modal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} title="Mailing List Configuration">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Add or remove exact email destinations for the automated Daily Report drop. Changes here map dynamically to the chron engine immediately.</p>
          
          <div className="flex gap-2">
            <input 
               type="email"
               value={newEmail}
               onChange={e => setNewEmail(e.target.value)} 
               onKeyDown={e => e.key === 'Enter' && addEmail()}
               placeholder="Add technical lead... (@giken.co.id)"
               className="flex-1 px-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button onClick={addEmail} className="px-4 py-2 bg-surface text-foreground border border-border rounded-lg hover:bg-surface-hover transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-background rounded-lg border border-border overflow-hidden max-h-60 overflow-y-auto">
             {emailList.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground font-medium">No custom targets. Inheriting default (aditya@giken).</div>}
             {emailList.map((email, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 border-b border-border/50 last:border-0 hover:bg-surface/30">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">{email}</span>
                  </div>
                  <button onClick={() => setEmailList(emailList.filter(e => e !== email))} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
             ))}
          </div>

          <div className="flex justify-end pt-4 mt-2 border-t border-border">
            <button onClick={handleSaveEmails} disabled={isSavingEmails} className="px-6 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm ml-auto flex items-center gap-2">
               {isSavingEmails && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
               Save Routing Config
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
