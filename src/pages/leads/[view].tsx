// pages/leads/[view].tsx
// Unified Leads Page - handles both 'list' and 'kanban' views
// View is persisted in localStorage AND reflected in the URL

import { useRouter } from 'next/router';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { ListCollapse, Plus, Filter, Kanban, Search, Download, Upload, X } from 'lucide-react';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';

// ── Sub-components ──────────────────────────────────────────────────────────
import LeadsListView from '@/components/leads/LeadsListView';
import LeadsKanbanView from '@/components/leads/LeadsKanbanView';
import LeadAddDialog from '@/components/leads/LeadAddDialog';
import LeadViewDialog from '@/components/leads/LeadViewDialog';
import LeadBulkImportDialog from '@/components/leads/LeadBulkImportDialog';
import { PageSkeleton, KanbanColumnSkeleton } from '@/components/ui/Skeleton';

// ── Types ────────────────────────────────────────────────────────────────────
import {
  ApiLead,
} from '@/components/leads/types';

// ── Hooks / Config ───────────────────────────────────────────────────────────
import { useLeadsData } from '@/components/leads/useLeadsData';
import FormInput from '@/components/ui/Input';
import { FormSelect, FormMultiSelect } from '@/components/ui/FormSelect';
import DatePicker from '@/components/ui/DatePicker';

export type ViewMode = 'list' | 'kanban';
export type KanbanSubView = 'board' | 'lost' | 'won';

