import { useEffect, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import axios from 'axios';
import { toast } from 'react-toastify';
import { DefaultEditor } from 'react-simple-wysiwyg';
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
  const [sources, setSources] = useState<{ _id: string; name: string }[]>([]);
  const [staffMembers, setStaffMembers] = useState<{ _id: string; fullName: string }[]>([]);
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [dynamicSchema, setDynamicSchema] = useState<any>(Yup.object());
  const token = getAuthToken;

  useEffect(() => {
    if (!isOpen) return;
    const fetchDropdowns = async () => {
      try {
        const headers = { Authorization: `Bearer ${token()}` };
        const [statusRes, sourceRes, reqRes] = await Promise.all([
          axios.get(baseUrl.leadStatuses, { headers }),
          axios.get(baseUrl.leadSources, { headers }),
          axios.get(baseUrl.settingsRequiredFields || 'http://localhost:5005/v1/api/settings/required-fields', { headers })
        ]);
        setStatuses(statusRes.data?.data || statusRes.data || []);
        setSources(sourceRes.data?.data || sourceRes.data || []);
        
        const reqs = reqRes.data?.data?.requiredLeads || [];
        setRequiredFields(reqs);

        const schemaShape: any = {
          customerName: Yup.string().trim(),
          customerEmail: Yup.string().trim().email('Invalid email format'),
          customerContact: Yup.string().trim().matches(/^[0-9]{10}$/, 'Customer Contact must be exactly 10 digits').required('Customer Contact is required'),
          companyName: Yup.string().trim(),
          paymentAmount: Yup.number().typeError('Payment Amount must be a number').min(0, 'Payment Amount cannot be negative'),
          leadStatus: Yup.string(),
          leadSource: Yup.string(),
          remarks: Yup.string().optional(),
          isActive: Yup.boolean(),
        };

        const labels: any = {
          customerName: 'Customer Name',
          customerEmail: 'Customer Email',
          companyName: 'Company Name',
          paymentAmount: 'Payment Amount',
          leadStatus: 'Lead Status',
          leadSource: 'Lead Source',
          remarks: 'Remarks'
        };

        reqs.forEach((f: string) => {
           if (schemaShape[f]) {
             schemaShape[f] = schemaShape[f].required(`${labels[f] || f} is required`);
           }
        });
        setDynamicSchema(Yup.object().shape(schemaShape));
      } catch (err) {
        console.error('Failed to fetch dropdowns:', err);
      }
    };

    fetchDropdowns();
  }, [isOpen]);

  const formik = useFormik({
    initialValues: {
      customerName: '',
      customerEmail: '',
      customerContact: '',
      companyName: '',
      paymentAmount: '',
      leadStatus: '',
      leadSource: '',
      assignedTo: '',
      remarks: '',
      isActive: true,
    },
    validationSchema: dynamicSchema,
    validateOnChange: false,
    validateOnBlur: false,
    onSubmit: async (values, { setSubmitting, setStatus }) => {
      setStatus(null);
      try {
        const payload = {
          customerName: values.customerName.trim(),
          customerEmail: values.customerEmail.trim().toLowerCase(),
          customerContact: values.customerContact.trim(),
          companyName: values.companyName?.trim() || "",
          paymentAmount: Number(values.paymentAmount),
          leadStatus: values.leadStatus,
          leadSource: values.leadSource,
          assignedTo: values.assignedTo,
          remarks: values.remarks,
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
          paymentAmount: (initialData as any).paymentAmount != null ? String((initialData as any).paymentAmount) : '',
          leadStatus: typeof initialData.leadStatus === 'object' ? initialData.leadStatus?._id || '' : (initialData.leadStatus || ''),
          leadSource: typeof (initialData as any).leadSource === 'object' ? (initialData as any).leadSource?._id || '' : ((initialData as any).leadSource || (initialData as any).source || ''),
          assignedTo: typeof initialData.assignedTo === 'object' ? initialData.assignedTo?._id || '' : (initialData.assignedTo || ''),
          remarks: (initialData as any).remarks || '',
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
            className="px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
              required={requiredFields.includes('customerName')}
            />
            <FormInput
              label="Customer Email"
              name="customerEmail"
              type="email"
              value={formik.values.customerEmail}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={getFieldError('customerEmail')}
              required={requiredFields.includes('customerEmail')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Customer Contact"
              name="customerContact"
              type="tel"
              isPhone={true}
              value={formik.values.customerContact}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const val = e.target.value;
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
              required={requiredFields.includes('companyName')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Payment Amount"
              name="paymentAmount"
              value={formik.values.paymentAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const val = e.target.value.replace(/\D/g, '');
                formik.setFieldValue('paymentAmount', val);
              }}
              onBlur={formik.handleBlur}
              error={getFieldError('paymentAmount')}
              icon={<span className="text-gray-700 font-medium text-lg">₹</span>}
              required={requiredFields.includes('paymentAmount')}
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
              required={requiredFields.includes('leadStatus')}
              placeholder="Select Status"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormSelect
              label="Lead Source"
              name="leadSource"
              value={formik.values.leadSource}
              onChange={(val) => {
                formik.setFieldValue('leadSource', val);
                formik.setFieldTouched('leadSource', true, false);
              }}
              onBlur={formik.handleBlur}
              options={sources.map((s) => ({ value: s._id, label: s.name }))}
              error={getFieldError('leadSource')}
              required={requiredFields.includes('leadSource')}
              placeholder="Select Source"
            />

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

          <div className="w-full">
            <label className="block mb-1.5 text-sm font-semibold text-gray-700">
              Remarks
            </label>
            <div className={`rounded-xl border overflow-hidden ${formik.touched.remarks && formik.errors.remarks ? 'border-red-500' : 'border-gray-300'}`}>
              <DefaultEditor
                value={formik.values.remarks}
                onChange={(e) => {
                  formik.setFieldValue('remarks', e.target.value);
                  if (formik.errors.remarks) {
                    formik.setFieldError('remarks', undefined);
                  }
                }}
                onBlur={() => formik.setFieldTouched('remarks', true)}
              />
            </div>
            {getFieldError('remarks') && (
              <p className="mt-1 text-xs text-red-500">{getFieldError('remarks')}</p>
            )}
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
