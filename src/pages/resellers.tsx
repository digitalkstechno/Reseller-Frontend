'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import DataTable, { Column } from '@/components/DataTable';
import Badge from '@/components/Badge';
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
  city?: string;
  state?: string;
  pincode?: string;
  assignedProjects?: any[];
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
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [resellerToDelete, setResellerToDelete] = useState<Reseller | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const debouncedSearch = useDebounce(search, 500);

  const getUserRole = useCallback((): string => {
    const currentToken = typeof window !== 'undefined' ? getAuthToken() : null;
    if (!currentToken) return '';
    try {
      const parts = currentToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(window.atob(parts[1]));
        return payload?.role?.roleName?.toLowerCase() || '';
      }
    } catch (e) {
      console.error('Failed to parse token payload:', e);
    }
    return '';
  }, []);

  const getUserId = useCallback((): string => {
    const currentToken = typeof window !== 'undefined' ? getAuthToken() : null;
    if (!currentToken) return '';
    try {
      const parts = currentToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(window.atob(parts[1]));
        return payload?.id || payload?._id || '';
      }
    } catch (e) {
      console.error('Failed to parse token payload:', e);
    }
    return '';
  }, []);

  const fetchResellers = useCallback(async () => {
    if (getUserRole() === 'reseller') {
      return;
    }

    setIsLoading(true);
    try {
      const currentToken = typeof window !== 'undefined' ? getAuthToken() : null;
      const res = await axios.get(baseUrl.getAllResellers, {
        headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : undefined,
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
        assignedProjects?: any[];
      }[]) || [];
      const pagination = res.data?.pagination || {};

      const formatted: Reseller[] = payload
        .filter((item) => item.email !== 'admin@gmail.com' && (typeof item.role === 'object' ? item.role?.roleName?.toLowerCase() !== 'admin' : true))
        .map((item) => ({
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
          assignedProjects: item.assignedProjects || [],
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
  }, [page, limit, debouncedSearch, getUserRole]);

  useEffect(() => {
    fetchResellers();
  }, [fetchResellers]);

  const columns: Column<Reseller>[] = [
    {
      key: 'image',
      label: 'IMAGE',
      render: (value, row) => (
        <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-100 bg-blue-50 text-blue-700 shadow-2xs font-semibold text-xs">
          {value ? (
            <img
              src={value?.includes('http') ? value : `${baseUrl.getImageUrl}/images/ResellerProfileImages/${value}`}
              alt={row.fullName}
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : null}
          <span>{row.fullName?.charAt(0)?.toUpperCase() || 'R'}</span>
        </div>
      ),
    },
    {
      key: 'fullName',
      label: 'FULL NAME',
      render: (value) => (
        <span className="font-semibold text-gray-900">{value}</span>
      ),
    },
    {
      key: 'phone',
      label: 'PHONE',
      render: (value) => (
        <span className="font-medium text-gray-700">
          {value ? `+91 ${String(value).replace(/\D/g, '').slice(-10)}` : '-'}
        </span>
      ),
    },
    {
      key: 'email',
      label: 'EMAIL',
      render: (value) => (
        <a
          href={`mailto:${value}`}
          className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-sm"
        >
          {value}
        </a>
      ),
    },
    {
      key: 'assignedProjects',
      label: 'ASSIGNED PRODUCTS',
      render: (_, row) => {
        const activeProjects = Array.isArray(row.assignedProjects)
          ? row.assignedProjects.filter((p: any) => p.isSelected !== false)
          : [];
        const activeCount = activeProjects.length;

        if (activeCount === 0) {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-500 border border-gray-200">
              0 Products
            </span>
          );
        }

        return (
          <div className="relative inline-block group" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 hover:bg-blue-100/80 transition-all cursor-pointer shadow-2xs hover:shadow-xs focus:outline-none"
            >
              <span>{activeCount} {activeCount === 1 ? 'Product' : 'Products'}</span>
              <svg className="w-3 h-3 text-blue-500 group-hover:rotate-180 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Hover / Click Popup Menu (Opens downwards to avoid clipping) */}
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-gray-200/90 z-50 transition-all duration-200 ease-out transform group-hover:translate-y-0 group-focus-within:translate-y-0 -translate-y-1 pointer-events-auto">
              {/* Arrow on Top */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[-1px] border-4 border-transparent border-b-white drop-shadow-xs pointer-events-none"></div>

              {/* Header */}
              <div className="px-3.5 py-2.5 bg-gradient-to-r from-blue-50/90 to-indigo-50/60 border-b border-gray-100 rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  <span className="text-xs font-bold text-gray-800">Assigned Products ({activeCount})</span>
                </div>
                <span className="text-[10px] font-medium text-gray-500">Commission & Rate</span>
              </div>

              {/* Product List */}
              <div className="p-2.5 max-h-56 overflow-y-auto divide-y divide-gray-100/80 custom-scrollbar">
                {activeProjects.map((p: any, idx: number) => {
                  const proj = typeof p.project === 'object' && p.project !== null ? p.project : p;
                  const name = proj.name || p.name || p.projectName || (typeof p.project === 'string' ? p.project : `Product #${idx + 1}`);
                  
                  const commRate = p.commissionRate !== undefined && p.commissionRate !== null && p.commissionRate !== ''
                    ? p.commissionRate
                    : proj.commissionRate;
                    
                  const projAmt = p.projectAmount !== undefined && p.projectAmount !== null && p.projectAmount !== ''
                    ? p.projectAmount
                    : proj.projectAmount;

                  return (
                    <div key={idx} className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-800 truncate" title={name}>{name}</p>
                        <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                          Amount: <span className="font-semibold text-gray-800">
                            {projAmt !== undefined && projAmt !== null && projAmt !== '' && Number(projAmt) > 0
                              ? `₹${Number(projAmt).toLocaleString('en-IN')}`
                              : '₹0'}
                          </span>
                        </p>
                      </div>

                      <div className="flex-shrink-0 text-right">
                        {commRate !== undefined && commRate !== null && commRate !== '' && Number(commRate) > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-bold">
                            {commRate}% Comm.
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[11px] font-medium">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (value) => {
        const isActive = value?.toLowerCase() === 'active' || !value;
        return (
          <Badge
            variant={isActive ? 'success' : 'danger'}
            className="uppercase font-semibold tracking-wider text-[11px]"
          >
            {isActive ? 'ACTIVE' : (value || 'INACTIVE')}
          </Badge>
        );
      },
    },
  ];

  const handleAdd = () => {
    setEditingReseller(null);
    setIsFormOpen(true);
  };

  const handleEdit = async (row: Reseller) => {
    try {
      const currentToken = typeof window !== 'undefined' ? getAuthToken() : null;
      const res = await axios.get(`${baseUrl.findResellerById}/${row.id}`, {
        headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : undefined,
      });

      const item = res.data?.data;
      if (!item) throw new Error('Reseller not found');

      const formatted: any = {
        id: item._id,
        _id: item._id,
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
        assignedProjects: item.assignedProjects || [],
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
      const currentToken = typeof window !== 'undefined' ? getAuthToken() : null;
      await axios.delete(`${baseUrl.deleteReseller}/${resellerToDelete.id}`, {
        headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : undefined,
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

  const { role: userRole, permissions: rawPerms, user } = useSelector((state: any) => state.auth);
  const currentRoleName = (userRole || user?.role?.roleName || '').toLowerCase();
  const isAdmin = currentRoleName === 'admin' || user?.email === 'admin@gmail.com';
  const canCreate = isAdmin || Boolean(rawPerms?.reseller?.create);
  const canUpdate = isAdmin || Boolean(rawPerms?.reseller?.update);
  const canDelete = isAdmin || Boolean(rawPerms?.reseller?.delete);

  return (
    <>
      <div className="flex flex-col h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <DataTable
          data={resellersData}
          columns={columns}
          loading={isLoading}
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
          onEdit={canUpdate ? handleEdit : undefined}
          onDelete={canDelete ? handleDeleteClick : undefined}
          canEdit={(row) => {
            if (!canUpdate) return false;
            const rowRole = row.roleName?.toLowerCase() || '';
            const myId = getUserId();
            if (rowRole === 'admin') {
              return myId === row.id;
            }
            return true;
          }}
          canDelete={(row) => {
            if (!canDelete) return false;
            const rowRole = row.roleName?.toLowerCase() || '';
            if (rowRole === 'admin') {
              return false;
            }
            return true;
          }}
          actions
          addButton={canCreate ? {
            label: 'Add Reseller',
            onClick: handleAdd,
          } : undefined}
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
          _id: (editingReseller as any)._id || (editingReseller as any).id,
          fullName: (editingReseller as any).fullName,
          email: (editingReseller as any).email,
          phone: (editingReseller as any).phone,
          role: (editingReseller as any).role,
          status: (editingReseller as any).status,
          profileImage: (editingReseller as any).image,
          assignedProjects: (editingReseller as any).assignedProjects || [],
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
