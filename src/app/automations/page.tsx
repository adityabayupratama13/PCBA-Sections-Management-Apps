'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Zap, ArrowRight, Activity, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';

interface Rule {
  id: number;
  name: string;
  trigger_event: string;
  condition_field: string;
  condition_value: string;
  action_type: string;
  action_payload: string;
  is_active: number;
  created_at: string;
}

export default function AutomationsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Form State
  const [newName, setNewName] = useState('');
  const [newTrigger, setNewTrigger] = useState('ticket_created');
  const [newCondField, setNewCondField] = useState('priority');
  const [newCondValue, setNewCondValue] = useState('Critical');
  const [newActionType, setNewActionType] = useState('assign_to');
  const [newActionPayload, setNewActionPayload] = useState('IT Manager');

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/rules');
      if (res.ok) {
        setRules(await res.json());
      }
    } catch {
      toast.error('Failed to load automations');
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async (id: number, currentStatus: number) => {
    try {
      const res = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: currentStatus === 1 ? 0 : 1 })
      });
      if (res.ok) {
        toast.success(`Rule ${currentStatus === 1 ? 'disabled' : 'enabled'}`);
        fetchRules();
      }
    } catch {
      toast.error('Failed to toggle rule');
    }
  };

  const deleteRule = async (id: number) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;
    try {
      const res = await fetch(`/api/rules?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Rule deleted');
        fetchRules();
      }
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newCondValue.trim() || !newActionPayload.trim()) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          trigger_event: newTrigger,
          condition_field: newCondField,
          condition_value: newCondValue,
          action_type: newActionType,
          action_payload: newActionPayload
        })
      });

      if (res.ok) {
        toast.success('Automation rule created!');
        setIsAdding(false);
        setNewName('');
        fetchRules();
      }
    } catch {
      toast.error('Failed to create rule');
    }
  };


  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar p-6 lg:p-10 relative">
      
      {/* Background Magic Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] right-[5%] w-[30%] h-[40%] rounded-full bg-blue-500/5 blur-[120px]" />
        <div className="absolute bottom-[10%] left-[5%] w-[40%] h-[30%] rounded-full bg-violet-500/5 blur-[100px]" />
      </div>

      <div className="max-w-6xl w-full mx-auto relative z-10 space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
              <Zap className="w-8 h-8 text-amber-400" /> Automations
            </h1>
            <p className="text-muted-foreground mt-2 font-medium">Configure IF-THEN workflow rules to scale your IT operations.</p>
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-sm shadow-primary/20"
          >
            {isAdding ? 'Cancel' : <><Plus className="w-5 h-5" /> New Rule</>}
          </button>
        </div>

        {/* Builder Panel */}
        {isAdding && (
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <h3 className="font-bold text-lg mb-4 text-foreground flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> Rule Builder</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-end">
              <div className="col-span-1 lg:col-span-4">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Rule Name</label>
                <input 
                  type="text" 
                  placeholder="e.g., Escalation for Critical Tickets"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:border-primary transition-colors"
                />
              </div>

              <div className="col-span-1 border border-border/50 rounded-xl p-4 bg-background/50">
                <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-2">1. IF (Trigger)</label>
                <select value={newTrigger} onChange={e => setNewTrigger(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:border-primary">
                  <option value="ticket_created">Ticket is Created</option>
                  <option value="ticket_updated">Ticket is Updated</option>
                  <option value="task_updated">Task is Updated</option>
                </select>
              </div>

              <div className="col-span-1 lg:col-span-2 border border-border/50 rounded-xl p-4 bg-background/50 flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">2. AND (Condition)</label>
                  <div className="flex gap-2">
                    <select value={newCondField} onChange={e => setNewCondField(e.target.value)} className="w-1/2 bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:border-primary">
                      <option value="priority">Priority equals</option>
                      <option value="status">Status equals</option>
                      <option value="reporter">Reporter is</option>
                    </select>
                    <input 
                      type="text" 
                      value={newCondValue}
                      onChange={e => setNewCondValue(e.target.value)}
                      placeholder="Value"
                      className="w-1/2 bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-1 border border-border/50 rounded-xl p-4 bg-background/50">
                <label className="block text-xs font-bold text-green-500 uppercase tracking-wider mb-2">3. THEN (Action)</label>
                <div className="flex flex-col gap-2">
                  <select value={newActionType} onChange={e => setNewActionType(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:border-primary">
                    <option value="assign_to">Auto-Assign To</option>
                    <option value="add_comment">Add Auto-Comment</option>
                    <option value="set_priority">Change Priority To</option>
                    <option value="generate_alert">Generate Global Alert</option>
                  </select>
                  <input 
                    type="text" 
                    value={newActionPayload}
                    onChange={e => setNewActionPayload(e.target.value)}
                    placeholder="Action payload..."
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={handleCreate} className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 transition-colors shadow-sm">Save Automation Link</button>
            </div>
          </div>
        )}

        {/* Existing Rules List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">Active Workflows</h2>
          
          {loading ? (
             <div className="py-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div></div>
          ) : rules.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-surface/50">
              <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-bold text-foreground">No Automations Found</h3>
              <p className="text-muted-foreground mt-1">Create your first rule to automate repetitive IT workflows.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {rules.map(rule => (
                <div key={rule.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border transition-all ${rule.is_active ? 'bg-surface border-border shadow-sm' : 'bg-background border-border/50 opacity-60'}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-foreground text-lg">{rule.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${rule.is_active ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-muted text-muted-foreground border border-border'}`}>
                        {rule.is_active ? 'Running' : 'Paused'}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-medium">
                      <span className="text-primary bg-primary/10 px-2 py-1 rounded">IF</span>
                      <span className="text-muted-foreground">{rule.trigger_event}</span>
                      <span className="text-amber-500 bg-amber-500/10 px-2 py-1 rounded">AND</span>
                      <span className="text-muted-foreground">[{rule.condition_field}] == &quot;{rule.condition_value}&quot;</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-green-500 bg-green-500/10 px-2 py-1 rounded">THEN</span>
                      <span className="text-muted-foreground">{rule.action_type}( &quot;{rule.action_payload}&quot; )</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-4 sm:mt-0 sm:ml-6 shrink-0">
                    <button 
                      onClick={() => toggleRule(rule.id, rule.is_active)}
                      className={`transition-colors ${rule.is_active ? 'text-primary' : 'text-muted-foreground'}`}
                      title="Toggle Rule"
                    >
                      {rule.is_active ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                    </button>
                    <div className="w-px h-6 bg-border mx-1"></div>
                    <button onClick={() => deleteRule(rule.id)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
