'use client';

import { useEffect, useState, useRef } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';

import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';
import Dialog from './Dialog';
import FormInput from './ui/Input';
import { FiCamera, FiCheck, FiX, FiPercent, FiUser, FiMail, FiPhone, FiLock, FiLayers, FiShield } from 'react-icons/fi';

interface Reseller {
  _id?: string;
  fullName: string;
  email: string;
  phone: string;
  password?: string;
  role?: string;
  status: string;
  profileImage?: string;
  assignedProjects?: any[];
  commissionRate?: any;
}

interface ResellerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: Reseller | null;
}

const createValidationSchema = Yup.object({
  fullName: Yup.string()
    .required('Full name is required')
    .min(2, 'Full name must be at least 2 characters'),
  email: Yup.string()
    .required('Email is required')
    .matches(/^[A-Z0-9._%+-]+@gmail\.com$/i, 'Email must be a valid @gmail.com address'),
  phone: Yup.string()
    .required('Phone number is required')
    .matches(/^[0-9]{10}$/, 'Phone number must be exactly 10 digits'),
  password: Yup.string()
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
  commissionRate: Yup.number()
    .transform((value, originalValue) => (originalValue === '' ? 0 : value))
    .min(0, 'Commission rate cannot be less than 0')
    .max(100, 'Commission rate cannot exceed 100%')
    .optional()
    .nullable(),
  status: Yup.string().required('Status is required'),
});

const updateValidationSchema = Yup.object({
  fullName: Yup.string()
    .required('Full name is required')
    .min(2, 'Full name must be at least 2 characters'),
  email: Yup.string()
    .required('Email is required')
    .matches(/^[A-Z0-9._%+-]+@gmail\.com$/i, 'Email must be a valid @gmail.com address'),
  phone: Yup.string()
    .required('Phone number is required')
    .matches(/^[0-9]{10}$/, 'Phone number must be exactly 10 digits'),
  password: Yup.string().test(
    'min-length',
    'Password must be at least 6 characters',
    val => !val || val.length >= 6
  ),
  commissionRate: Yup.number()
    .transform((value, originalValue) => (originalValue === '' ? 0 : value))
    .min(0, 'Commission rate cannot be less than 0')
    .max(100, 'Commission rate cannot exceed 100%')
    .optional()
    .nullable(),
  status: Yup.string().required('Status is required'),
});

