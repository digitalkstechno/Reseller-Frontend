import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Phone, Mail } from 'lucide-react';
import { baseUrl, getAuthToken } from '@/config';
import { ApiStatus, ApiUser, ApiLead } from './types';
import DataTable, { Column } from '@/components/DataTable';
import DeleteDialog from '@/components/DeleteDialog';
import Swal from 'sweetalert2';

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
  attachments?: { name: string; url?: string }[];

  paymentAmount?: number;
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
}

function mapLead(item: any): TableLead {
  return {
    id: item._id,
    name: item.customerName || item.fullName || '-',
    companyName: item.product || item.companyName || '-',
    address: item.address || '-',
    phone: item.customerContact || item.CustomerContact || item.contact || item.phone || '-',
    email: item.customerEmail || item.email || '-',
    status: item.leadStatus?.name || item.status?.name || '-',
    staff: item.assignedTo?.fullName || '-',
    priority: item.priority?.toUpperCase() || 'MEDIUM',
    lastFollowUp: item.updatedAt
      ? new Date(item.updatedAt).toLocaleDateString()
      : '-',
    isActive: item.isActive,

    paymentAmount: item.paymentAmount || item.amount,
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
  pagination, // Receive pagination from parent
}: Props) {
  const router = useRouter();
  const [leads, setLeads] = useState<TableLead[]>([]);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TableLead | null>(null);
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

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns: Column<TableLead>[] = [
    {
      key: 'name',
      label: 'FULL NAME',
      render: (v) => <span className="font-semibold">{v}</span>,
    },
    {
      key: 'contact',
      label: 'CONTACT',
      render: (_, row) => (
        <div className="space-y-1 text-sm">
          {/* Phone number */}
          <div className="flex items-center gap-1.5 text-gray-600">
            <Phone className="h-3 w-3 text-gray-400" />
            <span>{row.phone || '-'}</span>
          </div>
          {/* Action icons */}
          {row.phone && (
            <div className="flex items-center gap-2 mt-1">
              {/* Call Now */}
              <a
                href={`tel:${row.phone}`}
                title="Call Now"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <Phone className="h-3 w-3" />
                Call
              </a>
              {/* WhatsApp */}
              <a
                href={`https://wa.me/${row.phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                title="WhatsApp"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600 hover:bg-green-100 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-3 w-3"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                WhatsApp
              </a>
            </div>
          )}
          {/* Email */}
          <div className="flex items-center gap-1.5">
            <Mail className="h-3 w-3 text-gray-400" />
            {row.email ? (
              <a
                href={`mailto:${row.email}`}
                title="Send Email"
                onClick={(e) => e.stopPropagation()}
                className="text-blue-500 hover:text-blue-700 hover:underline transition-colors"
              >
                {row.email}
              </a>
            ) : (
              <span className="text-gray-500">-</span>
            )}
          </div>
        </div>
      ),
    },
    { key: 'status', label: 'STATUS' },

    { key: 'staff', label: 'ASSIGNED STAFF' },
    { key: 'priority', label: 'PRIORITY' },
    { key: 'lastFollowUp', label: 'LAST FOLLOW-UP' },
    { 
      key: 'paymentAmount', 
      label: 'AMOUNT',
      render: (v) => (v ? <span className="font-bold text-emerald-600">₹{v.toLocaleString()}</span> : <span className="text-gray-400">-</span>)
    },
  ];

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
    <div className="space-y-4">
      {/* Data table */}
      <DataTable
        data={leads}
        columns={columns}
        loading={loading}
        pagination
        currentPage={pagination?.currentPage || 1}
        totalPages={pagination?.totalPages || 1}
        totalRecords={pagination?.totalItems || 0}
        pageSize={pagination?.rowsPerPage || 10}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        actions
        onView={handleView}
        onEdit={permissions?.update ? handleEdit : undefined}
        onDelete={permissions?.delete ? (row) => { setDeleteTarget(row); setShowDelete(true); } : undefined}
        extraActions={permissions?.update ? [
          {
            label: 'Payment',
            icon: <span className="text-xs font-bold">₹</span>,
            color: 'green',
            onClick: async (row) => {
              const { value: amount } = await Swal.fire({
                title: 'Add Payment',
                input: 'number',
                inputLabel: 'Enter payment amount',
                inputPlaceholder: 'e.g. 5000',
                showCancelButton: true,
                inputValidator: (value: any) => {
                  if (!value) return 'You need to write something!';
                  if (isNaN(value) || value < 0) return 'Please enter a valid amount';
                }
              });

              if (amount) {
                try {
                  await axios.put(`${baseUrl.updateLead}/${row.id}`, 
                    { paymentAmount: Number(amount) }, 
                    { headers: { Authorization: `Bearer ${getAuthToken()}` } }
                  );
                  Swal.fire('Success', 'Payment added successfully', 'success');
                  onRefresh?.();
                } catch (err) {
                  Swal.fire('Error', 'Failed to add payment', 'error');
                }
              }
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
    </div>
  );
}