'use client';
import { useSelector } from 'react-redux';

import React from "react";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  Settings,
  Users,
  LogOut,
  RefreshCw,
  ChevronDown,
  UserPlus,
  ChevronRight,
  ChevronLeft,
  Menu,
  CheckSquare,
  Handshake,
  Flag,
  IndianRupee,
  FileText,
  FolderKanban,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';
import axios from "axios";
import { baseUrl, clearAuthToken, getAuthToken } from "@/config";
import Swal from 'sweetalert2';
import DeleteDialog from './DeleteDialog';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path?: string;
  children?: MenuItem[];
}

export default function Sidebar({ isOpen, toggleSidebar }: SidebarProps) {
  const router = useRouter();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { role: userRole, permissions: rawPerms, user } = useSelector((state: any) => state.auth);

  const roleName = (userRole || user?.role?.roleName || (typeof user?.role === 'string' ? user.role : '') || '').toLowerCase();
  const isProjectManager = roleName === 'project_manager' || roleName === 'projectmanager';
  const isAdmin = roleName === 'admin' || user?.email === 'admin@gmail.com';

  const hasModuleAccess = (moduleKey: string) => {
    if (isAdmin) return true;
    const p = rawPerms?.[moduleKey];
    if (!p) return false;
    return Boolean(p.readAll || p.readOwn || p.create || p.update || p.delete);
  };

  const menuItems: MenuItem[] = [];

  // Dashboard is always available
  menuItems.push({ icon: LayoutDashboard, label: "Dashboard", path: "/" });

  // Leads
  if (isAdmin || hasModuleAccess('lead') || isProjectManager || roleName === 'reseller') {
    menuItems.push({ icon: UserPlus, label: "Leads", path: "/leads/list" });
  }

  // Roles & Permissions (Immediately below Leads)
  if (isAdmin || hasModuleAccess('role')) {
    menuItems.push({ icon: ShieldCheck, label: "Roles & Permissions", path: "/roles" });
  }

  // Resellers
  if (isAdmin || hasModuleAccess('reseller')) {
    menuItems.push({ icon: Handshake, label: "Resellers", path: "/resellers" });
  }

  // Product Management (Project Managers)
  if (isAdmin || hasModuleAccess('projectManager')) {
    menuItems.push({ icon: UserCheck, label: "Product Management", path: "/project-managers" });
  }

  // Products
  if (isAdmin || hasModuleAccess('project')) {
    menuItems.push({ icon: FolderKanban, label: "Products", path: "/projects" });
  }

  // Settlements
  if (isAdmin || hasModuleAccess('settlement') || roleName === 'reseller') {
    menuItems.push({ icon: IndianRupee, label: "Settlements", path: "/settlements" });
  }

  // Reports (Admin only)
  if (isAdmin) {
    menuItems.push({ 
      icon: FileText, 
      label: "Reports", 
      children: [
        { icon: FileText, label: "Leads Report", path: "/reports/leads" },
        { icon: IndianRupee, label: "Settlements Report", path: "/reports/settlements" },
        { icon: Handshake, label: "Resellers Report", path: "/reports/resellers" },
      ]
    });
  }

  const isActive = (path?: string) => {
    if (!path) return false;
    const currentPath = router.pathname;
    const currentAsPath = router.asPath;

    if (path === '/') {
      return currentPath === '/' || currentAsPath === '/';
    }

    if (path === '/leads' || path === '/leads/list') {
      return currentPath.startsWith('/leads') || currentAsPath.startsWith('/leads');
    }

    if (path === '/settlements') {
      return currentPath === '/settlements' || currentPath.startsWith('/settlements');
    }

    if (path === '/projects') {
      return currentPath === '/projects' || currentPath.startsWith('/projects');
    }

    return currentPath === path || currentAsPath.startsWith(path);
  };

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(label)) {
        newSet.delete(label);
      } else {
        newSet.add(label);
      }
      return newSet;
    });
  };

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = () => {
    setIsLogoutModalOpen(false);
    clearAuthToken();
    router.replace("/login");
  };

  const handleLinkClick = () => {
    if (window.innerWidth < 768) {
      toggleSidebar();
    }
  };

  return (
    <>
      {/* Overlay for mobile when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden transition-opacity duration-300"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen bg-[#3B82F6] text-white shadow-2xl transition-all duration-300 ease-in-out ${isOpen
          ? 'w-64 translate-x-0'
          : 'w-64 -translate-x-full md:w-20 md:translate-x-0'
          }`}
      >
        <div className="flex h-full flex-col">
          {/* Header with Logo */}
          <div className={`flex items-center h-20 px-4 border-b border-white/10 ${isOpen ? 'justify-between' : 'justify-center'}`}>
            <div className={`flex items-center gap-3 ${!isOpen && 'hidden md:flex'}`}>
              <div 
                onClick={!isOpen ? toggleSidebar : undefined}
                className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center font-bold text-[#3B82F6] shadow-lg ${!isOpen ? 'cursor-pointer hover:bg-gray-100' : ''}`}
              >
                RP
              </div>
              {isOpen && <span className="text-lg font-semibold text-white tracking-wide">Reseller Panel</span>}
            </div>

            {isOpen && (
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg hover:bg-white/10 transition-all duration-200 group cursor-pointer"
                aria-label="Close sidebar"
              >
                <ChevronLeft className="h-5 w-5 text-white/70 group-hover:text-white transition-all" />
              </button>
            )}
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-6 px-3 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            <ul className="space-y-1.5">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const hasChildren = !!item.children;
                const expanded = expandedItems.has(item.label);
                const isItemActive = isActive(item.path);

                return (
                  <li key={item.label}>
                    {hasChildren ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.label)}
                          className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 group cursor-pointer ${expanded
                            ? 'text-white'
                            : 'text-white hover:bg-white/5 hover:text-white'
                            }`}
                        >
                          <Icon className={`h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110 text-white`} />
                          {isOpen && (
                            <>
                              <span className="flex-1 text-sm font-medium text-left">{item.label}</span>
                              <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
                            </>
                          )}
                        </button>

                        {/* Submenu */}
                        {isOpen && expanded && (
                          <ul className="mt-1 ml-4 space-y-1 border-l border-white/10 pl-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            {item.children?.map((child) => {
                              const ChildIcon = child.icon;
                              const isChildActive = isActive(child.path);

                              return (
                                <li key={child.label}>
                                  <Link
                                    href={child.path || '#'}
                                    onClick={handleLinkClick}
                                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-all duration-200 group ${isChildActive
                                      ? 'bg-white text-[#3B82F6] font-semibold shadow-xs'
                                      : 'text-white hover:bg-white/10 hover:text-white'
                                      }`}
                                  >
                                    <ChildIcon className={`h-4 w-4 flex-shrink-0 transition-transform group-hover:scale-110 ${isChildActive ? 'text-[#3B82F6]' : 'text-white'
                                      }`} />
                                    <span className="text-sm">{child.label}</span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <Link
                        href={item.path || '#'}
                        onClick={handleLinkClick}
                        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 group ${isItemActive
                          ? 'bg-white text-[#3B82F6] font-semibold'
                          : 'text-white hover:bg-white/10 hover:text-white'
                          }`}
                      >
                        <Icon className={`h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110 ${isItemActive ? 'text-[#3B82F6]' : 'text-white'
                          }`} />
                        {isOpen && (
                          <span className="text-sm font-medium">{item.label}</span>
                        )}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>

      <DeleteDialog
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        title="Confirm Logout"
        footer={
          <>
            <button
              onClick={() => setIsLogoutModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmLogout}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Logout
            </button>
          </>
        }
      >
        <p className="text-gray-600">You will be logged out of your account. Are you sure you want to proceed?</p>
      </DeleteDialog>
    </>
  );
}