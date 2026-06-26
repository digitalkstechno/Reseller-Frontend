'use client';

import { useEffect, useState, useRef } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { EMAIL_REGEX } from '@/utills/emailRegex';
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
    .matches(EMAIL_REGEX, 'Invalid email format'),
  phone: Yup.string()
    .required('Phone number is required')
    .matches(/^[0-9]{10}$/, 'Phone number must be exactly 10 digits'),
  password: Yup.string()
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
  // role: Yup.string().required('Role is required'),
  status: Yup.string().required('Status is required'),
  commissionRate: Yup.number()
    .typeError('Commission must be a number')
    .integer('Commission must be an integer')
    .min(0, 'Commission cannot be less than 0')
    .max(100, 'Commission cannot exceed 100')
    .required('Commission percentage is required'),
});

const updateValidationSchema = Yup.object({
  fullName: Yup.string()
    .required('Full name is required')
    .min(2, 'Full name must be at least 2 characters'),
  email: Yup.string()
    .required('Email is required')
    .matches(EMAIL_REGEX, 'Invalid email format'),
  phone: Yup.string()
    .required('Phone number is required')
    .matches(/^[0-9]{10}$/, 'Phone number must be exactly 10 digits'),
  password: Yup.string().notRequired().min(6, 'Password must be at least 6 characters'),
  // role: Yup.string().required('Role is required'),
  status: Yup.string().required('Status is required'),
  commissionRate: Yup.number()
    .typeError('Commission must be a number')
    .integer('Commission must be an integer')
    .min(0, 'Commission cannot be less than 0')
    .max(100, 'Commission cannot exceed 100')
    .required('Commission percentage is required'),
});

export default function ResellerDialog({
  isOpen,
  onClose,
  onSubmit: parentOnSubmit,
  initialData,
}: ResellerDialogProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<{ _id: string; roleName: string }[]>([]);
  const [token, setToken] = useState<string | null>(null);

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
      commissionRate: '',
    },
    validationSchema: isUpdate ? updateValidationSchema : createValidationSchema,
    validateOnChange: false,
    validateOnBlur: false,
    onSubmit: async (values) => {
      await handleSubmit(values);
    },
    enableReinitialize: true,
  });

  useEffect(() => {
    if (error) setError(null);
  }, [formik.values, selectedFile]);

  const resetForm = () => {
    formik.resetForm();
    setSelectedFile(null);
    setPreviewImage(null);
    setShowPassword(false);
    setError(null);
  };

  useEffect(() => {
    if (initialData?._id) {
      formik.setValues({
        fullName: initialData.fullName || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        password: '',
        role: initialData.role || '',
        status: initialData.status || 'active',
        commissionRate: (initialData as any).commissionRate || '',
      });

      if (initialData.profileImage) {
        setPreviewImage(
          `${baseUrl.getImageUrl}/images/ResellerProfileImages/${initialData.profileImage}`
        );
      }
    } else {
      resetForm();
    }
  }, [initialData, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const storedToken = getAuthToken();
    const headers = { Authorization: `Bearer ${storedToken}` };

    axios.get(baseUrl.getAllRoles, { headers })
      .then((res) => {
        const fetchedRoles = res.data?.data || res.data?.roles || [];
        setRoles(fetchedRoles);

        // Auto-select Reseller role if exists and in add mode
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
  }, [isOpen, initialData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPEG, PNG, JPG, and GIF images are allowed');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    setPreviewImage(URL.createObjectURL(file));
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

      if (values.password.trim()) {
        payload.append('password', values.password);
      }

      if (selectedFile) {
        payload.append('profileImage', selectedFile);
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

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isUpdate ? 'Edit Reseller' : 'Add Reseller '}
      size="xl"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="reseller-form"
            className="px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            disabled={loading}
          >
            {loading ? 'Saving...' : isUpdate ? 'Update Reseller' : '+ Add Reseller'}
          </button>
        </>
      }
    >
      <form noValidate id="reseller-form" onSubmit={formik.handleSubmit} className="p-1 space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Personal info and address details */}
          <div className="lg:col-span-8 space-y-6">

            {/* PERSONAL INFORMATION CARD */}
            <div className="border border-gray-100 rounded-xl bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-50 text-blue-600 font-semibold text-sm uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                PERSONAL INFORMATION
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  placeholder="name@email.com"
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

                <div className="relative">
                  <FormInput
                    label="Password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formik.values.password}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.password && formik.errors.password ? formik.errors.password : undefined}
                    required={!isUpdate}
                    placeholder="Min 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-[38px] text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    {/* {showPassword ? 'Hide' : 'Show'} */}
                  </button>
                </div>

                <FormInput
                  label="Commission (%)"
                  name="commissionRate"
                  type="text"
                  value={formik.values.commissionRate}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val === '') {
                      formik.setFieldValue('commissionRate', '');
                      return;
                    }
                    const num = parseInt(val, 10);
                    if (num >= 0 && num <= 100) {
                      formik.setFieldValue('commissionRate', num.toString());
                    }
                  }}
                  onBlur={formik.handleBlur}
                  error={formik.touched.commissionRate && formik.errors.commissionRate ? formik.errors.commissionRate : undefined}
                  required
                  placeholder="e.g. 10"
                />

                {/* <div className="md:col-span-2">
                  <FormSelect
                    label="Role"
                    name="role"
                    value={formik.values.role}
                    onChange={(val) => formik.setFieldValue('role', val)}
                    options={roles.map((r) => ({ value: r._id, label: r.roleName }))}
                    error={formik.touched.role && formik.errors.role ? formik.errors.role : undefined}
                    required
                    placeholder="Select role"
                  />
                </div> */}
              </div>
            </div>

          </div>

          {/* Right Column: Image and settings */}
          <div className="lg:col-span-4 space-y-6">

            {/* PROFILE IMAGE CARD */}
            <div className="border border-gray-100 rounded-xl bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-50 text-blue-600 font-semibold text-sm uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                PROFILE IMAGE
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="relative w-28 h-28 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden">
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <FiCamera className="w-8 h-8" />
                    </div>
                  )}
                </div>

                <label
                  htmlFor="profile-image-upload"
                  className="px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 font-medium text-sm hover:bg-blue-100 cursor-pointer transition-colors text-center inline-flex items-center gap-1.5"
                >
                  <FiCamera className="w-4 h-4" />
                  Upload Image
                  <input
                    id="profile-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* SETTINGS CARD */}
            <div className="border border-gray-100 rounded-xl bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-50 text-blue-600 font-semibold text-sm uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                SETTINGS
              </div>

              <div className="space-y-4">

                <div className="space-y-2">
                  <span className="block text-sm font-medium text-gray-700">Status</span>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <button
                      type="button"
                      onClick={() =>
                        formik.setFieldValue(
                          'status',
                          formik.values.status === 'active' ? 'inactive' : 'active'
                        )
                      }
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formik.values.status === 'active' ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formik.values.status === 'active' ? 'translate-x-5' : 'translate-x-0'
                          }`}
                      />
                    </button>
                    <div>
                      <span className="block text-sm font-semibold text-gray-950 capitalize">
                        {formik.values.status}
                      </span>
                      <span className="block text-xs text-gray-500">
                        Reseller can access dashboard
                      </span>
                    </div>
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
