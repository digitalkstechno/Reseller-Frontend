// components/leads/useLeadsData.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { ApiLead, ApiStatus, ApiUser, LeadCountSummary } from './types';

type Filters = {
  search?: string;
  status?: string;
  staff?: string;
  from?: string;
  to?: string;
};

export function useLeadsData(
  activeTab: 'all' | 'my' = 'all',
  filters: Filters = {},
  viewMode: 'list' | 'kanban' = 'list',
  kanbanSubView: 'board' | 'lost' | 'won' = 'board'
) {
  const [leads, setLeads] = useState<ApiLead[]>([]);
  const [leadsList, setLeadsList] = useState<ApiLead[]>([]);
  const [lostLeads, setLostLeads] = useState<ApiLead[]>([]);
  const [wonLeads, setWonLeads] = useState<ApiLead[]>([]);

  const [statuses, setStatuses] = useState<ApiStatus[]>([]);
  const [staffMembers, setStaffMembers] = useState<ApiUser[]>([]);

  const [counts, setCounts] = useState<LeadCountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState({
    create: false, update: false, delete: false, readAll: false, readOwn: false,
  });

  // List pagination
  const [listPage, setListPage] = useState(1);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [listTotalItems, setListTotalItems] = useState(0);

  // Lost pagination
  const [lostPage, setLostPage] = useState(1);
  const [lostTotalPages, setLostTotalPages] = useState(1);
  const [lostTotalItems, setLostTotalItems] = useState(0);

  // Won pagination
  const [wonPage, setWonPage] = useState(1);
  const [wonTotalPages, setWonTotalPages] = useState(1);
  const [wonTotalItems, setWonTotalItems] = useState(0);

  const LIMIT = 10;

  const getHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` });

  const getUserRole = useCallback((): string => {
    if (typeof window === 'undefined') return '';
    const token = getAuthToken();
    if (!token) return '';
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(window.atob(parts[1]));
        return payload?.role?.roleName?.toLowerCase() || '';
      }
    } catch (e) {
      console.error('Failed to parse token payload:', e);
    }
    return '';
  }, []);

  const getLeadsUrl = useCallback((tab: string) => {
    const role = getUserRole();
    if (role === 'reseller') return baseUrl.myLeads;
    if (role === 'admin') return baseUrl.getAllLeads;
    return tab === 'my' ? baseUrl.myLeads : baseUrl.getAllLeads;
  }, [getUserRole]);

  const getLeadsCountUrl = useCallback((tab: string) => {
    const role = getUserRole();
    if (role === 'reseller') return baseUrl.myLeadCountSummary;
    if (role === 'admin') return baseUrl.leadCountSummary;
    return tab === 'my' ? baseUrl.myLeadCountSummary : baseUrl.leadCountSummary;
  }, [getUserRole]);

  // Keep latest values in a ref so callbacks always read fresh values
  const stateRef = useRef({
    activeTab, filters, viewMode, kanbanSubView,
    listPage, lostPage, wonPage,
  });
  useEffect(() => {
    stateRef.current = {
      activeTab, filters, viewMode, kanbanSubView,
      listPage, lostPage, wonPage,
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH FUNCTIONS — accept explicit params so they never use stale closures
  // ─────────────────────────────────────────────────────────────────────────

  const fetchKanbanLeads = useCallback(async (
    tab = stateRef.current.activeTab,
    f: Filters = stateRef.current.filters
  ) => {
    try {
      const useKanbanEndpoint = !!baseUrl.getKanbanData;

      if (useKanbanEndpoint) {
        const res = await axios.get(baseUrl.getKanbanData, {
          headers: getHeaders(),
          params: {
            my: (tab === 'my' || getUserRole() === 'reseller') ? true : undefined,
            search: f.search || undefined,
            status: f.status || undefined,
            staff: f.staff || undefined,
            from: f.from || undefined,
            to: f.to || undefined,
            limit: LIMIT,
          },
        });

        const data = res.data?.data;

        if (Array.isArray(data)) {
          // Shape A: grouped → [{ leads: [...] }, ...]
          // Shape B: flat array of leads
          const isGrouped = data.length > 0 && Array.isArray((data[0] as any)?.leads);
          setLeads(isGrouped ? (data as any[]).flatMap((g: any) => g.leads || []) : (data as ApiLead[]));
        } else {
          setLeads([]);
        }
      } else {
        // Fallback: no dedicated kanban endpoint
        const url = getLeadsUrl(tab);
        const res = await axios.get(url, {
          headers: getHeaders(),
          params: {
            search: f.search || undefined,
            status: f.status || undefined,
            staff: f.staff || undefined,
            from: f.from || undefined,
            to: f.to || undefined,
            limit: 100,
          },
        });
        setLeads(res.data?.data || []);
      }
    } catch (e) {
      console.error('fetchKanbanLeads error:', e);
      setLeads([]);
    }
  }, [getLeadsUrl, getUserRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLeadsList = useCallback(async (
    tab = stateRef.current.activeTab,
    f: Filters = stateRef.current.filters,
    page = stateRef.current.listPage
  ) => {
    try {
      const url = getLeadsUrl(tab);
      const res = await axios.get(url, {
        headers: getHeaders(),
        params: {
          search: f.search || undefined,
          status: f.status || undefined,
          staff: f.staff || undefined,
          from: f.from || undefined,
          to: f.to || undefined,
          page,
          limit: LIMIT,
        },
      });
      const arr = res.data?.data || [];
      const p = res.data?.pagination || {};
      setLeadsList(arr);
      setListTotalItems(p.totalRecords ?? p.total ?? p.count ?? arr.length);
      setListTotalPages(p.totalPages ?? (p.totalRecords ? Math.ceil(p.totalRecords / LIMIT) : 1));
    } catch (e) {
      console.error('fetchLeadsList error:', e);
      setLeadsList([]);
    }
  }, [getLeadsUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLostLeads = useCallback(async (
    tab = stateRef.current.activeTab,
    f: Filters = stateRef.current.filters,
    page = stateRef.current.lostPage
  ) => {
    try {
      const res = await axios.get(baseUrl.getLostLeads, {
        headers: getHeaders(),
        params: {
          my: (tab === 'my' || getUserRole() === 'reseller') ? true : undefined,
          search: f.search || undefined,
          status: f.status || undefined,
          staff: f.staff || undefined,
          from: f.from || undefined,
          to: f.to || undefined,
          page,
          limit: LIMIT,
        },
      });
      const raw = res.data?.data;
      const arr: ApiLead[] = Array.isArray(raw) ? raw : (raw?.data || []);
      const p = res.data?.pagination || {};
      setLostLeads(arr);
      setLostTotalItems(p.totalRecords ?? p.total ?? p.count ?? arr.length);
      setLostTotalPages(p.totalPages ?? (p.totalRecords ? Math.ceil(p.totalRecords / LIMIT) : 1));
    } catch (e) {
      console.error('fetchLostLeads error:', e);
      setLostLeads([]);
    }
  }, [getUserRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchWonLeads = useCallback(async (
    tab = stateRef.current.activeTab,
    f: Filters = stateRef.current.filters,
    page = stateRef.current.wonPage
  ) => {
    try {
      const res = await axios.get(baseUrl.getWonLeads, {
        headers: getHeaders(),
        params: {
          my: (tab === 'my' || getUserRole() === 'reseller') ? true : undefined,
          search: f.search || undefined,
          status: f.status || undefined,
          staff: f.staff || undefined,
          from: f.from || undefined,
          to: f.to || undefined,
          page,
          limit: LIMIT,
        },
      });
      const raw = res.data?.data;
      const arr: ApiLead[] = Array.isArray(raw) ? raw : (raw?.data || []);
      const p = res.data?.pagination || {};
      setWonLeads(arr);
      setWonTotalItems(p.totalRecords ?? p.total ?? p.count ?? arr.length);
      setWonTotalPages(p.totalPages ?? (p.totalRecords ? Math.ceil(p.totalRecords / LIMIT) : 1));
    } catch (e) {
      console.error('fetchWonLeads error:', e);
      setWonLeads([]);
    }
  }, [getUserRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCounts = useCallback(async (
    tab = stateRef.current.activeTab,
    f: Filters = stateRef.current.filters
  ) => {
    try {
      const url = getLeadsCountUrl(tab);
      const res = await axios.get(url, {
        headers: getHeaders(),
        params: {
          search: f.search || undefined,
          status: f.status || undefined,
          staff: f.staff || undefined,
          from: f.from || undefined,
          to: f.to || undefined,
        },
      });
      setCounts(res.data?.data || null);
    } catch (e) {
      console.error('fetchCounts error:', e);
    }
  }, [getLeadsCountUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMeta = useCallback(async () => {
    try {
      const [stRes, staffRes, meRes] = await Promise.all([
        axios.get(baseUrl.leadStatuses, { headers: getHeaders() }),
        axios.get(baseUrl.getAllStaff, { headers: getHeaders() }).catch(() => ({ data: { data: [] } })),
        axios.get(baseUrl.currentStaff, { headers: getHeaders() }),
      ]);
      setStatuses(stRes.data?.data ?? stRes.data ?? []);
      setStaffMembers(staffRes.data?.data ?? staffRes.data ?? []);
      const role = meRes.data?.data?.role || {};
      const rawPerms = Array.isArray(role.permissions) ? role.permissions[0] : role.permissions || {};
      const lp = rawPerms.lead || {};
      setPermissions({
        create: !!lp.create, update: !!lp.update, delete: !!lp.delete,
        readAll: !!lp.readAll, readOwn: !!lp.readOwn,
      });
    } catch (e) {
      console.error('fetchMeta error:', e);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // refetchAll — always reads latest values from ref, no stale closures
  // ─────────────────────────────────────────────────────────────────────────
  const refetchAll = useCallback(async () => {
    const { activeTab: tab, filters: f, viewMode: vm, kanbanSubView: ksv,
      listPage: lp, lostPage: lsp, wonPage: wp } = stateRef.current;

    if (vm === 'list') {
      await Promise.all([fetchLeadsList(tab, f, lp), fetchCounts(tab, f)]);
    } else {
      const calls: Promise<void>[] = [
        fetchKanbanLeads(tab, f),
        fetchCounts(tab, f),
      ];
      if (ksv === 'lost') calls.push(fetchLostLeads(tab, f, lsp));
      if (ksv === 'won') calls.push(fetchWonLeads(tab, f, wp));
      await Promise.all(calls);
    }
  }, [fetchLeadsList, fetchKanbanLeads, fetchLostLeads, fetchWonLeads, fetchCounts]);

  // ─────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────────────────────────────────

  // 1. Meta — once
  useEffect(() => { fetchMeta(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Initial data load
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setLoading(true);
      if (viewMode === 'list') {
        await Promise.all([fetchLeadsList(activeTab, filters, 1), fetchCounts(activeTab, filters)]);
      } else {
        const calls: Promise<void>[] = [
          // Global Kanban fetch removed - component now fetches status-wise
          fetchCounts(activeTab, filters),
        ];
        if (kanbanSubView === 'lost') calls.push(fetchLostLeads(activeTab, filters, 1));
        if (kanbanSubView === 'won') calls.push(fetchWonLeads(activeTab, filters, 1));
        await Promise.all(calls);
      }
      if (!cancelled) setLoading(false);
    };
    init();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 3. Re-fetch when viewMode / activeTab / filters change
  const prevKey = useRef('');
  useEffect(() => {
    const key = JSON.stringify({ viewMode, activeTab, filters });
    if (key === prevKey.current) return;
    prevKey.current = key;

    setListPage(1);
    setLostPage(1);
    setWonPage(1);

    if (viewMode === 'list') {
      fetchLeadsList(activeTab, filters, 1);
      fetchCounts(activeTab, filters);
    } else {
      // fetchKanbanLeads(activeTab, filters); // Status-wise fetching handled by component
      fetchCounts(activeTab, filters);
      if (kanbanSubView === 'lost') fetchLostLeads(activeTab, filters, 1);
      if (kanbanSubView === 'won') fetchWonLeads(activeTab, filters, 1);
    }
  }, [viewMode, activeTab, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // 4. Kanban sub-view changed
  const prevSubView = useRef(kanbanSubView);
  useEffect(() => {
    if (prevSubView.current === kanbanSubView) return;
    prevSubView.current = kanbanSubView;
    if (viewMode !== 'kanban') return;
    // if (kanbanSubView === 'board') fetchKanbanLeads(activeTab, filters); // Handled by component
    if (kanbanSubView === 'lost') fetchLostLeads(activeTab, filters, lostPage);
    if (kanbanSubView === 'won') fetchWonLeads(activeTab, filters, wonPage);
  }, [kanbanSubView]); // eslint-disable-line react-hooks/exhaustive-deps

  // 5. List page change
  const prevListPage = useRef(listPage);
  useEffect(() => {
    if (prevListPage.current === listPage) return;
    prevListPage.current = listPage;
    if (viewMode === 'list') fetchLeadsList(activeTab, filters, listPage);
  }, [listPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // 6. Lost page change
  const prevLostPage = useRef(lostPage);
  useEffect(() => {
    if (prevLostPage.current === lostPage) return;
    prevLostPage.current = lostPage;
    if (viewMode === 'kanban' && kanbanSubView === 'lost') fetchLostLeads(activeTab, filters, lostPage);
  }, [lostPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // 7. Won page change
  const prevWonPage = useRef(wonPage);
  useEffect(() => {
    if (prevWonPage.current === wonPage) return;
    prevWonPage.current = wonPage;
    if (viewMode === 'kanban' && kanbanSubView === 'won') fetchWonLeads(activeTab, filters, wonPage);
  }, [wonPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────

  const findLeadById = useCallback(
    (id: string) =>
      leads.find(l => l._id === id) ||
      leadsList.find(l => l._id === id) ||
      lostLeads.find(l => l._id === id) ||
      wonLeads.find(l => l._id === id),
    [leads, leadsList, lostLeads, wonLeads]
  );

  return {
    leads, setLeads,
    leadsList, setLeadsList,
    lostLeads, wonLeads,
    statuses, staffMembers,
    counts, loading, permissions,
    refetchAll,
    fetchLeadsList,
    fetchKanbanLeads,
    findLeadById,

    listPagination: {
      currentPage: listPage,
      rowsPerPage: LIMIT,
      totalPages: listTotalPages,
      totalItems: listTotalItems,
      handlePageChange: (p: number) => setListPage(p),
      handleRowsPerPageChange: (_: number) => setListPage(1),
    },
    lostPagination: {
      currentPage: lostPage,
      rowsPerPage: LIMIT,
      totalPages: lostTotalPages,
      totalItems: lostTotalItems,
      handlePageChange: (p: number) => setLostPage(p),
      handleRowsPerPageChange: (_: number) => setLostPage(1),
    },
    wonPagination: {
      currentPage: wonPage,
      rowsPerPage: LIMIT,
      totalPages: wonTotalPages,
      totalItems: wonTotalItems,
      handlePageChange: (p: number) => setWonPage(p),
      handleRowsPerPageChange: (_: number) => setWonPage(1),
    },
    pagination: {
      currentPage: listPage,
      rowsPerPage: LIMIT,
      totalPages: listTotalPages,
      totalItems: listTotalItems,
      handlePageChange: (p: number) => setListPage(p),
      handleRowsPerPageChange: (_: number) => setListPage(1),
    },
  };
}