'use client';

import { useEffect, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import Dialog from '@/components/Dialog';
import DataTable, { Column } from '@/components/DataTable';
import DeleteDialog from '@/components/DeleteDialog';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';
import FormInput from '@/components/ui/Input';

type Organization = { _id: string; name: string; createdAt?: string };

function useDebounce<T>(value: T, delay = 500): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

// Validation schema
const validationSchema = Yup.object({
  name: Yup.string()
    .required('Organization name is required')
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name must be at most 100 characters')
    .matches(/^[a-zA-Z0-9\s&-]+$/, 'Organization name can only contain letters, numbers, spaces, &, and -'),
});

export function OrganizationsContent() {
  const [data, setData] = useState<Organization[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [toDelete, setToDelete] = useState<Organization | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const token = typeof window !== 'undefined' ? getAuthToken() : null;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const [setupPermissions, setSetupPermissions] = useState<{
    create?: boolean;
    readAll?: boolean;
    update?: boolean;
    delete?: boolean;
  } | null>(null);

  // Initialize formik
  const formik = useFormik({
    initialValues: {
      _id: '',
      name: '',
    },
    validationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values) => {
      await handleSave(values);
    },
    enableReinitialize: true,
  });

  useEffect(() => {
    if (!token) return;
    axios
      .get(baseUrl.currentStaff, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const role = res.data?.data?.role || {};
        const rawPerms = Array.isArray(role.organizations)
          ? role.organizations[0]
          : role.organizations || {};
        setSetupPermissions(rawPerms.organizations || null);
      })
      .catch(() => {
        setSetupPermissions(null);
      });
  }, [token]);

  const fetchData = async () => {
    try {
      const res = await axios.get(baseUrl.organizations, {
        headers,
        params: { search: debouncedSearch || undefined, page: currentPage, limit: pageSize },
      });
      setData(res.data?.data ?? []);
      setTotalRecords(res.data?.pagination?.totalRecords ?? 0);
    } catch (err: any) {
      console.error('Failed to fetch organizations', err);
      setData([]);
      toast.error(err?.response?.data?.message || 'Failed to load organizations');
    }
  };

  useEffect(() => { fetchData(); }, [debouncedSearch, currentPage, pageSize]);

  const handleSave = async (values: { _id?: string; name: string }) => {
    setIsSubmitting(true);
    try {
      if (values._id) {
        await axios.put(`${baseUrl.organizations}/${values._id}`, { name: values.name }, { headers });
        toast.success('Organization updated successfully');
      } else {
        await axios.post(baseUrl.organizations, { name: values.name }, { headers });
        toast.success('Organization created successfully');
      }
      await fetchData();
      setIsDialogOpen(false);
      formik.resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await axios.delete(`${baseUrl.organizations}/${toDelete._id}`, { headers });
      toast.success('Organization deleted successfully');
      await fetchData();
      setShowDeleteDialog(false);
      setToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    formik.resetForm();
  };

  const handleEdit = (row: Organization) => {
    // Check if user has update permission
    if (setupPermissions?.update === false) {
      toast.warning("You don't have permission to edit organizations");
      return;
    }
    formik.setValues({
      _id: row._id,
      name: row.name,
    });
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    // Check if user has create permission
    if (setupPermissions?.create === false) {
      toast.warning("You don't have permission to create organizations");
      return;
    }
    resetForm();
    setIsDialogOpen(true);
  };

  const columns: Column<Organization>[] = [
    {
      key: 'name',
      label: 'Organization Name',
      render: (v) => <span className="font-semibold text-gray-900">{v}</span>
    },
  ];

  const canCreate = setupPermissions?.create !== false;
  const canUpdate = setupPermissions?.update !== false;
  const canDelete = setupPermissions?.delete !== false;

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Organizations</h1>
        <p className="text-gray-600">
          Manage organizations in your system. Organizations help group teams and staff members.
        </p>
      </div>

      <DataTable
        data={data}
        columns={columns}
        searchable
        pagination
        currentPage={currentPage}
        totalPages={Math.ceil(totalRecords / pageSize) || 1}
        totalRecords={totalRecords}
        pageSize={pageSize}
        onSearch={(v) => { setSearch(v); setCurrentPage(1); }}
        onPageChange={setCurrentPage}
        onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
        onEdit={canUpdate ? handleEdit : undefined}
        onDelete={canDelete ? (row) => { setToDelete(row); setShowDeleteDialog(true); } : undefined}
        addButton={canCreate ? { label: 'Add Organization', onClick: handleAdd } : undefined}
      />

      {/* DELETE CONFIRMATION DIALOG */}
      <DeleteDialog
        isOpen={showDeleteDialog}
        onClose={() => { setShowDeleteDialog(false); setToDelete(null); }}
        title="Delete Organization"
        size="md"
        footer={
          <>
            <button
              onClick={() => { setShowDeleteDialog(false); setToDelete(null); }}
              disabled={isDeleting}
              className="px-4 py-2 cursor-pointer rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="px-4 py-2 cursor-pointer rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
        <div className="py-4 text-gray-700">
          <p>
            Are you sure you want to delete organization "<strong>{toDelete?.name}</strong>"?
          </p>
          <p className="mt-2 text-sm text-red-600">
            ⚠️ This action cannot be undone. All teams and staff members in this organization will be affected.
          </p>
        </div>
      </DeleteDialog>

      {/* ADD / EDIT DIALOG */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          resetForm();
        }}
        title={formik.values._id ? 'Edit Organization' : 'Add Organization'}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}
              disabled={isSubmitting}
              className="px-4 py-2 cursor-pointer rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="organization-form"
              disabled={isSubmitting || !formik.isValid}
              className="px-4 py-2 cursor-pointer rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
        <form noValidate id="organization-form" onSubmit={formik.handleSubmit} className="space-y-4">
          <FormInput
            label="Organization Name"
            name="name"
            type="text"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.name && formik.errors.name ? formik.errors.name : undefined}
            required
            placeholder="Enter organization name"
            disabled={isSubmitting}
          />

          {/* Preview Section */}
          {formik.values.name && !formik.errors.name && (
            <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2">Preview</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-green-600 font-semibold text-sm">
                    {formik.values.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{formik.values.name}</p>
                  <p className="text-xs text-gray-500">Organization preview</p>
                </div>
              </div>
            </div>
          )}
        </form>
      </Dialog>
    </div>
  );
}

export default function OrganizationsPage() {
  return <OrganizationsContent />;
}