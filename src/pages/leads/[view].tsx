// pages/leads/[view].tsx
// Unified Leads Page - handles both 'list' and 'kanban' views
// View is persisted in localStorage AND reflected in the URL

import { useRouter } from 'next/router';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [projectsList, setProjectsList] = useState<{ _id: string; name: string }[]>([]);
  
  // Temporary state for the filter popover
  const [tempStatusFilter, setTempStatusFilter] = useState<string[]>([]);
  const [tempStaffFilter, setTempStaffFilter] = useState<string[]>([]);
  const [tempResellerFilter, setTempResellerFilter] = useState<string[]>([]);
  const [tempProjectFilter, setTempProjectFilter] = useState<string[]>([]);
  const [tempPaymentStatusFilter, setTempPaymentStatusFilter] = useState('');
  const [tempFromDate, setTempFromDate] = useState('');
  const [tempToDate, setTempToDate] = useState('');
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const filterContainerRef = useRef<HTMLDivElement>(null);

  // Close filter popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!showFilterPopover) return;
      const target = e.target as HTMLElement;
      if (
        filterContainerRef.current &&
        !filterContainerRef.current.contains(target) &&
        !target.closest('[data-datepicker-popup="true"]') &&
        !target.closest('[id^="portal-"]') &&
        !target.closest('.react-datepicker')
      ) {
        setShowFilterPopover(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showFilterPopover]);

  // Sync temp state when opening popover
  useEffect(() => {
    if (showFilterPopover) {
      setTempStatusFilter(statusFilter);
      setTempStaffFilter(staffFilter);
      setTempResellerFilter(resellerFilter);
      setTempProjectFilter(projectFilter);
      setTempPaymentStatusFilter(paymentStatusFilter);
      setTempFromDate(fromDate);
      setTempToDate(toDate);
    }
  }, [showFilterPopover, statusFilter, staffFilter, resellerFilter, projectFilter, paymentStatusFilter, fromDate, toDate]);

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

  // ── Fetch permissions & projects ─────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const lp = rawPerms?.lead || {};
    setLeadPermissions(lp);
    if (userRole !== 'project_manager' && userRole !== 'projectmanager' && userRole !== 'admin') {
      if (!lp.readAll && lp.readOwn) setActiveTab('my');
    }

    axios.get(`${baseUrl.getAllProjects}?all=true`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      const data = res.data?.data || res.data?.projects || res.data || [];
      if (Array.isArray(data)) setProjectsList(data);
    })
    .catch(err => console.error('Failed to fetch projects for filter:', err));
  }, [token, rawPerms, userRole]);

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      status: statusFilter.length > 0 ? statusFilter.join(',') : '',
      staff: staffFilter.length > 0 ? staffFilter.join(',') : '',
      reseller: resellerFilter.length > 0 ? resellerFilter.join(',') : '',
      project: projectFilter.length > 0 ? projectFilter.join(',') : '',
      paymentStatus: paymentStatusFilter,
      from: fromDate,
      to: toDate,
    }),
    [debouncedSearch, statusFilter, staffFilter, resellerFilter, projectFilter, paymentStatusFilter, fromDate, toDate]
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
    fetchLostLeads,
    fetchWonLeads,
    fetchCounts,
    findLeadById,
    listPagination,
    lostPagination,
    wonPagination,
  } = useLeadsData(activeTab, filters, viewMode, kanbanSubView);

  const handleRefresh = useCallback(() => {
    refetchAll();
    setRefreshTrigger(prev => prev + 1);
  }, [refetchAll]);

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
  const isPM = userRole === 'project_manager' || userRole === 'projectmanager' || userRole.includes('project');
  const canCreate = isPM ? false : leadPermissions?.create !== false;
  const canRead = isPM ? true : (leadPermissions?.readAll || leadPermissions?.readOwn) !== false;
  const canReadAll = isPM ? true : leadPermissions?.readAll !== false;
  const canReadOwn = leadPermissions?.readOwn !== false;
  const canUpdate = isPM ? false : leadPermissions?.update !== false;
  const canDelete = isPM ? false : leadPermissions?.delete !== false;
  const canAssign = isPM ? false : leadPermissions?.assign !== false;
  const canTransfer = isPM ? false : leadPermissions?.transfer !== false;
  const canConvert = isPM ? false : leadPermissions?.convert !== false;

  const handleApplyFilters = () => {
    setStatusFilter(tempStatusFilter);
    setStaffFilter(tempStaffFilter);
    setResellerFilter(tempResellerFilter);
    setProjectFilter(tempProjectFilter);
    setPaymentStatusFilter(tempPaymentStatusFilter);
    setFromDate(tempFromDate);
    setToDate(tempToDate);
    setShowFilterPopover(false);

    const updatedFilters = {
      search: debouncedSearch,
      status: tempStatusFilter.length > 0 ? tempStatusFilter.join(',') : '',
      staff: tempStaffFilter.length > 0 ? tempStaffFilter.join(',') : '',
      reseller: tempResellerFilter.length > 0 ? tempResellerFilter.join(',') : '',
      project: tempProjectFilter.length > 0 ? tempProjectFilter.join(',') : '',
      paymentStatus: tempPaymentStatusFilter,
      from: tempFromDate,
      to: tempToDate,
    };
    if (viewMode === 'list') {
      fetchLeadsList(activeTab, updatedFilters, 1);
    } else {
      if (kanbanSubView === 'lost') fetchLostLeads(activeTab, updatedFilters, 1);
      if (kanbanSubView === 'won') fetchWonLeads(activeTab, updatedFilters, 1);
    }
    fetchCounts(activeTab, updatedFilters);
  };

  const handleClearFilters = () => {
    setTempStatusFilter([]);
    setTempStaffFilter([]);
    setTempResellerFilter([]);
    setTempProjectFilter([]);
    setTempPaymentStatusFilter('');
    setTempFromDate('');
    setTempToDate('');
    setStatusFilter([]);
    setStaffFilter([]);
    setResellerFilter([]);
    setProjectFilter([]);
    setPaymentStatusFilter('');
    setFromDate('');
    setToDate('');
    setSearch('');
    setShowFilterPopover(false);

    const clearedFilters = {
      search: '',
      status: '',
      staff: '',
      reseller: '',
      project: '',
      paymentStatus: '',
      from: '',
      to: '',
    };
    if (viewMode === 'list') {
      fetchLeadsList(activeTab, clearedFilters, 1);
    } else {
      if (kanbanSubView === 'lost') fetchLostLeads(activeTab, clearedFilters, 1);
      if (kanbanSubView === 'won') fetchWonLeads(activeTab, clearedFilters, 1);
    }
    fetchCounts(activeTab, clearedFilters);
  };

  const hasActiveFilters = !!(
    statusFilter.length > 0 || staffFilter.length > 0 || resellerFilter.length > 0 || projectFilter.length > 0 || paymentStatusFilter || fromDate || toDate || search
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
      <div ref={filterContainerRef} className="relative">
        <button
          onClick={() => setShowFilterPopover(!showFilterPopover)}
          className={`inline-flex items-center justify-center h-10 w-10 rounded-xl border transition-all duration-200 cursor-pointer ${
            showFilterPopover || hasActiveFilters
              ? 'bg-blue-50 text-[#3B82F6] border-blue-200 shadow-sm'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
          }`}
          title="Filter Leads"
        >
          <Filter className="h-4 w-4" />
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#3B82F6] border-2 border-white"></span>
            </span>
          )}
        </button>

        {showFilterPopover && (
          <div className="absolute right-0 top-full mt-2 w-[340px] sm:w-[370px] bg-white rounded-2xl shadow-2xl border border-gray-200/90 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-100/60 text-[#3B82F6]">
                  <Filter className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-bold text-gray-800">Filter Leads</h3>
              </div>
              <button
                onClick={() => setShowFilterPopover(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200/60 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filter Fields */}
            <div className="p-4 space-y-3.5 max-h-[72vh] overflow-y-auto custom-scrollbar">
              <div>
                <FormMultiSelect
                  label="Lead Status"
                  value={tempStatusFilter}
                  onChange={setTempStatusFilter}
                  options={statuses.map((s) => ({ value: s._id, label: s.name }))}
                />
              </div>

              {(userRole === 'admin' || isPM) && (
                <div>
                  <FormMultiSelect
                    label="Reseller"
                    value={tempResellerFilter}
                    onChange={setTempResellerFilter}
                    options={staffMembers.map((s) => ({ value: s._id, label: s.fullName }))}
                  />
                </div>
              )}

              <div>
                <FormMultiSelect
                  label="Project"
                  value={tempProjectFilter}
                  onChange={setTempProjectFilter}
                  options={projectsList.map((p) => ({ value: p._id, label: p.name }))}
                />
              </div>

              <div>
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

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 px-1">Date Range</label>
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

            {/* Footer Buttons */}
            <div className="p-3.5 border-t border-gray-100 bg-gray-50/80 flex items-center gap-2.5">
              <button
                onClick={handleClearFilters}
                className="flex-1 py-2 px-3 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 active:scale-95 transition-all cursor-pointer shadow-sm"
              >
                Clear All
              </button>
              <button
                onClick={handleApplyFilters}
                className="flex-1 py-2 px-3 text-xs font-bold text-white bg-[#3B82F6] rounded-xl hover:bg-blue-600 active:scale-95 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                Apply Filters
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
    <div className="flex flex-col h-full relative">

      {/* ── Page Header & Unified Toolbar ───────────────────────────────── */}
      <div className="bg-gradient-to-r from-gray-50 via-white to-gray-50 border-b border-gray-200 px-3 py-2.5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Mobile View Toggle */}
            {userRole !== 'admin' && (
              <div className="md:hidden relative flex items-center bg-gray-100 p-1 rounded-lg w-fit border border-gray-200">
                <button
                  onClick={() => switchView('list')}
                  className={`relative z-10 cursor-pointer flex items-center justify-center w-8 h-8 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[#3B82F6] text-white shadow-sm' : 'text-gray-700'}`}
                >
                  <ListCollapse className="h-4 w-4" />
                </button>
                <button
                  onClick={() => switchView('kanban')}
                  className={`relative z-10 cursor-pointer flex items-center justify-center w-8 h-8 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-[#3B82F6] text-white shadow-sm' : 'text-gray-700'}`}
                >
                  <Kanban className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Kanban Sub-View Tabs (Board / Lost / Won) placed cleanly in the top toolbar */}
            {viewMode === 'kanban' && (
              <div className="flex items-center bg-gray-100/90 p-1 rounded-xl border border-gray-200/80 shadow-2xs gap-1">
                {(['board', 'lost', 'won'] as KanbanSubView[]).map((v) => {
                  let boardCount = 0;
                  let lostCount = 0;
                  let wonCount = 0;

                  if (Array.isArray(counts?.statusWiseCounts)) {
                    (counts.statusWiseCounts as any[]).forEach((s: any) => {
                      if (s.statusName?.match(/^won$/i)) {
                        wonCount += s.count;
                      } else if (s.statusName?.match(/^lost$/i)) {
                        lostCount += s.count;
                      } else {
                        boardCount += s.count;
                      }
                    });
                  } else {
                    lostCount = lostPagination?.totalItems ?? lostLeads?.length ?? 0;
                    wonCount = wonPagination?.totalItems ?? wonLeads?.length ?? 0;
                  }

                  let label = '';
                  let countVal = 0;
                  if (v === 'board') {
                    label = 'Board View';
                    countVal = boardCount;
                  } else if (v === 'lost') {
                    label = 'Lost Leads';
                    countVal = lostCount;
                  } else {
                    label = 'Won Leads';
                    countVal = wonCount;
                  }

                  const isActive = kanbanSubView === v;

                  return (
                    <button
                      key={v}
                      onClick={() => setKanbanSubView(v)}
                      className={`cursor-pointer px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 flex items-center gap-1.5 ${
                        isActive
                          ? v === 'lost'
                            ? 'bg-red-600 text-white shadow-sm'
                            : v === 'won'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-[#3B82F6] text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                      }`}
                    >
                      <span>{label}</span>
                      <span
                        className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                          isActive
                            ? 'bg-white/25 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {countVal}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-3 md:ml-auto">
            {headerActions}

            {/* Desktop View toggle */}
            {userRole !== 'admin' && (
              <div className="hidden md:flex relative items-center bg-gray-100 p-1 rounded-xl border border-gray-200/80 h-10 w-fit">
                <button
                  onClick={() => switchView('list')}
                  className={`relative z-10 cursor-pointer flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-[#3B82F6] text-white shadow-sm font-semibold' : 'text-gray-600 hover:bg-gray-200/70 hover:text-gray-900'}`}
                  title="List View"
                >
                  <ListCollapse className="h-4 w-4" />
                </button>
                <button
                  onClick={() => switchView('kanban')}
                  className={`relative z-10 cursor-pointer flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${viewMode === 'kanban' ? 'bg-[#3B82F6] text-white shadow-sm font-semibold' : 'text-gray-600 hover:bg-gray-200/70 hover:text-gray-900'}`}
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
                className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-5 h-10 text-sm font-semibold text-white shadow-md hover:bg-blue-600 active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" />
                Add Lead
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col p-3">
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
            headerActions={undefined}
          />
        ) : (
          <LeadsKanbanView
            leads={leads}
            lostLeads={lostLeads}
            wonLeads={wonLeads}
            statuses={statuses}
            counts={counts?.statusCounts}
            summary={counts}
            subView={kanbanSubView}
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
        onEdit={(lead) => {
          setViewingLead(null);
          handleEdit(lead);
        }}
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