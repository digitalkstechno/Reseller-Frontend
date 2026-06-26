'use client';

import { useEffect, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import Dialog from '@/components/Dialog';
import DataTable, { Column } from '@/components/DataTable';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import DeleteDialog from '@/components/DeleteDialog';
import FormInput from '@/components/ui/Input';
import { toast } from 'react-toastify';

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

type TaskStatusItem = {
    _id: string;
    name: string;
    order: number;
    color: string;
};

// Validation schema
const validationSchema = Yup.object({
    name: Yup.string()
        .required('Status name is required')
        .min(2, 'Status name must be at least 2 characters')
        .max(50, 'Status name must be at most 50 characters')
        .matches(/^[a-zA-Z0-9\s&-]+$/, 'Status name can only contain letters, numbers, spaces, &, and -'),
    
    order: Yup.number()
        .required('Order is required')
        .integer('Order must be a whole number')
        .min(1, 'Order must be at least 1')
        .max(9999, 'Order must be at most 9999'),
    
    color: Yup.string()
        .required('Color is required')
        .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color code. Use format: #RRGGBB or #RGB'),
});

export function TaskStatusContent() {
    const [allData, setAllData] = useState<TaskStatusItem[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 600);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [statusToDelete, setStatusToDelete] = useState<TaskStatusItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const token = typeof window !== 'undefined' ? getAuthToken() : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    // Initialize formik
    const formik = useFormik({
        initialValues: {
            _id: '',
            name: '',
            order: 1,
            color: '#6B7280',
        },
        validationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        onSubmit: async (values) => {
            await saveTaskStatus(values);
        },
        enableReinitialize: true,
    });

    /* ================= LOAD DATA ================= */

    const fetchData = async () => {
        try {
            const res = await axios.get(baseUrl.taskStatuses, {
                headers,
                params: {
                    search: debouncedSearch || undefined,
                    page: currentPage,
                    limit: pageSize,
                },
            });

            const data = (res.data?.data as { _id: string; name?: string; order?: number; color?: string }[]) ?? [];
            const items: TaskStatusItem[] = data.map((i) => ({
                _id: i._id,
                name: i.name || '',
                order: i.order ?? 0,
                color: i.color || '#6B7280',
            }));

            setAllData(items);
            setTotalRecords(res.data.pagination?.totalRecords || items.length);
        } catch (err: any) {
            console.error('Failed to load task statuses', err);
            setAllData([]);
            setTotalRecords(0);
            toast.error(err?.response?.data?.message || 'Failed to load task statuses');
        }
    };

    // initial load & whenever search/page/limit changes
    useEffect(() => {
        fetchData();
    }, [debouncedSearch, currentPage, pageSize]);

    /* ================= SAVE (ADD / EDIT) ================= */

    const saveTaskStatus = async (values: { _id?: string; name: string; order: number; color: string }) => {
        setIsSubmitting(true);

        const payload = {
            name: values.name.trim(),
            order: values.order,
            color: values.color
        };

        try {
            if (values._id) {
                // EDIT: call getById before updating
                const existing = await axios.get(`${baseUrl.taskStatuses}/${values._id}`, { headers });
                const id = existing.data.data._id;

                await axios.put(`${baseUrl.taskStatuses}/${id}`, payload, { headers });
                toast.success('Task status updated successfully');
            } else {
                // ADD
                await axios.post(baseUrl.taskStatuses, payload, { headers });
                toast.success('Task status created successfully');
            }

            // refresh data after add/edit
            await fetchData();
            setIsDialogOpen(false);
            formik.resetForm();
        } catch (err: any) {
            console.error('Failed to save task status', err);
            toast.error(err?.response?.data?.message || 'Operation failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    /* ================= DELETE ================= */

    // Show delete confirmation dialog
    const handleDeleteClick = (row: TaskStatusItem) => {
        setStatusToDelete(row);
        setShowDeleteDialog(true);
    };

    // Perform actual delete
    const handleConfirmDelete = async () => {
        if (!statusToDelete) return;

        setIsDeleting(true);

        try {
            await axios.delete(`${baseUrl.taskStatuses}/${statusToDelete._id}`, { headers });
            await fetchData();
            toast.success(`Task status "${statusToDelete.name}" deleted successfully`);
            setShowDeleteDialog(false);
            setStatusToDelete(null);
        } catch (err: any) {
            console.error('Failed to delete', err);
            toast.error(err?.response?.data?.message || 'Delete failed');
        } finally {
            setIsDeleting(false);
        }
    };

    /* ================= RESET FORM ================= */

    const resetForm = () => {
        formik.resetForm();
        formik.setFieldValue('order', allData.length + 1);
        formik.setFieldValue('color', '#6B7280');
    };

    /* ================= HANDLE EDIT ================= */

    const handleEdit = async (row: TaskStatusItem) => {
        try {
            const res = await axios.get(`${baseUrl.taskStatuses}/${row._id}`, { headers });
            const data = res.data.data;
            formik.setValues({
                _id: data._id,
                name: data.name,
                order: data.order,
                color: data.color || '#6B7280',
            });
            setIsDialogOpen(true);
        } catch (err: any) {
            console.error('Failed to fetch by id', err);
            toast.error(err?.response?.data?.message || 'Failed to fetch data');
        }
    };

    /* ================= COLUMNS ================= */

    const renderNameCell = (value: string, row: TaskStatusItem) => (
        <div className="flex items-center gap-3">
            <div
                className="w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: row.color }}
                title={row.color}
            />
            <span className="text-gray-700">{value}</span>
        </div>
    );

    const renderOrderCell = (value: number) => (
        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
            #{value}
        </span>
    );

    const columns: Column<TaskStatusItem>[] = [
        {
            key: 'name',
            label: 'Name',
            render: renderNameCell
        },
        {
            key: 'order',
            label: 'Order',
            render: renderOrderCell
        },
    ];

    /* ================= UI ================= */

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Task Status</h1>
                <p className="text-gray-600">
                    Manage task statuses to track your tasks progress
                </p>
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
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                addButton={{
                    label: 'Add Status',
                    onClick: () => {
                        resetForm();
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
                title="Delete Task Status"
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
                        Are you sure you want to delete the task status "{statusToDelete?.name}"?
                        This action cannot be undone.
                    </p>
                    {statusToDelete && (
                        <div className="mt-3 flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                            <div
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: statusToDelete.color }}
                            />
                            <span className="text-sm text-gray-600">
                                Status color: {statusToDelete.color}
                            </span>
                        </div>
                    )}
                </div>
            </DeleteDialog>

            {/* ADD / EDIT DIALOG */}
            <Dialog
                isOpen={isDialogOpen}
                onClose={() => {
                    setIsDialogOpen(false);
                    resetForm();
                }}
                title={formik.values._id ? 'Edit Task Status' : 'Add Task Status'}
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => {
                                setIsDialogOpen(false);
                                resetForm();
                            }}
                            disabled={isSubmitting}
                            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="task-status-form"
                            disabled={isSubmitting || !formik.isValid}
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
                <form noValidate id="task-status-form" onSubmit={formik.handleSubmit} className="space-y-4">
                    {/* Name Field */}
                    <FormInput
                        label="Status Name"
                        name="name"
                        type="text"
                        value={formik.values.name}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.name && formik.errors.name ? formik.errors.name : undefined}
                        required
                        placeholder="e.g., To Do, In Progress, Done"
                        helperText="Unique name for the task status"
                        disabled={isSubmitting}
                    />

                    {/* Order Field */}
                    <FormInput
                        label="Display Order"
                        name="order"
                        type="number"
                        value={formik.values.order}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.order && formik.errors.order ? formik.errors.order : undefined}
                        required
                        placeholder="Enter display order"
                        helperText="Lower numbers appear first"
                        disabled={isSubmitting}
                    />

                    {/* Color Field */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Color <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-3">
                            <input
                                type="color"
                                name="color"
                                className="h-10 w-16 border border-gray-300 rounded-lg cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formik.values.color}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                disabled={isSubmitting}
                            />
                            <input
                                type="text"
                                name="color"
                                className={`flex-1 border rounded-lg px-3 py-2 font-mono shadow-sm focus:outline-none focus:ring-2 ${
                                    formik.touched.color && formik.errors.color
                                        ? 'border-red-500 focus:ring-red-200'
                                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                                }`}
                                placeholder="#6B7280"
                                value={formik.values.color}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                disabled={isSubmitting}
                            />
                        </div>
                        {formik.touched.color && formik.errors.color && (
                            <p className="mt-1 text-xs text-red-500">{formik.errors.color}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                            Enter hex color code (e.g., #FF0000 for red, #00FF00 for green)
                        </p>
                    </div>

                    {/* Preview */}
                    {formik.values.name && formik.values.color && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Preview</p>
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-5 h-5 rounded-full shadow-sm"
                                    style={{ backgroundColor: formik.values.color }}
                                />
                                <span 
                                    className="text-sm font-medium px-3 py-1 rounded-full"
                                    style={{ 
                                        backgroundColor: formik.values.color + '20',
                                        color: formik.values.color
                                    }}
                                >
                                    {formik.values.name}
                                </span>
                                <span className="text-xs text-gray-400">Example status</span>
                            </div>
                        </div>
                    )}
                </form>
            </Dialog>
        </div>
    );
}

export default function TaskStatusPage() {
    return (
        <>
            <TaskStatusContent />
        </>
    );
}