export default function ResellerDialog({
  isOpen,
  onClose,
  onSubmit: parentOnSubmit,
  initialData,
}: ResellerDialogProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [allProjects, setAllProjects] = useState<{ _id: string; name: string; commissionRate?: number; projectAmount?: number }[]>([]);
  const [assignedProjects, setAssignedProjects] = useState<{
    project: string;
    projectName: string;
    isSelected: boolean;
    commissionRate?: string;
    projectAmount?: string;
  }[]>([]);

  const isUpdate = !!initialData?._id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = getAuthToken();
      setToken(storedToken);
    }
  }, []);

  const formik = useFormik({
    initialValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      commissionRate: '',
      role: '',
      status: 'active',
      profileImage: null as File | null,
    },
    validationSchema: isUpdate ? updateValidationSchema : createValidationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values) => {
      await handleSubmit(values);
    },
    enableReinitialize: true,
  });

  useEffect(() => {
    if (error) setError(null);
  }, [formik.values]);

  const resetForm = (projects: { _id: string; name: string; commissionRate?: number; projectAmount?: number }[] = allProjects) => {
    formik.resetForm({
      values: {
        fullName: '',
        email: '',
        phone: '',
        password: '',
        commissionRate: '',
        role: '',
        status: 'active',
        profileImage: null,
      },
    });
    setPreviewImage(null);
    setError(null);

    const initialAssigned = projects.map((p) => ({
      project: p._id,
      projectName: p.name,
      isSelected: true,
      commissionRate: p.commissionRate !== undefined && p.commissionRate !== null ? String(p.commissionRate) : '',
      projectAmount: p.projectAmount !== undefined && p.projectAmount !== null ? String(p.projectAmount) : '',
    }));
    setAssignedProjects(initialAssigned);
  };

  const syncAssignedProjects = (fetchedProjects: typeof allProjects, currentInitialData: typeof initialData) => {
    if (currentInitialData?._id) {
      const rawAssigned = (currentInitialData as any).assignedProjects || [];
      const mapped = fetchedProjects.map((p: any) => {
        const match = rawAssigned.find((ap: any) => {
          const apProjId = typeof ap.project === 'object' && ap.project !== null ? ap.project._id : ap.project;
          return apProjId === p._id;
        });

        if (match) {
          const matchComm = match.commissionRate !== undefined && match.commissionRate !== null && match.commissionRate !== ''
            ? String(match.commissionRate)
            : (p.commissionRate !== undefined && p.commissionRate !== null ? String(p.commissionRate) : '');
          const matchAmt = match.projectAmount !== undefined && match.projectAmount !== null && match.projectAmount !== ''
            ? String(match.projectAmount)
            : (p.projectAmount !== undefined && p.projectAmount !== null ? String(p.projectAmount) : '');
          return {
            project: p._id,
            projectName: p.name,
            isSelected: match.isSelected !== false,
            commissionRate: matchComm,
            projectAmount: matchAmt,
          };
        }

        return {
          project: p._id,
          projectName: p.name,
          isSelected: true,
          commissionRate: p.commissionRate !== undefined && p.commissionRate !== null ? String(p.commissionRate) : '',
          projectAmount: p.projectAmount !== undefined && p.projectAmount !== null ? String(p.projectAmount) : '',
        };
      });
      setAssignedProjects(mapped);
    } else {
      const initialAssigned = fetchedProjects.map((p: any) => ({
        project: p._id,
        projectName: p.name,
        isSelected: true,
        commissionRate: p.commissionRate !== undefined && p.commissionRate !== null ? String(p.commissionRate) : '',
        projectAmount: p.projectAmount !== undefined && p.projectAmount !== null ? String(p.projectAmount) : '',
      }));
      setAssignedProjects(initialAssigned);
    }
  };

  // Fetch Projects on Open
  useEffect(() => {
    if (!isOpen) return;
    const storedToken = getAuthToken();
    const headers = { Authorization: `Bearer ${storedToken}` };

    axios.get(`${baseUrl.getAllProjects}?all=true&status=active`, { headers })
      .then((res) => {
        const fetchedProjects = res.data?.data || res.data?.projects || [];
        setAllProjects(fetchedProjects);
        syncAssignedProjects(fetchedProjects, initialData);
      })
      .catch(() => {
        setAllProjects([]);
        setAssignedProjects([]);
      });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialData?._id) {
      formik.setValues({
        fullName: initialData.fullName || '',
        email: initialData.email || '',
        phone: initialData.phone ? String(initialData.phone).replace(/\D/g, '').slice(-10) : '',
        password: '',
        commissionRate: initialData.commissionRate !== undefined && initialData.commissionRate !== null ? String(initialData.commissionRate) : '',
        role: initialData.role || '',
        status: initialData.status || 'active',
        profileImage: null,
      });
      setPreviewImage(
        initialData.profileImage
          ? (initialData.profileImage.includes('http')
              ? initialData.profileImage
              : `${baseUrl.getImageUrl}/images/ResellerProfileImages/${initialData.profileImage}`)
          : null
      );
      if (allProjects.length > 0) {
        syncAssignedProjects(allProjects, initialData);
      }
    } else {
      resetForm(allProjects);
    }
  }, [initialData, isOpen]);

  const handleToggleProject = (projectId: string) => {
    setAssignedProjects((prev) =>
      prev.map((item) =>
        item.project === projectId ? { ...item, isSelected: !item.isSelected } : item
      )
    );
  };

  const handleProjectCommissionChange = (projectId: string, rateStr: string) => {
    const val = rateStr.replace(/\D/g, '');
    const num = Number(val);
    if (val === '' || (num >= 0 && num <= 100)) {
      setAssignedProjects((prev) =>
        prev.map((item) =>
          item.project === projectId ? { ...item, commissionRate: val } : item
        )
      );
    }
  };

  const handleProjectAmountChange = (projectId: string, amountStr: string) => {
    const val = amountStr.replace(/\D/g, '');
    setAssignedProjects((prev) =>
      prev.map((item) =>
        item.project === projectId ? { ...item, projectAmount: val } : item
      )
    );
  };

  const handleToggleAllProjects = () => {
    const allSelected = assignedProjects.every((p) => p.isSelected);
    setAssignedProjects((prev) =>
      prev.map((item) => ({ ...item, isSelected: !allSelected }))
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!file.type.startsWith('image/') && !hasValidExtension) {
      toast.error('Please select a valid image file (JPG, PNG, GIF, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    formik.setFieldValue('profileImage', file);
  };

  const handleRemoveImage = () => {
    setPreviewImage(null);
    formik.setFieldValue('profileImage', null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    setError(null);

    try {
      const payload = new FormData();
      payload.append('fullName', values.fullName);
      payload.append('email', values.email);
      payload.append('phone', values.phone);
      if (values.role) {
        payload.append('role', values.role);
      }
      payload.append('status', values.status);

      const defaultComm = values.commissionRate ? parseInt(values.commissionRate, 10) : 0;
      payload.append('commissionRate', String(defaultComm));

      // Append Assigned Projects with their individual commission rates and amounts
      const formattedAssigned = assignedProjects.map((p) => {
        const projObj = allProjects.find(proj => proj._id === p.project);
        const fallbackRate = (projObj?.commissionRate !== undefined && projObj?.commissionRate !== null)
          ? projObj.commissionRate
          : defaultComm;
        const fallbackAmt = (projObj?.projectAmount !== undefined && projObj?.projectAmount !== null)
          ? projObj.projectAmount
          : 0;

        const itemComm = p.commissionRate !== '' && p.commissionRate !== undefined && p.commissionRate !== null
          ? parseInt(p.commissionRate, 10)
          : fallbackRate;

        const itemAmt = p.projectAmount !== '' && p.projectAmount !== undefined && p.projectAmount !== null
          ? parseInt(p.projectAmount, 10)
          : fallbackAmt;

        return {
          project: p.project,
          isSelected: p.isSelected,
          commissionRate: Number.isNaN(itemComm) ? 0 : itemComm,
          projectAmount: Number.isNaN(itemAmt) ? 0 : itemAmt,
        };
      });
      payload.append('assignedProjects', JSON.stringify(formattedAssigned));

      if (values.password.trim()) {
        payload.append('password', values.password);
      }

      if (values.profileImage) {
        payload.append('profileImage', values.profileImage);
      }

      const headers = {
        Authorization: `Bearer ${token || getAuthToken()}`
      };

      const response = isUpdate
        ? await axios.put(`${baseUrl.updateReseller}/${initialData?._id}`, payload, { headers })
        : await axios.post(baseUrl.addReseller, payload, { headers });

      parentOnSubmit?.(response.data);
      toast.success(isUpdate ? 'Reseller updated successfully' : 'Reseller created successfully');
      onClose();
    } catch (err: any) {
      const message = err.response?.data?.message || 'Something went wrong';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const activeProjectsCount = assignedProjects.filter((p) => p.isSelected).length;
  const areAllProjectsSelected = assignedProjects.length > 0 && assignedProjects.every((p) => p.isSelected);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isUpdate ? 'Edit Reseller' : 'Add New Reseller'}
      size="xl"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => formik.submitForm()}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm flex items-center gap-2"
            disabled={loading}
          >
            {loading && (
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {loading ? 'Saving...' : isUpdate ? 'Update Reseller' : 'Create Reseller'}
          </button>
        </div>
      }
    >
      <form noValidate onSubmit={formik.handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200 flex items-center gap-2">
            <FiShield className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Form Info + Projects */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* PERSONAL INFORMATION */}
            <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-gray-100">
                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
                  <FiUser className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                    Personal Information
                  </h4>
                  <p className="text-[11px] text-gray-400">Basic contact & login credentials</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <FormInput
                  label="Full Name"
                  name="fullName"
                  type="text"
                  value={formik.values.fullName}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.fullName && formik.errors.fullName ? formik.errors.fullName : undefined}
                  required
                  placeholder="e.g. John Doe"
                />

                <FormInput
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.email && formik.errors.email ? formik.errors.email : undefined}
                  required
                  placeholder="e.g. name@gmail.com"
                />

                <FormInput
                  label="Phone Number"
                  name="phone"
                  type="tel"
                  isPhone={true}
                  value={formik.values.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    formik.setFieldValue('phone', val);
                  }}
                  onBlur={formik.handleBlur}
                  error={formik.touched.phone && formik.errors.phone ? formik.errors.phone : undefined}
                  required
                  placeholder="10-digit mobile number"
                />

                <FormInput
                  label="Password"
                  name="password"
                  type="password"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.password && formik.errors.password ? formik.errors.password : undefined}
                  required={!isUpdate}
                  placeholder={isUpdate ? 'Leave blank to keep current' : 'Min 6 characters'}
                />

                <div className="sm:col-span-2">
                  <FormInput
                    label="Default Commission Rate (%)"
                    name="commissionRate"
                    type="text"
                    value={formik.values.commissionRate}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      const num = Number(val);
                      if (val === '' || (num >= 0 && num <= 100)) {
                        formik.setFieldValue('commissionRate', val);
                      }
                    }}
                    onBlur={formik.handleBlur}
                    error={formik.touched.commissionRate && formik.errors.commissionRate ? (formik.errors.commissionRate as string) : undefined}
                    placeholder="e.g. 20"
                    icon={<span className="text-gray-500 font-bold text-sm">%</span>}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Standard percentage commission the reseller earns on closed Digitalks deals
                  </p>
                </div>
              </div>
            </div>

            {/* ASSIGNED PROJECTS */}
            <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
                    <FiLayers className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                        Assigned Projects & Rates
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        {activeProjectsCount} / {assignedProjects.length} Active
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">Select accessible projects and specify custom commission %</p>
                  </div>
                </div>

                {assignedProjects.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleAllProjects}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 px-2.5 py-1 rounded-md border border-blue-200 transition-colors cursor-pointer"
                  >
                    {areAllProjectsSelected ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {assignedProjects.length > 0 ? (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {assignedProjects.map((item) => {
                    const projObj = allProjects.find(p => p._id === item.project);
                    const projectBaseRate = projObj?.commissionRate;
                    const projectBaseAmount = projObj?.projectAmount;
                    return (
                      <div
                        key={item.project}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 py-2 rounded-lg border transition-all ${
                          item.isSelected
                            ? 'bg-blue-50/20 border-blue-200 hover:border-blue-300 hover:bg-blue-50/40 shadow-2xs'
                            : 'bg-gray-50/50 border-gray-200 opacity-60'
                        }`}
                      >
                        <label 
                          onClick={() => handleToggleProject(item.project)}
                          className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 select-none"
                        >
                          <input
                            type="checkbox"
                            checked={item.isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer pointer-events-none"
                          />
                          <div className="truncate">
                            <div className="flex items-center gap-2 flex-wrap truncate">
                              <span className={`text-xs font-bold truncate ${item.isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                                {item.projectName}
                              </span>
                              {projectBaseRate !== undefined && projectBaseRate !== null && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-500 font-medium border border-gray-200/60">
                                  Default: {projectBaseRate}%
                                </span>
                              )}
                              {projectBaseAmount !== undefined && projectBaseAmount !== null && projectBaseAmount > 0 && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200/60">
                                  Base: ₹{projectBaseAmount.toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                              {item.isSelected ? 'Enabled for lead creation' : 'Disabled for this reseller'}
                            </span>
                          </div>
                        </label>

                        <div className="flex items-center gap-3">
                          {item.isSelected ? (
                            <div className="flex items-center gap-2.5 flex-wrap">
                              {/* Commission Rate % */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-medium text-gray-500">Rate:</span>
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    placeholder={String(projectBaseRate ?? formik.values.commissionRate ?? '0')}
                                    value={item.commissionRate ?? ''}
                                    onChange={(e) => handleProjectCommissionChange(item.project, e.target.value)}
                                    className="w-13 h-7 text-xs font-bold text-center pr-4 text-blue-700 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-2xs"
                                    title="Project commission % (editable)"
                                  />
                                  <span className="absolute right-1 text-[10px] font-bold text-gray-400 pointer-events-none">%</span>
                                </div>
                              </div>

                              {/* Project Base Amount ₹ */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-medium text-gray-500">Amount:</span>
                                <div className="relative flex items-center">
                                  <span className="absolute left-1.5 text-[11px] font-bold text-gray-400 pointer-events-none">₹</span>
                                  <input
                                    type="text"
                                    placeholder={String(projectBaseAmount ?? '0')}
                                    value={item.projectAmount ?? ''}
                                    onChange={(e) => handleProjectAmountChange(item.project, e.target.value)}
                                    className="w-20 h-7 text-xs font-bold pl-4 pr-1.5 text-emerald-700 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-2xs"
                                    title="Auto-fill base amount for reseller (editable)"
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
                              Disabled
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-gray-400 text-xs italic bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                  No active projects found. Please create a project first.
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Image & Status */}
          <div className="lg:col-span-4 space-y-4">

            {/* PROFILE IMAGE CARD */}
            <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-gray-100">
                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
                  <FiCamera className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                    Profile Photo
                  </h4>
                  <p className="text-[11px] text-gray-400">Avatar image</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-3 py-1">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden cursor-pointer group hover:border-blue-500 hover:bg-blue-50/30 transition-all shadow-2xs"
                >
                  {previewImage ? (
                    <>
                      <img
                        src={previewImage}
                        alt="Profile Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <FiCamera className="w-5 h-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-gray-400 group-hover:text-blue-600 transition-colors">
                      <FiCamera className="w-6 h-6 mb-1" />
                      <span className="text-[11px] font-medium">Upload</span>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {previewImage && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-medium hover:underline cursor-pointer"
                  >
                    <FiX className="w-3.5 h-3.5" /> Remove photo
                  </button>
                )}
                
                <p className="text-[10px] text-gray-400 text-center leading-tight">
                  Supports JPG, PNG, WEBP (Max 5MB)
                </p>
              </div>
            </div>

            {/* ACCOUNT STATUS */}
            <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-gray-100">
                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
                  <FiShield className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                    Account Status
                  </h4>
                  <p className="text-[11px] text-gray-400">Reseller access control</p>
                </div>
              </div>

              <div className="p-3 bg-gray-50/80 border border-gray-200/80 rounded-lg flex items-center justify-between">
                <div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                    formik.values.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      formik.values.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'
                    }`}></span>
                    {formik.values.status}
                  </span>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {formik.values.status === 'active'
                      ? 'Reseller can login and manage leads'
                      : 'Account is suspended/disabled'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    formik.setFieldValue(
                      'status',
                      formik.values.status === 'active' ? 'inactive' : 'active'
                    )
                  }
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formik.values.status === 'active' ? 'bg-emerald-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      formik.values.status === 'active' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

          </div>
        </div>
      </form>
    </Dialog>
  );
}
