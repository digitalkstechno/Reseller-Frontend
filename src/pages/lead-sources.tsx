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

/* ================= TYPES ================= */

type LeadItem = {
  _id: string;
  name: string;
  order: number;
};

// Validation schema
const validationSchema = Yup.object({
  name: Yup.string()
    .required('Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .matches(/^[a-zA-Z0-9\s&-]+$/, 'Name can only contain letters, numbers, spaces, &, and -'),
  
  order: Yup.number()
    .required('Order is required')
    .integer('Order must be a whole number')
    .min(1, 'Order must be at least 1')
    .max(9999, 'Order must be at most 9999'),
});

/* ================= CONTENT ================= */

export function LeadSourcesContent() {
  const [allData, setAllData] = useState<LeadItem[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 600);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<LeadItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    },
    validationSchema,
 
    onSubmit: async (values) => {
      await saveLeadSource(values);
    },
    enableReinitialize: true,
  });

  /* ================= LOAD DATA ================= */

  const fetchData = async () => {
    try {
      const res = await axios.get(baseUrl.leadSources, {
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
      console.error('Failed to load lead sources', err);
      setAllData([]);
      setTotalRecords(0);
    }
  };

  // initial load & whenever search/page/limit changes
  useEffect(() => {
    fetchData();
  }, [debouncedSearch, currentPage, pageSize]);

  /* ================= SAVE (ADD / EDIT) ================= */

  const saveLeadSource = async (values: { _id?: string; name: string; order: number }) => {
    setIsSubmitting(true);
    
    const payload = { name: values.name.trim(), order: values.order };

    try {
      if (values._id) {
        // EDIT
        const existing = await axios.get(`${baseUrl.leadSources}/${values._id}`, { headers });
        const id = existing.data.data._id;
        await axios.put(`${baseUrl.leadSources}/${id}`, payload, { headers });
      } else {
        // ADD
        await axios.post(baseUrl.leadSources, payload, { headers });
      }

      await fetchData();
      setIsDialogOpen(false);
      setIsSubmitting(false);

      formik.resetForm();
    } catch (err: any) {
      console.error('Failed to save lead source', err?.message || 'Unknown error');
      const msg = err.response?.data?.message || 'Operation failed';
      if (msg.toLowerCase().includes('order')) {
        formik.setFieldTouched('order', true, false);
        formik.setFieldError('order', msg);
      } else {
        formik.setFieldTouched('name', true, false);
        formik.setFieldError('name', msg);
      }
      setIsSubmitting(false);

    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================= DELETE ================= */

  // Show delete confirmation dialog
  const handleDeleteClick = (row: LeadItem) => {
    setSourceToDelete(row);
    setShowDeleteDialog(true);
  };

  // Perform actual delete
  const handleConfirmDelete = async () => {
    if (!sourceToDelete) return;

    try {
      await axios.delete(`${baseUrl.leadSources}/${sourceToDelete._id}`, { headers });
      await fetchData();
      setShowDeleteDialog(false);
      setSourceToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete', err);
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  /* ================= COLUMNS ================= */

  const columns: Column<LeadItem>[] = [
    { key: 'name', label: 'Name' },
    { key: 'order', label: 'Order' },
  ];

  /* ================= UI ================= */

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Lead Sources</h1>
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
            const res = await axios.get(`${baseUrl.leadSources}/${row._id}`, { headers });
            const data = res.data.data;
            formik.setValues({
              _id: data._id,
              name: data.name,
              order: data.order,
            });
            setIsDialogOpen(true);
          } catch (err: any) {
            console.error('Failed to fetch by id', err);
            toast.error(err.response?.data?.message || 'Failed to fetch data');
          }
        }}
        onDelete={handleDeleteClick}
        addButton={{
          label: 'Add Source',
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
          setSourceToDelete(null);
        }}
        title="Delete Lead Source"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setShowDeleteDialog(false);
                setSourceToDelete(null);
              }}
              className="px-4 cursor-pointer py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="px-4 cursor-pointer py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </button>
          </>
        }
      >
        <div className="py-4 text-slate-700">
          <p>
            Are you sure you want to delete the lead source "{sourceToDelete?.name}"? 
            This action cannot be undone.
          </p>
        </div>
      </DeleteDialog>

      {/* ADD / EDIT DIALOG */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          formik.resetForm();
        }}
        title={formik.values._id ? 'Edit Lead Source' : 'Add Lead Source'}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setIsDialogOpen(false);
                formik.resetForm();
              }}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="lead-source-form"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting 
                ? 'Saving...' 
                : formik.values._id 
                  ? 'Update' 
                  : 'Save'
              }
            </button>
          </>
        }
      >
        <form noValidate id="lead-source-form" onSubmit={formik.handleSubmit} className="space-y-4">
          <FormInput
            label="Name"
            name="name"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.name && formik.errors.name ? formik.errors.name : undefined}
            required
            placeholder="Lead Source"
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
          />
        </form>
      </Dialog>
    </div>
  );
}

/* ================= PAGE ================= */

export default function LeadSourcesPage() {
  return (
    <>
      <LeadSourcesContent />
    </>
  );
}