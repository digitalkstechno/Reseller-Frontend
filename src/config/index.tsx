const API = process.env.NEXT_PUBLIC_API_URL;

export const baseUrl = {
  userSignup: `${API}users/signup`,
  userLogin: `${API}auth/login`,
  addRole: `${API}role`,
  getAllRoles: `${API}role`,
  findRoleById: `${API}role`,
  updateRole: `${API}role`,
  deleteRole: `${API}role`,
  addStaff: `${API}reseller/create`,
  getAllStaff: `${API}reseller`,
  findStaffById: `${API}reseller`,
  updateStaff: `${API}reseller`,
  deleteStaff: `${API}reseller`,
  addLead: `${API}lead/create`,
  getAllLeads: `${API}lead`,
  myLeads: `${API}lead/my`,
  findLeadById: `${API}lead`,
  updateLead: `${API}lead`,
  deleteLead: `${API}lead`,
  leadSources: `${API}leadsources`,
  leadStatuses: `${API}leadstatus`,
  leadCountSummary: `${API}lead/count-summary`,
  myLeadCountSummary: `${API}lead/count-summary/my`,
  getKanbanData: `${API}lead/kanban`,
  getKanbanStatusLeads: `${API}lead/kanban-status`,
  getKanbanStatusTasks: `${API}task/kanban-status`,
  updateKanbanStatus: `${API}lead`,
  leadUpcomingFollowups: `${API}lead/followups/upcoming`,
  leadUpcomingFollowupsMy: `${API}lead/followups/upcoming/my`,
  leadDueFollowups: `${API}lead/followups/due`,
  leadDueFollowupsMy: `${API}lead/followups/due/my`,
  leadAllFollowups: `${API}lead/followups/all`,
  leadAllFollowupsMy: `${API}lead/followups/all/my`,
  getWonLeads: `${API}lead/won`,
  getLostLeads: `${API}lead/lost`,
  exportLeads: `${API}lead/export`,
  importLeadsTemplate: `${API}lead/import-template`,
  bulkImportLeads: `${API}lead/bulk-import`,
  teams: `${API}team`,
  organizations: `${API}organization`,
  myTasks: `${API}task/my`,
  taskSummary: `${API}task/summary`,
  myTaskSummary: `${API}task/my-summary`,
  taskKanban: `${API}task/kanban`,
  taskStatuses: `${API}taskstatus`,
  createTask: `${API}task/create`,
  getAllTasks: `${API}task`,
  findTaskById: `${API}task`,
  updateTask: `${API}task`,
  deleteTask: `${API}task`,
  updateTaskStatus: `${API}task`,
  updateTaskPriority: `${API}task`,
  todayTasks: `${API}task/today`,
  addReseller: `${API}reseller/create`,
  getAllResellers: `${API}reseller`,
  findResellerById: `${API}reseller`,
  updateReseller: `${API}reseller`,
  deleteReseller: `${API}reseller`,
  settlements: `${API}settlement/all`,
  addSettlement: `${API}settlement/pay`,
  resellerLeadSettlements: `${API}settlement/leads`,
  settlementHistory: `${API}settlement/history`,
  settingsRequiredFields: `${API}settings/required-fields`,
  settingsLeadFields: `${API}settings/lead-fields`,
  settleLeads: `${API}settlement/settle-leads`,
  getBaseUrl: API,
  getImageUrl: (process.env.NEXT_PUBLIC_IMAGE_URL || "").replace(/\/+$/, ""),
};

import { store } from '@/store';
import { setCredentials, logout } from '@/store/slices/authSlice';

export function setAuthToken(token: string, days: number = 7) {
  // Sync to Redux store
  try {
    store.dispatch(setCredentials({
      token,
      user: store.getState().auth.user,
      role: store.getState().auth.role || '',
      permissions: store.getState().auth.permissions,
    }));
  } catch (e) {
    console.error("Failed to sync auth token to Redux store:", e);
  }
}

export function getAuthToken(): string | null {
  try {
    return store.getState().auth.token;
  } catch (e) {
    return null;
  }
}

export function clearAuthToken() {
  // Clear Redux store
  try {
    store.dispatch(logout());
  } catch (e) {
    console.error("Failed to clear auth token from Redux store:", e);
  }
}
