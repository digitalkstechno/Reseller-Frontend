'use client';

import { useEffect, useState, useRef } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';
import { DefaultEditor } from 'react-simple-wysiwyg';
import Dialog from './Dialog';
import FormInput from './ui/Input';
import FormSelect from './ui/FormSelect';
import { FiCamera, FiTrash2, FiExternalLink, FiPlus } from 'react-icons/fi';

export interface Project {
  _id?: string;
  name: string;
  projectManager?: any;
  demoLink?: string;
  demoId?: string;
  demoPassword?: string;
  images?: string[];
  features?: string;
  description?: string;
  projectAmount?: number | string;
  status: 'active' | 'inactive';
  createdBy?: any;
  createdAt?: string;
}

interface ProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
  initialData?: Project | null;
}

const validationSchema = Yup.object({
  name: Yup.string()
    .required('Project name is required')
    .min(2, 'Project name must be at least 2 characters'),
  projectManager: Yup.string().optional(),
  demoLink: Yup.string().url('Must be a valid URL (e.g. https://example.com)').nullable().optional(),
  demoId: Yup.string().optional(),
  demoPassword: Yup.string().optional(),
  features: Yup.string().optional(),
  status: Yup.string().required('Status is required'),
});

export default function ProjectDialog({
  isOpen,
  onClose,
  onSubmit: parentOnSubmit,
  initialData,
}: ProjectDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectManagers, setProjectManagers] = useState<{ _id: string; fullName: string }[]>([]);

  // Array of 4 slots: each item is either { type: 'existing', url: string } | { type: 'new', file: File, preview: string } | null
  const [imageSlots, setImageSlots] = useState<(
    | { type: 'existing'; url: string }
    | { type: 'new'; file: File; preview: string }
    | null
  )[]>([null, null, null, null]);

  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const isUpdate = !!initialData?._id;

  const formik = useFormik({
    initialValues: {
      name: '',
      projectManager: '',
      demoLink: '',
      demoId: '',
      demoPassword: '',
      features: '',
      status: 'active' as 'active' | 'inactive',
    },
    validationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values) => {
      await handleSubmit(values);
    },
    enableReinitialize: true,
  });

  useEffect(() => {
    if (!isOpen) return;

    const fetchPMs = async () => {
      try {
        const res = await axios.get(`${baseUrl.getAllProjectManagers}?all=true`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        });
        setProjectManagers(res.data?.data || []);
      } catch (err) {
        console.error('Failed to fetch project managers:', err);
      }
    };
    fetchPMs();

    if (initialData?._id) {
      const pmId = typeof initialData.projectManager === 'object' && initialData.projectManager !== null
        ? initialData.projectManager?._id || ''
        : initialData.projectManager || '';

      formik.setValues({
        name: initialData.name || '',
        projectManager: pmId,
        demoLink: initialData.demoLink || '',
        demoId: initialData.demoId || '',
        demoPassword: initialData.demoPassword || '',
        features: initialData.features || initialData.description || '',
        status: initialData.status || 'active',
      });

      const initialImages = (initialData.images || []).slice(0, 4);
      const newSlots: (
        | { type: 'existing'; url: string }
        | { type: 'new'; file: File; preview: string }
        | null
      )[] = [null, null, null, null];

      initialImages.forEach((url, idx) => {
        if (idx < 4) {
          newSlots[idx] = { type: 'existing', url };
        }
      });
      setImageSlots(newSlots);
    } else {
      formik.resetForm({
        values: {
          name: '',
          projectManager: '',
          demoLink: '',
          demoId: '',
          demoPassword: '',
          features: '',
          status: 'active',
        },
      });
      setImageSlots([null, null, null, null]);
    }
    setError(null);
  }, [isOpen, initialData]);

  const handleFileSelect = (slotIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const hasValidExtension = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!file.type.startsWith('image/') && !hasValidExtension) {
      toast.error('Please select a valid image file (JPG, PNG, GIF, WEBP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const updated = [...imageSlots];
      updated[slotIndex] = {
        type: 'new',
        file,
        preview: reader.result as string,
      };
      setImageSlots(updated);
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  };

  const removeSlotImage = (slotIndex: number) => {
    const updated = [...imageSlots];
    updated[slotIndex] = null;
    setImageSlots(updated);
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    setError(null);

    try {
      const payload = new FormData();
      payload.append('name', values.name.trim());
      payload.append('projectManager', values.projectManager ? values.projectManager.trim() : '');
      payload.append('demoLink', values.demoLink ? values.demoLink.trim() : '');
      payload.append('demoId', values.demoId ? values.demoId.trim() : '');
      payload.append('demoPassword', values.demoPassword ? values.demoPassword.trim() : '');
      payload.append('features', values.features || '');
      payload.append('description', values.features || '');
      payload.append('status', values.status);

      // Existing images to retain
      const existingToRetain = imageSlots
        .filter((slot): slot is { type: 'existing'; url: string } => slot?.type === 'existing')
        .map((s) => s.url);
      payload.append('existingImages', JSON.stringify(existingToRetain));

      // Append new files
      imageSlots.forEach((slot) => {
        if (slot?.type === 'new') {
          payload.append('images', slot.file);
        }
      });

      const token = getAuthToken();
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const response = isUpdate
        ? await axios.put(`${baseUrl.updateProject}/${initialData?._id}`, payload, { headers })
        : await axios.post(baseUrl.addProject, payload, { headers });

      parentOnSubmit?.(response.data);
      toast.success(isUpdate ? 'Project updated successfully' : 'Project created successfully');
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save project';
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
      title={isUpdate ? 'Edit Project' : 'Add New Project'}
      size="xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => formik.submitForm()}
            className="px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            disabled={loading}
          >
            {loading ? 'Saving...' : isUpdate ? 'Update Project' : '+ Add Project'}
          </button>
        </>
      }
    >
      <form noValidate onSubmit={formik.handleSubmit} className="p-1 space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: General Information */}
          <div className="lg:col-span-8 space-y-6">
            <div className="border border-gray-100 rounded-xl bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-50 text-blue-600 font-semibold text-sm uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                PROJECT INFORMATION
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput
                  label="Project Name"
                  name="name"
                  type="text"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.name && formik.errors.name ? formik.errors.name : undefined}
                  required
                  placeholder="e.g. E-Commerce Web & App"
                />

                <FormSelect
                  label="Project Manager"
                  name="projectManager"
                  value={formik.values.projectManager}
                  onChange={(val) => formik.setFieldValue('projectManager', val)}
                  options={projectManagers.map((pm) => ({
                    value: pm._id,
                    label: pm.fullName,
                  }))}
                  placeholder="Select Project Manager"
                  error={formik.touched.projectManager && formik.errors.projectManager ? formik.errors.projectManager : undefined}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <FormInput
                    label="Live Demo Link"
                    name="demoLink"
                    type="url"
                    value={formik.values.demoLink}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.demoLink && formik.errors.demoLink ? formik.errors.demoLink : undefined}
                    placeholder="https://demo.example.com"
                    icon={
                      formik.values.demoLink ? (
                        <a
                          href={formik.values.demoLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                          title="Open Demo"
                        >
                          <FiExternalLink className="w-4 h-4" />
                        </a>
                      ) : undefined
                    }
                  />
                </div>

                <div className="md:col-span-1">
                  <FormInput
                    label="Demo ID / User"
                    name="demoId"
                    type="text"
                    value={formik.values.demoId}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.demoId && formik.errors.demoId ? formik.errors.demoId : undefined}
                    placeholder="e.g. admin / user"
                  />
                </div>

                <div className="md:col-span-1">
                  <FormInput
                    label="Demo Password"
                    name="demoPassword"
                    type="text"
                    value={formik.values.demoPassword}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.demoPassword && formik.errors.demoPassword ? formik.errors.demoPassword : undefined}
                    placeholder="e.g. demo@123"
                  />
                </div>
              </div>

              <div className="w-full">
                <label className="block mb-1.5 text-sm font-semibold text-gray-700">
                  Features & Details
                </label>
                <div className={`rounded-xl border overflow-hidden ${formik.touched.features && formik.errors.features ? 'border-red-500' : 'border-gray-300'}`}>
                  <DefaultEditor
                    value={formik.values.features}
                    onChange={(e) => formik.setFieldValue('features', e.target.value)}
                    onBlur={() => formik.setFieldTouched('features', true)}
                  />
                </div>
                {formik.touched.features && formik.errors.features && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{formik.errors.features}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: 4 Images & Settings */}
          <div className="lg:col-span-4 space-y-6">
            {/* 4 IMAGES UPLOAD CARD */}
            <div className="border border-gray-100 rounded-xl bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-50">
                <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  PROJECT IMAGES (MAX 4)
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  {imageSlots.filter(Boolean).length}/4
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((idx) => {
                  const slot = imageSlots[idx];
                  const imgSrc = slot?.type === 'existing' ? slot.url : slot?.preview;

                  return (
                    <div
                      key={idx}
                      className="relative group border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-xl h-28 bg-gray-50 flex flex-col items-center justify-center overflow-hidden transition-all"
                    >
                      {imgSrc ? (
                        <>
                          <img
                            src={imgSrc}
                            alt={`Slot ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                            <button
                              type="button"
                              onClick={() => fileInputRefs[idx].current?.click()}
                              className="p-1.5 bg-white text-gray-800 rounded-full hover:bg-gray-100 shadow"
                              title="Change Image"
                            >
                              <FiCamera className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSlotImage(idx)}
                              className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 shadow"
                              title="Remove Image"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRefs[idx].current?.click()}
                          className="flex flex-col items-center justify-center text-gray-400 hover:text-blue-600 transition-colors w-full h-full p-2 cursor-pointer"
                        >
                          <FiPlus className="w-6 h-6 mb-1 text-gray-400" />
                          <span className="text-xs font-medium">Image {idx + 1}</span>
                        </button>
                      )}

                      <input
                        ref={fileInputRefs[idx]}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileSelect(idx, e)}
                        className="hidden"
                      />
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-gray-500 text-center leading-tight">
                Upload up to 4 project screenshots or banners (JPG, PNG, WEBP).
              </p>
            </div>

            {/* SETTINGS CARD */}
            <div className="border border-gray-100 rounded-xl bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-50 text-blue-600 font-semibold text-sm uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                SETTINGS
              </div>

              <div className="space-y-2">
                <span className="block text-sm font-medium text-gray-700">Project Status</span>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <button
                    type="button"
                    onClick={() =>
                      formik.setFieldValue(
                        'status',
                        formik.values.status === 'active' ? 'inactive' : 'active'
                      )
                    }
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formik.values.status === 'active' ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        formik.values.status === 'active' ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <div>
                    <span className="block text-sm font-semibold text-gray-950 capitalize">
                      {formik.values.status}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {formik.values.status === 'active'
                        ? 'Visible to resellers in Add Lead'
                        : 'Hidden from resellers'}
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
