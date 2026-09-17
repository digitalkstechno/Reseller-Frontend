'use client';

import { useEffect, useState, useRef } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';

import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';
import Dialog from './Dialog';
import FormInput from './ui/Input';
import FormSelect from './ui/FormSelect';
import { FiCamera } from 'react-icons/fi';

interface Reseller {
  _id?: string;
  fullName: string;
  email: string;
  phone: string;
  password?: string;
  role: string;
  status: string;
  profileImage?: string;
  commissionRate?: string;
  assignedProjects?: any[];
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
  // role: Yup.string().required('Role is required'),
  status: Yup.string().required('Status is required'),
  commissionRate: Yup.string().nullable().optional(),
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
  // role: Yup.string().required('Role is required'),
  status: Yup.string().required('Status is required'),
  commissionRate: Yup.string().nullable().optional(),
});

export default function ResellerDialog({
  isOpen,
  onClose,
  onSubmit: parentOnSubmit,
  initialData,
}: ResellerDialogProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const previewImageRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<{ _id: string; roleName: string }[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [allProjects, setAllProjects] = useState<{ _id: string; name: string; commissionRate?: number }[]>([]);
  const [assignedProjects, setAssignedProjects] = useState<{
    project: string;
    projectName: string;
    commissionRate: string;
    isSelected: boolean;
  }[]>([]);

  const isUpdate = !!initialData?._id;

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
      role: '',
      status: 'active',
      commissionRate: '20',
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

  const resetForm = (projects: { _id: string; name: string; commissionRate?: number }[] = allProjects) => {
    formik.resetForm({
      values: {
        fullName: '',
        email: '',
        phone: '',
        password: '',
        role: '',
        status: 'active',
        commissionRate: '20',
        profileImage: null,
      },
    });
    setPreviewImage(null);
    setShowPassword(false);
    setError(null);

    // Initialize all projects as selected with their default commissionRate
    const initialAssigned = projects.map((p) => ({
      project: p._id,
      projectName: p.name,
      commissionRate: String(p.commissionRate !== undefined && p.commissionRate !== null ? p.commissionRate : 20),
      isSelected: true,
    }));
    setAssignedProjects(initialAssigned);
  };

  const prevInitialDataId = useRef<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const syncAssignedProjects = (fetchedProjects: typeof allProjects, currentInitialData: typeof initialData) => {
    if (currentInitialData?._id) {
      const rawAssigned = (currentInitialData as any).assignedProjects || [];
      const mapped = fetchedProjects.map((p: any) => {
        const projectDefRate = p.commissionRate !== undefined && p.commissionRate !== null ? p.commissionRate : 0;
        const match = rawAssigned.find((ap: any) => {
          const apProjId = typeof ap.project === 'object' && ap.project !== null ? ap.project._id : ap.project;
          return apProjId === p._id;
        });

        if (match) {
          // If match has a custom commissionRate, use it; otherwise fallback to project's default rate
          const savedRate = match.commissionRate !== undefined && match.commissionRate !== null ? match.commissionRate : '';
          const finalRate = savedRate !== '' && Number(savedRate) !== 0 ? String(savedRate) : String(projectDefRate);
          return {
            project: p._id,
            projectName: p.name,
            commissionRate: finalRate,
            isSelected: match.isSelected !== false,
          };
        }

        return {
          project: p._id,
          projectName: p.name,
          commissionRate: String(projectDefRate),
          isSelected: true,
        };
      });
      setAssignedProjects(mapped);
    } else {
      const initialAssigned = fetchedProjects.map((p: any) => ({
        project: p._id,
        projectName: p.name,
        commissionRate: String(p.commissionRate !== undefined && p.commissionRate !== null ? p.commissionRate : 0),
        isSelected: true,
      }));
      setAssignedProjects(initialAssigned);
    }
  };

  // Fetch Projects and Roles on Open
  useEffect(() => {
    if (!isOpen) return;
    const storedToken = getAuthToken();
    const headers = { Authorization: `Bearer ${storedToken}` };

    // Fetch Roles
    axios.get(baseUrl.getAllRoles, { headers })
      .then((res) => {
        const fetchedRoles = res.data?.data || res.data?.roles || [];
        setRoles(fetchedRoles);

        if (!initialData?._id) {
          const resellerRole = fetchedRoles.find(
            (r: any) => r.roleName?.toLowerCase() === 'reseller'
          );
          if (resellerRole) {
            formik.setFieldValue('role', resellerRole._id);
          }
        }
      })
      .catch(() => setRoles([]));

    // Fetch Projects
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
        phone: initialData.phone ? String(initialData.phone).replace(/\D/g, '').slice(0, 10) : '',
        password: '',
        role: initialData.role || '',
        status: initialData.status || 'active',
        commissionRate: (initialData as any).commissionRate || '',
        profileImage: null,
      });
      setPreviewImage(initialData.profileImage || null);
      if (allProjects.length > 0) {
        syncAssignedProjects(allProjects, initialData);
      }
    } else {
      resetForm();
    }
  }, [initialData, isOpen]);

  const handleToggleProject = (projectId: string) => {
    setAssignedProjects((prev) =>
      prev.map((item) =>
        item.project === projectId ? { ...item, isSelected: !item.isSelected } : item
      )
    );
  };

  const handleProjectRateChange = (projectId: string, newRate: string) => {
    const val = newRate.replace(/\D/g, '');
    if (val === '') {
      setAssignedProjects((prev) =>
        prev.map((item) => (item.project === projectId ? { ...item, commissionRate: '' } : item))
      );
      return;
    }
    const num = Math.max(0, Math.min(100, parseInt(val, 10)));
    setAssignedProjects((prev) =>
      prev.map((item) =>
        item.project === projectId ? { ...item, commissionRate: num.toString() } : item
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
      previewImageRef.current = reader.result as string;
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    formik.setFieldValue('profileImage', file);
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
      payload.append('commissionRate', values.commissionRate);

      // Append Assigned Projects with custom commission rates
      const formattedAssigned = assignedProjects.map((p) => ({
        project: p.project,
        commissionRate: Number(p.commissionRate) || 0,
        isSelected: p.isSelected,
      }));
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

  const areAllProjectsSelected = assignedProjects.length > 0 && assignedProjects.every((p) => p.isSelected);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isUpdate ? 'Edit Reseller' : 'Add Reseller'}
      size="xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => formik.submitForm()}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            disabled={loading}
          >
            {loading ? 'Saving...' : isUpdate ? 'Update Reseller' : '+ Add Reseller'}
          </button>
        </>
      }
    >
      <form noValidate onSubmit={formik.handleSubmit} className="p-0.5 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Form Fields */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* PERSONAL INFORMATION */}
            <div className="border border-gray-100 rounded-xl bg-white p-4.5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-gray-50 text-blue-600 font-semibold text-xs uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                Personal Information
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormInput
                  label="Full Name"
                  name="fullName"
                  type="text"
                  value={formik.values.fullName}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.fullName && formik.errors.fullName ? formik.errors.fullName : undefined}
                  required
                  placeholder="John Doe"
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
                  placeholder="name@gmail.com"
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
                  placeholder="98765 43210"
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
              </div>
            </div>

            {/* ASSIGNED PROJECTS & COMMISSION RATES CARD */}
            <div className="border border-gray-100 rounded-xl bg-white p-4.5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-50">
                <div className="flex items-center gap-2 text-blue-600 font-semibold text-xs uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  Projects & Commission Rates
                </div>
                {assignedProjects.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleAllProjects}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer bg-blue-50/80 hover:bg-blue-100/70 px-2 py-0.5 rounded border border-blue-200 transition-colors"
                  >
                    {areAllProjectsSelected ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {assignedProjects.length > 0 ? (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                  {assignedProjects.map((item) => (
                    <div
                      key={item.project}
                      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition-all ${
                        item.isSelected
                          ? 'bg-blue-50/40 border-blue-200 hover:bg-blue-50/70'
                          : 'bg-gray-50 border-gray-200 opacity-60'
                      }`}
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0 select-none">
                        <input
                          type="checkbox"
                          checked={item.isSelected}
                          onChange={() => handleToggleProject(item.project)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="truncate">
                          <span className={`text-xs font-semibold block truncate ${item.isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                            {item.projectName}
                          </span>
                          <span className="text-[10px] text-gray-400 block -mt-0.5">
                            {item.isSelected ? 'Active for lead creation' : 'Hidden from reseller'}
                          </span>
                        </div>
                      </label>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-medium text-gray-500">Commission:</span>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            value={item.commissionRate}
                            disabled={!item.isSelected}
                            onChange={(e) => handleProjectRateChange(item.project, e.target.value)}
                            placeholder="0"
                            className="w-16 pl-2 pr-5 py-1 text-xs font-bold text-center text-gray-900 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100 disabled:text-gray-400 shadow-2xs"
                          />
                          <span className="absolute right-2 text-xs font-bold text-blue-600 pointer-events-none">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4 italic">
                  No active projects available to assign.
                </p>
              )}
            </div>

          </div>

          {/* Right Column: Image and Settings */}
          <div className="lg:col-span-4 space-y-4">

            {/* PROFILE IMAGE CARD */}
            <div className="border border-gray-100 rounded-xl bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-gray-50 text-blue-600 font-semibold text-xs uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                Profile Image
              </div>

              <div className="flex flex-col items-center gap-2.5 py-1">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden cursor-pointer group hover:border-blue-400 transition-colors"
                >
                  {previewImage ? (
                    <>
                      <img
                        key={previewImage.slice(-20)}
                        src={previewImage}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <FiCamera className="w-5 h-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-gray-400 group-hover:text-blue-500 transition-colors">
                      <FiCamera className="w-6 h-6 mb-0.5" />
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
                
                <p className="text-[11px] text-gray-400 text-center leading-tight">
                  JPG, PNG, GIF, WEBP (Max 5MB)
                </p>
              </div>
            </div>

            {/* SETTINGS CARD */}
            <div className="border border-gray-100 rounded-xl bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-gray-50 text-blue-600 font-semibold text-xs uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                Settings
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-medium text-gray-600">Account Status</span>
                <div className="flex items-center gap-3 p-2.5 bg-gray-50/80 border border-gray-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() =>
                      formik.setFieldValue(
                        'status',
                        formik.values.status === 'active' ? 'inactive' : 'active'
                      )
                    }
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formik.values.status === 'active' ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        formik.values.status === 'active' ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <div>
                    <span className="block text-xs font-semibold text-gray-900 capitalize leading-tight">
                      {formik.values.status}
                    </span>
                    <span className="block text-[10px] text-gray-400">
                      Reseller can access dashboard
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </form>
    </Dialog>
  );
}
