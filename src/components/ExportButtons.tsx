import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ExportButtonsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  filename: string;
  columns: { header: string; key: string }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ExportButtons({ data, filename, columns }: ExportButtonsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const { addAuditLog } = useAuth();

  const exportExcel = async () => {
    try {
      setIsExporting(true);
      setShowMenu(false);
      
      const XLSX = await import('xlsx');
      
      // Map data to requested columns
      const exportData = data.map(item => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row: Record<string, any> = {};
        columns.forEach(col => {
          row[col.header] = item[col.key];
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
      
      XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      addAuditLog('Exported', filename, `Exported ${data.length} records to Excel`);
      toast.success('Successfully exported to Excel');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export to Excel');
    } finally {
      setIsExporting(false);
    }
  };

  const exportPDF = async () => {
    try {
      setIsExporting(true);
      setShowMenu(false);
      
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      
      const doc = new jsPDF();
      
      const tableColumn = columns.map(c => c.header);
      const tableRows = data.map(item => columns.map(c => item[c.key]));
      
      // Add title and date
      doc.setFontSize(14);
      doc.text(`PCBA Sections Management - ${filename}`, 14, 15);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
      
      autoTable(doc, {
        head: [tableColumn],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: tableRows as any,
        startY: 30,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] }
      });
      
      doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
      
      addAuditLog('Exported', filename, `Exported ${data.length} records to PDF`);
      toast.success('Successfully exported to PDF');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export to PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting || data.length === 0}
        className="flex items-center gap-2 bg-background border border-border hover:bg-white/5 text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Export
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden py-1">
          <button
            onClick={exportExcel}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-white/5 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            Export as Excel
          </button>
          <button
            onClick={exportPDF}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-white/5 transition-colors"
          >
            <FileText className="w-4 h-4 text-rose-500" />
            Export as PDF
          </button>
        </div>
      )}
    </div>
  );
}
