'use client';

import React from "react"
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
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
} from 'lucide-react';
import { useRouter } from "next/navigation";
import axios from "axios";
import { baseUrl, clearAuthToken, getAuthToken } from "@/config";
import Swal from 'sweetalert2';

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
  const pathname = usePathname();
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [canViewLead, setCanViewLead] = useState(false);
  const [canViewTask, setCanViewTask] = useState(false);
  const [canViewStaff, setCanViewStaff] = useState(false);
  const [canViewRole, setCanViewRole] = useState(false);
  const [canViewLeadStatus, setCanViewLeadStatus] = useState(false);
  const [canViewLeadSource, setCanViewLeadSource] = useState(false);
  const [canViewLeadLabel, setCanViewLeadLabel] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    axios
      .get(baseUrl.currentStaff, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const role = res.data?.data?.role || {};
        const rawPerms = Array.isArray(role.permissions)
          ? role.permissions[0]
          : role.permissions || {};
        const leadPerms = rawPerms.lead || {};
        const taskPerms = rawPerms.task || {};
        const staffPerms = rawPerms.staff || {};
        const rolePerms = rawPerms.role || {};
        const leadStatusPerms = rawPerms.leadStatus || {};
        const leadSourcePerms = rawPerms.leadSource || {};
        const leadLabelPerms = rawPerms.leadLabel || {};

        setCanViewLead(!!(leadPerms.readOwn || leadPerms.readAll));
        setCanViewTask(!!(taskPerms.readOwn || taskPerms.readAll));
        setCanViewStaff(!!staffPerms.readAll);
        setCanViewRole(!!rolePerms.readAll);
        setCanViewLeadStatus(!!leadStatusPerms.readAll);
        setCanViewLeadSource(!!leadSourcePerms.readAll);
        setCanViewLeadLabel(!!leadLabelPerms.readAll);
      })
      .catch(() => {
        setCanViewLead(false);
        setCanViewTask(false);
        setCanViewStaff(false);
        setCanViewRole(false);
        setCanViewLeadStatus(false);
        setCanViewLeadSource(false);
        setCanViewLeadLabel(false);
      });
  }, []);

  const menuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  ];

  if (canViewLead) {
    menuItems.push({ icon: UserPlus, label: "Leads", path: "/leads" });
  }

  // Always allow viewing Resellers for now or if they have permission
  menuItems.push({ icon: Handshake, label: "Resellers", path: "/resellers" });

  const hasAnySetupPerm = canViewStaff || canViewRole || canViewLeadStatus || canViewLeadSource || canViewLeadLabel;

  // if (hasAnySetupPerm) {
    menuItems.push({
      icon: Settings,
      label: "Setup",
      path: "/setup",
    });
  // }

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === '/') return pathname === '/';
    return pathname?.startsWith(path);
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
    Swal.fire({
      title: 'Are you sure?',
      text: "You will be logged out of your account",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, logout',
      cancelButtonText: 'Cancel',
      background: '#fff',
      backdrop: true,
      allowOutsideClick: false,
      allowEscapeKey: true,
    }).then((result) => {
      if (result.isConfirmed) {
        // Show loading state
        Swal.fire({
          title: 'Logging out...',
          text: 'Please wait',
          icon: 'info',
          showConfirmButton: false,
          allowOutsideClick: false,
          allowEscapeKey: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
        
        // Perform logout
        clearAuthToken();
        if (typeof window !== "undefined") {
          localStorage.removeItem("token");
          localStorage.removeItem("auth");
        }
        
        // Show success message
        Swal.fire({
          title: 'Logged Out!',
          text: 'You have been successfully logged out',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        }).then(() => {
          router.replace("/login");
        });
      }
    });
  };

  const handleNavigation = (path?: string) => {
    if (path) {
      router.push(path);
      // Close sidebar on mobile after navigation
      if (window.innerWidth < 768) {
        toggleSidebar();
      }
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
        className={`fixed top-0 left-0 z-40 h-screen bg-[#05111e] text-white shadow-2xl transition-all duration-300 ease-in-out ${
          isOpen 
            ? 'w-64 translate-x-0' 
            : 'w-64 -translate-x-full md:w-20 md:translate-x-0'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header with Logo */}
          <div className={`flex items-center h-20 px-4 border-b border-white/10 ${isOpen ? 'justify-between' : 'justify-center'}`}>
            <div className={`flex items-center gap-3 ${!isOpen && 'hidden md:flex'}`}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#30cdb2] to-[#23abed] flex items-center justify-center font-bold text-white shadow-lg">
                LF
              </div>
              {isOpen && <span className="text-lg font-semibold text-white tracking-wide">LeadFlow</span>}
            </div>
            
            <button
              onClick={toggleSidebar}
              className={`p-2 rounded-lg hover:bg-white/10 transition-all duration-200 group ${!isOpen && 'md:block'}`}
              aria-label="Toggle sidebar"
            >
              {isOpen ? (
                <ChevronLeft className="h-5 w-5 text-white/70 group-hover:text-white transition-all" />
              ) : (
                <Menu className="h-6 w-6 text-white/70 group-hover:text-white transition-all" />
              )}
            </button>
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
                          onClick={() => toggleExpand(item.label)}
                          className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 group ${
                            expanded
                              ? 'bg-white/10 text-white'
                              : 'text-white/70 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <Icon className={`h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110 ${
                            expanded ? 'text-white' : 'text-white/70'
                          }`} />
                          {isOpen && (
                            <>
                              <span className="flex-1 text-sm font-medium text-left">{item.label}</span>
                              <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
                            </>
                          )}
                        </button>

                        {/* Submenu */}
                        {isOpen && expanded && (
                          <ul className="mt-1 ml-4 space-y-1 border-l border-white/10 pl-3">
                            {item.children?.map((child) => {
                              const ChildIcon = child.icon;
                              const isChildActive = isActive(child.path);
                              
                              return (
                                <li key={child.label}>
                                  <button
                                    onClick={() => handleNavigation(child.path)}
                                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-all duration-200 group ${
                                      isChildActive
                                        ? 'bg-gradient-to-r from-[#0f3c70]/20 to-[#0f2f5a]/20 text-white border border-white/10'
                                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                                    }`}
                                  >
                                    <ChildIcon className={`h-4 w-4 flex-shrink-0 transition-transform group-hover:scale-110 ${
                                      isChildActive ? 'text-[#9f7cff]' : 'text-white/60'
                                    }`} />
                                    <span className="text-sm">{child.label}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleNavigation(item.path)}
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 group ${
                          isItemActive
                            ? 'bg-gradient-to-r from-[#0f3c70] to-[#0f2f5a] text-white'
                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <Icon className={`h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110 ${
                          isItemActive ? 'text-white' : 'text-white/70'
                        }`} />
                        {isOpen && (
                          <span className="text-sm font-medium">{item.label}</span>
                        )}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>


        </div>
      </aside>
    </>
  );
}