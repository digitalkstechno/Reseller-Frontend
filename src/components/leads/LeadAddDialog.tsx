import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
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
  const { role } = useSelector((state: any) => state.auth);
  const userRole = role?.toLowerCase() || '';
  const isAdmin = userRole === 'admin';
  const isWonLead = mode === 'edit' && !!(
    initialData?.isWon ||
    (typeof initialData?.leadStatus === 'string' ? initialData.leadStatus : initialData?.leadStatus?.name)?.toLowerCase() === 'won' ||
    (initialData as any)?.status?.toLowerCase() === 'won'
  );

  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState<{ _id: string; name: string }[]>([]);
  const [sources, setSources] = useState<{ _id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ _id: string; name: string; projectAmount?: number }[]>([]);
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [dynamicSchema, setDynamicSchema] = useState<any>(Yup.object());
  const token = getAuthToken;

  useEffect(() => {
    if (!isOpen) return;
    const fetchDropdowns = async () => {
      try {
        const headers = { Authorization: `Bearer ${token()}` };
        const [statusRes, sourceRes, projectRes, reqRes] = await Promise.all([
          axios.get(baseUrl.leadStatuses, { headers }).catch(() => ({ data: [] })),
          axios.get(baseUrl.leadSources, { headers }).catch(() => ({ data: [] })),
          axios.get(`${baseUrl.getAllProjects}?all=true&status=active`, { headers }).catch(() => ({ data: [] })),
          axios.get(baseUrl.settingsRequiredFields || 'http://localhost:5005/v1/api/settings/required-fields', { headers }).catch(() => ({ data: [] })),
        ]);

        setStatuses(statusRes.data?.data || statusRes.data || []);
        setSources(sourceRes.data?.data || sourceRes.data || []);
        setProjects(projectRes.data?.data || projectRes.data?.projects || []);

        let reqs = reqRes.data?.data?.requiredLeads || [];
        reqs = reqs.filter((r: string) => r !== 'customerEmail' && r !== 'leadSource');
        if (!reqs.includes('customerContact')) reqs.push('customerContact');
        if (!reqs.includes('project')) reqs.push('project');
        setRequiredFields(reqs);

        const schemaShape: any = {
          customerName: Yup.string()
            .max(50, 'Max 50 characters')
            .test('req', 'Customer name is required', (val) => !requiredFields.includes('customerName') || !!val),
          customerEmail: Yup.string()
            .email('Invalid email address')
            .test('req', 'Email is required', (val) => !requiredFields.includes('customerEmail') || !!val),
          customerContact: Yup.string()
            .matches(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian phone number')
            .test('req', 'Contact is required', (val) => !requiredFields.includes('customerContact') || !!val),
          companyName: Yup.string().test(
            'req',
            'Company name is required',
            (val) => !requiredFields.includes('companyName') || !!val
          ),
          address: Yup.string().test(
            'req',
            'Location is required',
            (val) => !requiredFields.includes('address') || !!val
          ),
          project: Yup.string().required('Project is required'),
          paymentAmount: Yup.number()
            .transform((value, originalValue) => (originalValue === '' ? undefined : value))
            .typeError('Payment Amount must be a number')
            .min(0, 'Payment Amount cannot be negative')
            .test('req-amount', 'Project Amount is required', function (val) {
              if (this.parent.managedBy === 'Digitalks') return true;
              if (!requiredFields.includes('paymentAmount')) return true;
              return val !== undefined && val !== null && !isNaN(val);
            }),
          leadStatus: Yup.string().optional(),
          leadSource: Yup.string().optional(),
          customLeadSource: Yup.string().optional(),
          remarks: Yup.string().optional(),
          description: Yup.string().optional(),
          isActive: Yup.boolean(),
        };

        const labels: any = {
          customerName: 'Customer Name',
          customerEmail: 'Customer Email',
          customerContact: 'Customer Contact',
          companyName: 'Company Name',
          paymentAmount: 'Payment / Project Amount',
          leadStatus: 'Lead Status',
          leadSource: 'Lead Source',
          remarks: 'Remarks',
          description: 'Description',
        };

        reqs.forEach((f: string) => {
          if (f !== 'leadSource' && f !== 'paymentAmount' && schemaShape[f]) {
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
      address: '',
      managedBy: 'Manage by Me',
      project: '',
      paymentAmount: '',
      leadStatus: '',
      leadSource: '',
      assignedTo: '',
      description: '',
      remarks: '',
      isActive: true,
    },
    validationSchema: dynamicSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values, { setSubmitting, setStatus }) => {
      setStatus(null);
      try {
        const newLeadStatusId = statuses.find((s) => s.name?.toLowerCase() === 'new lead')?._id;
        const finalStatus = values.leadStatus || (mode === 'add' ? (newLeadStatusId || statuses[0]?._id) : undefined);

        const finalAmount = Number(values.paymentAmount) || 0;

        const payload: any = {
          customerName: values.customerName.trim(),
          customerEmail: values.customerEmail.trim().toLowerCase(),
          customerContact: values.customerContact.trim(),
          companyName: values.companyName?.trim() || '',
          address: values.address?.trim() || '',
          managedBy: values.managedBy || 'Manage by Me',
          project: values.project || undefined,
          projectAmount: finalAmount,
          paymentAmount: finalAmount,
          leadStatus: finalStatus,
          leadSource: values.leadSource ? values.leadSource.trim() : undefined,
          assignedTo: values.assignedTo,
          description: values.description || values.remarks || '',
          remarks: values.remarks || values.description || '',
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
      const defaultStatusId = statuses.find((s) => s.name?.toLowerCase() === 'new lead')?._id || statuses[0]?._id || '';

      if (mode === 'edit' && initialData) {
        const projId =
          typeof (initialData as any).project === 'object'
            ? (initialData as any).project?._id || ''
            : (initialData as any).project || '';

        formik.setValues({
          customerName: (initialData as any).customerName || initialData.fullName || '',
          customerEmail: (initialData as any).customerEmail || initialData.email || '',
          customerContact:
            (initialData as any).customerContact || (initialData as any).contact || '',
          companyName: initialData.companyName || '',
          address: (initialData as any).address || '',
          managedBy: (initialData as any).managedBy || 'Manage by Me',
          project: projId,
          paymentAmount:
            (initialData as any).paymentAmount != null
              ? String((initialData as any).paymentAmount)
              : (initialData as any).projectAmount != null
              ? String((initialData as any).projectAmount)
              : '',
          leadStatus:
            typeof initialData.leadStatus === 'object'
              ? initialData.leadStatus?._id || ''
              : initialData.leadStatus || defaultStatusId,
          leadSource:
            typeof (initialData as any).leadSource === 'object'
              ? (initialData as any).leadSource?.name || (initialData as any).leadSource?._id || ''
              : (initialData as any).leadSource || (initialData as any).source || '',
          assignedTo:
            typeof initialData.assignedTo === 'object'
              ? initialData.assignedTo?._id || ''
              : initialData.assignedTo || '',
          description: (initialData as any).description || (initialData as any).remarks || '',
          remarks: (initialData as any).remarks || (initialData as any).description || '',
          isActive: initialData.isActive ?? true,
        });
      } else {
        formik.resetForm({
          values: {
            customerName: '',
            customerEmail: '',
            customerContact: '',
            companyName: '',
            address: '',
            managedBy: 'Manage by Me',
            project: '',
            paymentAmount: '',
            leadStatus: defaultStatusId,
            leadSource: '',
            assignedTo: '',
            description: '',
            remarks: '',
            isActive: true,
          },
        });
      }
      formik.setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [isOpen, mode, initialData, statuses]);

  const handleProjectSelect = (projectId: string) => {
    formik.setFieldValue('project', projectId);
    const selectedProj = projects.find((p) => p._id === projectId);
    if (selectedProj && selectedProj.projectAmount && (!formik.values.paymentAmount || formik.values.paymentAmount === '0')) {
      formik.setFieldValue('paymentAmount', String(selectedProj.projectAmount));
    }
  };

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
      size="xl"
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
            className="px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-medium text-sm shadow-sm"
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
              placeholder="Enter Customer Name"
              value={formik.values.customerName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={getFieldError('customerName')}
              required={requiredFields.includes('customerName')}
              maxLength={50}
            />

            <FormInput
              label="Customer Email"
              name="customerEmail"
              type="email"
              placeholder="Enter Customer Email (e.g. name@example.com)"
              value={formik.values.customerEmail}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={getFieldError('customerEmail')}
              required={requiredFields.includes('customerEmail')}
            />

            <FormInput
              label="Customer Contact"
              name="customerContact"
              type="tel"
              isPhone={true}
              placeholder="00000 00000"
              value={formik.values.customerContact}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const val = e.target.value;
                formik.setFieldValue('customerContact', val);
              }}
              onBlur={formik.handleBlur}
              error={getFieldError('customerContact')}
              required={requiredFields.includes('customerContact')}
            />

            <FormInput
              label="Company Name"
              name="companyName"
              placeholder="Enter Company Name"
              value={formik.values.companyName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={getFieldError('companyName')}
              required={requiredFields.includes('companyName')}
            />

            {/* Row: Managed By | Select Project | Project Amount */}
            {(() => {
              const showPaymentAmount = isAdmin || mode === 'edit' || formik.values.managedBy !== 'Digitalks';
              return (
                <div
                  className={`md:col-span-2 grid grid-cols-1 ${
                    showPaymentAmount ? 'md:grid-cols-3' : 'md:grid-cols-2'
                  } gap-4`}
                >
                  <FormSelect
                    label="Managed By"
                    name="managedBy"
                    value={formik.values.managedBy}
                    onChange={(val) => {
                      formik.setFieldValue('managedBy', val);
                      if (val === 'Digitalks' && !isAdmin && mode === 'add') {
                        const newLeadStatusId = statuses.find((s) => s.name?.toLowerCase() === 'new lead')?._id || statuses[0]?._id || '';
                        if (newLeadStatusId) {
                          formik.setFieldValue('leadStatus', newLeadStatusId);
                        }
                      }
                    }}
                    options={[
                      { value: 'Manage by Me', label: 'Manage by Me' },
                      { value: 'Digitalks', label: 'Digitalks' },
                    ]}
                    placeholder="Select Managed By"
                  />

                  <FormSelect
                    label="Select Project"
                    name="project"
                    value={formik.values.project}
                    onChange={handleProjectSelect}
                    options={projects.map((p) => ({
                      value: p._id,
                      label: p.name,
                    }))}
                    placeholder="Select Project"
                    error={getFieldError('project')}
                    required={true}
                  />

                  {showPaymentAmount && (
                    <FormInput
                      label="Project Amount (₹)"
                      name="paymentAmount"
                      value={formik.values.paymentAmount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const val = e.target.value.replace(/\D/g, '');
                        formik.setFieldValue('paymentAmount', val);
                      }}
                      onBlur={formik.handleBlur}
                      error={getFieldError('paymentAmount')}
                      icon={<span className="text-gray-700 font-medium text-lg">₹</span>}
                      required={requiredFields.includes('paymentAmount') && formik.values.managedBy !== 'Digitalks'}
                      placeholder="e.g. 25000"
                    />
                  )}
                </div>
              );
            })()}

            {/* Lead Status (Selectable) */}
            <FormSelect
              label="Lead Status"
              name="leadStatus"
              value={formik.values.leadStatus}
              onChange={(val) => formik.setFieldValue('leadStatus', val)}
              disabled={isWonLead || (!isAdmin && formik.values.managedBy === 'Digitalks')}
              options={statuses.map((s) => ({
                value: s._id,
                label: s.name,
              }))}
              placeholder="Select Lead Status"
              error={getFieldError('leadStatus')}
              helperText={
                isWonLead
                  ? 'Status cannot be changed for Won leads'
                  : (!isAdmin && formik.values.managedBy === 'Digitalks'
                      ? 'Lead status for Digitalks managed leads can only be updated by Admin'
                      : undefined)
              }
            />

            {/* Lead Source: Optional */}
            <FormInput
              label="Lead Source"
              name="leadSource"
              placeholder="Enter Lead Source (e.g. Instagram, Referral, Facebook...)"
              value={formik.values.leadSource}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={getFieldError('leadSource')}
              required={false}
            />
          </div>

          {/* Description / Remarks Field */}
          <div className="w-full">
            <label className="block mb-1.5 text-sm font-semibold text-gray-700">
              Description / Remarks
              {requiredFields.includes('description') && (
                <span className="text-red-700 ml-1">*</span>
              )}
            </label>
            <div
              className={`rounded-xl border overflow-hidden ${
                formik.touched.description && formik.errors.description
                  ? 'border-red-500'
                  : 'border-gray-300'
              }`}
            >
              <DefaultEditor
                value={formik.values.description}
                onChange={(e) => {
                  formik.setFieldValue('description', e.target.value);
                  formik.setFieldValue('remarks', e.target.value);
                  if (formik.errors.description) {
                    formik.setFieldError('description', undefined);
                  }
                }}
                onBlur={() => formik.setFieldTouched('description', true)}
              />
            </div>
            {getFieldError('description') && (
              <p className="mt-1 text-xs text-red-500 font-medium">
                {getFieldError('description')}
              </p>
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