// ── Utils ──────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay = 500): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function LeadsPage() {
  const router = useRouter();
  const { view: viewParam } = router.query;

  // ── Active view (list | kanban) ──────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');

  // ── Kanban sub-view — lifted here so hook knows which data to fetch ───────
  const [kanbanSubView, setKanbanSubView] = useState<KanbanSubView>('board');

  // ── Search & Filters ─────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [staffFilter, setStaffFilter] = useState<string[]>([]);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [resellerFilter, setResellerFilter] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Temporary state for the filter popover
  const [tempStatusFilter, setTempStatusFilter] = useState<string[]>([]);
  const [tempStaffFilter, setTempStaffFilter] = useState<string[]>([]);
  const [tempResellerFilter, setTempResellerFilter] = useState<string[]>([]);
  const [tempPaymentStatusFilter, setTempPaymentStatusFilter] = useState('');
  const [tempFromDate, setTempFromDate] = useState('');
  const [tempToDate, setTempToDate] = useState('');
  const [showFilterPopover, setShowFilterPopover] = useState(false);

  // Sync temp state when opening popover
  useEffect(() => {
    if (showFilterPopover) {
      setTempStatusFilter(statusFilter);
      setTempStaffFilter(staffFilter);
      setTempResellerFilter(resellerFilter);
      setTempPaymentStatusFilter(paymentStatusFilter);
      setTempFromDate(fromDate);
      setTempToDate(toDate);
    }
  }, [showFilterPopover, statusFilter, staffFilter, resellerFilter, paymentStatusFilter, fromDate, toDate]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const debouncedSearch = useDebounce(search, 500);

  // ── Dialogs ──────────────────────────────────────────────────────────────
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingLead, setEditingLead] = useState<ApiLead | null>(null);
  const [viewingLead, setViewingLead] = useState<ApiLead | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  // ── Permissions ──────────────────────────────────────────────────────────
  const [leadPermissions, setLeadPermissions] = useState<{
    create?: boolean;
    readAll?: boolean;
    readOwn?: boolean;
    update?: boolean;
    delete?: boolean;
    assign?: boolean;
    transfer?: boolean;
    convert?: boolean;
  } | null>(null);

  const token = typeof window !== 'undefined' ? getAuthToken() : null;

  const { role, permissions: rawPerms } = useSelector((state: any) => state.auth);

  const userRole = role?.toLowerCase() || '';

  // ── Fetch permissions ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const lp = rawPerms?.lead || {};
    setLeadPermissions(lp);
    if (!lp.readAll && lp.readOwn) setActiveTab('my');
  }, [token, rawPerms]);

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      status: statusFilter.length > 0 ? statusFilter.join(',') : '',
      staff: staffFilter.length > 0 ? staffFilter.join(',') : '',
      reseller: resellerFilter.length > 0 ? resellerFilter.join(',') : '',
      paymentStatus: paymentStatusFilter,
      from: fromDate,
      to: toDate,
    }),
    [debouncedSearch, statusFilter, staffFilter, resellerFilter, paymentStatusFilter, fromDate, toDate]
  );

  // ── Data — pass kanbanSubView so hook fetches only what's needed ──────────
  const {
    leads,
    leadsList,
    lostLeads,
    wonLeads,
    statuses,
    staffMembers,
    counts,
    loading,
    refetchAll,
    fetchLeadsList,
    findLeadById,
    listPagination,
    lostPagination,
    wonPagination,
  } = useLeadsData(activeTab, filters, viewMode, kanbanSubView);

  const handleRefresh = useCallback(() => {
    refetchAll();
    setRefreshTrigger(prev => prev + 1);
  }, [refetchAll]);

  // ── Force 'Won' status for admin ─────────────────────────────────────────
  useEffect(() => {
    if (userRole === 'admin' && statuses.length > 0) {
      const wonStatus = statuses.find((s: any) => s.name.toLowerCase() === 'won');
      if (wonStatus) {
        if (statusFilter.length !== 1 || statusFilter[0] !== wonStatus._id) {
          setStatusFilter([wonStatus._id]);
        }
      }
    }
  }, [userRole, statuses, statusFilter]);

  // ── Sync URL → state ─────────────────────────────────────────────────────
  // ── Sync URL → state ─────────────────────────────────────────────────────
  useEffect(() => {
    if (userRole === 'admin') {
      setViewMode('list');
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('leadsView', 'list');
      }
      return;
    }
    if (viewParam === 'kanban' || viewParam === 'list') {
      setViewMode(viewParam as ViewMode);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('leadsView', viewParam);
      }
    }
  }, [viewParam, userRole]);

  const switchView = (mode: ViewMode) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('leadsView', mode);
    }
    router.push(`/leads/${mode}`, undefined, { shallow: true });
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleOpenAdd = () => {
    setEditingLead(null);
    setShowAddDialog(true);
  };

  const handleEdit = (lead: ApiLead) => {
    if (leadPermissions?.update === false) return;
    setEditingLead(lead);
    setShowAddDialog(true);
  };

  const handleView = (lead: ApiLead) => {
    if (leadPermissions?.readAll === false && leadPermissions?.readOwn === false) return;
    setViewingLead(lead);
  };

  const handleDialogClose = () => {
    setShowAddDialog(false);
    setEditingLead(null);
  };

  // ── Excel Export ──────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const token = getAuthToken();
      const params: Record<string, string> = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.staff) params.staff = filters.staff;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (activeTab === 'my') params.my = 'true';

      const res = await axios.get(baseUrl.exportLeads, {
        headers: { Authorization: `Bearer ${token}` },
        params,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads_export_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // ── Permission flags ──────────────────────────────────────────────────────
  const canCreate = leadPermissions?.create !== false;
  const canRead = (leadPermissions?.readAll || leadPermissions?.readOwn) !== false;
  const canReadAll = leadPermissions?.readAll !== false;
  const canReadOwn = leadPermissions?.readOwn !== false;
  const canUpdate = leadPermissions?.update !== false;
  const canDelete = leadPermissions?.delete !== false;
  const canAssign = leadPermissions?.assign !== false;
  const canTransfer = leadPermissions?.transfer !== false;
  const canConvert = leadPermissions?.convert !== false;

  const handleApplyFilters = () => {
    setStatusFilter(tempStatusFilter);
    setStaffFilter(tempStaffFilter);
    setResellerFilter(tempResellerFilter);
    setPaymentStatusFilter(tempPaymentStatusFilter);
    setFromDate(tempFromDate);
    setToDate(tempToDate);
    setShowFilterPopover(false);
  };

  const handleClearFilters = () => {
    setTempStatusFilter([]);
    setTempStaffFilter([]);
    setTempResellerFilter([]);
    setTempPaymentStatusFilter('');
    setTempFromDate('');
    setTempToDate('');
    setStatusFilter([]);
    setStaffFilter([]);
    setResellerFilter([]);
    setPaymentStatusFilter('');
    setFromDate('');
    setToDate('');
    setSearch('');
    setShowFilterPopover(false);
  };

  const hasActiveFilters = !!(
    statusFilter.length > 0 || staffFilter.length > 0 || resellerFilter.length > 0 || paymentStatusFilter || fromDate || toDate || search
  );

  const headerActions = (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search Bar */}
      <div className="relative w-full sm:w-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
        <input
          type="search"
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 rounded-md border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm text-gray-700 placeholder:text-gray-400 transition-all duration-200 focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/20 hover:border-gray-300"
        />
      </div>

      {/* Filter Popover Button */}
      <div className="relative">
        <button
          onClick={() => setShowFilterPopover(!showFilterPopover)}
          className={`inline-flex items-center justify-center h-9 w-9 rounded-md border transition-all ${
            showFilterPopover || hasActiveFilters
              ? 'bg-blue-50 text-blue-600 border-blue-200'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Filter className="h-4 w-4" />
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
          )}
        </button>

        {showFilterPopover && (
          <div className="absolute right-0 top-full mt-2 w-[320px] bg-white rounded-lg shadow-xl border border-gray-100 z-[100] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-900">Filter Leads</h3>
              <button
                onClick={() => setShowFilterPopover(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {userRole !== 'admin' && (
                <div className="space-y-1.5">
                  <FormMultiSelect
                    label="Lead Status"
                    value={tempStatusFilter}
                    onChange={setTempStatusFilter}
                    options={statuses.map((s) => ({ value: s._id, label: s.name }))}
                  />
                </div>
              )}

              {userRole === 'admin' && (
                <div className="space-y-1.5">
                  <FormMultiSelect
                    label="Reseller"
                    value={tempResellerFilter}
                    onChange={setTempResellerFilter}
                    options={staffMembers.map((s) => ({ value: s._id, label: s.fullName }))}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <FormSelect
                  label="Payment Status"
                  value={tempPaymentStatusFilter}
                  onChange={setTempPaymentStatusFilter}
                  options={[
                    { value: "", label: "All Payments" },
                    { value: "Paid", label: "Paid" },
                    { value: "Unpaid", label: "Unpaid" }
                  ]}
                  placeholder="All Payments"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <DatePicker
                    value={tempFromDate}
                    onChange={setTempFromDate}
                    placeholder="Start Date"
                  />
                  <DatePicker
                    value={tempToDate}
                    onChange={setTempToDate}
                    placeholder="End Date"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center gap-3">
              <button
                onClick={handleClearFilters}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Clear All
              </button>
              <button
                onClick={handleApplyFilters}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#3B82F6] rounded-md hover:bg-blue-600 transition-colors cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── Access denied ─────────────────────────────────────────────────────────
  if (!canRead && !loading && leadPermissions !== null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-md bg-red-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-red-800">Access Denied</h2>
          <p className="mt-2 text-red-600">You don't have permission to view leads.</p>
        </div>
      </div>
    );
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full flex-col gap-4 relative overflow-hidden">
        <div className="rounded-md border border-gray-200 bg-white px-6 py-4 transition-all duration-300">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="h-8 w-24 bg-gray-200 rounded-md animate-pulse" />
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <div className="h-10 w-24 bg-gray-200 rounded-md animate-pulse" />
              <div className="h-10 w-20 bg-gray-200 rounded-md animate-pulse" />
              <div className="h-10 w-32 bg-gray-200 rounded-md animate-pulse" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {viewMode === 'list' ? (
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <PageSkeleton />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 h-full">
              {Array.from({ length: 4 }).map((_, i) => (
                <KanbanColumnSkeleton key={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col h-full gap-4 relative">

      {/* ── Page Header & Unified Toolbar ───────────────────────────────── */}
      {(userRole !== 'admin' || viewMode !== 'list') && (
        <div className="rounded-md border border-gray-200 bg-white px-4 md:px-6 py-4 transition-all duration-300 flex-shrink-0">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center justify-between">
              {/* Mobile View Toggle */}
              {userRole !== 'admin' && (
                <div className="md:hidden relative flex items-center bg-gray-100 p-1 rounded-md w-fit">
                  <button
                    onClick={() => switchView('list')}
                    className={`relative z-10 cursor-pointer flex items-center justify-center w-8 h-8 rounded-md transition-colors ${viewMode === 'list' ? 'bg-secondary text-white shadow-sm' : 'text-gray-700'}`}
                  >
                    <ListCollapse className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => switchView('kanban')}
                    className={`relative z-10 cursor-pointer flex items-center justify-center w-8 h-8 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-secondary text-white shadow-sm' : 'text-gray-700'}`}
                  >
                    <Kanban className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {viewMode !== 'list' && headerActions}

            <div className="flex flex-wrap items-center gap-2 md:gap-3 md:ml-auto">
              {/* Desktop View toggle */}
              {userRole !== 'admin' && (
                <div className="hidden md:flex relative items-center bg-gray-100 p-1 rounded-md h-10 w-fit">
                  <button
                    onClick={() => switchView('list')}
                    className={`relative z-10 cursor-pointer flex items-center justify-center w-8 h-8 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[#3B82F6] text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200'}`}
                    title="List View"
                  >
                    <ListCollapse className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => switchView('kanban')}
                    className={`relative z-10 cursor-pointer flex items-center justify-center w-8 h-8 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-[#3B82F6] text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200'}`}
                    title="Kanban View"
                  >
                    <Kanban className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Add Lead button */}
              {canCreate && (
                <button
                  onClick={handleOpenAdd}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-[#3B82F6] px-5 h-10 text-sm font-semibold text-white shadow-md hover:bg-blue-600 active:scale-95 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Add Lead
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col">
        {viewMode === 'list' ? (
          <LeadsListView
            statuses={statuses}
            staffMembers={staffMembers}
            onEdit={canUpdate ? handleEdit : undefined}
            onView={handleView}
            onRefresh={handleRefresh}
            scope={activeTab}
            filters={filters}
            externalLeads={leadsList}
            loading={loading}
            permissions={{
              create: canCreate,
              readAll: canReadAll,
              readOwn: canReadOwn,
              update: canUpdate,
              delete: canDelete,
              assign: canAssign,
              transfer: canTransfer,
              convert: canConvert,
            }}
            pagination={listPagination}
            onSearchChange={setSearch}
            headerActions={headerActions}
          />
        ) : (
          <LeadsKanbanView
            leads={leads}
            lostLeads={lostLeads}
            wonLeads={wonLeads}
            statuses={statuses}
            counts={counts?.statusCounts}
            summary={counts}
            onEdit={canUpdate ? handleEdit : undefined}
            onView={handleView}
            onRefresh={handleRefresh}
            scope={activeTab}
            filters={filters}
            refreshTrigger={refreshTrigger}
            // Pass separate paginations for lost/won
            lostPagination={lostPagination}
            wonPagination={wonPagination}
            // Notify parent when sub-view changes so hook fetches correct data
            onSubViewChange={setKanbanSubView}
            permissions={{
              create: canCreate,
              readAll: canReadAll,
              readOwn: canReadOwn,
              update: canUpdate,
              delete: canDelete,
              assign: canAssign,
              transfer: canTransfer,
              convert: canConvert,
            }}
          />
        )}
      </div>

      {/* ── Add / Edit Dialog ────────────────────────────────────────────── */}
      <LeadAddDialog
        isOpen={showAddDialog}
        onClose={handleDialogClose}
        mode={editingLead ? 'edit' : 'add'}
        initialData={editingLead}
        onLeadCreated={() => {
          handleRefresh();
          handleDialogClose();
        }}
        onLeadUpdated={() => {
          handleRefresh();
          handleDialogClose();
        }}
      />

      {/* ── View Dialog ──────────────────────────────────────────────────── */}
      <LeadViewDialog
        lead={viewingLead}
        statuses={statuses}
        onClose={() => setViewingLead(null)}
        onRefresh={handleRefresh}
      />

      {/* ── Bulk Import Dialog ─────────────────────────────────────────── */}
      <LeadBulkImportDialog
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImported={() => {
          handleRefresh();
          setShowBulkImport(false);
        }}
      />
    </div>
  );
}