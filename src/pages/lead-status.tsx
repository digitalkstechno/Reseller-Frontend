'use client';

import { useEffect, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import Dialog from '@/components/Dialog';
import DataTable, { Column } from '@/components/DataTable';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';
import DeleteDialog from '@/components/DeleteDialog';
import FormInput from '@/components/ui/Input';

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

type LeadItem = {
  _id: string;
  name: string;
  order: number;
};

// Validation schema
const validationSchema = Yup.object({
  name: Yup.string()
    .required('Status name is required')
    .min(2, 'Status name must be at least 2 characters')
    .max(100, 'Status name must be at most 100 characters')
    .matches(/^[a-zA-Z0-9\s&-]+$/, 'Status name can only contain letters, numbers, spaces, &, and -')
    .test('not-reserved', 'This is a reserved status name and cannot be modified', function (value) {
      const reservedNames = ['new lead', 'won', 'lost'];
      // Only validate for edit mode if the original name wasn't reserved
      const originalName = this.parent.originalName;
      if (originalName && reservedNames.includes(originalName.toLowerCase())) {
        return true; // Skip validation for reserved names being edited
      }
      return !reservedNames.includes(value?.toLowerCase());
    }),

  order: Yup.number()
    .required('Order is required')
    .integer('Order must be a whole number')
    .min(1, 'Order must be at least 1')
    .max(9999, 'Order must be at most 9999'),
});

export function LeadStatusContent() {
  const [allData, setAllData] = useState<LeadItem[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 600);

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // dialogs
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // delete confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [statusToDelete, setStatusToDelete] = useState<LeadItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const token = typeof window !== 'undefined' ? getAuthToken() : null;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  // Initialize formik
  const formik = useFormik({
    validateOnChange: false,
    validateOnBlur: false,
    initialValues: {
      _id: '',
      name: '',
      order: 1,
      originalName: '', // Store original name for reserved check
    },
    validationSchema,
  
    onSubmit: async (values) => {
      await saveStatus(values);
    },
    enableReinitialize: true,
  });

  /* ================= LOAD DATA (search + pagination) ================= */

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(baseUrl.leadStatuses, {
        headers,
        params: {
          search: debouncedSearch || undefined,
          page: currentPage,
          limit: pageSize,
        },
      });

      const data = (res.data?.data as { _id: string; name?: string; order?: number }[]) ?? [];
      const items: LeadItem[] = data.map((i) => ({
        _id: i._id,
        name: i.name || '',
        order: i.order ?? 0,
      }));

      setAllData(items);
      setTotalRecords(res.data.pagination?.totalRecords || items.length);
    } catch (err: any) {
      console.error('Failed to load lead statuses', err);
      setAllData([]);
      setTotalRecords(0);
      toast.error(err?.response?.data?.message || 'Failed to load lead statuses');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [debouncedSearch, currentPage, pageSize]);

  /* ================= SAVE (add or edit) ================= */

  const saveStatus = async (values: { _id?: string; name: string; order: number; originalName?: string }) => {
    setIsSubmitting(true);

    try {
      const payload = { name: values.name.trim(), order: values.order };

      if (values._id) {
        // EDIT
        const existing = await axios.get(`${baseUrl.leadStatuses}/${values._id}`, { headers });
        const id = existing.data.data._id;
        await axios.put(`${baseUrl.leadStatuses}/${id}`, payload, { headers });
        toast.success('Lead status updated successfully');
      } else {
        // ADD
        await axios.post(baseUrl.leadStatuses, payload, { headers });
        toast.success('Lead status created successfully');
      }

      await fetchData();
      setIsDialogOpen(false);
      formik.resetForm();
    } catch (err: any) {
      console.error('Failed to save', err?.message || 'Unknown error');
      const msg = err?.response?.data?.message || 'Operation failed';
      if (msg.toLowerCase().includes('order')) {
        formik.setFieldTouched('order', true, false);
        formik.setFieldError('order', msg);
      } else {
        formik.setFieldTouched('name', true, false);
        formik.setFieldError('name', msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================= DELETE ================= */

  // Show delete confirmation dialog
  const handleDeleteClick = (row: LeadItem) => {
    setStatusToDelete(row);
    setShowDeleteDialog(true);
  };

  // Perform actual delete
  const handleConfirmDelete = async () => {
    if (!statusToDelete) return;

    setIsDeleting(true);

    try {
      await axios.delete(`${baseUrl.leadStatuses}/${statusToDelete._id}`, { headers });
      await fetchData();
      toast.success(`Lead status "${statusToDelete.name}" deleted successfully`);
      setShowDeleteDialog(false);
      setStatusToDelete(null);
    } catch (err: any) {
      console.error('Delete failed', err);
      toast.error(err?.response?.data?.message || 'Failed to delete lead status');
    } finally {
      setIsDeleting(false);
    }
  };

  /* ================= COLUMNS ================= */

  const columns: Column<LeadItem>[] = [
    { key: 'name', label: 'Name' },
    { key: 'order', label: 'Order' },
  ];

  // Check if a status is reserved (cannot be edited or deleted)
  const isReserved = (name: string) => {
    return ['new lead', 'won', 'lost'].includes(name?.toLowerCase());
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Lead Status</h1>
        <p className="text-sm text-gray-500">Manage lead statuses. "New Lead", "Won", and "Lost" are system reserved statuses.</p>
      </div>
      <DataTable
        data={allData}
        columns={columns}
        searchable
        pagination
        currentPage={currentPage}
        totalPages={Math.ceil(totalRecords / pageSize)}
        totalRecords={totalRecords}
        pageSize={pageSize}
        loading={isLoading}
        onSearch={(v) => {
          setSearch(v);
          setCurrentPage(1);
        }}
        onPageChange={setCurrentPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setCurrentPage(1);
        }}
        onEdit={async (row) => {
          try {
            const res = await axios.get(`${baseUrl.leadStatuses}/${row._id}`, { headers });
            const data = res.data.data;
            formik.setValues({
              _id: data._id,
              name: data.name,
              order: data.order,
              originalName: data.name,
            });
            setIsDialogOpen(true);
          } catch (err: any) {
            console.error('Failed to fetch by ID', err);
            toast.error(err?.response?.data?.message || 'Failed to fetch data');
          }
        }}
        onDelete={handleDeleteClick}
        canEdit={(row) => !isReserved(row.name)}
        canDelete={(row) => !isReserved(row.name)}
        addButton={{
          label: 'Add Status',
          onClick: () => {
            formik.resetForm();
            formik.setFieldValue('order', allData.length + 1);
            setIsDialogOpen(true);
          },
        }}
      />

      {/* DELETE CONFIRMATION DIALOG */}
      <DeleteDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setStatusToDelete(null);
        }}
        title="Delete Lead Status"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setShowDeleteDialog(false);
                setStatusToDelete(null);
              }}
              disabled={isDeleting}
              className="px-4 cursor-pointer py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="px-4 cursor-pointer py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></span>
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </button>
          </>
        }
      >
        <div className="py-4 text-slate-700">
          <p>
            Are you sure you want to delete the lead status "{statusToDelete?.name}"?
            This action cannot be undone.
          </p>
          {statusToDelete && isReserved(statusToDelete.name) && (
            <p className="mt-2 text-sm text-red-600">
              Warning: This is a system reserved status. Deleting it may cause unexpected behavior.
            </p>
          )}
        </div>
      </DeleteDialog>

      {/* Add / Edit Dialog */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          formik.resetForm();
        }}
        title={formik.values._id ? 'Edit Lead Status' : 'Add Lead Status'}
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setIsDialogOpen(false);
                formik.resetForm();
              }}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="lead-status-form"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></span>
                  {formik.values._id ? 'Updating...' : 'Saving...'}
                </>
              ) : (
                formik.values._id ? 'Update' : 'Save'
              )}
            </button>
          </>
        }
      >
        <form noValidate id="lead-status-form" onSubmit={formik.handleSubmit} className="space-y-4">
          <FormInput
            label="Status Name"
            name="name"
            type="text"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.name && formik.errors.name ? formik.errors.name : undefined}
            required
            placeholder="Enter status name"
            disabled={isSubmitting || (!!formik.values._id && isReserved(formik.values.originalName))}
          />
          
          <FormInput
            label="Order"
            name="order"
            type="number"
            value={formik.values.order}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.order && formik.errors.order ? formik.errors.order : undefined}
            required
            placeholder="Enter display order"
            disabled={isSubmitting}
          />

          {formik.values._id && isReserved(formik.values.originalName) && (
            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
              <p className="font-medium">⚠️ System Reserved Status</p>
              <p className="mt-1 text-xs">This is a system reserved status. Some modifications may be limited.</p>
            </div>
          )}
        </form>
      </Dialog>
    </div>
  );
}

/* ================= PAGE ================= */

export default function LeadStatusPage() {
  return (
    <>
      <LeadStatusContent />
    </>
  );
}