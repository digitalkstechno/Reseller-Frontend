'use client';
import { useSelector } from 'react-redux';

import { useEffect, useMemo, useState } from 'react';
import Dialog from '@/components/Dialog';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';
import { RolesContent } from './roles';
import { StaffManagementContent } from './staff-management';
import { LeadSourcesContent } from './lead-sources';
import { LeadStatusContent } from './lead-status';
import { Settings, Users, Link2, Flag, Tag, Building2, UsersRound, Settings2 } from 'lucide-react';
import { TeamsContent } from './teams';
import { OrganizationsContent } from './organizations';
import { TaskStatusContent } from './task-status';
import { useRouter } from 'next/router';
import { FieldSettingsContent } from './field-settings';


export default function Setup() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    'Lead Sources' | 'Lead Status' | 'Kanban Status' | 'Field Settings'
  >('Lead Sources');
  const token = typeof window !== 'undefined' ? getAuthToken() : null;
  const [permissions, setPermissions] = useState<any>(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  // Sync activeTab with URL query parameter - FIXED: Check if router.query.tab exists
  useEffect(() => {
    if (router.query.tab) {
      const tab = router.query.tab as string;
      const validTabs = ['Lead Sources', 'Lead Status', 'Kanban Status', 'Field Settings'];
      if (validTabs.includes(tab)) {
        setActiveTab(tab as any);
      }
    }
  }, [router.query.tab]);

  // Handle tab change and update URL
  const handleTabChange = (tab: 'Lead Sources' | 'Lead Status' | 'Kanban Status' | 'Field Settings') => {
    setActiveTab(tab);
    router.push({
      pathname: router.pathname,
      query: { ...router.query, tab },
    }, undefined, { shallow: true });
  };

  const { permissions: rawPerms } = useSelector((state: any) => state.auth);

  useEffect(() => {
    setPermissions(rawPerms || {});
    setLoadingPermissions(false);
  }, [rawPerms]);

  type Item = { name: string; order: number };
  type BackendItem = { name?: string; order?: number | string };

  const parseList = (data: unknown): Item[] => {
    if (!Array.isArray(data)) return [];
    return (data as BackendItem[]).map((i) => {
      const name = typeof i.name === 'string' ? i.name : '';
      const orderRaw = i.order;
      const order = typeof orderRaw === 'number' ? orderRaw : Number(orderRaw ?? 0) || 0;
      return { name, order };
    });
  };

  const [leadStatuses, setLeadStatuses] = useState<Item[]>([]);
  const [kanbanStatusNames, setKanbanStatusNames] = useState<string[]>([]);

  // Fetch lead statuses - FIXED: Always call useEffect
  useEffect(() => {
    let isMounted = true;

    const fetchLeadStatuses = async () => {

      try {
        const res = await axios.get(baseUrl.leadStatuses, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        if (isMounted) {
          setLeadStatuses(parseList(res.data?.data ?? res.data).sort((a, b) => a.order - b.order));
        }
      } catch {
        if (isMounted) setLeadStatuses([]);
      }
    };

    fetchLeadStatuses();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Load saved kanban statuses from sessionStorage - FIXED: Always call useEffect
  useEffect(() => {
    const loadKanbanStatuses = () => {
      if (typeof window === 'undefined') return;

      const stored = window.sessionStorage.getItem('kanbanVisibleStatusNames');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setKanbanStatusNames(parsed.filter((x) => typeof x === 'string'));
            return;
          }
        } catch {
          // Invalid stored data, will use default
        }
      }

      // If no stored data and we have lead statuses, use all of them as default
      if (leadStatuses.length > 0) {
        setKanbanStatusNames(leadStatuses.map((s) => s.name));
      }
    };

    loadKanbanStatuses();
  }, [leadStatuses]);

  // Handle select all
  const handleSelectAll = () => {
    setKanbanStatusNames(leadStatuses.map((s) => s.name));
  };

  // Handle clear all
  const handleClearAll = () => {
    setKanbanStatusNames([]);
  };

  // Handle individual checkbox change
  const handleCheckboxChange = (statusName: string, isChecked: boolean) => {
    setKanbanStatusNames((prev) => {
      if (isChecked) {
        return prev.includes(statusName) ? prev : [...prev, statusName];
      } else {
        return prev.filter((n) => n !== statusName);
      }
    });
  };

  // Handle save to sessionStorage
  const handleSaveKanbanStatuses = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        'kanbanVisibleStatusNames',
        JSON.stringify(kanbanStatusNames)
      );
      toast.success('Kanban statuses updated successfully');
    }
  };

  const canViewLeadSource = useMemo(() => !!(permissions?.leadSource?.readAll || permissions?.setup?.readAll), [permissions]);
  const canViewLeadStatus = useMemo(() => !!(permissions?.leadStatus?.readAll || permissions?.setup?.readAll), [permissions]);
  const menuItems = useMemo(() => {
    const items = [
      { name: "Lead Sources", icon: Link2, visible: canViewLeadSource },
      { name: "Lead Status", icon: Flag, visible: canViewLeadStatus },
      { name: "Kanban Status", icon: Settings2, visible: true },
      { name: "Field Settings", icon: Settings2, visible: true },
    ];
    return items.filter(i => i.visible);
  }, [canViewLeadSource, canViewLeadStatus]);

  // Handle access restriction - FIXED: Check if current tab is valid
  useEffect(() => {
    if (!loadingPermissions && permissions) {
      const currentItem = menuItems.find(i => i.name === activeTab);
      if (!currentItem && menuItems.length > 0) {
        handleTabChange(menuItems[0].name as any);
      }
    }
  }, [loadingPermissions, permissions, menuItems, activeTab]);

  // Show loading state
  if (loadingPermissions) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Show access denied
  if (!loadingPermissions && menuItems.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
        <p className="mt-2 text-gray-600">
          You do not have permission to access any setup pages.
        </p>
      </div>
    );
  }

  // Main render
  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col md:grid md:grid-cols-12 gap-6">
          <div className="md:col-span-3">
            <div className="rounded-md border border-gray-200 bg-white p-3 flex md:flex-col flex-row overflow-x-auto gap-1">
              {menuItems.map((item: any, index: number) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.name}
                    onClick={() => handleTabChange(item.name)}
                    className={`flex shrink-0 md:w-full items-center gap-3 cursor-pointer rounded-md px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === item.name
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-9">
            <div className="rounded-md border border-gray-200 bg-white p-6">
              {activeTab === 'Lead Sources' && <LeadSourcesContent />}
              {activeTab === 'Lead Status' && <LeadStatusContent />}
              {activeTab === 'Field Settings' && <FieldSettingsContent />}
              {activeTab === 'Kanban Status' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Kanban Status Visibility</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Select which lead statuses should appear as columns in the Kanban view.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="px-4 cursor-pointer py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="px-4 cursor-pointer py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-md p-4 max-h-[420px] overflow-y-auto">
                    {leadStatuses.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-gray-500">No lead statuses found.</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Please add lead statuses first in the Lead Status tab.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {leadStatuses.map((status) => {
                          const isChecked = kanbanStatusNames.includes(status.name);
                          return (
                            <label
                              key={status.name}
                              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm cursor-pointer transition-colors ${isChecked
                                ? 'border-blue-200 bg-blue-50'
                                : 'border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => handleCheckboxChange(status.name, e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-gray-800 font-medium">{status.name}</span>
                              {status.order && (
                                <span className="ml-auto text-xs text-gray-400">
                                  Order: {status.order}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={handleSaveKanbanStatuses}
                      disabled={leadStatuses.length === 0}
                      className="px-6 cursor-pointer py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save Changes
                    </button>
                  </div>

                  <div className="text-sm text-gray-600">
                    {kanbanStatusNames.length} of {leadStatuses.length} statuses selected
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}