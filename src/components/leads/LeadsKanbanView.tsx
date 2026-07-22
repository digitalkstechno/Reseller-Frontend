// components/leads/LeadsKanbanView.tsx
// Kanban board with Board / Lost / Won sub-views + drag-and-drop

import { useState, useCallback, useEffect } from 'react';
import { FiPhone, FiMail, FiCalendar } from 'react-icons/fi';
import { formatContactNumber } from "@/utills/utill";
import axios from 'axios';
import toast from 'react-hot-toast';
import { baseUrl, getAuthToken } from '@/config';
import { formatIndianCurrency } from '@/utills/formatters';
import { ApiLead } from './types';
import { RefreshCw } from 'lucide-react';
import DataTable, { Column } from '@/components/DataTable';
import KanbanCard from './KanbanCard';
import PaymentModal from './PaymentModal';
import Swal from 'sweetalert2';

type PaginationShape = {
    currentPage: number;
    rowsPerPage: number;
    totalPages: number;
    totalItems: number;
    handlePageChange: (page: number) => void;
    handleRowsPerPageChange: (rows: number) => void;
};

interface Props {
    leads: ApiLead[];
    lostLeads: ApiLead[];
    wonLeads: ApiLead[];
    statuses: any[];
    onEdit?: (lead: ApiLead) => void;
    onView?: (lead: ApiLead) => void;
    onRefresh: () => void;
    counts?: Record<string, number>;
    summary?: any;
    permissions?: {
        create: boolean;
        update: boolean;
        delete: boolean;
        readAll?: boolean;
        readOwn?: boolean;
        assign?: boolean;
        transfer?: boolean;
        convert?: boolean;
    };
    scope?: 'all' | 'my';
    filters: {
        search?: string;
        status?: string;
        staff?: string;
        date?: string;
    };
    lostPagination?: PaginationShape;
    wonPagination?: PaginationShape;
    onSubViewChange?: (subView: 'board' | 'lost' | 'won') => void;
    refreshTrigger?: number;
}

type SubView = 'board' | 'lost' | 'won';

