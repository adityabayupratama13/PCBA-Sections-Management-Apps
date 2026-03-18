import type { Member } from '@/context/AuthContext';

// ─── Role constants ────────────────────────────────────────────────────────
export const ROLES = {
  IT_SUPERVISOR: 'IT Supervisor',
  IT_SOFTWARE: 'IT Software & Database',
  IT_INFRA: 'IT Infrastructure & Administration',
  IT_ANALYST: 'IT Analyst & Support',
} as const;

// ─── Role Checks ───────────────────────────────────────────────────────────
export const isSupervisor = (m: Member | null) =>
  m?.role === ROLES.IT_SUPERVISOR;

export const isLeader = (m: Member | null) =>
  m?.role === ROLES.IT_SOFTWARE || m?.role === ROLES.IT_INFRA;

export const isManagement = (m: Member | null) =>
  m?.member_type === 'Management';

/** Supervisor OR Leader (IT Software & DB / IT Infra) */
export const isSupervisorOrLeader = (m: Member | null) =>
  isSupervisor(m) || isLeader(m);

// ─── Permission Checks ─────────────────────────────────────────────────────

/** Can this user do general Edit/Add/Delete on Team, Positions, Attendance sub-menus? */
export const canManageTeam = (m: Member | null) =>
  isSupervisor(m) || isLeader(m) || isManagement(m);

/** Can this user edit Dashboard layout / widgets? */
export const canManageDashboard = (m: Member | null) =>
  isSupervisor(m) || isManagement(m);

/** Can this user manage Shift Roster / Employee Status in Attendance? */
export const canManageAttendanceAdmin = (m: Member | null) =>
  isSupervisor(m) || isLeader(m) || isManagement(m);

/** Everyone can submit their own OT / Leave */
export const canSubmitRequest = () => true;

/** IT Supervisor can approve/decline first-level (OT + Leave) */
export const canApproveAsITSupervisor = (m: Member | null) =>
  isSupervisor(m) || isManagement(m);

/** Manager can approve final (OT + Leave) */
export const canApproveAsManager = (m: Member | null) =>
  isManagement(m);

/** Leader can approve first step of Leave */
export const canApproveAsLeader = (m: Member | null) =>
  isLeader(m) || isSupervisor(m) || isManagement(m);

/** Can this user edit THEIR OWN profile fields (password, photo, email, phone)? */
export const canEditOwnProfile = (
  currentUser: Member | null,
  targetMemberId: number
) => currentUser?.id === targetMemberId;

// ─── Tooltip helpers ───────────────────────────────────────────────────────
export const noPermissionTooltip = (action = 'edit') =>
  `You don't have permission to ${action}. Contact IT Supervisor.`;
