'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  ShieldCheck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Lock,
  Sparkles,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Info,
  Check,
  Users,
  FolderKanban,
  UserCheck,
  IndianRupee,
  Settings,
  Tag,
  Share2,
  Activity,
} from 'lucide-react';
import { baseUrl, getAuthToken } from '@/config';
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
  roleName: string;
  permissions?: RolePermissions[];
  createdAt?: string;
  updatedAt?: string;
}

const MODULE_DEFINITIONS = [
  { key: 'lead', label: 'Leads Management', icon: Users, description: 'Manage CRM leads and deals', hasOwn: true },
  { key: 'reseller', label: 'Resellers Management', icon: Users, description: 'Reseller partner accounts', hasOwn: true },
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
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

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

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Roles
  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = getAuthToken();
      const res = await axios.get(baseUrl.getAllRoles, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { all: true, search: debouncedSearch },
      });
      const data = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      setRoles(data);
    } catch (err: any) {
      console.error('Failed to fetch roles:', err);
      toast.error(err?.response?.data?.message || 'Failed to load roles');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch]);

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
      // Admin has all permissions fully enabled
      setFormPermissions(getAllGrantedPermissions());
    } else {
      const existing = role.permissions?.[0] || DEFAULT_PERMISSIONS;
      setFormPermissions(JSON.parse(JSON.stringify({ ...DEFAULT_PERMISSIONS, ...existing })));
    }
    setIsModalOpen(true);
  };

  // Toggle single permission
  const handleTogglePermission = (moduleKey: string, actionKey: keyof PermissionAction) => {
    if (selectedRole?.roleName?.toLowerCase() === 'admin') return; // Locked for admin
    
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
    if (selectedRole?.roleName?.toLowerCase() === 'admin') return; // Locked for admin
    
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
    if (selectedRole?.roleName?.toLowerCase() === 'admin') return; // Locked for admin

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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRoleName.trim()) {
      toast.error('Please enter a role name');
      return;
    }

    if (selectedRole?.roleName?.toLowerCase() === 'admin') {
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
        await axios.put(`${baseUrl.updateRole}/${selectedRole._id}`, payload, { headers });
        toast.success('Role updated successfully');
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
      await axios.delete(`${baseUrl.deleteRole}/${roleToDelete._id}`, {
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

  // Count active modules
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

  const isSystemRole = (name?: string) => {
    if (!name) return false;
    return /^(admin|reseller|project_manager|projectmanager)$/i.test(name);
  };

  const isEditingAdmin = selectedRole?.roleName?.toLowerCase() === 'admin';

  if (!isAdmin) return null;

  return (
    <div className="flex flex-col h-full gap-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Head>
        <title>Roles & Permissions | Reseller CRM</title>
      </Head>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#3B82F6] shadow-xs">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Roles & Permissions</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage user access rights, module capabilities and security rules</p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-all cursor-pointer hover:shadow-blue-500/25 active:scale-95"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Add New Role</span>
        </button>
      </div>

      {/* Table & Filter Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 flex flex-col flex-1 gap-4 overflow-hidden">
        {/* Search & Stats */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search roles by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50/70 border border-gray-200 rounded-xl focus:bg-white focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </div>

          <div className="text-xs font-semibold text-gray-500">
            Total Roles: <span className="text-[#3B82F6] font-bold">{roles.length}</span>
          </div>
        </div>

        {/* Roles Table */}
        <div className="flex-1 overflow-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                <th className="py-3.5 px-5">Role Name</th>
                <th className="py-3.5 px-5">Created Date</th>
                <th className="py-3.5 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#3B82F6] border-t-transparent" />
                      <span>Loading roles...</span>
                    </div>
                  </td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-gray-400">
                    No roles found
                  </td>
                </tr>
              ) : (
                roles.map((role) => {
                  const isSys = isSystemRole(role.roleName);
                  const isAdm = role.roleName?.toLowerCase() === 'admin';

                  return (
                    <tr key={role._id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-xl font-bold text-xs flex items-center justify-center uppercase border shadow-xs ${
                            isAdm
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-blue-50 text-[#3B82F6] border-blue-100'
                          }`}>
                            {role.roleName?.slice(0, 2)}
                          </div>
                          <span className="font-bold text-gray-900 capitalize flex items-center gap-1.5">
                            {role.roleName?.replace(/_/g, ' ')}
                            {isSys && (
                              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                System
                              </span>
                            )}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-5 text-xs text-gray-600">
                        {role.createdAt
                          ? new Date(role.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '-'}
                      </td>

                      <td className="py-3.5 px-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(role)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg border border-blue-100 transition-colors cursor-pointer"
                            title={isAdm ? 'View Superadmin Permissions' : 'Edit Permissions'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {!isSys ? (
                            <button
                              onClick={() => {
                                setRoleToDelete(role);
                                setIsDeleteDialogOpen(true);
                              }}
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg border border-red-100 transition-colors cursor-pointer"
                              title="Delete Role"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : (
                            <span className="p-1.5 text-gray-300 cursor-not-allowed" title="System roles cannot be deleted">
                              <Lock className="h-4 w-4" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Role Modal */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalMode === 'add'
            ? 'Create New Role'
            : isEditingAdmin
            ? 'Superadmin Role & Capabilities'
            : `Edit Role: ${selectedRole?.roleName || ''}`
        }
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            {!isEditingAdmin ? (
              <button
                type="button"
                onClick={handleToggleGrantAll}
                className="text-xs font-semibold text-[#3B82F6] hover:text-blue-700 underline cursor-pointer"
              >
                Toggle Grant All / Revoke All
              </button>
            ) : (
              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Unrestricted Superadmin Access
              </span>
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
              >
                {isEditingAdmin ? 'Close' : 'Cancel'}
              </button>
              {!isEditingAdmin && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#3B82F6] hover:bg-blue-600 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : modalMode === 'add' ? 'Create Role' : 'Save Permissions'}
                </button>
              )}
            </div>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Admin Notice Banner */}
          {isEditingAdmin && (
            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-900">
              <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm text-emerald-800">Superadmin Master Role</span>
                Admin is the root administrator with full, unrestricted access across all system modules. For platform security and integrity, all capability checkboxes are permanently active and locked.
              </div>
            </div>
          )}

          {/* Role Name Input */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Role Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isSystemRole(selectedRole?.roleName)}
              placeholder="e.g. Sales Manager, Accountant..."
              value={formRoleName}
              onChange={(e) => setFormRoleName(e.target.value)}
              className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-100 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {isSystemRole(selectedRole?.roleName) && (
              <p className="text-[11px] text-amber-600 mt-1 font-medium">
                System role names cannot be renamed.
              </p>
            )}
          </div>

          {/* Permissions Matrix */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#3B82F6]" />
                <h3 className="text-sm font-bold text-gray-900">Module Capabilities Matrix</h3>
              </div>
              <span className="text-xs text-gray-500">
                {isEditingAdmin ? 'All 10 modules enabled' : 'Check permissions to grant access'}
              </span>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Module Name</th>
                      <th className="py-3 px-3 text-center">Read All</th>
                      <th className="py-3 px-3 text-center">Read Own</th>
                      <th className="py-3 px-3 text-center">Create</th>
                      <th className="py-3 px-3 text-center">Edit / Update</th>
                      <th className="py-3 px-3 text-center">Delete</th>
                      <th className="py-3 px-3 text-center">Quick Action</th>
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
                        <tr
                          key={mod.key}
                          className={`transition-colors ${
                            isAllSelected ? 'bg-blue-50/15' : 'hover:bg-gray-50/50'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                                <IconComp className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-900">{mod.label}</span>
                                <span className="text-[10px] text-gray-400">{mod.description}</span>
                              </div>
                            </div>
                          </td>

                          {/* Read All */}
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={!!perm.readAll}
                              disabled={isEditingAdmin}
                              onChange={() => handleTogglePermission(mod.key, 'readAll')}
                              className={`h-4 w-4 text-[#3B82F6] rounded border-gray-300 focus:ring-[#3B82F6] ${
                                isEditingAdmin ? 'cursor-not-allowed opacity-80 accent-emerald-600' : 'cursor-pointer'
                              }`}
                            />
                          </td>

                          {/* Read Own */}
                          <td className="py-3 px-3 text-center">
                            {mod.hasOwn ? (
                              <input
                                type="checkbox"
                                checked={!!perm.readOwn}
                                disabled={isEditingAdmin}
                                onChange={() => handleTogglePermission(mod.key, 'readOwn')}
                                className={`h-4 w-4 text-[#3B82F6] rounded border-gray-300 focus:ring-[#3B82F6] ${
                                  isEditingAdmin ? 'cursor-not-allowed opacity-80 accent-emerald-600' : 'cursor-pointer'
                                }`}
                              />
                            ) : (
                              <span className="text-gray-300 font-bold">-</span>
                            )}
                          </td>

                          {/* Create */}
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={!!perm.create}
                              disabled={isEditingAdmin}
                              onChange={() => handleTogglePermission(mod.key, 'create')}
                              className={`h-4 w-4 text-[#3B82F6] rounded border-gray-300 focus:ring-[#3B82F6] ${
                                isEditingAdmin ? 'cursor-not-allowed opacity-80 accent-emerald-600' : 'cursor-pointer'
                              }`}
                            />
                          </td>

                          {/* Update */}
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={!!perm.update}
                              disabled={isEditingAdmin}
                              onChange={() => handleTogglePermission(mod.key, 'update')}
                              className={`h-4 w-4 text-[#3B82F6] rounded border-gray-300 focus:ring-[#3B82F6] ${
                                isEditingAdmin ? 'cursor-not-allowed opacity-80 accent-emerald-600' : 'cursor-pointer'
                              }`}
                            />
                          </td>

                          {/* Delete */}
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={!!perm.delete}
                              disabled={isEditingAdmin}
                              onChange={() => handleTogglePermission(mod.key, 'delete')}
                              className={`h-4 w-4 text-[#3B82F6] rounded border-gray-300 focus:ring-[#3B82F6] ${
                                isEditingAdmin ? 'cursor-not-allowed opacity-80 accent-emerald-600' : 'cursor-pointer'
                              }`}
                            />
                          </td>

                          {/* Full Access Toggle */}
                          <td className="py-3 px-3 text-center">
                            {isEditingAdmin ? (
                              <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Full Access
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleModuleAll(mod.key)}
                                className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                                  isAllSelected
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                                }`}
                              >
                                {isAllSelected ? 'Granted' : 'Grant All'}
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
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete Role'}
            </button>
          </div>
        }
      >
        <div className="flex items-start gap-3 text-sm text-gray-600">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p>
            Are you sure you want to delete the role <span className="font-bold text-gray-900">{roleToDelete?.roleName}</span>? This action cannot be undone.
          </p>
        </div>
      </DeleteDialog>
    </div>
  );
}