export default function LeadsKanbanView({
    lostLeads, wonLeads,
    statuses,
    onEdit, onView, onRefresh, counts, summary, permissions, scope = 'all',
    filters,
    lostPagination,
    wonPagination,
    onSubViewChange,
    refreshTrigger,
}: Props) {
    const [subView, setSubView] = useState<SubView>('board');
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [showPayment, setShowPayment] = useState(false);
    const [paymentTarget, setPaymentTarget] = useState<ApiLead | null>(null);

    // Board state
    const [boardLeads, setBoardLeads] = useState<Record<string, ApiLead[]>>({});
    const [columnLoading, setColumnLoading] = useState<Record<string, boolean>>({});
    const [pageMap, setPageMap] = useState<Record<string, number>>({});
    const [hasMoreMap, setHasMoreMap] = useState<Record<string, boolean>>({});
    const [loadingMoreMap, setLoadingMoreMap] = useState<Record<string, boolean>>({});
    const [columnCounts, setColumnCounts] = useState<Record<string, number>>({});

    const [kanbanVisibleStatusNames, setKanbanVisibleStatusNames] = useState<string[] | null>(null);

    useEffect(() => {
        const loadVisibility = async () => {
            const t = getAuthToken();
            if (!t) return;
            try {
                const res = await axios.get(baseUrl.settingsKanbanStatus, {
                    headers: { Authorization: `Bearer ${t}` }
                });
                const statusNames = res.data?.data;
                if (statusNames && Array.isArray(statusNames)) {
                    setKanbanVisibleStatusNames(statusNames.filter((x: any) => typeof x === 'string'));
                    return;
                }
            } catch (err) {
                console.error('Failed to load visible kanban status names:', err);
            }

            try {
                const stored = sessionStorage.getItem('kanbanVisibleStatusNames');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setKanbanVisibleStatusNames(Array.isArray(parsed) ? parsed : null);
                    return;
                }
            } catch {}
            setKanbanVisibleStatusNames(null);
        };

        loadVisibility();
    }, []);

    const token = () => getAuthToken();

    // Notify parent when sub-view changes
    const handleSubViewChange = (v: SubView) => {
        setSubView(v);
        onSubViewChange?.(v);
    };

    // Fetch leads for a specific status
    const fetchStatusLeads = useCallback(
        async (statusId: string, page = 1, isLoadMore = false, isSilent = false) => {
            if (isLoadMore) {
                setLoadingMoreMap((p) => ({ ...p, [statusId]: true }));
            } else if (!isSilent) {
                setColumnLoading((p) => ({ ...p, [statusId]: true }));
            }

            try {
                const res = await axios.get(baseUrl.getKanbanStatusLeads, {
                    headers: { Authorization: `Bearer ${token()}` },
                    params: {
                        statusId,
                        page,
                        limit: 10,
                        my: scope === 'my' || undefined,
                        search: filters.search || undefined,
                        staff: filters.staff || undefined,
                        date: filters.date || undefined,
                        paymentStatus: (filters as any).paymentStatus || undefined,
                    },
                });

                const newData: ApiLead[] = res.data?.data || [];
                const pagination = res.data?.pagination || {};

                setBoardLeads((prev) => ({
                    ...prev,
                    [statusId]: isLoadMore ? [...(prev[statusId] || []), ...newData] : newData,
                }));

                const totalRecords = pagination.totalRecords ?? pagination.total ?? pagination.count ?? (isLoadMore ? (columnCounts[statusId] || 0) : newData.length);
                setColumnCounts((prev) => ({ ...prev, [statusId]: totalRecords }));

                setPageMap((prev) => ({ ...prev, [statusId]: page }));
                setHasMoreMap((prev) => ({
                    ...prev,
                    [statusId]: page < (pagination.totalPages || 1),
                }));
            } catch (error) {
                console.error(`Failed to fetch leads for status ${statusId}:`, error);
            } finally {
                setColumnLoading((p) => ({ ...p, [statusId]: false }));
                setLoadingMoreMap((p) => ({ ...p, [statusId]: false }));
            }
        },
        [scope, filters]
    );

    // Initial fetch and re-fetch on filter change
    useEffect(() => {
        if (subView !== 'board') return;
        statuses.forEach((s) => {
            const isVisible = kanbanVisibleStatusNames === null || kanbanVisibleStatusNames.includes(s.name);
            if (isVisible) {
                fetchStatusLeads(s._id, 1);
            }
        });
    }, [subView, statuses, kanbanVisibleStatusNames, scope, filters, fetchStatusLeads, refreshTrigger]);

    const loadMore = useCallback(
        async (statusId: string) => {
            if (loadingMoreMap[statusId] || hasMoreMap[statusId] === false) return;
            const nextPage = (pageMap[statusId] || 1) + 1;
            fetchStatusLeads(statusId, nextPage, true);
        },
        [loadingMoreMap, hasMoreMap, pageMap, fetchStatusLeads]
    );

    const handleDrop = async (newStatusId: string) => {
        if (!draggingId || !permissions?.update) return;

        let sourceStatusId = '';
        let isWonLead = false;
        const entries = Object.entries(boardLeads);
        for (let i = 0; i < entries.length; i++) {
            const [sId, leadsArr] = entries[i];
            const foundLead = leadsArr.find(l => l._id === draggingId);
            if (foundLead) {
                sourceStatusId = sId;
                isWonLead = foundLead.isWon || statuses.find(s => s._id === sId)?.name.toLowerCase() === 'won';
                break;
            }
        }

        if (isWonLead) {
            toast.error("Cannot update a lead that has been won");
            setDraggingId(null);
            return;
        }

        if (sourceStatusId === newStatusId || !sourceStatusId) {
            setDraggingId(null);
            return;
        }

        const targetStatus = statuses.find((s) => s._id === newStatusId);
        if (!targetStatus) return;

        let lostReason = '';
        if (targetStatus.name.toLowerCase() === 'lost') {
            const result = await Swal.fire({
                title: 'Lead Lost Reason',
                input: 'textarea',
                inputLabel: 'Why was this lead lost?',
                inputPlaceholder: 'Enter reason here...',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Mark as Lost',
                inputValidator: (value) => {
                    if (!value?.trim()) {
                        return 'You need to write a reason!';
                    }
                }
            });
            if (!result.isConfirmed || !result.value) {
                setDraggingId(null);
                return;
            }
            lostReason = result.value;
        }

        const currentDropId = draggingId;
        setDraggingId(null);
        setUpdatingId(currentDropId);

        // Optimistic UI update
        setBoardLeads(prev => {
            const next = { ...prev };
            const sourceLeads = [...(next[sourceStatusId] || [])];
            const leadIndex = sourceLeads.findIndex(l => l._id === currentDropId);
            if (leadIndex > -1) {
                const [lead] = sourceLeads.splice(leadIndex, 1);
                next[sourceStatusId] = sourceLeads;
                next[newStatusId] = [lead, ...(next[newStatusId] || [])];
                lead.leadStatus = targetStatus;
            }
            return next;
        });

        try {
            await axios.put(
                `${baseUrl.updateKanbanStatus}/${currentDropId}/kanban-status`,
                {
                    leadStatus: newStatusId,
                    ...(lostReason ? { lostReason, isLost: true, lostDate: new Date().toISOString() } : {})
                },
                { headers: { Authorization: `Bearer ${token()}` } }
            );
            toast.success(`Lead moved to ${targetStatus.name}`);

            // SILENT RE-FETCH: sync counts/order etc in background without showing loaders
            fetchStatusLeads(sourceStatusId, 1, false, true);
            fetchStatusLeads(newStatusId, 1, false, true);

            onRefresh();
        } catch {
            toast.error('Failed to update lead status');
            // Re-fetch with loader to show the revert
            fetchStatusLeads(sourceStatusId, 1);
            fetchStatusLeads(newStatusId, 1);
        } finally {
            setUpdatingId(null);
        }
    };

    const statusGroups = statuses
        .map((s) => ({
            id: s._id,
            title: s.name,
            leads: boardLeads[s._id] || [],
            count: columnCounts[s._id] ?? (counts ? counts[s._id] || 0 : 0),
            isLoading: columnLoading[s._id]
        }))
        .filter((group) => {
            if (kanbanVisibleStatusNames === null) return true;
            return kanbanVisibleStatusNames.includes(group.title);
        });

    const markLost = async (id: string) => {
        const result = await Swal.fire({
            title: 'Lead Lost Reason',
            input: 'textarea',
            inputLabel: 'Why was this lead lost?',
            inputPlaceholder: 'Enter reason here...',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Mark as Lost',
            inputValidator: (value) => {
                if (!value?.trim()) {
                    return 'You need to write a reason!';
                }
            }
        });
        if (!result.isConfirmed || !result.value) return;

        try {
            await axios.put(`${baseUrl.updateLead}/${id}`, {
                isLost: true,
                lostDate: new Date().toISOString(),
                lostReason: result.value
            }, { headers: { Authorization: `Bearer ${token()}` } });
            toast.success('Lead marked as lost');
            onRefresh();
        } catch { toast.error('Failed to update lead'); }
    };

    const markWon = async (id: string) => {
        try {
            await axios.put(`${baseUrl.updateLead}/${id}`, { isWon: true, wonDate: new Date().toISOString() }, { headers: { Authorization: `Bearer ${token()}` } });
            toast.success('Lead marked as won');
            onRefresh();
        } catch { toast.error('Failed to update lead'); }
    };

    const reactivate = async (id: string) => {
        const result = await Swal.fire({
            title: 'Reactivate Lead',
            text: "Are you sure you want to reactivate this lead? It will be moved to the New status.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, reactivate it!'
        });

        if (!result.isConfirmed) return;

        try {
            await axios.put(`${baseUrl.updateLead}/${id}`, { isLost: false, isWon: false }, { headers: { Authorization: `Bearer ${token()}` } });
            toast.success('Lead reactivated');
            onRefresh();
        } catch { toast.error('Failed to reactivate lead'); }
    };

    const lostLeadsColumns: Column<ApiLead>[] = [
        { key: 'fullName', label: 'LEAD NAME', render: (v, row) => (<div><div className="font-semibold text-gray-900">{row.customerName || v}</div><span className="text-xs text-red-500">• Lost</span></div>) },
        { key: 'companyName', label: 'COMPANY', render: (v) => <span className="text-sm">{v || '-'}</span> },
        { key: 'contact', label: 'CONTACT', render: (v, row) => <ContactCell phone={row.customerContact || v} email={row.customerEmail || row.email} /> },
        { key: 'lostDate', label: 'LOST DATE', render: (v, row) => { const d = v || row.updatedAt; return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A' } },
        { key: 'assignedTo', label: 'ASSIGNED TO', render: (v) => v?.fullName || '-' },
        { key: 'lostReason', label: 'REASON', render: (v) => v || 'Not specified' },
    ];

    const wonLeadsColumns: Column<ApiLead>[] = [
        { key: 'fullName', label: 'LEAD NAME', render: (v, row) => <span className="font-semibold text-gray-900">{row.customerName || v}</span> },
        { key: 'companyName', label: 'COMPANY', render: (v) => <span className="text-sm">{v || '-'}</span> },
        { key: 'contact', label: 'CONTACT', render: (v, row) => <ContactCell phone={row.customerContact || v} email={row.customerEmail || row.email} /> },
        { key: 'wonDate', label: 'WON DATE', render: (v, row) => { const d = v || row.updatedAt; return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A' } },
        { key: 'assignedTo', label: 'ASSIGNED TO', render: (v) => v?.fullName || '-' },
        { key: 'paymentAmount', label: 'AMOUNT', render: (v) => (v ? formatIndianCurrency(v) : '-') },
    ];

    return (
        <div className="flex flex-1 min-h-0 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1 flex-shrink-0">
                <div className="flex items-center gap-2">
                    {(['board', 'lost', 'won'] as SubView[]).map((v) => {
                        let boardCount = 0;
                        let lostCount = 0;
                        let wonCount = 0;

                        if (summary?.statusWiseCounts) {
                            summary.statusWiseCounts.forEach((s: any) => {
                                if (s.statusName.match(/^won$/i)) {
                                    wonCount += s.count;
                                } else if (s.statusName.match(/^lost$/i)) {
                                    lostCount += s.count;
                                } else {
                                    boardCount += s.count;
                                }
                            });
                        } else {
                            boardCount = Object.values(columnCounts).reduce((a, b) => a + b, 0);
                            lostCount = lostPagination?.totalItems ?? lostLeads?.length ?? 0;
                            wonCount = wonPagination?.totalItems ?? wonLeads?.length ?? 0;
                        }

                        let text = '';
                        if (v === 'board') {
                            text = `Board View (${boardCount})`;
                        } else if (v === 'lost') {
                            text = `Lost Leads (${lostCount})`;
                        } else {
                            text = `Won Leads (${wonCount})`;
                        }

                        return (
                            <button
                                key={v}
                                onClick={() => handleSubViewChange(v)}
                                className={`rounded-lg cursor-pointer px-4 py-1.5 text-sm font-medium capitalize transition-colors ${subView === v
                                    ? v === 'lost' ? 'bg-red-600 text-white' : v === 'won' ? 'bg-green-600 text-white' : 'bg-[#3B82F6] text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {text}
                            </button>
                        );
                    })}
                </div>
            </div>

            {subView === 'board' && (
                <div className="overflow-x-auto w-full pb-4">
                    <div className="flex gap-4 h-[calc(100vh-280px)] min-w-max">
                        {statusGroups.map((group) => (
                            <div key={group.id} className="w-80 flex-shrink-0 flex flex-col">
                                <div className="rounded-t-xl bg-secondary px-5 py-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-white capitalize">{group.title}</h3>
                                        <span className="rounded-full bg-white px-3 py-0.5 text-sm font-semibold text-secondary">
                                            {group.count}
                                        </span>
                                    </div>
                                </div>

                                <div
                                    className="flex-1 overflow-y-auto rounded-b-lg bg-[#f4f7fb] p-3 space-y-3"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => handleDrop(group.id)}
                                    onScroll={(e) => {
                                        const t = e.target as HTMLDivElement;
                                        if (Math.ceil(t.scrollTop + t.clientHeight) >= t.scrollHeight - 20) {
                                            loadMore(group.id);
                                        }
                                    }}
                                >
                                    {group.isLoading ? (
                                        <div className="flex h-full items-center justify-center py-10">
                                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-transparent" />
                                        </div>
                                    ) : group.leads.length === 0 ? (
                                        <div className="flex h-full items-center justify-center text-sm text-gray-400">
                                            No leads
                                        </div>
                                    ) : (
                                        group.leads.map((lead: ApiLead) => (
                                            <KanbanCard
                                                key={lead._id}
                                                lead={lead}
                                                isUpdating={updatingId === lead._id}
                                                onDragStart={() => { if (permissions?.update) setDraggingId(lead._id); }}
                                                onView={() => onView?.(lead)}
                                                onEdit={permissions?.update && !group.title.match(/^won$/i) ? () => onEdit?.(lead) : undefined}
                                                onMarkLost={permissions?.update ? () => markLost(lead._id) : undefined}
                                                onMarkWon={permissions?.update ? () => markWon(lead._id) : undefined}
                                            />
                                        ))
                                    )}
                                    {loadingMoreMap[group.id] && (
                                        <div className="flex justify-center py-2">
                                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {subView === 'lost' && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm w-full flex-1 min-h-0 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between mb-4 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-red-200 text-red-700 flex items-center justify-center font-bold text-lg">×</div>
                            <div>
                                <h2 className="text-xl font-semibold text-red-800">Lost Leads</h2>
                                <p className="text-sm text-red-800 opacity-80">Leads that were not converted</p>
                            </div>
                        </div>
                        <span className="rounded-full bg-red-200 px-3 py-1 text-sm font-semibold text-red-800">
                            {lostPagination?.totalItems ?? lostLeads.length} Total
                        </span>
                    </div>
                    <DataTable
                        data={lostLeads}
                        columns={lostLeadsColumns}
                        loading={false}
                        searchable={false}
                        pagination
                        currentPage={lostPagination?.currentPage ?? 1}
                        totalPages={lostPagination?.totalPages ?? 1}
                        totalRecords={lostPagination?.totalItems ?? lostLeads.length}
                        pageSize={lostPagination?.rowsPerPage ?? 10}
                        onPageChange={lostPagination?.handlePageChange}
                        onPageSizeChange={lostPagination?.handleRowsPerPageChange}
                        actions
                        onView={(row) => onView?.(row)}
                        onEdit={permissions?.update ? (row) => onEdit?.(row) : undefined}
                        extraActions={permissions?.update ? [{ label: 'Reactivate', onClick: (row) => reactivate(row._id), icon: <RefreshCw className="h-4 w-4" />, color: 'orange' }] : undefined}
                    />
                </div>
            )}

            {subView === 'won' && (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm w-full flex-1 min-h-0 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between mb-4 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-green-200 text-green-700 flex items-center justify-center font-bold text-lg">✓</div>
                            <div>
                                <h2 className="text-xl font-semibold text-green-800">Won Leads</h2>
                                <p className="text-sm text-green-800 opacity-80">Leads that were converted</p>
                            </div>
                        </div>
                        <span className="rounded-full bg-green-200 px-3 py-1 text-sm font-semibold text-green-800">
                            {wonPagination?.totalItems ?? wonLeads.length} Total
                        </span>
                    </div>
                    <DataTable
                        data={wonLeads}
                        columns={wonLeadsColumns}
                        loading={false}
                        searchable={false}
                        pagination
                        currentPage={wonPagination?.currentPage ?? 1}
                        totalPages={wonPagination?.totalPages ?? 1}
                        totalRecords={wonPagination?.totalItems ?? wonLeads.length}
                        pageSize={wonPagination?.rowsPerPage ?? 10}
                        onPageChange={wonPagination?.handlePageChange}
                        onPageSizeChange={wonPagination?.handleRowsPerPageChange}
                        actions
                        onView={(row) => onView?.(row)}
                        onEdit={undefined}
                        extraActions={permissions?.update ? [
                            {
                                label: (row) => row?.paymentStatus === 'Paid' ? 'Payment Details' : 'Payment',
                                icon: <span className="text-xs font-bold">₹</span>,
                                color: (row) => row?.paymentStatus === 'Paid' ? 'blue' : 'green',
                                onClick: (row) => {
                                    setPaymentTarget(row);
                                    setShowPayment(true);
                                }
                            }
                        ] : undefined}
                    />
                </div>
            )}

            {/* Payment Modal */}
            {showPayment && paymentTarget && (
                <PaymentModal
                    isOpen={showPayment}
                    onClose={() => { setShowPayment(false); setPaymentTarget(null); }}
                    lead={paymentTarget}
                    onSuccess={() => { onRefresh(); }}
                />
            )}
        </div>
    );
}

function ContactCell({ phone, email }: { phone: string; email: string }) {
    return (
        <div className="flex flex-col gap-1 text-sm text-gray-700">
            {phone && (
                <div className="flex items-center gap-1.5"><FiPhone className="h-3.5 w-3.5 text-gray-400" />{formatContactNumber(phone)}</div>
            )}      <div className="flex items-center gap-1.5"><FiMail className="h-3.5 w-3.5 text-gray-400" />{email}</div>
        </div>
    );
}