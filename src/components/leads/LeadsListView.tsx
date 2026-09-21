import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Phone, Mail, Trash2 } from 'lucide-react';
import { formatIndianCurrency } from '@/utills/formatters';
import { formatContactNumber } from "@/utills/utill";
import { baseUrl, getAuthToken } from '@/config';
import { ApiStatus, ApiUser, ApiLead } from './types';
import DataTable, { Column } from '@/components/DataTable';
import Badge from '@/components/Badge';
import DeleteDialog from '@/components/DeleteDialog';
import Swal from 'sweetalert2';
import PaymentModal from './PaymentModal';

// ── Debounce helper ──────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay = 500): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Table row type ───────────────────────────────────────────────────────────
type TableLead = {
  id: string;
  name: string;
  companyName?: string;
  address?: string;
  phone: string;
  email: string;
  managedBy?: string;
  project?: string;
  status: string;
  staff: string;
  priority: string;
  lastFollowUp: string;
  nextFollowupDate?: string;
  nextFollowupTime?: string;
  note?: string;
  isActive?: boolean;
  isWon?: boolean;
  attachments?: { name: string; url?: string }[];

  paymentAmount?: number;
  paidAmount?: number;
  payments?: any[];
  paymentDate?: any;
  paymentMode?: string;
  paymentProof?: string;
  paymentStatus?: string;
  commissionAmount?: number;
  commissionRate?: number;
  _raw?: any;
};

interface Props {
  statuses: ApiStatus[];
  staffMembers: ApiUser[];
  onEdit?: (lead: ApiLead) => void;
  onView?: (lead: ApiLead) => void;
  onRefresh: () => void;
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
  externalLeads?: ApiLead[];
  loading?: boolean;
  // Add pagination props from parent
  pagination?: {
    currentPage: number;
    rowsPerPage: number;
    totalPages: number;
    totalItems: number;
    handlePageChange: (page: number) => void;
    handleRowsPerPageChange: (rows: number) => void;
  };
  onSearchChange?: (value: string) => void;
  headerActions?: React.ReactNode;
}

