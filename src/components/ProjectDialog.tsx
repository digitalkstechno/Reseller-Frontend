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
  projectManagers?: any[];
  commissionRate?: number | string;
  demoLink?: string;
  demoId?: string;
  demoPassword?: string;
  singlePageLink?: string;
  labelCustomization?: boolean;
  images?: string[];
  features?: string;
  description?: string;
  projectAmount?: number | string;
  status: 'active' | 'inactive';
  themeColor?: string;
  sortOrder?: number;
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
    .required('Product name is required')
    .min(2, 'Product name must be at least 2 characters'),
  projectManagers: Yup.array().of(Yup.string()).optional(),
  commissionRate: Yup.number()
    .transform((value, originalValue) => (originalValue === '' ? undefined : value))
    .min(0, 'Commission rate cannot be negative')
    .max(100, 'Commission rate cannot exceed 100%')
    .nullable()
    .optional(),
  projectAmount: Yup.number()
    .transform((value, originalValue) => (originalValue === '' ? undefined : value))
    .min(0, 'Product amount cannot be negative')
    .nullable()
    .optional(),
  demoLink: Yup.string().url('Must be a valid URL (e.g. https://example.com)').nullable().optional(),
  demoId: Yup.string().optional(),
  demoPassword: Yup.string().optional(),
  singlePageLink: Yup.string().url('Must be a valid URL (e.g. https://example.com)').nullable().optional(),
  labelCustomization: Yup.boolean().optional(),
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
  const [projectManagers, setProjectManagers] = useState<{ _id: string; fullName: string; email?: string }[]>([]);
  const [isPMDropdownOpen, setIsPMDropdownOpen] = useState(false);
  const [pmSearch, setPmSearch] = useState('');
  const [featurePoints, setFeaturePoints] = useState<string[]>([]);
  const [featureInput, setFeatureInput] = useState('');
  const pmDropdownRef = useRef<HTMLDivElement>(null);

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
      name: initialData?.name || '',
      projectManagers: (Array.isArray(initialData?.projectManagers) && initialData!.projectManagers!.length > 0
        ? initialData!.projectManagers!.map((pm: any) => (typeof pm === 'object' && pm !== null ? pm._id || pm.id : pm)).filter(Boolean)
        : initialData?.projectManager
        ? [typeof initialData.projectManager === 'object' && initialData.projectManager !== null ? initialData.projectManager._id || initialData.projectManager.id : initialData.projectManager].filter(Boolean)
        : []) as string[],
      commissionRate: initialData?.commissionRate !== undefined && initialData?.commissionRate !== null ? String(initialData.commissionRate) : '',
      projectAmount: initialData?.projectAmount !== undefined && initialData?.projectAmount !== null ? String(initialData.projectAmount) : '',
      demoLink: initialData?.demoLink || '',
      demoId: initialData?.demoId || '',
      demoPassword: initialData?.demoPassword || '',
      singlePageLink: initialData?.singlePageLink || '',
      labelCustomization: initialData?.labelCustomization === true || (initialData?.labelCustomization as any) === 'true' || (initialData?.labelCustomization as any) === 1,
      features: initialData?.features || initialData?.description || '',
      status: (initialData?.status || 'active') as 'active' | 'inactive',
      themeColor: initialData?.themeColor || '#2563EB',
    },
    validationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values) => {
      await handleSubmit(values);
    },
    enableReinitialize: true,
  });

  // Close PM dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pmDropdownRef.current && !pmDropdownRef.current.contains(event.target as Node)) {
        setIsPMDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      let selectedPMIds: string[] = [];
      if (Array.isArray(initialData.projectManagers) && initialData.projectManagers.length > 0) {
        selectedPMIds = initialData.projectManagers.map((pm: any) =>
          typeof pm === 'object' && pm !== null ? pm._id || pm.id : pm
        ).filter(Boolean);
      } else if (initialData.projectManager) {
        const singleId = typeof initialData.projectManager === 'object' && initialData.projectManager !== null
          ? initialData.projectManager._id || initialData.projectManager.id
          : initialData.projectManager;
        if (singleId) selectedPMIds = [singleId];
      }

      let initialDesc = initialData.features || initialData.description || '';
      const extractedPoints: string[] = [];

      // Check for <li> elements in features
      const liMatches = Array.from(initialDesc.matchAll(/<li[^>]*>(.*?)<\/li>/gi));
      for (const match of liMatches) {
        const cleanText = match[1].replace(/<[^>]+>/g, '').trim();
        if (cleanText) extractedPoints.push(cleanText);
      }

      if (extractedPoints.length > 0) {
        setFeaturePoints(extractedPoints);
        initialDesc = initialDesc.replace(/<ul[^>]*>[\s\S]*?<\/ul>/gi, '').trim();
      } else {
        setFeaturePoints([]);
      }

      formik.setValues({
        name: initialData.name || '',
        projectManagers: selectedPMIds,
        commissionRate: initialData.commissionRate !== undefined && initialData.commissionRate !== null ? String(initialData.commissionRate) : '',
        projectAmount: initialData.projectAmount !== undefined && initialData.projectAmount !== null ? String(initialData.projectAmount) : '',
        demoLink: initialData.demoLink || '',
        demoId: initialData.demoId || '',
        demoPassword: initialData.demoPassword || '',
        singlePageLink: initialData.singlePageLink || '',
        labelCustomization: initialData.labelCustomization === true || (initialData.labelCustomization as any) === 'true' || (initialData.labelCustomization as any) === 1,
        features: initialDesc,
        status: initialData.status || 'active',
        themeColor: initialData.themeColor || '#2563EB',
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
      setFeaturePoints([]);
      setFeatureInput('');
      formik.resetForm({
        values: {
          name: '',
          projectManagers: [],
          commissionRate: '',
          projectAmount: '',
          demoLink: '',
          demoId: '',
          demoPassword: '',
          singlePageLink: '',
          labelCustomization: false,
          features: '',
          status: 'active',
          themeColor: '#2563EB',
        },
      });
      setImageSlots([null, null, null, null]);
    }
    setError(null);
    setIsPMDropdownOpen(false);
    setPmSearch('');
  }, [isOpen, initialData]);

  const handleAddFeature = () => {
    const trimmed = featureInput.trim();
    if (!trimmed) return;
    setFeaturePoints((prev) => [...prev, trimmed]);
    setFeatureInput('');
  };

  const handleRemoveFeature = (index: number) => {
    setFeaturePoints((prev) => prev.filter((_, i) => i !== index));
  };

  const togglePMSelection = (pmId: string) => {
    const current = formik.values.projectManagers || [];
    if (current.includes(pmId)) {
      formik.setFieldValue(
        'projectManagers',
        current.filter((id) => id !== pmId)
      );
    } else {
      formik.setFieldValue('projectManagers', [...current, pmId]);
    }
  };

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
      let finalFeatures = '';
      if (featurePoints.length > 0) {
        const listItems = featurePoints.map((p) => `<li>${p}</li>`).join('');
        finalFeatures = `<ul>${listItems}</ul>`;
        if (values.features && values.features.trim()) {
          finalFeatures += `<br/>${values.features.trim()}`;
        }
      } else {
        finalFeatures = values.features || '';
      }

      const payload = new FormData();
      payload.append('name', values.name.trim());
      payload.append('projectManagers', JSON.stringify(values.projectManagers || []));
      payload.append('projectManager', values.projectManagers?.[0] || '');
      payload.append('commissionRate', String(Number(values.commissionRate) || 0));
      payload.append('projectAmount', String(Number(values.projectAmount) || 0));
      payload.append('demoLink', values.demoLink ? values.demoLink.trim() : '');
      payload.append('demoId', values.demoId ? values.demoId.trim() : '');
      payload.append('demoPassword', values.demoPassword ? values.demoPassword.trim() : '');
      payload.append('singlePageLink', values.singlePageLink ? values.singlePageLink.trim() : '');
      payload.append('labelCustomization', String(values.labelCustomization));
      payload.append('features', finalFeatures);
      payload.append('description', finalFeatures);
      payload.append('status', values.status);
      payload.append('themeColor', values.themeColor || '#2563EB');

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
      toast.success(isUpdate ? 'Product updated successfully' : 'Product created successfully');
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save product';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const filteredPMs = projectManagers.filter((pm) =>
    pm.fullName.toLowerCase().includes(pmSearch.toLowerCase()) ||
    (pm.email && pm.email.toLowerCase().includes(pmSearch.toLowerCase()))
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isUpdate ? 'Edit Product' : 'Add New Product'}
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
            {loading ? 'Saving...' : isUpdate ? 'Update Product' : '+ Add Product'}
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
                PRODUCT INFORMATION
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormInput
                  label="Product Name"
                  name="name"
                  type="text"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.name && formik.errors.name ? formik.errors.name : undefined}
                  required
                  placeholder="e.g. E-Commerce Web & App"
                />

                <FormInput
                  label="Commission Rate (%)"
                  name="commissionRate"
                  type="text"
                  value={formik.values.commissionRate}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val === '') {
                      formik.setFieldValue('commissionRate', '');
                      return;
                    }
                    const num = Math.max(0, Math.min(100, parseInt(val, 10)));
                    formik.setFieldValue('commissionRate', num.toString());
                  }}
                  onBlur={formik.handleBlur}
                  error={formik.touched.commissionRate && formik.errors.commissionRate ? (formik.errors.commissionRate as string) : undefined}
                  placeholder="e.g. 20"
                />

                <FormInput
                  label="Default Product Amount (₹)"
                  name="projectAmount"
                  type="text"
                  value={formik.values.projectAmount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    formik.setFieldValue('projectAmount', val);
                  }}
                  onBlur={formik.handleBlur}
                  error={formik.touched.projectAmount && formik.errors.projectAmount ? (formik.errors.projectAmount as string) : undefined}
                  placeholder="e.g. 50000"
                  icon={<span className="text-gray-500 font-bold text-sm">₹</span>}
                />
              </div>

              {/* Product Managers & Status / Customization Row (Perfect Level Alignment) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Product Managers Multi-Select */}
                <div className="lg:col-span-7 relative flex flex-col justify-end" ref={pmDropdownRef}>
                  <label className="block mb-1.5 text-sm font-semibold text-gray-700">
                    Product Manager(s)
                  </label>

                  {/* Trigger / Selected Pills */}
                  <div
                    onClick={() => setIsPMDropdownOpen((prev) => !prev)}
                    className="min-h-[44px] px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:border-gray-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 cursor-pointer flex flex-wrap items-center gap-1.5 transition-colors"
                  >
                    {formik.values.projectManagers.length > 0 ? (
                      formik.values.projectManagers.map((pmId) => {
                        const pm = projectManagers.find((p) => p._id === pmId);
                        return (
                          <span
                            key={pmId}
                            className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-2.5 py-1 rounded-md"
                          >
                            <span>{pm?.fullName || pmId}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePMSelection(pmId);
                              }}
                              className="hover:text-red-600 text-blue-400 font-bold ml-0.5"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-gray-400 text-sm py-1">
                        Click to select Product Manager(s)...
                      </span>
                    )}
                  </div>

                  {/* Dropdown Menu */}
                  {isPMDropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-2 max-h-60 overflow-y-auto space-y-1">
                      <input
                        type="text"
                        placeholder="Search product managers..."
                        value={pmSearch}
                        onChange={(e) => setPmSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-500 mb-1"
                      />

                      {filteredPMs.length > 0 ? (
                        filteredPMs.map((pm) => {
                          const isSelected = formik.values.projectManagers.includes(pm._id);
                          return (
                            <div
                              key={pm._id}
                              onClick={() => togglePMSelection(pm._id)}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-blue-50 text-blue-700 font-medium'
                                  : 'hover:bg-gray-50 text-gray-700'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="rounded text-blue-600 focus:ring-blue-500 pointer-events-none"
                                />
                                <span>{pm.fullName}</span>
                              </div>
                              {pm.email && (
                                <span className="text-xs text-gray-400">{pm.email}</span>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-gray-400 p-2 text-center">
                          No product managers found
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Status Toggle Box */}
                <div className="lg:col-span-3 flex flex-col justify-end">
                  <span className="block mb-1.5 text-sm font-semibold text-gray-700">
                    Product Status
                  </span>
                  <div className="h-[44px] px-3 bg-gray-50 hover:bg-gray-100/60 rounded-lg border border-gray-300 flex items-center justify-between transition-colors">
                    <span className={`text-xs font-bold capitalize ${formik.values.status === 'active' ? 'text-green-700' : 'text-gray-500'}`}>
                      {formik.values.status}
                    </span>
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
                  </div>
                </div>

                {/* Customization Checkbox Box */}
                <div className="lg:col-span-2 flex flex-col justify-end">
                  <span className="block mb-1.5 text-sm font-semibold text-gray-700">
                    Customization
                  </span>
                  <label className="h-[44px] px-3 bg-gray-50 hover:bg-blue-50/50 rounded-lg border border-gray-300 cursor-pointer transition-colors flex items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      name="labelCustomization"
                      checked={formik.values.labelCustomization}
                      onChange={(e) => formik.setFieldValue('labelCustomization', e.target.checked)}
                      className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-gray-800 truncate">
                      {formik.values.labelCustomization ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    label="Single Page Link"
                    name="singlePageLink"
                    type="url"
                    value={formik.values.singlePageLink}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.singlePageLink && formik.errors.singlePageLink ? formik.errors.singlePageLink : undefined}
                    placeholder="https://singlepage.example.com"
                    icon={
                      formik.values.singlePageLink ? (
                        <a
                          href={formik.values.singlePageLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                          title="Open Single Page Link"
                        >
                          <FiExternalLink className="w-4 h-4" />
                        </a>
                      ) : undefined
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              {/* Features (Bullet Points) Section */}
              <div className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-800">
                    Features
                  </label>
                  {featurePoints.length > 0 && (
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      {featurePoints.length} {featurePoints.length === 1 ? 'bullet point' : 'bullet points'}
                    </span>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddFeature();
                      }
                    }}
                    placeholder="Type a feature / bullet point (e.g. Custom Admin Panel) and click Add"
                    className="flex-1 px-3.5 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-gray-800 placeholder-gray-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddFeature}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <FiPlus size={16} />
                    <span>Add</span>
                  </button>
                </div>

                {/* Bullet list items */}
                {featurePoints.length > 0 && (
                  <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                    {featurePoints.map((feat, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm text-gray-800 shadow-xs hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0"></span>
                          <span className="break-words font-medium">{feat}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFeature(idx)}
                          className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50 cursor-pointer"
                          title="Delete bullet point"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="w-full">
                <label className="block mb-1.5 text-sm font-semibold text-gray-700">
                  Additional Description / Details
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
                  PRODUCT IMAGES (MAX 4)
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  {imageSlots.filter(Boolean).length}/4
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((idx) => {
                  const slot = imageSlots[idx];
                  const imgSrc = slot?.type === 'existing' ? slot.url : slot?.preview;
                  const isLogoSlot = idx === 0;

                  return (
                    <div
                      key={idx}
                      className={`relative group border-2 border-dashed ${
                        isLogoSlot ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200 bg-gray-50'
                      } hover:border-blue-500 rounded-xl h-28 flex flex-col items-center justify-center overflow-hidden transition-all`}
                    >
                      {isLogoSlot && (
                        <div className="absolute top-1.5 left-1.5 z-10 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                          Main Logo
                        </div>
                      )}

                      {imgSrc ? (
                        <>
                          <img
                            src={imgSrc}
                            alt={isLogoSlot ? 'Product Logo' : `Slot ${idx + 1}`}
                            className="w-full h-full object-contain p-1.5"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity z-20">
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
                          <span className="text-xs font-semibold">
                            {isLogoSlot ? 'Upload Logo' : `Image ${idx + 1}`}
                          </span>
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
                Slot 1 is for <strong className="text-blue-600">Product Logo</strong>. Slots 2-4 are for screenshots/banners.
              </p>
            </div>

            {/* SETTINGS CARD (CARD THEME COLOR) */}
            <div className="border border-gray-100 rounded-xl bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-50 text-blue-600 font-semibold text-sm uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                CARD THEME COLOR
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="block text-sm font-medium text-gray-700">Accent Color</span>
                  <div className="flex items-center gap-1.5">
                    <span 
                      className="w-4 h-4 rounded-full border border-gray-300 shadow-2xs"
                      style={{ backgroundColor: formik.values.themeColor || '#2563EB' }}
                    />
                    <span className="text-xs font-mono text-gray-500 uppercase">
                      {formik.values.themeColor || '#2563EB'}
                    </span>
                  </div>
                </div>

                {/* Preset Color Swatches */}
                <div className="flex items-center flex-wrap gap-2 pt-1">
                  {[
                    { name: 'Royal Blue', hex: '#2563EB' },
                    { name: 'Indigo', hex: '#4F46E5' },
                    { name: 'Purple', hex: '#7C3AED' },
                    { name: 'Emerald', hex: '#059669' },
                    { name: 'Teal', hex: '#0D9488' },
                    { name: 'Rose', hex: '#E11D48' },
                    { name: 'Amber', hex: '#D97706' },
                    { name: 'Cyan', hex: '#0891B2' },
                    { name: 'Dark Slate', hex: '#1E293B' },
                  ].map((color) => {
                    const isSelected = (formik.values.themeColor || '#2563EB').toLowerCase() === color.hex.toLowerCase();
                    return (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() => formik.setFieldValue('themeColor', color.hex)}
                        title={color.name}
                        className={`w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                          isSelected
                            ? 'ring-2 ring-offset-2 ring-blue-600 scale-110 shadow-sm'
                            : 'hover:scale-105 opacity-85 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: color.hex }}
                      >
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-white shadow-xs" />
                        )}
                      </button>
                    );
                  })}

                  {/* Custom Hex Color Picker */}
                  <label 
                    className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 hover:border-gray-500 cursor-pointer flex items-center justify-center transition-colors relative overflow-hidden"
                    title="Custom Color"
                  >
                    <span className="text-[10px] font-bold text-gray-400">+</span>
                    <input
                      type="color"
                      value={formik.values.themeColor || '#2563EB'}
                      onChange={(e) => formik.setFieldValue('themeColor', e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                </div>
                <p className="text-[11px] text-gray-400">
                  Reseller product cards and buttons will accent with this theme color.
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
