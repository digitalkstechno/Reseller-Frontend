'use client';

import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import DataTable, { Column } from '@/components/DataTable';
import ProjectManagerDialog, { ProjectManager } from '@/components/ProjectManagerDialog';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';
import DeleteDialog from '@/components/DeleteDialog';
import { formatContactNumber } from '@/utills/utill';
import { Phone, Mail } from 'lucide-react';

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

export function ProjectManagersContent() {
  const [managersData, setManagersData] = useState<ProjectManager[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<ProjectManager | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [managerToDelete, setManagerToDelete] = useState<ProjectManager | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const debouncedSearch = useDebounce(search, 500);
  const token = typeof window !== 'undefined' ? getAuthToken() : null;

  const fetchProjectManagers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(baseUrl.getAllProjectManagers, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: {
          page,
          limit,
          search: debouncedSearch.trim(),
        },
      });

      const payload = res.data?.data || [];
      const pagination = res.data?.pagination || res.data?.extra?.pagination || {};

      const formatted: ProjectManager[] = payload.map((item: any) => ({
        id: item._id,
        _id: item._id,
        fullName: item.fullName || '',
        phone: item.phone || '',
        email: item.email || '',
        status: item.status || 'active',
        profileImage: item.profileImage || '',
        role: item.role,
      }));

      setManagersData(formatted);
      setTotalPages(pagination.totalPages || 1);
      setTotalRecords(pagination.total || pagination.totalRecords || formatted.length);
    } catch (error) {
      console.error('Failed to fetch project managers:', error);
      setManagersData([]);
      setTotalPages(1);
      setTotalRecords(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, token]);

  useEffect(() => {
    fetchProjectManagers();
  }, [fetchProjectManagers]);

  const handleCreate = () => {
    setEditingManager(null);
    setIsFormOpen(true);
  };

  const handleEdit = (manager: ProjectManager) => {
    setEditingManager(manager);
    setIsFormOpen(true);
  };

  const handleDelete = (manager: ProjectManager) => {
    setManagerToDelete(manager);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!managerToDelete) return;
    try {
      const id = managerToDelete._id || managerToDelete.id;
      await axios.delete(`${baseUrl.deleteProjectManager}/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      toast.success('Project Manager deleted successfully');
      setShowDeleteDialog(false);
      setManagerToDelete(null);
      fetchProjectManagers();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete Project Manager');
    }
  };

  const handleFormSubmit = () => {
    fetchProjectManagers();
  };

  const columns: Column<ProjectManager>[] = [
    {
      key: 'fullName',
      label: 'PROJECT MANAGER',
      render: (_, row) => {
        const fullUrl = row.profileImage
          ? row.profileImage.startsWith('http')
            ? row.profileImage
            : `${baseUrl.getImageUrl}/${row.profileImage.replace(/^\/+/, '')}`
          : null;

        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center flex-shrink-0 border border-blue-200">
              {fullUrl ? (
                <img src={fullUrl} alt={row.fullName} className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-blue-700 text-sm">
                  {row.fullName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{row.fullName}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <Mail size={12} className="text-gray-400" />
                <span>{row.email}</span>
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'phone',
      label: 'CONTACT',
      render: (v) => (
        <a
          href={`tel:${v}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-800 hover:text-blue-600 transition-colors"
        >
          <Phone size={14} className="text-gray-400" />
          <span>{formatContactNumber(v) || '-'}</span>
        </a>
      ),
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (v) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
            v === 'active'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {v === 'active' ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 p-2 sm:p-4">
      <DataTable
        data={managersData}
        columns={columns}
        loading={isLoading}
        searchable
        pagination
        currentPage={page}
        totalPages={totalPages}
        totalRecords={totalRecords}
        pageSize={limit}
        onPageChange={(p: number) => setPage(p)}
        onPageSizeChange={(size: number) => {
          setLimit(size);
          setPage(1);
        }}
        onSearch={(value: string) => {
          setSearch(value);
          setPage(1);
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        actions
        addButton={{
          label: 'Add Project Manager',
          onClick: handleCreate,
        }}
      />

      {/* Dialog */}
      <ProjectManagerDialog
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingManager(null);
        }}
        initialData={editingManager}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirmation */}
      <DeleteDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setManagerToDelete(null);
        }}
        title="Delete Project Manager"
        size="md"
        footer={
          <>
            <button
              onClick={() => {
                setShowDeleteDialog(false);
                setManagerToDelete(null);
              }}
              className="rounded-lg cursor-pointer border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              className="rounded-lg cursor-pointer bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Delete
            </button>
          </>
        }
      >
        <div className="py-4">
          <p className="text-gray-700">
            Are you sure you want to delete Project Manager "{managerToDelete?.fullName}"?
          </p>
        </div>
      </DeleteDialog>
    </div>
  );
}

export default function ProjectManagersPage() {
  return (
    <>
      <Head>
        <title>Project Managers | Reseller CRM</title>
      </Head>
      <ProjectManagersContent />
    </>
  );
}