function mapLead(item: any): TableLead {
  const projectName = typeof item.project === 'object' && item.project !== null
    ? item.project.name || '-'
    : typeof item.project === 'string' && item.project
    ? item.project
    : '-';

  return {
    id: item._id,
    name: item.customerName || item.fullName || '-',
    companyName: item.product || item.companyName || '-',
    address: item.address || '-',
    phone: item.customerContact || item.customerContact || item.contact || item.phone || '-',
    email: item.customerEmail || item.email || '-',
    managedBy: item.managedBy || 'Manage by Me',
    project: projectName,
    status: item.leadStatus?.name || item.status?.name || (typeof item.leadStatus === 'string' && item.leadStatus ? item.leadStatus : 'New Lead'),
    staff: typeof item.assignedTo === 'object' && item.assignedTo !== null
      ? item.assignedTo.fullName || '-'
      : (typeof item.assignedTo === 'string' ? item.assignedTo : '-'),
    priority: item.priority?.toUpperCase() || 'MEDIUM',
    lastFollowUp: item.updatedAt
      ? new Date(item.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '-',
    isActive: item.isActive,
    isWon: item.isWon,

    paymentAmount: item.paymentAmount || item.projectAmount || item.amount,
    paidAmount: item.paidAmount,
    payments: item.payments,
    paymentDate: item.paymentDate,
    paymentMode: item.paymentMode,
    paymentProof: item.paymentProof,
    paymentStatus: item.paymentStatus,
    commissionAmount: item.commissionAmount,
    commissionRate: item.commissionRate !== undefined && item.commissionRate !== null
      ? Number(item.commissionRate)
      : (item.assignedTo && typeof item.assignedTo === 'object' && item.assignedTo.commissionRate !== undefined
        ? Number(item.assignedTo.commissionRate)
        : (item.paymentAmount > 0 && item.commissionAmount > 0
          ? Math.round((Number(item.commissionAmount) / Number(item.paymentAmount)) * 100)
          : undefined)),
    _raw: item,
  };
}

export default function LeadsListView({
  statuses,
  staffMembers,
  onEdit,
  onView,
  onRefresh,
  permissions,
  scope = 'all',
  filters = {},
  externalLeads,
  loading: loadingProp,
  pagination,
  onSearchChange,
  headerActions
}: Props) {
  const router = useRouter();
  const [leads, setLeads] = useState<TableLead[]>([]);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TableLead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<TableLead | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  // Use loading from prop or local state
  const loading = loadingProp !== undefined ? loadingProp : localLoading;

  // Map external leads to table format when they change
  useEffect(() => {
    if (externalLeads && externalLeads.length > 0) {
      setLeads(externalLeads.map(mapLead));
    } else if (externalLeads && externalLeads.length === 0) {
      setLeads([]);
    }
  }, [externalLeads]);

  // Extract user role from Redux & token
  const { role: authRole, user: authUser } = useSelector((state: any) => state.auth || {});
  const userRole = (authRole || authUser?.role?.roleName || authUser?.role || (() => {
    const t = typeof window !== 'undefined' ? getAuthToken() : null;
    if (!t) return '';
    try {
      const parts = t.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(window.atob(parts[1]));
        return payload?.role?.roleName || payload?.role || '';
      }
    } catch { }
    return '';
  })()).toString().toLowerCase();

  const isAdmin = userRole === 'admin' || authUser?.email === 'admin@gmail.com';
  const isPM = userRole === 'project_manager' || userRole === 'projectmanager' || userRole.includes('project');
  const isReseller = userRole === 'reseller';

  // ── Columns ──────────────────────────────────────────────────────────────
  const baseColumns: Column<TableLead>[] = [
    {
      key: 'name',
      label: 'FULL NAME',
      render: (v) => <span className="font-semibold">{v}</span>,
    },
    {
      key: 'contact',
      label: 'CONTACT',
      render: (_, row) => (
        <div className="text-sm">
          {row.phone && (
            <div className="flex items-center mt-1">
              <a
                href={`tel:${row.phone}`}
                title="Call Now"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-medium text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>{formatContactNumber(row.phone) || '-'}</span>
              </a>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'managedBy',
      label: 'MANAGED BY',
      render: (v) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
          {v || 'Manage by Me'}
        </span>
      ),
    },
    {
      key: 'project',
      label: 'PROJECT',
      render: (v) => (
        <span className="text-sm font-medium text-gray-700">
          {v && v !== '-' ? v : '-'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (v) => {
        const s = (v || 'New Lead').toString();
        const lower = s.toLowerCase();
        let badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200';
        if (lower === 'won') {
          badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold';
        } else if (lower === 'lost') {
          badgeStyle = 'bg-red-50 text-red-700 border-red-200 font-semibold';
        } else if (lower.includes('follow') || lower.includes('in progress') || lower.includes('contacted')) {
          badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
        }

        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${badgeStyle}`}>
            {s}
          </span>
        );
      },
    },
    {
      key: 'paymentStatus',
      label: 'PAYMENT',
      render: (_, row) => {
        const total = Number(row.paymentAmount) || 0;
        const paid = Array.isArray(row.payments) && row.payments.length > 0
          ? row.payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
          : (Number(row.paidAmount) || (row.paymentStatus === 'Paid' ? total : 0));
        const pending = Math.max(0, total - paid);

        let statusText = 'Unpaid';
        let badgeClass = 'bg-gray-100 text-gray-800 border-gray-200';

        if (row.paymentStatus === 'Paid' || (total > 0 && paid >= total)) {
          statusText = 'Paid';
          badgeClass = 'bg-green-100 text-green-800 border-green-200';
        } else if (paid > 0 && pending > 0) {
          statusText = 'Partial';
          badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
        }

        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeClass}`}>
            {statusText}
          </span>
        );
      },
    },
    {
      key: 'paymentAmount',
      label: 'TOTAL AMOUNT',
      render: (_, row) => {
        const total = Number(row.paymentAmount) || 0;
        const paid = Array.isArray(row.payments) && row.payments.length > 0
          ? row.payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
          : (Number(row.paidAmount) || (row.paymentStatus === 'Paid' ? total : 0));
        const pending = Math.max(0, total - paid);

        if (!total && !paid) {
          return <span className="text-gray-400 font-medium">-</span>;
        }

        const formatDec = (n: number) =>
          '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        return (
          <div className="flex flex-col min-w-[160px] max-w-[190px] py-0.5 text-xs select-text">
            <div className="flex items-center justify-between text-gray-500 gap-3 py-0.5">
              <div className="flex items-center gap-1.5 flex-shrink-0 text-gray-600">
                <span className="text-[13px] leading-none">📄</span>
                <span className="font-medium text-[11px] whitespace-nowrap">Total Amount</span>
              </div>
              <span className="font-bold text-gray-900 text-xs tabular-nums text-right">
                {formatDec(total)}
              </span>
            </div>

            <div className="flex items-center justify-between text-gray-500 gap-3 py-0.5">
              <div className="flex items-center gap-1.5 flex-shrink-0 text-gray-600">
                <span className="text-gray-500 font-semibold text-xs leading-none">₹</span>
                <span className="font-medium text-[11px] whitespace-nowrap">Paid Amount</span>
              </div>
              <span className="font-bold text-gray-900 text-xs tabular-nums text-right">
                {formatDec(paid)}
              </span>
            </div>

            <div className="border-t border-dashed border-gray-300 my-1 w-full" />

            <div className={`flex items-center justify-between gap-3 py-0.5 font-bold ${pending > 0 ? 'text-emerald-600' : 'text-emerald-600'}`}>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="font-bold text-xs leading-none">₹</span>
                <span className="text-[11px] whitespace-nowrap">{pending > 0 ? 'Pending' : 'Total'}</span>
              </div>
              <span className="text-xs tabular-nums text-right font-bold">
                {formatDec(pending > 0 ? pending : total)}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'commissionRate',
      label: 'Percent %',
      render: (_, row) => {
        if (row.managedBy === 'Manage by Me' || row.managedBy === 'manage by me') {
          return <span className="text-gray-400 font-medium text-xs">-</span>;
        }
        const rate = row.commissionRate !== undefined && row.commissionRate !== null && !isNaN(Number(row.commissionRate))
          ? Number(row.commissionRate)
          : (row.paymentAmount && row.commissionAmount && Number(row.paymentAmount) > 0 && Number(row.commissionAmount) > 0
            ? Math.round((Number(row.commissionAmount) / Number(row.paymentAmount)) * 100)
            : null);

        if (rate !== null && rate > 0) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {rate}%
            </span>
          );
        }
        return <span className="text-gray-400 font-medium text-xs">0%</span>;
      },
    },
    {
      key: 'commissionAmount',
      label: 'COMMISSION',
      render: (v, row) => {
        if (row.managedBy === 'Manage by Me' || row.managedBy === 'manage by me') {
          return <span className="text-gray-400 font-medium">-</span>;
        }
        return v && Number(v) > 0 ? (
          <span className="font-bold text-blue-600">{formatIndianCurrency(v)}</span>
        ) : (
          <span className="text-gray-400 font-medium">-</span>
        );
      },
    },
  ];

  let columns = baseColumns.filter((col) => {
    if (isPM) {
      if (col.key === 'managedBy' || col.key === 'paymentAmount' || col.key === 'commissionRate' || col.key === 'commissionAmount') {
        return false;
      }
    }
    return true;
  });

  if (isAdmin) {
    columns.splice(2, 0, {
      key: 'staff',
      label: 'RESELLER',
      render: (v) => <span className="text-gray-700">{v || '-'}</span>,
    });
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleView = async (row: TableLead) => {
    try {
      const res = await axios.get(`${baseUrl.findLeadById}/${row.id}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const d = res.data.data;
      onView?.(d);
    } catch {
      // fallback
      if (row._raw) {
        onView?.(row._raw);
      } else {
        const apiLead: ApiLead = {
          _id: row.id,
          fullName: row.name,
          contact: row.phone,
          email: row.email,
        };
        onView?.(apiLead);
      }
    }
  };

  const handleEdit = async (row: TableLead) => {
    try {
      const res = await axios.get(`${baseUrl.findLeadById}/${row.id}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const d = res.data.data;
      const apiLead: ApiLead = {
        ...d,
        _id: d._id,
        fullName: d.fullName,
        companyName: d.companyName,
        address: d.address,
        contact: d.contact,
        email: d.email,

        leadStatus: d.leadStatus,
        assignedTo: d.assignedTo,
        priority: d.priority,
        lastFollowUp: d.lastFollowUp,
        nextFollowupDate: d.nextFollowupDate,
        nextFollowupTime: d.nextFollowupTime,
        note: d.note,
        isActive: d.isActive,
      };
      onEdit?.(apiLead);
    } catch {
      console.error('Failed to fetch lead for edit, using local raw data fallback');
      if (row._raw) {
        const d = row._raw;
        const apiLead: ApiLead = {
          ...d,
          _id: d._id,
          fullName: d.fullName,
          companyName: d.companyName,
          address: d.address,
          contact: d.contact,
          email: d.email,

          leadStatus: d.leadStatus,
          assignedTo: d.assignedTo,
          priority: d.priority,
          lastFollowUp: d.lastFollowUp,
          nextFollowupDate: d.nextFollowupDate,
          nextFollowupTime: d.nextFollowupTime,
          note: d.note,
          isActive: d.isActive,
        };
        onEdit?.(apiLead);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await axios.delete(`${baseUrl.deleteLead}/${deleteTarget.id}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      toast.success('Lead deleted successfully');
      setLeads((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      setShowDelete(false);
      setDeleteTarget(null);
      // Delay refresh so backend completes and no race condition
      setTimeout(() => { onRefresh?.(); }, 300);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to delete lead');
    } finally {
      setDeleting(false);
    }
  };

  // Handle page change from DataTable
  const handlePageChange = (newPage: number) => {
    if (pagination) {
      pagination.handlePageChange(newPage);
    }
  };

  // Handle page size change from DataTable
  const handlePageSizeChange = (newSize: number) => {
    if (pagination) {
      pagination.handleRowsPerPageChange(newSize);
    }
  };

  return (
    <div className="flex flex-col h-full flex-1 min-h-0 gap-4">
      {/* Data table */}
      <DataTable
        data={leads}
        columns={columns}
        loading={loading}
        searchable={false}
        headerActions={headerActions}
        pagination
        serverSidePagination={true}
        currentPage={pagination?.currentPage || 1}
        totalPages={pagination?.totalPages || 1}
        totalRecords={pagination?.totalItems || 0}
        pageSize={pagination?.rowsPerPage || 10}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        searchQuery={filters.search}
        onSearch={onSearchChange}
        actions={!isPM}
        onView={handleView}
        onEdit={!isPM && (isAdmin || permissions?.update) ? handleEdit : undefined}
        onDelete={!isPM && (isAdmin || permissions?.delete) ? (row) => { setDeleteTarget(row); setShowDelete(true); } : undefined}
        canEdit={(row) => {
          if (isPM) return false;
          const isWon = row.status?.toLowerCase() === 'won' || !!row.isWon;
          if (isWon) return false;
          // Digitalks leads should be editable by Admin and authorized users
          return true;
        }}
        canDelete={(row) => {
          if (isPM) return false;
          const isWon = row.status?.toLowerCase() === 'won' || !!row.isWon;
          if (isWon) return false;
          const isDigitalks = row.managedBy === 'Digitalks';
          if (isAdmin) {
            return isDigitalks;
          }
          if (isReseller) {
            return !isDigitalks;
          }
          return true;
        }}
        extraActions={!isPM && (isAdmin || permissions?.update) ? [
          {
            label: (row) => row.paymentStatus === 'Paid' ? 'View Payment' : 'Add Payment',
            icon: (row) => row.paymentStatus === 'Paid'
              ? <span className="text-xs group-hover:text-white">✓</span>
              : <span className="text-xs font-bold group-hover:text-white">₹</span>,
            show: (row) => {
              const isWon = row.status?.toLowerCase() === 'won' || !!row.isWon;
              const isDigitalks = row.managedBy === 'Digitalks';
              const hasAmount = (Number(row.paymentAmount) > 0) || (Number(row.paidAmount) > 0);
              if (isAdmin) {
                return isDigitalks && (hasAmount || isWon);
              }
              return !isDigitalks && isWon;
            },
            onClick: (row) => {
              setPaymentTarget(row);
              setShowPayment(true);
            }
          }
        ] : undefined}
      />

      {/* Delete dialog */}
      <DeleteDialog
        isOpen={showDelete}
        onClose={() => { setShowDelete(false); setDeleteTarget(null); }}
        title="Delete Lead"
        size="md"
        footer={
          <>
            <button
              onClick={() => { setShowDelete(false); setDeleteTarget(null); }}
              className="rounded-lg border cursor-pointer border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-red-600 cursor-pointer px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </>
        }
      >
        <p className="py-4 text-gray-700">
          Are you sure you want to delete <strong>"{deleteTarget?.name}"</strong>?
          This action cannot be undone.
        </p>
      </DeleteDialog>

      {/* Payment Modal */}
      {showPayment && paymentTarget && (
        <PaymentModal
          isOpen={showPayment}
          onClose={() => { setShowPayment(false); setPaymentTarget(null); }}
          lead={paymentTarget._raw || paymentTarget}
          onSuccess={() => { onRefresh?.(); }}
        />
      )}
    </div>
  );
}