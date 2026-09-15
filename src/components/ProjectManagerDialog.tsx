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

export interface ProjectManager {
  _id?: string;
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  password?: string;
  role?: any;
  status: string;
  profileImage?: string;
}

interface ProjectManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
  initialData?: ProjectManager | null;
}

const createValidationSchema = Yup.object({
  fullName: Yup.string()
    .required('Full name is required')
    .min(2, 'Full name must be at least 2 characters'),
  email: Yup.string()
    .required('Email is required')
    .email('Must be a valid email address'),
  phone: Yup.string()
    .required('Phone number is required')
    .matches(/^[0-9]{10}$/, 'Phone number must be exactly 10 digits'),
  password: Yup.string()
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
  status: Yup.string().required('Status is required'),
});

const updateValidationSchema = Yup.object({
  fullName: Yup.string()
    .required('Full name is required')
    .min(2, 'Full name must be at least 2 characters'),
  email: Yup.string()
    .required('Email is required')
    .email('Must be a valid email address'),
  phone: Yup.string()
    .required('Phone number is required')
    .matches(/^[0-9]{10}$/, 'Phone number must be exactly 10 digits'),
  password: Yup.string().test(
    'min-length',
    'Password must be at least 6 characters',
    (val) => !val || val.length >= 6
  ),
  status: Yup.string().required('Status is required'),
});

export default function ProjectManagerDialog({
  isOpen,
  onClose,
  onSubmit: parentOnSubmit,
  initialData,
}: ProjectManagerDialogProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const previewImageRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUpdate = !!(initialData?._id || initialData?.id);
  const pmId = initialData?._id || initialData?.id;

  const formik = useFormik({
    initialValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (pmId && initialData) {
      formik.setValues({
        fullName: initialData.fullName || '',
        email: initialData.email || '',
        phone: initialData.phone ? String(initialData.phone).replace(/\D/g, '').slice(0, 10) : '',
        password: '',
        status: initialData.status || 'active',
        profileImage: null,
      });

      if (initialData.profileImage) {
        const fullUrl = initialData.profileImage.startsWith('http')
          ? initialData.profileImage
          : `${baseUrl.getImageUrl}/${initialData.profileImage.replace(/^\/+/, '')}`;
        setPreviewImage(fullUrl);
        previewImageRef.current = fullUrl;
      } else {
        setPreviewImage(null);
        previewImageRef.current = null;
      }
    } else {
      formik.resetForm({
        values: {
          fullName: '',
          email: '',
          phone: '',
          password: '',
          status: 'active',
          profileImage: null,
        },
      });
      setPreviewImage(null);
      previewImageRef.current = null;
      setShowPassword(false);
      setError(null);
    }
  }, [isOpen, pmId, initialData]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File size must be less than 2MB');
        return;
      }
      formik.setFieldValue('profileImage', file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
        previewImageRef.current = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('fullName', values.fullName.trim());
      formData.append('email', values.email.trim().toLowerCase());
      formData.append('phone', values.phone.trim());
      formData.append('status', values.status);

      if (values.password && values.password.trim()) {
        formData.append('password', values.password.trim());
      }

      if (values.profileImage) {
        formData.append('profileImage', values.profileImage);
      }

      const headers = {
        Authorization: `Bearer ${getAuthToken()}`,
        'Content-Type': 'multipart/form-data',
      };

      if (isUpdate && pmId) {
        await axios.put(`${baseUrl.updateProjectManager}/${pmId}`, formData, { headers });
        toast.success('Project Manager updated successfully!');
      } else {
        await axios.post(baseUrl.addProjectManager, formData, { headers });
        toast.success('Project Manager created successfully!');
      }

      parentOnSubmit?.(values);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to save Project Manager';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isUpdate ? 'Edit Project Manager' : 'Add New Project Manager'}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm cursor-pointer"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => formik.handleSubmit()}
            disabled={loading || formik.isSubmitting}
            className="px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
          >
            {loading ? 'Saving...' : isUpdate ? 'Update Project Manager' : 'Save Project Manager'}
          </button>
        </div>
      }
    >
      <form onSubmit={formik.handleSubmit} className="p-2 space-y-5" noValidate>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* Profile Picture Upload */}
        <div className="flex flex-col items-center justify-center mb-4">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-blue-500 bg-gray-100 flex items-center justify-center shadow-md">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Profile Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-gray-400 uppercase">
                  {formik.values.fullName ? formik.values.fullName.slice(0, 2) : 'PM'}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition-colors cursor-pointer"
              title="Upload Photo"
            >
              <FiCamera size={16} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
          </div>
          <span className="text-xs text-gray-500 mt-2">Upload Profile Photo (Max 2MB)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Full Name"
            name="fullName"
            placeholder="Enter Full Name"
            value={formik.values.fullName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.fullName && formik.errors.fullName ? formik.errors.fullName : undefined}
            required={true}
          />

          <FormInput
            label="Email Address"
            name="email"
            type="email"
            placeholder="Enter Email Address"
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.email && formik.errors.email ? formik.errors.email : undefined}
            required={true}
          />

          <FormInput
            label="Contact Number"
            name="phone"
            type="tel"
            isPhone={true}
            placeholder="00000 00000"
            value={formik.values.phone}
            onChange={(e: any) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 10);
              formik.setFieldValue('phone', val);
            }}
            onBlur={formik.handleBlur}
            error={formik.touched.phone && formik.errors.phone ? formik.errors.phone : undefined}
            required={true}
          />

          <FormInput
            label={isUpdate ? 'Password (Leave blank to keep current)' : 'Password'}
            name="password"
            type="password"
            placeholder={isUpdate ? 'Enter new password or leave blank' : 'Enter Password (min 6 chars)'}
            value={formik.values.password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.password && formik.errors.password ? formik.errors.password : undefined}
            required={!isUpdate}
          />

          <div className="md:col-span-2">
            <FormSelect
              label="Status"
              name="status"
              value={formik.values.status}
              onChange={(val) => formik.setFieldValue('status', val)}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              placeholder="Select Status"
              required={true}
            />
          </div>
        </div>
      </form>
    </Dialog>
  );
}
