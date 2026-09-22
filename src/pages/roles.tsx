'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Users,
  FolderKanban,
  UserCheck,
  IndianRupee,
  Settings,
  Shield,
  Activity,
  Share2,
  Tag,
  Handshake,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { baseUrl, getAuthToken } from '@/config';
import DataTable, { Column } from '@/components/DataTable';
import Dialog from '@/components/Dialog';
import DeleteDialog from '@/components/DeleteDialog';
import Badge from '@/components/Badge';

interface PermissionAction {
  create?: boolean;
  readOwn?: boolean;
  readAll?: boolean;
  update?: boolean;
  delete?: boolean;
}

interface RolePermissions {
  lead?: PermissionAction;
  reseller?: PermissionAction;
  project?: PermissionAction;
  projectManager?: PermissionAction;
  settlement?: PermissionAction;
  setup?: PermissionAction;
  leadStatus?: PermissionAction;
  leadSource?: PermissionAction;
  leadLabel?: PermissionAction;
  role?: PermissionAction;
  [key: string]: any;
}

interface RoleData {
  _id: string;
  id?: string;
  roleName: string;
  permissions?: RolePermissions[];
  createdAt?: string;
  updatedAt?: string;
}

const MODULE_DEFINITIONS = [
  { key: 'lead', label: 'Leads Management', icon: Users, description: 'Manage CRM leads and deals', hasOwn: true },
  { key: 'reseller', label: 'Resellers Management', icon: Handshake, description: 'Reseller partner accounts', hasOwn: true },
  { key: 'project', label: 'Projects Management', icon: FolderKanban, description: 'Project portfolio and setups', hasOwn: true },
  { key: 'projectManager', label: 'Product / Project Managers', icon: UserCheck, description: 'Product managers and staff', hasOwn: true },
  { key: 'settlement', label: 'Settlements & Payouts', icon: IndianRupee, description: 'Payouts, earnings & ledgers', hasOwn: true },
  { key: 'setup', label: 'System Setup & Settings', icon: Settings, description: 'Platform configurations', hasOwn: false },
  { key: 'role', label: 'Roles & Permissions', icon: Shield, description: 'Role definitions & capability matrix', hasOwn: false },
  { key: 'leadStatus', label: 'Lead Statuses', icon: Activity, description: 'Kanban stages and statuses', hasOwn: false },
  { key: 'leadSource', label: 'Lead Sources', icon: Share2, description: 'Inquiry and lead sources', hasOwn: false },
  { key: 'leadLabel', label: 'Lead Labels', icon: Tag, description: 'Categorization and lead tags', hasOwn: false },
];

const DEFAULT_PERMISSIONS: RolePermissions = {
  lead: { create: false, readOwn: false, readAll: false, update: false, delete: false },
  reseller: { create: false, readOwn: false, readAll: false, update: false, delete: false },
  project: { create: false, readOwn: false, readAll: false, update: false, delete: false },
  projectManager: { create: false, readOwn: false, readAll: false, update: false, delete: false },
  settlement: { create: false, readOwn: false, readAll: false, update: false, delete: false },
  setup: { create: false, readAll: false, update: false, delete: false },
  role: { create: false, readAll: false, update: false, delete: false },
  leadStatus: { create: false, readAll: false, update: false, delete: false },
  leadSource: { create: false, readAll: false, update: false, delete: false },
  leadLabel: { create: false, readAll: false, update: false, delete: false },
};

