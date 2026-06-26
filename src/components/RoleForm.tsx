'use client';

import { useEffect, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import Dialog from './Dialog';
import FormInput from './ui/Input';

type CapabilityKey = 'create' | 'readOwn' | 'readAll' | 'update' | 'delete';
type CapabilitySet = Record<CapabilityKey, boolean>;

interface Role {
  roleName: string;
  permissions: Record<string, CapabilitySet>;
}

interface RoleFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (role: any) => void | Promise<void>;
  initialData?: any;
}

export default function RoleForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: RoleFormProps) {
  // FIXED: Use lowercase for feature keys to match backend expectations
  type Feature = 'lead' | 'task' | 'taskStatus' | 'staff' | 'role' | 'leadStatus' | 'leadSource' | 'teams' | 'organizations';
  const features: Feature[] = ['lead', 'task', 'taskStatus', 'staff', 'role', 'leadStatus', 'leadSource', 'teams', 'organizations'];

  const featureLabels: Record<Feature, string> = {
    lead: 'Leads',
    task: 'Tasks',
    taskStatus: 'Task Statuses',
    staff: 'Staff Management',
    role: 'Role Management',
    leadStatus: 'Lead Statuses',
    leadSource: 'Lead Sources',
    teams: 'Teams',
    organizations: 'Organizations',
  };

  const defaultCaps: CapabilitySet = {
    create: false,
    readOwn: false,
    readAll: false,
    update: false,
    delete: false,
  };

  const initialPermissions: Record<string, CapabilitySet> = features.reduce((acc, f) => {
    acc[f] = { ...defaultCaps };
    return acc;
  }, {} as Record<string, CapabilitySet>);

  const sanitizeCaps = (caps?: Partial<CapabilitySet>): CapabilitySet => ({
    create: !!caps?.create,
    readOwn: !!caps?.readOwn,
    readAll: !!caps?.readAll,
    update: !!caps?.update,
    delete: !!caps?.delete,
  });

  type RawRole = {
    roleName?: string;
    permissions?: Record<string, Partial<CapabilitySet>> | Array<Record<string, Partial<CapabilitySet>>>;
  };

  const normalizePermissions = (data?: RawRole | null) => {
    const base: Record<string, CapabilitySet> = features.reduce((acc, f) => {
      acc[f] = { ...defaultCaps };
      return acc;
    }, {} as Record<string, CapabilitySet>);

    if (!data?.permissions) return base;

    const raw = Array.isArray(data.permissions)
      ? data.permissions[0]
      : data.permissions;

    features.forEach((feature) => {
      base[feature] = {
        ...base[feature],
        ...(raw?.[feature] || {}),
      };
    });

    return base;
  };

  // Validation schema
  const validationSchema = Yup.object({
    roleName: Yup.string()
      .required('Role name is required')
      .min(2, 'Role name must be at least 2 characters')
      .max(50, 'Role name must be at most 50 characters')
      .matches(/^[a-zA-Z0-9\s_-]+$/, 'Role name can only contain letters, numbers, spaces, underscores, and hyphens'),
  });

  // Initialize formik
  const formik = useFormik({
    initialValues: {
      roleName: '',
      permissions: normalizePermissions(),
    },
    validationSchema,
    onSubmit: async (values) => {
      await onSubmit(values);
      onClose();
    },
    enableReinitialize: true,
  });

  // Update form when initialData changes
  useEffect(() => {
    if (!initialData) {
      formik.resetForm();
      return;
    }

    const rawPerms: unknown = (initialData as unknown as { permissions?: unknown }).permissions;
    const perms = Array.isArray(rawPerms)
      ? (rawPerms[0] as Record<string, Partial<CapabilitySet>>)
      : (rawPerms as Record<string, Partial<CapabilitySet>>);

    const normalizedPerms = features.reduce((acc, f) => {
      acc[f] = sanitizeCaps(perms?.[f]);
      return acc;
    }, {} as Record<Feature, CapabilitySet>);

    formik.setValues({
      roleName: initialData.roleName || '',
      permissions: normalizedPerms,
    });
  }, [initialData, isOpen]);

  const toggleCapability = (feature: Feature, capability: CapabilityKey) => {
    const current = formik.values.permissions[feature] || defaultCaps;
    const nextValue = !current[capability];
    let nextCaps: CapabilitySet = { ...current, [capability]: nextValue };

    // Handle mutual exclusivity for readAll and readOwn
    if (capability === 'readAll' && nextValue) {
      nextCaps = { ...nextCaps, readOwn: false };
    }
    if (capability === 'readOwn' && nextValue) {
      nextCaps = { ...nextCaps, readAll: false };
    }

    const newPermissions = {
      ...formik.values.permissions,
      [feature]: nextCaps,
    };

    formik.setFieldValue('permissions', newPermissions);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? `Edit Role: ${initialData.roleName}` : "Add New Role"}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 cursor-pointer rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="role-form"
            className="px-4 py-2 cursor-pointer rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={formik.isSubmitting}
          >
            {formik.isSubmitting ? 'Saving...' : (initialData ? 'Update' : 'Save')}
          </button>
        </>
      }
    >
      <form noValidate id="role-form" onSubmit={formik.handleSubmit} className="space-y-6">
        <div>
          <FormInput
            label="Role Name"
            name="roleName"
            type="text"
            value={formik.values.roleName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.roleName && formik.errors.roleName ? formik.errors.roleName : undefined}
            required
            placeholder="Enter role name (e.g., Admin, Manager, Staff)"
            // helperText="Role name must be unique and descriptive"
          />
        </div>

        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-800">Permissions</h3>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="grid grid-cols-12 border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
              <div className="col-span-5">Features</div>
              <div className="col-span-7">Capabilities</div>
            </div>
            <div className="">
              {features.map((feature) => {
                const caps = formik.values.permissions[feature] || defaultCaps;
                return (
                  <div key={feature} className="grid grid-cols-12 items-center border-t border-gray-200 px-4 py-4 hover:bg-gray-50 transition-colors">
                    <div className="col-span-5 text-gray-800 font-medium">{featureLabels[feature]}</div>
                    <div className="col-span-7">
                      <div className="flex flex-wrap gap-4">
                        {(['readAll', 'readOwn', 'create', 'update', 'delete'] as CapabilityKey[]).map((cap) => (
                          <label key={cap} className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={caps[cap]}
                              onChange={() => toggleCapability(feature, cap)}
                              className="h-4 w-4 rounded cursor-pointer border-gray-300 text-sky-950 focus:ring-sky-200"
                            />
                            <span>
                              {cap === 'readAll'
                                ? 'View (Global)'
                                : cap === 'readOwn'
                                  ? 'View (Own)'
                                  : cap === 'create'
                                    ? 'Create'
                                    : cap === 'update'
                                      ? 'Update'
                                      : 'Delete'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </form>
    </Dialog>
  );
}