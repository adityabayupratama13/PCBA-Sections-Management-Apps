'use client';
import { useState } from 'react';
import { FileText, Calendar, Download, RefreshCw, BarChart3, Clock, Users, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { generateDailyReport } from '@/lib/generateReport';
import { toast } from 'sonner';

export default function ReportPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-surface border border-border">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Tickets</div>
                <div className="text-3xl font-bold text-foreground">{data.tickets.total}</div>
                <div className="flex items-center gap-2 mt-2 text-xs font-medium text-danger">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {data.tickets.createdToday} new today
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-border">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Tasks</div>
                <div className="text-3xl font-bold text-foreground">{data.tasks.total}</div>
                <div className="flex items-center gap-2 mt-2 text-xs font-medium text-warning">
                  <Clock className="w-3.5 h-3.5" />
                  {data.tasks.overdue} overdue
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-border">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Attendance</div>
                <div className="text-3xl font-bold text-foreground">{data.attendance.present} <span className="text-lg text-muted-foreground font-normal">/ {data.members.total}</span></div>
                <div className="flex items-center gap-2 mt-2 text-xs font-medium text-success">
                  <Users className="w-3.5 h-3.5" />
                  present today
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-border">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Daily Logs</div>
                <div className="text-3xl font-bold text-foreground">{data.dailyLogs.total}</div>
                <div className="flex items-center gap-2 mt-2 text-xs font-medium text-primary">
                  <FileText className="w-3.5 h-3.5" />
                  recorded today
                </div>
              </div>
            </div>
            
            <div className="p-6 rounded-3xl bg-surface border border-border text-center">
              <p className="text-muted-foreground text-sm">Full details including Projects, Leaves, Overtime, and Audit Logs will be included in the exported PDF.</p>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
