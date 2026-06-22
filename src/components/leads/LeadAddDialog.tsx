import { useEffect, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import axios from 'axios';
import { toast } from 'react-toastify';
import Dialog from '@/components/Dialog';
import { baseUrl, getAuthToken } from '@/config';
import { ApiLead } from './types';
import FormInput from '../ui/Input';
import FormSelect from '../ui/FormSelect';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  initialData?: ApiLead | null;
  onLeadCreated?: (lead: any) => void;
  onLeadUpdated?: (lead: any) => void;
}

const validationSchema = Yup.object().shape({
  customerName: Yup.string()
    .trim()
    .required('Customer Name is required'),
  customerEmail: Yup.string()
    .trim()
    .email('Invalid email format')
    .required('Customer Email is required'),
  customerContact: Yup.string()
    .trim()
    .matches(/^[0-9]{10}$/, 'Customer Contact must be exactly 10 digits')
    .required('Customer Contact is required'),
  companyName: Yup.string().trim(),
  assignedTo: Yup.string().trim(),
  product: Yup.string().trim().required('Product is required'),
  address: Yup.string().trim().required('Address is required'),
  paymentAmount: Yup.number()
    .typeError('Payment Amount must be a number')
    .required('Payment Amount is required')
    .min(0, 'Payment Amount cannot be negative'),
  leadStatus: Yup.string().required('Lead Status is required'),
  isActive: Yup.boolean(),
});

export default function LeadAddDialog({
  isOpen,
  onClose,
  mode,
  initialData,
  onLeadCreated,
  onLeadUpdated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState<{ _id: string; name: string }[]>([]);
  const [staffMembers, setStaffMembers] = useState<{ _id: string; fullName: string }[]>([]);
  const token = getAuthToken;

  useEffect(() => {
    if (!isOpen) return;
    const fetchStatuses = async () => {
      try {
        const headers = { Authorization: `Bearer ${token()}` };
        const res = await axios.get(baseUrl.leadStatuses, { headers });
        setStatuses(res.data?.data || res.data || []);
      } catch (err) {
        console.error('Failed to fetch lead statuses:', err);
      }
    };

    fetchStatuses();
  }, [isOpen]);

  const formik = useFormik({
    initialValues: {
      customerName: '',
      customerEmail: '',
      customerContact: '',
      companyName: '',
      product: '',
      address: '',
      paymentAmount: '',
      leadStatus: '',
      assignedTo: '',
      isActive: true,
    },
    validationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values, { setSubmitting, setStatus }) => {
      setStatus(null);
      try {
        const payload = {
          customerName: values.customerName.trim(),
          customerEmail: values.customerEmail.trim().toLowerCase(),
          customerContact: values.customerContact.trim(),
          companyName: values.companyName?.trim() || "",
          product: values.product.trim(),
          address: values.address.trim(),
          paymentAmount: Number(values.paymentAmount),
          leadStatus: values.leadStatus,
          assignedTo: values.assignedTo,
          isActive: values.isActive,
        };

        const headers = {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json',
        };

        if (mode === 'add') {
          const res = await axios.post(baseUrl.addLead, payload, { headers });
          toast.success('Lead created successfully!');
          onLeadCreated?.(res.data?.data ?? res.data);
        } else {
          if (!initialData?._id) throw new Error('Missing lead ID');
          const res = await axios.put(
            `${baseUrl.updateLead}/${initialData._id}`,
            payload,
            { headers }
          );
          toast.success('Lead updated successfully!');
          onLeadUpdated?.(res.data?.data ?? res.data);
        }
        onClose();
      } catch (error: any) {
        const msg = error?.response?.data?.message || `Failed to ${mode} lead`;
        setStatus(msg);
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    try {
      if (mode === 'edit' && initialData) {
        formik.setValues({
          customerName: (initialData as any).customerName || initialData.fullName || '',
          customerEmail: (initialData as any).customerEmail || initialData.email || '',
          customerContact: (initialData as any).customerContact || (initialData as any).customerContact || initialData.contact || '',
          companyName: initialData.companyName || '',
          product: (initialData as any).product || '',
          address: (initialData as any).address || '',
          paymentAmount: (initialData as any).paymentAmount != null ? String((initialData as any).paymentAmount) : '',
          leadStatus: typeof initialData.leadStatus === 'object' ? initialData.leadStatus?._id || '' : (initialData.leadStatus || ''),
          assignedTo: typeof initialData.assignedTo === 'object' ? initialData.assignedTo?._id || '' : (initialData.assignedTo || ''),
          isActive: initialData.isActive ?? true,
        });
      } else {
        formik.resetForm();
      }
      formik.setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [isOpen, mode, initialData]);

  const getFieldError = (field: keyof typeof formik.values) => {
    const touched = formik.touched[field];
    const error = formik.errors[field];
    return touched && error ? (error as string) : undefined;
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Lead' : 'Add New Lead'}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg cursor-pointer border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => formik.handleSubmit()}
            disabled={formik.isSubmitting}
            className="rounded-lg cursor-pointer bg-[#0b2a55] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a2447] disabled:opacity-60"
          >
            {formik.isSubmitting
              ? 'Saving...'
              : mode === 'edit'
                ? 'Update Lead'
                : 'Save Lead'}
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="p-6 text-center text-gray-500">Loading...</div>
      ) : (
        <form
          onSubmit={formik.handleSubmit}
          className="space-y-5 p-2"
          noValidate
        >
          {formik.status && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formik.status}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Customer Name"
              name="customerName"
              value={formik.values.customerName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={getFieldError('customerName')}
              required
            />
            <FormInput
              label="Customer Email"
              name="customerEmail"
              type="email"
              value={formik.values.customerEmail}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={getFieldError('customerEmail')}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Customer Contact"
              name="customerContact"
              value={formik.values.customerContact}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                formik.setFieldValue('customerContact', val);
              }}
              onBlur={formik.handleBlur}
              error={getFieldError('customerContact')}
              required
            />
            <FormInput
              label="Company Name"
              name="companyName"
              value={formik.values.companyName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={getFieldError('companyName')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Product Name"
              name="product"
              value={formik.values.product}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={getFieldError('product')}
              required
            />
            <FormInput
              label="Address"
              name="address"
              value={formik.values.address}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={getFieldError('address')}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Payment Amount"
              name="paymentAmount"
              value={formik.values.paymentAmount}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={getFieldError('paymentAmount')}
              required
            />
            <FormSelect
              label="Lead Status"
              name="leadStatus"
              value={formik.values.leadStatus}
              onChange={(val) => {
                formik.setFieldValue('leadStatus', val);
                formik.setFieldTouched('leadStatus', true, false);
              }}
              onBlur={formik.handleBlur}
              options={statuses.map((s) => ({ value: s._id, label: s.name }))}
              error={getFieldError('leadStatus')}
              required
              placeholder="Select Status"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* <FormSelect
              label="Assigned Staff"
              name="assignedTo"
              value={formik.values.assignedTo}
              onChange={(val) => {
                formik.setFieldValue('assignedTo', val);
                formik.setFieldTouched('assignedTo', true, false);
              }}
              onBlur={formik.handleBlur}
              options={staffMembers.map((s) => ({ value: s._id, label: s.fullName }))}
              error={getFieldError('assignedTo')}
              placeholder="Select Staff (Optional)"
            /> */}
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              name="isActive"
              checked={formik.values.isActive}
              onChange={formik.handleChange}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-800">Active Lead</span>
          </label>
        </form>
      )}
    </Dialog>
  );
}
