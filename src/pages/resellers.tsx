'use client';

import { useEffect, useState, useCallback } from 'react';
import DataTable, { Column } from '@/components/DataTable';
import ResellerDialog from '@/components/ResellerDialog';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';
import DeleteDialog from '@/components/DeleteDialog';

interface Reseller {
  id: string;
  image?: string;
  fullName: string;
  phone: string;
  email: string;
  status: string;
  role: string;
  roleName?: string;
  address?: string;
  city: string;
  state: string;
  pincode: string;
  commissionRate: string;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export function ResellersContent() {
  const [resellersData, setResellersData] = useState<Reseller[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [resellerToDelete, setResellerToDelete] = useState<Reseller | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const debouncedSearch = useDebounce(search, 500);
  const token = typeof window !== 'undefined' ? getAuthToken() : null;

  const getUserRole = useCallback((): string => {
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
  }, [token]);

  const getUserId = useCallback((): string => {
    if (!token) return '';
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(window.atob(parts[1]));
        return payload?.id || payload?._id || '';
      }
    } catch (e) {
      console.error('Failed to parse token payload:', e);
    }
    return '';
  }, [token]);

  const fetchResellers = useCallback(async () => {
    if (getUserRole() === 'reseller') {
      return;
    }

    setIsLoading(true);
    try {
      const res = await axios.get(baseUrl.getAllResellers, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: {
          page,
          limit,
          search: debouncedSearch.trim(),
        },
      });

      const payload = (res.data?.data as {
        _id: string;
        profileImage?: string;
        fullName?: string;
        phone?: string;
        email?: string;
        status?: string;
        role?: { _id: string; roleName?: string } | string;
        address?: string;
        city?: string;
        state?: string;
        pincode?: string;
        commissionRate?: number;
      }[]) || [];
      const pagination = res.data?.pagination || {};

      const formatted: Reseller[] = payload.map((item) => ({
        id: item._id,
        image: item.profileImage || '',
        fullName: item.fullName || '',
        phone: item.phone || '',
        email: item.email || '',
        status: item.status || 'active',
        role: typeof item.role === 'object' ? item.role?._id || '' : item.role || '',
        roleName: typeof item.role === 'object' ? item.role?.roleName || '' : '',
        address: item.address || '',
        city: item.city || '',
        state: item.state || '',
        pincode: item.pincode || '',
        commissionRate: String(item.commissionRate ?? '0'),
      }));

      setResellersData(formatted);
      setTotalPages(pagination.totalPages || 1);
      setTotalRecords(pagination.totalRecords || 0);

      if (page > (pagination.totalPages || 1)) {
        setPage(pagination.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch resellers:', error);
      setResellersData([]);
      setTotalPages(1);
      setTotalRecords(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, token, getUserRole]);

  useEffect(() => {
    fetchResellers();
  }, [fetchResellers]);

  const columns: Column<Reseller>[] = [
    {
      key: 'image',
      label: 'IMAGE',
      render: (value, row) => (
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-sky-900">
          {value ? (
            <img
              src={`${process.env.NEXT_PUBLIC_IMAGE_URL}/images/ResellerProfileImages/${value}`}
              alt={row.fullName}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-xs font-bold text-gray-500">
              {row.fullName?.charAt(0) || '?'}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'fullName',
      label: 'FULL NAME',
      render: (value) => <span className="font-semibold">{value}</span>,
    },
    {
      key: 'phone',
      label: 'PHONE',
    },
    {
      key: 'email',
      label: 'EMAIL',
      render: (value) => (
        <a href={`mailto:${value}`} className="text-sky-950 underline">
          {value}
        </a>
      ),
    },
   
    {
      key: 'commissionRate',
      label: 'COMMISSION RATE',
      render: (value) => <span className="font-medium">{value}%</span>,
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (value) => (
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${value === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
        >
          {value}
        </span>
      ),
    },
  ];

  const handleAdd = () => {
    setEditingReseller(null);
    setIsFormOpen(true);
  };

  const handleEdit = async (row: Reseller) => {
    try {
      const res = await axios.get(`${baseUrl.findResellerById}/${row.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const item = res.data?.data;
      if (!item) throw new Error('Reseller not found');

      const formatted: Reseller = {
        id: item._id,
        image: item.profileImage || '',
        fullName: item.fullName || '',
        phone: item.phone || '',
        email: item.email || '',
        status: item.status || 'active',
        role: typeof item.role === 'object' ? item.role?._id || '' : item.role || '',
        roleName: typeof item.role === 'object' ? item.role?.roleName || '' : '',
        address: item.address || '',
        city: item.city || '',
        state: item.state || '',
        pincode: item.pincode || '',
        commissionRate: String(item.commissionRate ?? '0'),
      };

      setEditingReseller(formatted);
      setIsFormOpen(true);
    } catch (err: any) {
      console.error('Failed to fetch reseller by id:', err);
      toast.error(err?.response?.data?.message || 'Could not load reseller details');
    }
  };

  const handleDeleteClick = (row: Reseller) => {
    setResellerToDelete(row);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!resellerToDelete) return;

    try {
      await axios.delete(`${baseUrl.deleteReseller}/${resellerToDelete.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      fetchResellers();
      toast.success('Reseller deactivated successfully');
      setShowDeleteDialog(false);
      setResellerToDelete(null);
    } catch (err: any) {
      console.error('Deactivate failed:', err);
      toast.error(err?.response?.data?.message || 'Failed to deactivate reseller');
    }
  };

  const handleSubmit = () => {
    fetchResellers();
    setIsFormOpen(false);
    setEditingReseller(null);
  };

  if (getUserRole() === 'reseller') {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
        <p className="mt-2 text-gray-600">
          You do not have permission to access the Resellers page.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reseller Management</h1>
        </div> */}

        <DataTable
          data={resellersData}
          columns={columns}
          searchable
          pagination
          currentPage={page}
          totalPages={totalPages}
          totalRecords={totalRecords}
          pageSize={limit}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setLimit(size);
            setPage(1);
          }}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          canEdit={(row) => {
            const rowRole = row.roleName?.toLowerCase() || '';
            const myId = getUserId();
            if (rowRole === 'admin') {
              return myId === row.id;
            }
            return true;
          }}
          canDelete={(row) => {
            const rowRole = row.roleName?.toLowerCase() || '';
            if (rowRole === 'admin') {
              return false;
            }
            return true;
          }}
          actions
          addButton={{
            label: 'Add Reseller',
            onClick: handleAdd,
          }}
        />
      </div>

      <DeleteDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setResellerToDelete(null);
        }}
        title="Deactivate Reseller"
        size="md"
        footer={
          <>
            <button
              onClick={() => {
                setShowDeleteDialog(false);
                setResellerToDelete(null);
              }}
              className="rounded-lg cursor-pointer border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              className="rounded-lg cursor-pointer bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Deactivate
            </button>
          </>
        }
      >
        <div className="py-4">
          <p className="text-gray-700">
            Are you sure you want to deactivate reseller "{resellerToDelete?.fullName}"?
          </p>
        </div>
      </DeleteDialog>

      <ResellerDialog
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingReseller(null);
        }}
        onSubmit={handleSubmit}
        initialData={editingReseller ? {
          _id: editingReseller.id,
          fullName: editingReseller.fullName,
          email: editingReseller.email,
          phone: editingReseller.phone,
          role: editingReseller.role,
          status: editingReseller.status,
          profileImage: editingReseller.image,
          commissionRate: editingReseller.commissionRate,
        } : null}
      />
    </>
  );
}

export default function Resellers() {
  return (
    <>
      <ResellersContent />
    </>
  );
}
