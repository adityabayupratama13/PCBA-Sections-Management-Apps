export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';

const SLA_HOURS: Record<Priority, number> = {
  Critical: 4,     // 4 hours
  High: 24,        // 1 day
  Medium: 72,      // 3 days
  Low: 168         // 7 days
};

export interface SLAStatus {
  label: string;
  level: 'good' | 'warning' | 'danger';
  timeLeftText?: string;
  isBreached: boolean;
}

export function getTicketSLA(createdDate: string, priority: string, status: string): SLAStatus {
  if (status === 'Resolved' || status === 'Closed' || status === 'Done') {
    return { label: 'Met', level: 'good', isBreached: false, timeLeftText: 'Completed' };
  }

  const p = (SLA_HOURS[priority as Priority] || 72);
  const slaMs = p * 60 * 60 * 1000;
  
  const created = new Date(createdDate).getTime();
  const now = new Date().getTime();
  
  const elapsedMs = now - created;
  const remainingMs = slaMs - elapsedMs;
  const hoursLeft = remainingMs / (1000 * 60 * 60);

  const formatHours = (h: number) => {
    if (h > 48) return `${Math.floor(h/24)}d`;
    if (h >= 1) return `${Math.floor(h)}h`;
    return `${Math.floor(h * 60)}m`;
  };

  if (hoursLeft < 0) {
    return { 
      label: 'Breached', 
      level: 'danger', 
      isBreached: true,
      timeLeftText: `-${formatHours(Math.abs(hoursLeft))}` 
    };
  } else if (hoursLeft <= p * 0.25 || hoursLeft <= 2) {
    // Warning if less than 25% of time left, OR less than 2 hours left
    return { 
      label: 'At Risk', 
      level: 'warning', 
      isBreached: false,
      timeLeftText: `${formatHours(hoursLeft)}`
    };
  } else {
    return { 
      label: 'On Track', 
      level: 'good', 
      isBreached: false,
      timeLeftText: `${formatHours(hoursLeft)}`
    };
  }
}
