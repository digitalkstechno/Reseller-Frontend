// pages/leads/[view].tsx
// Unified Leads Page - handles both 'list' and 'kanban' views
// View is persisted in localStorage AND reflected in the URL

import { useRouter } from 'next/router';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { ListCollapse, Plus, Filter, Kanban, Search, Download, Upload } from 'lucide-react';
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
import { FormMultiSelect } from '@/components/ui/FormSelect';
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
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
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
      from: fromDate,
      to: toDate,
    }),
    [debouncedSearch, statusFilter, staffFilter, fromDate, toDate]
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

  const clearFilters = () => {
    setStatusFilter([]);
    setStaffFilter([]);
    setFromDate('');
    setToDate('');
    setSearch('');
  };

  const hasActiveFilters = !!(
    statusFilter.length > 0 ||
    staffFilter.length > 0 ||
    fromDate ||
    toDate ||
    search
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

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-full flex-col gap-4 relative">

      {/* ── Page Header & Unified Toolbar ───────────────────────────────── */}
      <div className="rounded-md border border-gray-200 bg-white px-4 md:px-6 py-4 transition-all duration-300">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Leads</h1>
            
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

          {/* Search Bar */}
          <div className="w-full md:flex-1 md:max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-3 md:ml-auto">
            {/* Tab Toggle (All/My) */}
            {/* {canReadAll && canReadOwn && (
              <div className="flex items-center bg-gray-100 p-1 rounded-md">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all ${activeTab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveTab('my')}
                  className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all ${activeTab === 'my' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  My
                </button>
              </div>
            )} */}

            {/* Advanced Filter Button */}
            <button
              onClick={() => setShowFilterDrawer(!showFilterDrawer)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-all cursor-pointer ${showFilterDrawer || hasActiveFilters
                  ? 'bg-primary-50 text-primary-600 border border-primary-200 hover:bg-primary-100'
                  : 'bg-gray-100 text-gray-700 border border-transparent hover:bg-gray-200'
                }`}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {hasActiveFilters && (
                <span className="h-2 w-2 bg-primary-500 rounded-full"></span>
              )}
            </button>

            {/* Excel Export Button */}
            <button
              onClick={handleExport}
              disabled={exporting}
              title="Export to Excel"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-xs md:text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{exporting ? '...' : 'Export'}</span>
            </button>

            {/* Bulk Import Button */}
            {canCreate && (
              <button
                onClick={() => setShowBulkImport(true)}
                title="Bulk Import Leads"
                className="flex items-center gap-2 px-3 py-2 rounded-md text-xs md:text-sm font-medium bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-all cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Import</span>
              </button>
            )}

            {/* Desktop View toggle */}
            {userRole !== 'admin' && (
            <div className="hidden md:flex relative items-center bg-gray-100 p-1 rounded-md w-fit">
              <button
                onClick={() => switchView('list')}
                className={`relative z-10 cursor-pointer flex items-center justify-center w-10 h-10 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[#3B82F6] text-white shadow-sm' : 'text-gray-700'}`}
                title="List View"
              >
                <ListCollapse className="h-5 w-5" />
              </button>
              <button
                onClick={() => switchView('kanban')}
                className={`relative z-10 cursor-pointer flex items-center justify-center w-10 h-10 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-[#3B82F6] text-white shadow-sm' : 'text-gray-700'}`}
                title="Kanban View"
              >
                <Kanban className="h-5 w-5" />
              </button>
            </div>
            )}

            {/* Add Lead button */}
            {canCreate && (
              <button
                onClick={handleOpenAdd}
                className="flex cursor-pointer items-center gap-2 rounded-md bg-[#3B82F6] px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" />
                Add Lead
              </button>
            )}
          </div>
        </div>

        {/* ── Filter Section (Inline Expandable) ────────────────────────────── */}
        <div
          className={`grid transition-all duration-300 ease-in-out ${showFilterDrawer
              ? 'grid-rows-[1fr] opacity-100 mt-4 pt-4 border-t border-gray-100'
              : 'grid-rows-[0fr] opacity-0 overflow-hidden'
            }`}
        >
          <div className="overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {userRole !== 'admin' && (
              <div className="space-y-2">
                <FormMultiSelect
                  label="Lead Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e)}
                  options={statuses.map((s) => ({ value: s._id, label: s.name }))}
                />
              </div>
              )}
      

              <div className="space-y-2">
                <label className="block mb-1.5 text-sm font-medium text-gray-700">From Date</label>
                <DatePicker
                  value={fromDate}
                  onChange={(val) => setFromDate(val)}
                  placeholder="Select from date"
                />
              </div>

              <div className="space-y-2">
                <label className="block mb-1.5 text-sm font-medium text-gray-700">To Date</label>
                <DatePicker
                  value={toDate}
                  onChange={(val) => setToDate(val)}
                  placeholder="Select to date"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={clearFilters}
                className="px-4 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-all cursor-pointer"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowFilterDrawer(false)}
                className="px-4 py-1.5 text-xs font-bold text-secondary bg-blue-50 hover:bg-blue-100 rounded-md transition-all cursor-pointer"
              >
                Collapse
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1">
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