export default function RolesPage() {
  const router = useRouter();
  const { role: userRole, user } = useSelector((state: any) => state.auth);

  const roleName = (userRole || user?.role?.roleName || (typeof user?.role === 'string' ? user.role : '') || '').toLowerCase();
  const isAdmin = roleName === 'admin' || user?.email === 'admin@gmail.com';

  const [roles, setRoles] = useState<RoleData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Dialog state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedRole, setSelectedRole] = useState<RoleData | null>(null);
  const [formRoleName, setFormRoleName] = useState('');
  const [formPermissions, setFormPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Roles
  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = getAuthToken();
      const res = await axios.get(baseUrl.getAllRoles, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { all: true, search: search.trim() },
      });
      const data = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      setRoles(data.map((r: any) => ({ ...r, id: r._id })));
    } catch (err: any) {
      console.error('Failed to fetch roles:', err);
      toast.error(err?.response?.data?.message || 'Failed to load roles');
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (isAdmin) {
      fetchRoles();
    } else {
      router.replace('/');
    }
  }, [isAdmin, fetchRoles, router]);

  const getAllGrantedPermissions = () => {
    const allPerms: any = {};
    MODULE_DEFINITIONS.forEach((m) => {
      allPerms[m.key] = {
        create: true,
        readAll: true,
        readOwn: m.hasOwn ? true : false,
        update: true,
        delete: true,
      };
    });
    return allPerms;
  };

  const isSystemRole = (name?: string) => {
    if (!name) return false;
    return /^(admin|reseller|project_manager|projectmanager)$/i.test(name);
  };

  const isEditingAdmin = selectedRole?.roleName?.toLowerCase() === 'admin';

  // Open Add Role Modal
  const handleOpenAdd = () => {
    setModalMode('add');
    setSelectedRole(null);
    setFormRoleName('');
    setFormPermissions(JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS)));
    setIsModalOpen(true);
  };

  // Open Edit Role Modal
  const handleOpenEdit = (role: RoleData) => {
    setModalMode('edit');
    setSelectedRole(role);
    setFormRoleName(role.roleName?.replace(/_/g, ' '));

    if (role.roleName?.toLowerCase() === 'admin') {
      setFormPermissions(getAllGrantedPermissions());
    } else {
      const existing = role.permissions?.[0] || DEFAULT_PERMISSIONS;
      setFormPermissions(JSON.parse(JSON.stringify({ ...DEFAULT_PERMISSIONS, ...existing })));
    }
    setIsModalOpen(true);
  };

  // Toggle single permission
  const handleTogglePermission = (moduleKey: string, actionKey: keyof PermissionAction) => {
    if (isEditingAdmin) return;

    setFormPermissions((prev) => {
      const modulePerms = prev[moduleKey] || {};
      const currentVal = !!modulePerms[actionKey];
      return {
        ...prev,
        [moduleKey]: {
          ...modulePerms,
          [actionKey]: !currentVal,
        },
      };
    });
  };

  // Toggle all actions for a specific module
  const handleToggleModuleAll = (moduleKey: string) => {
    if (isEditingAdmin) return;

    setFormPermissions((prev) => {
      const moduleDef = MODULE_DEFINITIONS.find((m) => m.key === moduleKey);
      const modulePerms = prev[moduleKey] || {};
      const allActive =
        modulePerms.create &&
        modulePerms.readAll &&
        modulePerms.update &&
        modulePerms.delete &&
        (!moduleDef?.hasOwn || modulePerms.readOwn);

      const targetVal = !allActive;
      return {
        ...prev,
        [moduleKey]: {
          create: targetVal,
          readAll: targetVal,
          readOwn: moduleDef?.hasOwn ? targetVal : false,
          update: targetVal,
          delete: targetVal,
        },
      };
    });
  };

  // Master Toggle: Grant All / Revoke All
  const handleToggleGrantAll = () => {
    if (isEditingAdmin) return;

    const isAllGranted = MODULE_DEFINITIONS.every((m) => {
      const p = formPermissions[m.key] || {};
      return p.create && p.readAll && p.update && p.delete && (!m.hasOwn || p.readOwn);
    });

    const targetVal = !isAllGranted;
    const newPerms: any = {};
    MODULE_DEFINITIONS.forEach((m) => {
      newPerms[m.key] = {
        create: targetVal,
        readAll: targetVal,
        readOwn: m.hasOwn ? targetVal : false,
        update: targetVal,
        delete: targetVal,
      };
    });
    setFormPermissions(newPerms);
  };

  // Submit Add / Edit
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formRoleName.trim()) {
      toast.error('Please enter a role name');
      return;
    }

    if (isEditingAdmin) {
      toast.info('Admin role already has full unrestricted permissions.');
      setIsModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const token = getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const payload = {
        roleName: formRoleName.trim(),
        permissions: [formPermissions],
      };

      if (modalMode === 'add') {
        await axios.post(baseUrl.addRole, payload, { headers });
        toast.success('Role created successfully');
      } else if (selectedRole) {
        await axios.put(`${baseUrl.updateRole}/${selectedRole._id || selectedRole.id}`, payload, { headers });
        toast.success('Role permissions updated successfully');
      }

      setIsModalOpen(false);
      fetchRoles();
    } catch (err: any) {
      console.error('Role submit error:', err);
      toast.error(err?.response?.data?.message || 'Failed to save role');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Role
  const handleDeleteConfirm = async () => {
    if (!roleToDelete) return;
    setIsDeleting(true);
    try {
      const token = getAuthToken();
      await axios.delete(`${baseUrl.deleteRole}/${roleToDelete._id || roleToDelete.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      toast.success('Role deleted successfully');
      setIsDeleteDialogOpen(false);
      setRoleToDelete(null);
      fetchRoles();
    } catch (err: any) {
      console.error('Delete role error:', err);
      toast.error(err?.response?.data?.message || 'Failed to delete role');
    } finally {
      setIsDeleting(false);
    }
  };

  const getActiveModuleCount = (role: RoleData) => {
    if (role.roleName?.toLowerCase() === 'admin') {
      return MODULE_DEFINITIONS.length;
    }
    const perms = role.permissions?.[0];
    if (!perms) return 0;
    return MODULE_DEFINITIONS.filter((m) => {
      const p = perms[m.key];
      return p && (p.readAll || p.readOwn || p.create || p.update || p.delete);
    }).length;
  };

  const columns: Column<RoleData>[] = [
    {
      key: 'roleName',
      label: 'Role Name',
      render: (value, row) => {
        const isSys = isSystemRole(row.roleName);
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 capitalize">{value?.replace(/_/g, ' ')}</span>
            {isSys && (
              <span className="text-[10px] font-semibold capitalize tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                System
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'permissions',
      label: 'Active Modules',
      render: (_, row) => {
        const isAdm = row.roleName?.toLowerCase() === 'admin';
        const activeCount = getActiveModuleCount(row);
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            {isAdm ? 'All Modules (Full Access)' : `${activeCount} Modules`}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Created Date',
      render: (value) => (
        <span className="text-sm text-gray-600 font-medium">
          {value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
        </span>
      ),
    },
  ];

  if (!isAdmin) return null;

  return (
    <>
      <Head>
        <title>Roles & Permissions | Reseller CRM</title>
      </Head>

      <div className="flex flex-col h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <DataTable
          data={roles}
          columns={columns}
          loading={isLoading}
          searchable
          onSearch={(val) => {
            setSearch(val);
          }}
          actions
          onEdit={(row) => handleOpenEdit(row)}
          onDelete={(row) => {
            setRoleToDelete(row);
            setIsDeleteDialogOpen(true);
          }}
          canDelete={(row) => !isSystemRole(row.roleName)}
          addButton={{
            label: 'Add Role',
            onClick: handleOpenAdd,
          }}
        />
      </div>

      {/* Add / Edit Role Dialog */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalMode === 'add'
            ? 'Add Role'
            : isEditingAdmin
            ? 'Role: admin'
            : `Edit Role: ${selectedRole?.roleName || ''}`
        }
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            {!isEditingAdmin ? (
              <button
                type="button"
                onClick={handleToggleGrantAll}
                className="text-xs font-medium text-blue-600 hover:underline cursor-pointer"
              >
                Toggle Grant All / Revoke All
              </button>
            ) : (
              <span className="text-xs text-gray-500">
                Full administrative access enabled.
              </span>
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
              {!isEditingAdmin && (
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Permissions'}
                </button>
              )}
            </div>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role Name Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Role Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isSystemRole(selectedRole?.roleName)}
              placeholder="Enter role name"
              value={formRoleName}
              onChange={(e) => setFormRoleName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
            />
            {isSystemRole(selectedRole?.roleName) && (
              <p className="text-[11px] text-amber-600 mt-1">
                System role names cannot be renamed.
              </p>
            )}
          </div>

          {/* Module Capabilities Matrix */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">
                Module Capabilities Matrix
              </span>
              <span className="text-xs text-gray-400">
                Check permissions to grant access
              </span>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold text-xs">
                      <th className="py-2.5 px-3">Module Name</th>
                      <th className="py-2.5 px-3 text-center">Read All</th>
                      <th className="py-2.5 px-3 text-center">Read Own</th>
                      <th className="py-2.5 px-3 text-center">Create</th>
                      <th className="py-2.5 px-3 text-center">Edit / Update</th>
                      <th className="py-2.5 px-3 text-center">Delete</th>
                      <th className="py-2.5 px-3 text-center">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {MODULE_DEFINITIONS.map((mod) => {
                      const perm = isEditingAdmin
                        ? { create: true, readAll: true, readOwn: mod.hasOwn ? true : false, update: true, delete: true }
                        : formPermissions[mod.key] || {};

                      const isAllSelected =
                        perm.create &&
                        perm.readAll &&
                        perm.update &&
                        perm.delete &&
                        (!mod.hasOwn || perm.readOwn);

                      const IconComp = mod.icon;

                      return (
                        <tr key={mod.key} className="hover:bg-gray-50/70 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded bg-gray-100 flex items-center justify-center text-gray-600 flex-shrink-0">
                                <IconComp className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-gray-800">{mod.label}</span>
                                <span className="text-[10px] text-gray-400 truncate">{mod.description}</span>
                              </div>
                            </div>
                          </td>

                          {/* Read All */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={!!perm.readAll}
                              disabled={isEditingAdmin}
                              onChange={() => handleTogglePermission(mod.key, 'readAll')}
                              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>

                          {/* Read Own */}
                          <td className="py-2.5 px-3 text-center">
                            {mod.hasOwn ? (
                              <input
                                type="checkbox"
                                checked={!!perm.readOwn}
                                disabled={isEditingAdmin}
                                onChange={() => handleTogglePermission(mod.key, 'readOwn')}
                                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                              />
                            ) : (
                              <span className="text-gray-300 font-bold">-</span>
                            )}
                          </td>

                          {/* Create */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={!!perm.create}
                              disabled={isEditingAdmin}
                              onChange={() => handleTogglePermission(mod.key, 'create')}
                              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>

                          {/* Update */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={!!perm.update}
                              disabled={isEditingAdmin}
                              onChange={() => handleTogglePermission(mod.key, 'update')}
                              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>

                          {/* Delete */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={!!perm.delete}
                              disabled={isEditingAdmin}
                              onChange={() => handleTogglePermission(mod.key, 'delete')}
                              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>

                          {/* Quick Action */}
                          <td className="py-2.5 px-3 text-center">
                            {isEditingAdmin ? (
                              <span className="text-[11px] text-gray-400 font-medium">Locked</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleModuleAll(mod.key)}
                                className={`px-2 py-1 rounded text-[10px] font-semibold capitalize transition-colors cursor-pointer border ${
                                  isAllSelected
                                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                {isAllSelected ? 'Revoke All' : 'Grant All'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setRoleToDelete(null);
        }}
        title="Delete Role"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setRoleToDelete(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        }
      >
        <div className="flex items-start gap-3 text-sm text-gray-600">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p>
            Are you sure you want to delete the role{' '}
            <span className="font-bold text-gray-900">{roleToDelete?.roleName}</span>?
          </p>
        </div>
      </DeleteDialog>
    </>
  );
}