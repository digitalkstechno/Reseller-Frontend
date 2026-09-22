// components/leads/useLeadsData.ts

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { ApiLead, ApiStatus, ApiUser, LeadCountSummary } from './types';

// Abort ref helper — cancels previous request if a new one starts
const createAbort = (ref: React.MutableRefObject<AbortController | null>) => {
  if (ref.current) ref.current.abort();
  ref.current = new AbortController();
  return ref.current.signal;
};

type Filters = {
  search?: string;
  status?: string;
  staff?: string;
  from?: string;
  to?: string;
  paymentStatus?: string;
  reseller?: string;
  managedBy?: string;
  project?: string;
};

export type LeadStageTab = 'all' | 'new_lead' | 'won' | 'lost';

export function useLeadsData(
  activeTab: 'all' | 'my' = 'all',
  filters: Filters = {},
  viewMode: 'list' | 'kanban' = 'list',
  kanbanSubView: 'board' | 'lost' | 'won' = 'won',
  leadStageTab: LeadStageTab = 'won'
) {
  const { permissions: rawPerms } = useSelector((state: any) => state.auth);
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

  const [limit, setLimit] = useState(20);

  const getHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` });

  // Abort controller refs — one per concurrent fetch type
  const abortListRef = useRef<AbortController | null>(null);
  const abortLostRef = useRef<AbortController | null>(null);
  const abortWonRef = useRef<AbortController | null>(null);
  const abortKanbanRef = useRef<AbortController | null>(null);
  const abortCountsRef = useRef<AbortController | null>(null);


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
    if (role === 'admin' || role === 'project_manager' || role === 'projectmanager') return baseUrl.getAllLeads;
    return tab === 'my' ? baseUrl.myLeads : baseUrl.getAllLeads;
  }, [getUserRole]);

  const getLeadsCountUrl = useCallback((tab: string) => {
    const role = getUserRole();
    if (role === 'reseller') return baseUrl.myLeadCountSummary;
    if (role === 'admin' || role === 'project_manager' || role === 'projectmanager') return baseUrl.leadCountSummary;
    return tab === 'my' ? baseUrl.myLeadCountSummary : baseUrl.leadCountSummary;
  }, [getUserRole]);

  // Keep latest values in a ref so callbacks always read fresh values
  const stateRef = useRef({
    activeTab, filters, viewMode, kanbanSubView, leadStageTab,
    listPage, lostPage, wonPage, limit,
  });
  useEffect(() => {
    stateRef.current = {
      activeTab, filters, viewMode, kanbanSubView, leadStageTab,
      listPage, lostPage, wonPage, limit,
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH FUNCTIONS — accept explicit params so they never use stale closures
  // ─────────────────────────────────────────────────────────────────────────

  const fetchKanbanLeads = useCallback(async (
    tab = stateRef.current.activeTab,
    f: Filters = stateRef.current.filters
  ) => {
    const signal = createAbort(abortKanbanRef);
    try {
      const useKanbanEndpoint = !!baseUrl.getKanbanData;
      const role = getUserRole();

      if (useKanbanEndpoint) {
        const res = await axios.get(baseUrl.getKanbanData, {
          headers: getHeaders(),
          signal,
          params: {
            my: (tab === 'my' && role !== 'project_manager' && role !== 'projectmanager') || role === 'reseller' ? true : undefined,
            search: f.search || undefined,
            status: f.status || undefined,
            staff: f.staff || undefined,
            reseller: f.reseller || undefined,
            managedBy: f.managedBy || undefined,
            project: f.project || undefined,
            paymentStatus: f.paymentStatus || undefined,
            from: f.from || undefined,
            to: f.to || undefined,
            limit: stateRef.current.limit,
          },
        });

        const data = res.data?.data;

        if (Array.isArray(data)) {
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
          signal,
          params: {
            search: f.search || undefined,
            status: f.status || undefined,
            staff: f.staff || undefined,
            reseller: f.reseller || undefined,
            managedBy: f.managedBy || undefined,
            project: f.project || undefined,
            paymentStatus: f.paymentStatus || undefined,
            from: f.from || undefined,
            to: f.to || undefined,
            limit: 100,
          },
        });
        setLeads(res.data?.data || []);
      }
    } catch (e: any) {
      if (axios.isCancel(e) || e?.name === 'CanceledError') return;
      console.error('fetchKanbanLeads error:', e);
      setLeads([]);
    }
  }, [getLeadsUrl, getUserRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLeadsListId = useRef(0);

  const fetchLeadsList = useCallback(async (
    tab = stateRef.current.activeTab,
    f: Filters = stateRef.current.filters,
    page = stateRef.current.listPage
  ) => {
    const signal = createAbort(abortListRef);
    try {
      const url = getLeadsUrl(tab);
      const res = await axios.get(url, {
        headers: getHeaders(),
        signal,
        params: {
          search: f.search || undefined,
          status: f.status || undefined,
          staff: f.staff || undefined,
          reseller: f.reseller || undefined,
          managedBy: f.managedBy || undefined,
          project: f.project || undefined,
          paymentStatus: f.paymentStatus || undefined,
          from: f.from || undefined,
          to: f.to || undefined,
          page,
          limit: stateRef.current.limit,
        },
      });
      const arr = res.data?.data || [];
      const p = res.data?.pagination || {};
      setLeadsList(arr);
      setListTotalItems(p.totalRecords ?? p.total ?? p.count ?? arr.length);
      setListTotalPages(p.totalPages ?? (p.totalRecords ? Math.ceil(p.totalRecords / stateRef.current.limit) : 1));
    } catch (e: any) {
      if (axios.isCancel(e) || e?.name === 'CanceledError') return;
      console.error('fetchLeadsList error:', e);
      setLeadsList([]);
    }
  }, [getLeadsUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLostLeads = useCallback(async (
    tab = stateRef.current.activeTab,
    f: Filters = stateRef.current.filters,
    page = stateRef.current.lostPage
  ) => {
    const signal = createAbort(abortLostRef);
    try {
      const role = getUserRole();
      const res = await axios.get(baseUrl.getLostLeads, {
        headers: getHeaders(),
        signal,
        params: {
          my: (tab === 'my' && role !== 'project_manager' && role !== 'projectmanager') || role === 'reseller' ? true : undefined,
          search: f.search || undefined,
          status: f.status || undefined,
          staff: f.staff || undefined,
          reseller: f.reseller || undefined,
          managedBy: f.managedBy || undefined,
          project: f.project || undefined,
          paymentStatus: f.paymentStatus || undefined,
          from: f.from || undefined,
          to: f.to || undefined,
          page,
          limit: stateRef.current.limit,
        },
      });
      const raw = res.data?.data;
      const arr: ApiLead[] = Array.isArray(raw) ? raw : (raw?.data || []);
      const p = res.data?.pagination || {};
      setLostLeads(arr);
      setLostTotalItems(p.totalRecords ?? p.total ?? p.count ?? arr.length);
      setLostTotalPages(p.totalPages ?? (p.totalRecords ? Math.ceil(p.totalRecords / stateRef.current.limit) : 1));
    } catch (e: any) {
      if (axios.isCancel(e) || e?.name === 'CanceledError') return;
      console.error('fetchLostLeads error:', e);
      setLostLeads([]);
    }
  }, [getUserRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchWonLeads = useCallback(async (
    tab = stateRef.current.activeTab,
    f: Filters = stateRef.current.filters,
    page = stateRef.current.wonPage
  ) => {
    const signal = createAbort(abortWonRef);
    try {
      const role = getUserRole();
      const res = await axios.get(baseUrl.getWonLeads, {
        headers: getHeaders(),
        signal,
        params: {
          my: (tab === 'my' && role !== 'project_manager' && role !== 'projectmanager') || role === 'reseller' ? true : undefined,
          search: f.search || undefined,
          status: f.status || undefined,
          staff: f.staff || undefined,
          reseller: f.reseller || undefined,
          managedBy: f.managedBy || undefined,
          project: f.project || undefined,
          paymentStatus: f.paymentStatus || undefined,
          from: f.from || undefined,
          to: f.to || undefined,
          page,
          limit: stateRef.current.limit,
        },
      });
      const raw = res.data?.data;
      const arr: ApiLead[] = Array.isArray(raw) ? raw : (raw?.data || []);
      const p = res.data?.pagination || {};
      setWonLeads(arr);
      setWonTotalItems(p.totalRecords ?? p.total ?? p.count ?? arr.length);
      setWonTotalPages(p.totalPages ?? (p.totalRecords ? Math.ceil(p.totalRecords / stateRef.current.limit) : 1));
    } catch (e: any) {
      if (axios.isCancel(e) || e?.name === 'CanceledError') return;
      console.error('fetchWonLeads error:', e);
      setWonLeads([]);
    }
  }, [getUserRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCounts = useCallback(async (
    tab = stateRef.current.activeTab,
    f: Filters = stateRef.current.filters
  ) => {
    const signal = createAbort(abortCountsRef);
    try {
      const url = getLeadsCountUrl(tab);
      const res = await axios.get(url, {
        headers: getHeaders(),
        signal,
        params: {
          search: f.search || undefined,
          status: f.status || undefined,
          staff: f.staff || undefined,
          reseller: f.reseller || undefined,
          managedBy: f.managedBy || undefined,
          project: f.project || undefined,
          from: f.from || undefined,
          to: f.to || undefined,
        },
      });
      setCounts(res.data?.data || null);
    } catch (e: any) {
      if (axios.isCancel(e) || e?.name === 'CanceledError') return;
      console.error('fetchCounts error:', e);
    }
  }, [getLeadsCountUrl]);

  const fetchMeta = useCallback(async () => {
    try {
      const [stRes, staffRes] = await Promise.all([
        axios.get(baseUrl.leadStatuses, { headers: getHeaders() }),
        axios.get(baseUrl.getAllStaff, { headers: getHeaders() }).catch(() => ({ data: { data: [] } })),
      ]);
      setStatuses(stRes.data?.data ?? stRes.data ?? []);
      setStaffMembers(staffRes.data?.data ?? staffRes.data ?? []);
      
      const lp = rawPerms?.lead || {};
      setPermissions({
        create: !!lp.create, update: !!lp.update, delete: !!lp.delete,
        readAll: !!lp.readAll, readOwn: !!lp.readOwn,
      });
    } catch (e) {
      console.error('fetchMeta error:', e);
    }
  }, [rawPerms]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // refetchAll — always reads latest values from ref, no stale closures
  // ─────────────────────────────────────────────────────────────────────────
  const refetchAll = useCallback(async () => {
    const { activeTab: tab, filters: f, viewMode: vm, kanbanSubView: ksv, leadStageTab: lst,
      listPage: lp, lostPage: lsp, wonPage: wp } = stateRef.current;

    if (vm === 'list') {
      const calls: Promise<void>[] = [fetchCounts(tab, f)];
      if (lst === 'won') {
        calls.push(fetchWonLeads(tab, f, wp));
      } else if (lst === 'lost') {
        calls.push(fetchLostLeads(tab, f, lsp));
      } else {
        calls.push(fetchLeadsList(tab, f, lp));
      }
      await Promise.all(calls);
    } else {
      const calls: Promise<void>[] = [
        fetchCounts(tab, f),
      ];
      if (ksv === 'lost' || lst === 'lost') calls.push(fetchLostLeads(tab, f, lsp));
      if (ksv === 'won' || lst === 'won') calls.push(fetchWonLeads(tab, f, wp));
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
        const calls: Promise<void>[] = [fetchCounts(activeTab, filters)];
        if (leadStageTab === 'won') {
          calls.push(fetchWonLeads(activeTab, filters, 1));
        } else if (leadStageTab === 'lost') {
          calls.push(fetchLostLeads(activeTab, filters, 1));
        } else {
          calls.push(fetchLeadsList(activeTab, filters, 1));
        }
        await Promise.all(calls);
      } else {
        const calls: Promise<void>[] = [
          fetchCounts(activeTab, filters),
        ];
        if (kanbanSubView === 'lost' || leadStageTab === 'lost') calls.push(fetchLostLeads(activeTab, filters, 1));
        if (kanbanSubView === 'won' || leadStageTab === 'won') calls.push(fetchWonLeads(activeTab, filters, 1));
        await Promise.all(calls);
      }
      if (!cancelled) setLoading(false);
    };
    init();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 3. Re-fetch when viewMode / activeTab / filters / leadStageTab change
  const prevKey = useRef(JSON.stringify({ viewMode, activeTab, filters, leadStageTab }));
  useEffect(() => {
    const key = JSON.stringify({ viewMode, activeTab, filters, leadStageTab });
    if (key === prevKey.current) return;
    prevKey.current = key;

    setListPage(1);
    setLostPage(1);
    setWonPage(1);

    if (viewMode === 'list') {
      if (leadStageTab === 'won') {
        fetchWonLeads(activeTab, filters, 1);
      } else if (leadStageTab === 'lost') {
        fetchLostLeads(activeTab, filters, 1);
      } else {
        fetchLeadsList(activeTab, filters, 1);
      }
      fetchCounts(activeTab, filters);
    } else {
      fetchCounts(activeTab, filters);
      if (kanbanSubView === 'lost' || leadStageTab === 'lost') fetchLostLeads(activeTab, filters, 1);
      if (kanbanSubView === 'won' || leadStageTab === 'won') fetchWonLeads(activeTab, filters, 1);
    }
  }, [viewMode, activeTab, filters, leadStageTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // 4. Kanban sub-view changed
  const prevSubView = useRef(kanbanSubView);
  useEffect(() => {
    if (prevSubView.current === kanbanSubView) return;
    prevSubView.current = kanbanSubView;
    if (viewMode !== 'kanban') return;
    if (kanbanSubView === 'lost') fetchLostLeads(activeTab, filters, lostPage);
    if (kanbanSubView === 'won') fetchWonLeads(activeTab, filters, wonPage);
  }, [kanbanSubView]); // eslint-disable-line react-hooks/exhaustive-deps

  // 5. List page or limit change
  const prevListPage = useRef(listPage);
  const prevLimit = useRef(limit);
  useEffect(() => {
    if (prevListPage.current === listPage && prevLimit.current === limit) return;
    prevListPage.current = listPage;
    prevLimit.current = limit;
    if (viewMode === 'list') {
      if (leadStageTab === 'won') {
        fetchWonLeads(activeTab, filters, listPage);
      } else if (leadStageTab === 'lost') {
        fetchLostLeads(activeTab, filters, listPage);
      } else {
        fetchLeadsList(activeTab, filters, listPage);
      }
    }
  }, [listPage, limit, leadStageTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // 6. Lost page change
  const prevLostPage = useRef(lostPage);
  useEffect(() => {
    if (prevLostPage.current === lostPage) return;
    prevLostPage.current = lostPage;
    if (leadStageTab === 'lost' || (viewMode === 'kanban' && kanbanSubView === 'lost')) {
      fetchLostLeads(activeTab, filters, lostPage);
    }
  }, [lostPage, leadStageTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // 7. Won page change
  const prevWonPage = useRef(wonPage);
  useEffect(() => {
    if (prevWonPage.current === wonPage) return;
    prevWonPage.current = wonPage;
    if (leadStageTab === 'won' || (viewMode === 'kanban' && kanbanSubView === 'won')) {
      fetchWonLeads(activeTab, filters, wonPage);
    }
  }, [wonPage, leadStageTab]); // eslint-disable-line react-hooks/exhaustive-deps

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
    fetchLostLeads,
    fetchWonLeads,
    fetchCounts,
    findLeadById,

    listPagination: {
      currentPage: listPage,
      rowsPerPage: limit,
      totalPages: listTotalPages,
      totalItems: listTotalItems,
      handlePageChange: (p: number) => setListPage(p),
      handleRowsPerPageChange: (newLimit: number) => { setLimit(newLimit); setListPage(1); },
    },
    lostPagination: {
      currentPage: lostPage,
      rowsPerPage: limit,
      totalPages: lostTotalPages,
      totalItems: lostTotalItems,
      handlePageChange: (p: number) => setLostPage(p),
      handleRowsPerPageChange: (newLimit: number) => { setLimit(newLimit); setLostPage(1); },
    },
    wonPagination: {
      currentPage: wonPage,
      rowsPerPage: limit,
      totalPages: wonTotalPages,
      totalItems: wonTotalItems,
      handlePageChange: (p: number) => setWonPage(p),
      handleRowsPerPageChange: (newLimit: number) => { setLimit(newLimit); setWonPage(1); },
    },
    pagination: {
      currentPage: listPage,
      rowsPerPage: limit,
      totalPages: listTotalPages,
      totalItems: listTotalItems,
      handlePageChange: (p: number) => setListPage(p),
      handleRowsPerPageChange: (newLimit: number) => { setLimit(newLimit); setListPage(1); },
    },
  };
}