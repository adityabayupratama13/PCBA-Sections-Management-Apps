'use client';
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Plus, Search, Edit2, Trash2, Briefcase, Users, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { DataTable } from '@/components/DataTable';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { toast } from 'sonner';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { canManageTeam } from '@/lib/permissions';

interface Position {
  id: number;
  name: string;
  division: string;
  level: string;
  description: string;
  created_at?: string;
}

const LEVEL_ORDER = ['Manager', 'Supervisor', 'Senior', 'Staff'];
const LEVEL_COLORS: Record<string, string> = {
  Manager:    'bg-violet-500/15 text-violet-400 border-violet-500/25',
  Supervisor: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  Senior:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  Staff:      'bg-orange-500/15 text-orange-400 border-orange-500/25',
};

const DIVISIONS = ['Engineering', 'Technician SMT', 'Production SMT-A', 'Production SMT-B', 'Production SMT-C', 'PMC', 'Finish Goods', 'MI Second Floor', 'MI Grooming Garment', 'MI Denso Ryoyo', 'Dipping Technician', 'PGA-HRE', 'MI Wiseally', 'MI Bluetti', 'IT', 'NPI', 'QA'];

export default function PositionsPage() {
  const { data: positions, loading, create, update, remove } = useApi<Position>('positions');
  const { currentUser, activeSection } = useAuth();
  const canEdit = canManageTeam(currentUser);
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Position | null>(null);
  const [managingDesc, setManagingDesc] = useState<Position | null>(null);
  const [newDescText, setNewDescText] = useState('');
  const [importPreview, setImportPreview] = useState<{ duplicates: string[], newItems: string[], originalDescriptions: string[] } | null>(null);

  const confirmImport = async (includeDuplicates: boolean) => {
     if (!importPreview || !managingDesc) return;
     const payloadDescriptions = includeDuplicates 
        ? importPreview.originalDescriptions 
        : importPreview.newItems;
     
     if (payloadDescriptions.length === 0) {
        toast.info('No new data added');
        setImportPreview(null);
        return;
     }
     
     const idToast = toast.loading('Importing data...');
     try {
        const res = await fetch('/api/positions/import-desc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: managingDesc.id, descriptions: payloadDescriptions, userName: currentUser?.name })
        });
        if (res.ok) {
          const resData = await res.json();
          toast.success(`Successfully imported ${resData.count} job responsibilities!`, { id: idToast });
          setManagingDesc({ ...managingDesc, description: resData.newDescriptions });
          setImportPreview(null);
        } else {
          toast.error('Failed to process import', { id: idToast });
        }
     } catch(err) {
        toast.error('Network error occurred', { id: idToast });
     }
  };

  const getDescriptionsList = (descStr: string): { id: number, text: string }[] => {
    if (!descStr) return [];
    try {
      const parsed = JSON.parse(descStr);
      if (Array.isArray(parsed)) return parsed;
      return [{ id: Date.now(), text: descStr }];
    } catch {
      return [{ id: Date.now(), text: descStr }];
    }
  };

  const filtered = positions.filter(p => {
    const matchDivision = p.division === activeSection;
    const q = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    const matchLevel = filterLevel === 'All' || p.level === filterLevel;
    return matchDivision && matchSearch && matchLevel;
  });

  const openAddModal = () => { setEditingPosition(null); setIsModalOpen(true); };
  const openEditModal = (p: Position) => { setEditingPosition(p); setIsModalOpen(true); };

  const fileInputRefGeneral = useRef<HTMLInputElement>(null);
  const fileInputRefDesc = useRef<HTMLInputElement>(null);

  const downTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { "Name": "Example Analyst", "Division": activeSection || "IT", "Level": "Staff", "Job Responsibilities & Descriptions": "1. Perform hardware installation\n2. Routine network maintenance" },
      { "Name": "Example Supervisor", "Division": activeSection || "IT", "Level": "Supervisor", "Job Responsibilities & Descriptions": "1. Oversee team performance\n2. Create monthly reports" }
    ], { header: ["Name", "Division", "Level", "Job Responsibilities & Descriptions"] });
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Import_Positions.xlsx");
  };

  const exportGeneral = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');

    ws.mergeCells('A1:D1');
    ws.getCell('A1').value = 'PT GIKEN PRECISION INDONESIA';
    ws.getCell('A1').font = { size: 14, bold: true, name: 'Arial' };
    ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };

    ws.mergeCells('A2:D2');
    ws.getCell('A2').value = 'Master Data Positions';
    ws.getCell('A2').font = { size: 12, bold: true, name: 'Arial' };
    ws.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };

    ws.getCell('A3').value = 'Employee: ' + (currentUser?.name || 'Admin');
    ws.getCell('A3').font = { italic: true };
    ws.getCell('B3').value = 'Date: ' + new Date().toLocaleDateString();
    ws.getCell('B3').font = { italic: true };
    
    const headerRow = ws.getRow(5);
    headerRow.values = ['Name', 'Division', 'Level', 'Job Responsibilities & Descriptions'];
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    let currentRowIndex = 6;
    filtered.forEach((p, index) => {
      const descList = getDescriptionsList(p.description);
      const rowCount = Math.max(1, descList.length);
      const startRow = currentRowIndex;
      const endRow = currentRowIndex + rowCount - 1;

      for (let i = 0; i < rowCount; i++) {
        const row = ws.getRow(currentRowIndex + i);
        row.getCell(1).value = p.name;
        row.getCell(2).value = p.division;
        row.getCell(3).value = p.level;
        row.getCell(4).value = descList.length > 0 ? descList[i].text : '-';
        
        row.eachCell((cell, colNumber) => {
          cell.alignment = { vertical: 'top', wrapText: true };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          if(colNumber !== 4) cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        });

        if (index % 2 === 0) {
          row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; });
        }
      }

      if (rowCount > 1) {
        ws.mergeCells(startRow, 1, endRow, 1);
        ws.mergeCells(startRow, 2, endRow, 2);
        ws.mergeCells(startRow, 3, endRow, 3);
      }
      currentRowIndex += rowCount;
    });

    ws.getColumn(1).width = 30;
    ws.getColumn(2).width = 25;
    ws.getColumn(3).width = 15;
    ws.getColumn(4).width = 90;

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'Export_Master_Positions.xlsx');
  };

  const handleImportSubmitGeneral = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        
        const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wsname], { header: 1 });
        let startReading = false;
        const colMap = { name: 0, division: 1, level: 2, desc: 3 };
        const payloadMap = new Map();
        const lastContext = { name: '', division: '', level: '' };

        rawRows.forEach((r: any) => {
          if (!Array.isArray(r)) return;
          if (!startReading) {
            const nIdx = r.findIndex(c => typeof c === 'string' && c.toLowerCase().trim() === 'name');
            const divIdx = r.findIndex(c => typeof c === 'string' && c.toLowerCase().trim() === 'division');
            if (nIdx > -1 && divIdx > -1) {
              startReading = true;
              colMap.name = nIdx;
              colMap.division = divIdx;
              colMap.level = r.findIndex(c => typeof c === 'string' && c.toLowerCase().trim() === 'level');
              colMap.desc = r.findIndex(c => typeof c === 'string' && c.toLowerCase().includes('description'));
            }
          } else {
            const nameVal = r[colMap.name] ? String(r[colMap.name]).trim() : '';
            const divVal = r[colMap.division] ? String(r[colMap.division]).trim() : '';
            const levelVal = colMap.level > -1 && r[colMap.level] ? String(r[colMap.level]).trim() : '';
            const descVal = colMap.desc > -1 && r[colMap.desc] ? String(r[colMap.desc]) : '';

            if (nameVal) {
               lastContext.name = nameVal;
               lastContext.division = divVal || '';
               lastContext.level = levelVal || 'Staff';
            }

            if (!lastContext.name) return;

            const key = `${lastContext.name}_${lastContext.division}`;
            if (!payloadMap.has(key)) {
               payloadMap.set(key, { ...lastContext, description: [] });
            }

            if (descVal && descVal.trim() !== '' && descVal.trim() !== '-') {
               payloadMap.get(key).description.push(descVal.trim());
            }
          }
        });

        let payload = Array.from(payloadMap.values()).map(p => ({
           name: p.name,
           division: p.division,
           level: p.level,
           description: p.description.length > 0 ? p.description.join('\n') : '[]'
        }));

        if (payload.length === 0) {
          const dictRows = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload = dictRows.map((r: any) => ({
            name: r['Name'] || r['name'],
            division: r['Division'] || r['division'],
            level: r['Level'] || r['level'] || 'Staff',
            description: r['Job Responsibilities & Descriptions'] || r['description'] || '[]'
          })).filter(r => r.name && r.division);
        }

        toast.info(`Importing ${payload.length} rows...`);
        const res = await fetch('/api/positions/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions: payload, userName: currentUser?.name })
        });
        if (res.ok) {
          const resData = await res.json();
          toast.success(`Successfully imported ${resData.count} items!`);
          window.location.reload();
        } else toast.error('Failed to process import');
      } catch (err) { toast.error('Invalid file format'); console.log(err); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await remove(deleteTarget.id);
    if (ok) toast.success(`"${deleteTarget.name}" deleted`);
    setDeleteTarget(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const payload = {
      name: (fd.get('name') as string).trim(),
      division: editingPosition ? editingPosition.division : activeSection,
      level: fd.get('level') as string,
      description: editingPosition ? editingPosition.description : '[]',
      userName: currentUser?.name || 'System',
    };
    if (!payload.name) { toast.error('Name required'); return; }

    if (editingPosition) {
      const res = await update({ id: editingPosition.id, ...payload } as unknown as Position & Record<string, unknown>);
      if (res !== null) { toast.success(`"${payload.name}" updated`); setIsModalOpen(false); }
    } else {
      const res = await create(payload as unknown as Partial<Position> & Record<string, unknown>);
      if (res !== null) { toast.success(`"${payload.name}" created`); setIsModalOpen(false); }
    }
  };

  const inputClass = "w-full bg-gray-50 dark:bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all";

  const columns = [
    {
      header: 'Position Name',
      accessor: (p: Position) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
            <Briefcase className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold text-foreground">{p.name}</div>
            {p.created_at && <div className="text-xs text-muted-foreground">Since {new Date(p.created_at).getFullYear()}</div>}
          </div>
        </div>
      )
    },
    {
      header: 'Division',
      accessor: (p: Position) => <span className="text-sm text-foreground">{p.division}</span>
    },
    {
      header: 'Level',
      accessor: (p: Position) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${LEVEL_COLORS[p.level] || LEVEL_COLORS.Staff}`}>
          {p.level}
        </span>
      )
    },
    {
      header: 'Description',
      accessor: (p: Position) => {
        const list = getDescriptionsList(p.description);
        return <span className="text-sm text-muted-foreground">{list.length} Details</span>;
      }
    },
    {
      header: 'Actions',
      accessor: (p: Position) => canEdit ? (
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => openEditModal(p)} className="text-muted-foreground hover:text-primary transition-colors"><Edit2 className="w-4 h-4" /></button>
          <button onClick={() => setDeleteTarget(p)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground italic">View only</span>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Job Positions</h1>
          <p className="text-muted-foreground mt-1">
            Registered positions for <strong className="text-foreground">{activeSection}</strong> — {filtered.length} positions
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button onClick={exportGeneral} className="flex items-center gap-2 px-4 py-2 bg-transparent border border-slate-600/50 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={downTemplate} className="flex items-center gap-2 px-4 py-2 bg-transparent border border-indigo-500/50 hover:bg-indigo-500/10 text-indigo-400 rounded-lg text-sm font-medium transition-all">
              <Download className="w-4 h-4" /> Template
            </button>
            <input type="file" ref={fileInputRefGeneral} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImportSubmitGeneral} />
            <button onClick={() => fileInputRefGeneral.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-transparent border border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-medium transition-all">
              <Upload className="w-4 h-4" /> Import
            </button>
            
            <div className="w-[1px] h-6 bg-border mx-2"></div>
            <button onClick={openAddModal}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-sm">
              <Plus className="w-4 h-4" /> Add Position
            </button>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl p-4 flex flex-col sm:flex-row gap-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input placeholder="Search positions..." value={search} onChange={e => setSearch(e.target.value)} className={inputClass + ' pl-9'} />
        </div>
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className={inputClass + ' min-w-[140px] cursor-pointer'}>
          <option value="All">All Levels</option>
          {LEVEL_ORDER.map(l => <option key={l}>{l}</option>)}
        </select>
      </div>

      <DataTable columns={columns} data={filtered} keyExtractor={p => p.id} onRowClick={(p) => canEdit ? setManagingDesc(p) : undefined} isLoading={loading} />

      {/* Info */}
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border text-sm" style={{ background: 'var(--surface)' }}>
        <Users className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-muted-foreground">Positions here appear as role options in the <strong className="text-foreground">Team</strong> module.</span>
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPosition ? 'Edit Position' : 'Add New Position'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Position Name *</label>
            <input name="name" required defaultValue={editingPosition?.name} className={inputClass} placeholder="e.g. Network Engineer" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Division *</label>
              <input readOnly disabled value={editingPosition ? editingPosition.division : activeSection} className={inputClass + ' opacity-50 cursor-not-allowed'} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Level *</label>
              <select name="level" defaultValue={editingPosition?.level || 'Staff'} className={inputClass + ' cursor-pointer'}>
                {LEVEL_ORDER.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <button type="button" onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-foreground border hover:bg-primary/5 transition-colors" style={{ borderColor: 'var(--border)' }}>Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-medium transition-colors">
              {editingPosition ? 'Save Changes' : 'Add Position'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Job Descriptions Modal */}
      <Modal isOpen={!!managingDesc} onClose={() => { setManagingDesc(null); setNewDescText(''); }} title={`Position Profile: ${managingDesc?.name}`} maxWidth="max-w-4xl">
        {managingDesc && (() => {
          const list = getDescriptionsList(managingDesc.description);
          
          const handleAddDesc = async (e?: React.FormEvent) => {
             e?.preventDefault();
             if (!newDescText.trim()) return;
             const newList = [...list, { id: Date.now(), text: newDescText.trim() }];
             setNewDescText('');
             const res = await update({ ...managingDesc, description: JSON.stringify(newList) } as unknown as Position & Record<string, unknown>);
             if (res) { setManagingDesc({ ...managingDesc, description: JSON.stringify(newList) }); toast.success('Detail added'); }
          };

          const handleDeleteDesc = async (id: number) => {
             const newList = list.filter(d => d.id !== id);
             const res = await update({ ...managingDesc, description: JSON.stringify(newList) } as unknown as Position & Record<string, unknown>);
             if (res) { setManagingDesc({ ...managingDesc, description: JSON.stringify(newList) }); toast.success('Detail deleted'); }
          };

          const exportDesc = async () => {
             const wb = new ExcelJS.Workbook();
             const ws = wb.addWorksheet('Job_Description');
             
             ws.mergeCells('A1:B1');
             ws.getCell('A1').value = 'JOB DESCRIPTION PROFILE';
             ws.getCell('A1').font = { size: 14, bold: true, name: 'Arial' };
             ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };

             ws.getCell('A3').value = 'Position Name';
             ws.getCell('B3').value = `: ${managingDesc.name}`;
             ws.getCell('A4').value = 'Division';
             ws.getCell('B4').value = `: ${managingDesc.division}`;
             ws.getCell('A5').value = 'Level';
             ws.getCell('B5').value = `: ${managingDesc.level}`;

             for(let i=3; i<=5; i++) ws.getCell(`A${i}`).font = { bold: true };

             const headerRow = ws.getRow(7);
             headerRow.values = ['No', 'Job Responsibilities & Descriptions'];
             headerRow.eachCell(cell => {
               cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
               cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
               cell.alignment = { vertical: 'middle', horizontal: 'center' };
               cell.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
             });

             let currentRow = 8;
             list.forEach((item, id) => {
               const row = ws.getRow(currentRow);
               row.getCell(1).value = id + 1;
               row.getCell(2).value = item.text;
               row.eachCell((cell, colNum) => {
                 cell.alignment = { vertical: 'top', wrapText: true };
                 if (colNum === 1) cell.alignment = { vertical: 'top', horizontal: 'center' };
                 cell.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
               });
               if (id % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern:'solid', fgColor:{argb:'FFF2F2F2'} } });
               currentRow++;
             });

             ws.getColumn(1).width = 8;
             ws.getColumn(2).width = 90;

             const buffer = await wb.xlsx.writeBuffer();
             saveAs(new Blob([buffer]), `Job_Desc_${managingDesc.name}.xlsx`);
          };

          const handleImportSubmitDesc = async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (evt) => {
              try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wsname], { header: 1 });
                const descriptions: string[] = [];
                let startReading = false;
                let colIdx = 1;
                
                rawRows.forEach((MathOrRow: any) => {
                  if (!Array.isArray(MathOrRow)) return;
                  if (!startReading) {
                    const foundIdx = MathOrRow.findIndex(c => typeof c === 'string' && (c.includes('Job Responsibilities') || c.includes('Tanggung Jawab') || c.toLowerCase().includes('description') || c.toLowerCase().includes('responsibility')));
                    if (foundIdx > -1) {
                      startReading = true;
                      colIdx = foundIdx;
                    }
                  } else {
                    const text = MathOrRow[colIdx];
                    if (text && String(text).trim() !== '') descriptions.push(String(text).trim());
                  }
                });
                
                if (descriptions.length === 0) {
                  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  rows.forEach((r: any) => {
                    const t = r['Job Responsibilities & Descriptions'] || r['Tanggung Jawab (Job Description)'] || r['Tanggung Jawab'] || r['responsibility'] || r['description'] || String(Object.values(r)[1] || Object.values(r)[0] || '');
                    if (t && String(t).trim() !== '') descriptions.push(String(t).trim());
                  });
                }
                
                const validDescriptions = descriptions.filter(d => d.trim() !== '');
                if (validDescriptions.length === 0) {
                  toast.error('Invalid file or no importable data found');
                  return;
                }

                const existingTexts = list.map(item => item.text.toLowerCase().trim());
                const duplicates: string[] = [];
                const newItems: string[] = [];

                validDescriptions.forEach(desc => {
                  if (existingTexts.includes(desc.toLowerCase().trim())) {
                    duplicates.push(desc);
                  } else {
                    newItems.push(desc);
                  }
                });

                setImportPreview({ duplicates, newItems, originalDescriptions: validDescriptions });
              } catch (err) { toast.error('Invalid file format'); }
            };
            reader.readAsBinaryString(file);
            e.target.value = '';
          };

          const formatDate = (ts: number) => {
            if (!ts || ts < 1000000000000) return 'Legacy Data';
            const d = new Date(ts);
            return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}`;
          };

          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-2">
              {/* Left Column: Details */}
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 mb-3">
                    <Briefcase className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">{managingDesc.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{managingDesc.division}</p>
                  
                  <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">Level</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border inline-block ${LEVEL_COLORS[managingDesc.level] || LEVEL_COLORS.Staff}`}>
                        {managingDesc.level}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Responsibilities</span>
                      <span className="text-sm font-medium text-foreground">{list.length} Items</span>
                    </div>
                    {managingDesc.created_at && (
                      <div>
                        <span className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">Created Date</span>
                        <span className="text-sm font-medium text-foreground">
                          {new Date(managingDesc.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Descriptions List */}
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Job Responsibilities & Descriptions</h3>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-stretch">
                  <form onSubmit={handleAddDesc} className="flex flex-1 gap-2 w-full">
                    <input value={newDescText} onChange={e => setNewDescText(e.target.value)} placeholder="Type new job responsibility..." className={inputClass} />
                    <button type="submit" className="px-5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 flex-shrink-0 transition-colors shadow-sm whitespace-nowrap">Add Item</button>
                  </form>
                  <div className="flex items-center gap-2">
                    <button onClick={exportDesc} className="flex items-center gap-1.5 px-4 bg-transparent border border-slate-600/50 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all h-full">
                      <Download className="w-4 h-4" /> Export
                    </button>
                    <input type="file" ref={fileInputRefDesc} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImportSubmitDesc} />
                    <button onClick={() => fileInputRefDesc.current?.click()} className="flex items-center gap-1.5 px-4 bg-transparent border border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-medium transition-all h-full">
                      <Upload className="w-4 h-4" /> Import
                    </button>
                  </div>
                </div>

                {list.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl" style={{ borderColor: 'var(--border)' }}>No job details added yet. Format requires action points.</div>
                ) : (
                  <div className="border rounded-xl divide-y overflow-hidden shadow-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                    <div className="max-h-[50vh] overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
                      {list.map((item, idx) => (
                        <div key={item.id || idx} className="flex justify-between items-start gap-4 p-4 hover:bg-muted/30 transition-colors group">
                          <div className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20">{idx+1}</span>
                            <div>
                              <p className="text-sm text-foreground/90 leading-snug">{item.text}</p>
                              <p className="text-[10px] text-muted-foreground mt-1.5 opacity-60">Last Edited: {formatDate(item.id)}</p>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteDesc(item.id)} className="text-muted-foreground hover:text-destructive flex-shrink-0 p-1.5 bg-background rounded-md border border-border opacity-0 group-hover:opacity-100 transition-all shadow-sm"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal isOpen={!!importPreview} onClose={() => setImportPreview(null)} title="Import Validation">
        {importPreview && (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              <strong>{importPreview.originalDescriptions.length}</strong> responsibilities read from file and ready to be added.
            </p>
            {importPreview.duplicates.length > 0 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-600 dark:text-yellow-400">
                ⚠️ Found <strong>{importPreview.duplicates.length}</strong> duplicate items based on existing data. Import all or skip duplicates?
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
               <button onClick={() => setImportPreview(null)} className="px-4 py-2 rounded-xl text-sm font-medium text-foreground border hover:bg-primary/5 transition-colors" style={{ borderColor: 'var(--border)' }}>Cancel</button>
               {importPreview.duplicates.length > 0 ? (
                 <>
                   <button onClick={() => confirmImport(false)} className="px-4 py-2 text-primary hover:bg-primary/10 border border-primary/20 rounded-xl text-sm font-medium transition-colors">Skip Duplicates ({importPreview.newItems.length})</button>
                   <button onClick={() => confirmImport(true)} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-medium shadow-sm transition-colors">Import All ({importPreview.originalDescriptions.length})</button>
                 </>
               ) : (
                 <button onClick={() => confirmImport(true)} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-medium shadow-sm transition-colors">Confirm Import ({importPreview.originalDescriptions.length})</button>
               )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Position" message={`Delete "${deleteTarget?.name}"? Members using this role won't be affected.`} />
    </div>
  );
}
