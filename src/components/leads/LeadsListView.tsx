import { useState, useEffect } from 'react';
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
  paymentDate?: any;
  paymentMode?: string;
  paymentProof?: string;
  paymentStatus?: string;
  commissionAmount?: number;
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
  return {
    id: item._id,
    name: item.customerName || item.fullName || '-',
    companyName: item.product || item.companyName || '-',
    address: item.address || '-',
    phone: item.customerContact || item.customerContact || item.contact || item.phone || '-',
    email: item.customerEmail || item.email || '-',
    status: (typeof item.leadStatus === 'string' ? item.leadStatus : item.leadStatus?.name) || item.status?.name || '-',
    staff: item.assignedTo?.fullName || '-',
    priority: item.priority?.toUpperCase() || 'MEDIUM',
    lastFollowUp: item.updatedAt
      ? new Date(item.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '-',
    isActive: item.isActive,
    isWon: item.isWon,

    paymentAmount: item.paymentAmount || item.amount,
    paidAmount: item.paidAmount,
    paymentDate: item.paymentDate,
    paymentMode: item.paymentMode,
    paymentProof: item.paymentProof,
    paymentStatus: item.paymentStatus,
    commissionAmount: item.commissionAmount,
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

  // Extract user role from token
  const userRole = (() => {
    const t = typeof window !== 'undefined' ? getAuthToken() : null;
    if (!t) return '';
    try {
      const parts = t.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(window.atob(parts[1]));
        return payload?.role?.roleName?.toLowerCase() || '';
      }
    } catch { }
    return '';
  })();

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
    { key: 'status', label: 'STATUS' },

    { key: 'lastFollowUp', label: 'LAST FOLLOW-UP' },
    {
      key: 'paymentStatus',
      label: 'PAYMENT',
      render: (v) => (
        <Badge
          label={v === 'Paid' ? 'Paid' : 'Unpaid'}
          className={v === 'Paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}
        />
      )
    },
    {
      key: 'paymentAmount',
      label: 'AMOUNT',
      render: (v) => (v ? <span className="font-bold text-emerald-600">{formatIndianCurrency(v)}</span> : <span className="text-gray-400">-</span>)
    },
    {
      key: 'commissionAmount',
      label: 'COMMISSION',
      render: (v) => (v && Number(v) > 0 ? <span className="font-bold text-blue-600">{formatIndianCurrency(v)}</span> : <span className="text-gray-400">-</span>)
    },
  ];

  let columns = [...baseColumns];
  if (userRole === 'admin') {
    columns.splice(2, 0, {
      key: 'staff',
      label: 'RESELLER',
      render: (v) => <span className="text-gray-700">{v || '-'}</span>,
    });
    // Remove status column for admin as requested
    columns = columns.filter(c => c.key !== 'status');
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
    if (!deleteTarget) return;
    try {
      await axios.delete(`${baseUrl.deleteLead}/${deleteTarget.id}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      toast.success('Lead deleted successfully');
      setLeads((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      onRefresh?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to delete lead');
    } finally {
      setShowDelete(false);
      setDeleteTarget(null);
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
        actions={userRole !== 'admin'}
        onView={handleView}
        onEdit={permissions?.update ? handleEdit : undefined}
        onDelete={permissions?.delete ? (row) => { setDeleteTarget(row); setShowDelete(true); } : undefined}
        canEdit={(row) => row.status?.toLowerCase() !== 'won' && !row.isWon}
        canDelete={(row) => row.status?.toLowerCase() !== 'won' && !row.isWon}
        extraActions={permissions?.update ? [
          {
            label: (row) => row.paymentStatus === 'Paid' ? 'View Payment' : 'Add Payment',
            icon: (row) => row.paymentStatus === 'Paid'
              ? <span className="text-xs group-hover:text-white">✓</span>
              : <span className="text-xs font-bold group-hover:text-white">₹</span>,
            color: (row) => row.paymentStatus === 'Paid' ? 'green' : 'blue',
            show: (row) => row.status?.toLowerCase() === 'won' || !!row.isWon,
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
              className="rounded-lg bg-red-600 cursor-pointer px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Delete
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
          lead={paymentTarget}
          onSuccess={() => { onRefresh?.(); }}
        />
      )}
    </div>
  );
}