'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { baseUrl, clearAuthToken, getAuthToken } from '@/config';
import { useRouter } from 'next/router';
import { Bell, Check, CheckCircle, CheckCheck, LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';
import ResellerDialog from '@/components/ResellerDialog';
import { toast } from 'react-toastify';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  relatedId: string;
  isRead: boolean;
  createdAt: string;
}

interface HeaderProps {
  toggleSidebar: () => void;
}

interface ResellerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: Reseller | null;
}

interface Reseller {
  id: string;
  image?: string;
  fullName: string;
  phone: string;
  email: string;
  status: string;
  role: string;
  roleName?: string;
  address?: string;
  city: string;
  state: string;
  pincode: string;
  commissionRate: string;
}

export default function Header({ toggleSidebar }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userProfileImage, setUserProfileImage] = useState<string>('');
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pathName = usePathname()

  // Profile Edit States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string>('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const isLoginPage = pathName === "/login";

  const getLabel = () => {
    if (pathName === "/") return "Dashboard"
    if (pathName === "/leads") return "Leads"
    if (pathName === "/leads/list") return "Leads List"
    if (pathName === "/leads/kanban") return "Leads Kanban"
    if (pathName === "/setup") return "Setup"
    if (pathName === "/tasks") return "Tasks"
    if (pathName === "/resellers") return "Reseller List"
    if (pathName === "/ledger") return "Ledger"
    if (pathName === "/settlements") return "Settlements"
    if (pathName === "/reports/leads") return "Leads Report"
    if (pathName === "/reports/settlements") return "Settlements Report"


    return ""
  }
    const token = getAuthToken();
    if (!token) return;

  const handleSubmit = async (values: any) => {
    setIsLoading(true);
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

      await axios.put(`${baseUrl.updateReseller}/${editingReseller?.id}`, payload, { headers })

      toast.success( 'Profile updated successfully');
      setIsFormOpen(false);
      setEditingReseller(null);
      fetchProfile();
    } catch (err: any) {
      const message = err.response?.data?.message || 'Something went wrong';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfile = useCallback(async () => {


    setIsLoading(true);
    try {
      const params = {

      };

      const res = await axios?.get(baseUrl?.myProfile, {
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setUserName(res.data.data.fullName || 'User');
      setUserEmail(res.data.data.email || '');
      setUserProfileImage(res.data.data.profileImage || '');
      setCurrentUserData(res.data.data);
    } catch (err) {
      console.error('Failed to fetch Profile:', err);

    } finally {
      setIsLoading(false);
    }
  }, []);


  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    }
    fetchProfile()
  }, []);

  // Request notification permission with user interaction
  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);

        if (permission === 'granted') {
          console.log('Notification permission granted');
          // Show a test notification to confirm it's working
          new Notification('Notifications Enabled', {
            body: 'You will now receive notifications for new tasks and leads.',
            icon: '/favicon.ico'
          });
        } else if (permission === 'denied') {
          console.log('Notification permission denied');
          // You can show a toast or tooltip here to inform the user
        }
      } catch (error) {
        console.error('Error requesting notification permission:', error);
      }
    }
  };

  // Check notification permission status on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      const date = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      setCurrentTime(time);
      setCurrentDate(date);
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const base = baseUrl.getBaseUrl?.endsWith('/') ? baseUrl.getBaseUrl.slice(0, -1) : baseUrl.getBaseUrl;
      const res = await axios.get(`${base}/notification/my-notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(res.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const { user: authUser, role: authRole } = useSelector((state: any) => state.auth);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    let socket: any;

    const staffData = authUser;
    if (!staffData) return;
    setUserRole(authRole || '');

    const currentUserId = staffData._id;
    if (!currentUserId) return;

    // ✅ Correct socket URL (NO /api/v1/api)
    const socketUrl = (
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      process.env.NEXT_PUBLIC_IMAGE_URL ||
      ''
    ).replace(/\/api\/?$/, '');


    socket = io(socketUrl || 'http://localhost:5000', {
      transports: ['websocket', 'polling'],
    });

    // =========================
    // 🔥 GLOBAL EVENT LOGGER
    // =========================
    socket.onAny((event: string, ...args: any[]) => {
      console.log('[Socket][onAny] 👉', event, args);
    });

    // =========================
    // 🔌 CONNECTION EVENTS
    // =========================
    socket.on('connect', () => {
      console.log('[Socket] ✅ Connected:', socket.id);

      socket.emit('joinRoom', currentUserId);
      console.log('[Socket] 📌 Joined room:', currentUserId);
    });

    socket.on('disconnect', (reason: string) => {
      console.log('[Socket] ❌ Disconnected:', reason);
    });

    socket.on('connect_error', (error: any) => {
      console.error('[Socket] 🚨 Connect Error:', error.message);
    });

    // =========================
    // 🔄 RECONNECT EVENTS
    // =========================
    socket.io.on('reconnect_attempt', () => {
      console.log('[Socket] 🔄 Reconnect Attempt...');
    });

    socket.io.on('reconnect', (attempt: number) => {
      console.log('[Socket] ♻️ Reconnected after:', attempt);
    });

    socket.io.on('reconnect_error', (err: any) => {
      console.error('[Socket] 🚨 Reconnect Error:', err.message);
    });

    // =========================
    // ⚡ ENGINE EVENTS (DEEP DEBUG)
    // =========================
    socket.io.engine.on('upgrade', () => {
      console.log('[Socket] ⚡ Upgraded to WebSocket');
    });

    socket.io.engine.on('packet', (packet: any) => {
      console.log('[Socket] 📦 Packet:', packet);
    });

    // =========================
    // 📩 CUSTOM EVENTS
    // =========================

    socket.on('new_task_assigned', (notif: Notification) => {
      console.log('[Socket] 📩 new_task_assigned:', notif);
      setNotifications((prev) => [notif, ...prev]);
    });

    socket.on('new_notification', (notif: Notification) => {
      console.log('[Socket] 📩 new_notification:', notif);
      setNotifications((prev) => [notif, ...prev]);
    });

    socket.on('new_lead_assigned', (notif: Notification) => {
      console.log('[Socket] 📩 new_lead_assigned:', notif);
      setNotifications((prev) => [notif, ...prev]);
    });

    socket.on('task_updated', (notif: Notification) => {
      console.log('[Socket] 📩 task_updated:', notif);
      setNotifications((prev) => [notif, ...prev]);
    });

    // =========================
    // 🧹 CLEANUP
    // =========================
    return () => {
      if (socket) {
        console.log('[Socket] 🧹 Cleaning up...');
        socket.disconnect();
      }
    };
  }, [router, authUser, authRole]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // FIXED: Mark single notification as read
  const markAsReadSingle = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    try {
      const token = getAuthToken();
      const base = baseUrl.getBaseUrl?.endsWith('/') ? baseUrl.getBaseUrl.slice(0, -1) : baseUrl.getBaseUrl;
      await axios.put(`${base}/notification/mark-read/${notifId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update the notification to mark it as read
      setNotifications(prev => prev.map(notification =>
        notification._id === notifId
          ? { ...notification, isRead: true }
          : notification
      ));
    } catch (error) {
      console.error('Failed to mark read', error);
    }
  };

  // FIXED: Mark all notifications as read
  const markAllAsRead = async () => {
    if (markingAllRead) return;
    setMarkingAllRead(true);
    try {
      const token = getAuthToken();
      const base = baseUrl.getBaseUrl?.endsWith('/') ? baseUrl.getBaseUrl.slice(0, -1) : baseUrl.getBaseUrl;
      await axios.put(`${base}/notification/mark-all-read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Mark all notifications as read in the state
      setNotifications(prev => prev.map(notification => ({
        ...notification,
        isRead: true
      })));
    } catch (error) {
      console.error('Failed to mark all as read', error);
    } finally {
      setMarkingAllRead(false);
    }
  };

  // FIXED: Handle notification click - mark as read and navigate
  const handleNotificationClick = async (notif: Notification) => {
    try {
      const token = getAuthToken();
      if (!notif.isRead) {
        const base = baseUrl.getBaseUrl?.endsWith('/') ? baseUrl.getBaseUrl.slice(0, -1) : baseUrl.getBaseUrl;
        await axios.put(`${base}/notification/mark-read/${notif._id}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Update the state to mark this notification as read
        setNotifications(prev => prev.map(n =>
          n._id === notif._id ? { ...n, isRead: true } : n
        ));
      }

      setShowNotifications(false);

      if (notif.type === 'task') {
        router.push(`/tasks`);
      } else if (notif.type === 'lead') {
        router.push(`/leads/list`);
      }
    } catch (error) {
      console.error('Failed to mark read', error);
    }
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
        Swal.fire({
          title: 'Logged Out!',
          text: 'You have been successfully logged out',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        }).then(() => {
          clearAuthToken();
          router.replace("/login");
        });
      }
    });
  };

  // Calculate unread notifications count
  const unreadNotifications = notifications.filter(n => !n.isRead);
  const unreadCount = unreadNotifications.length;
  // const totalCount = notifications.length;

  const openProfileModal = () => {
    setEditName(userName);
    setEditEmail(userEmail);
    setEditContact(authUser?.contact || '');
    setEditPassword('');
    setEditImageFile(null);
    setEditImagePreview(userProfileImage ? (userProfileImage.startsWith('http') ? userProfileImage : `${baseUrl.getImageUrl}/images/ResellerProfileImages/${userProfileImage}`) : '');
    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName || !editEmail) {
      toast.error('Name and Email are required');
      return;
    }
    setIsSavingProfile(true);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append('fullName', editName);
      formData.append('email', editEmail);
      if (editContact) formData.append('contact', editContact);
      if (editPassword) formData.append('password', editPassword);
      if (editImageFile) {
        formData.append('profileImage', editImageFile);
      }

      const res = await axios.put(`${baseUrl.updateReseller}/${authUser._id}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Profile updated successfully!');
      setShowProfileModal(false);

      const updatedUser = res.data.data;
      if (updatedUser) {
        setUserName(updatedUser.fullName || '');
        setUserEmail(updatedUser.email || '');
        if (updatedUser.profileImage) {
          setUserProfileImage(updatedUser.profileImage);
          setImageError(false);
        }
      }
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      toast.error(error?.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between bg-white border-b border-gray-200 px-4 md:px-6 backdrop-blur-sm">
      <div className="flex items-center gap-2 md:gap-4">
        {/* Hamburger Menu for Mobile */}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 md:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-6 w-6 text-gray-600" />
        </button>
        <h1 className="text-xl md:text-3xl font-bold text-gray-900 truncate">
          {getLabel() || "Default Title"}
        </h1>
      </div>
      <div className="flex items-center gap-1 md:gap-3">
        {/* User Profile */}
        <div 
          onClick={openProfileModal}
          className="hidden md:flex items-center gap-3 mr-2 pr-4 border-r border-gray-200 cursor-pointer hover:opacity-80 transition-all duration-200"
          title="Edit Profile"
          // className="hidden md:flex items-center gap-3 mr-2 pr-4 border-r border-gray-200 cursor-pointer hover:bg-gray-50 rounded p-1 transition-colors"
          // title="Edit Profile"
          // onClick={() => {
          //   if (currentUserData) {
          //     setEditingReseller({
          //       id: currentUserData._id,
          //       fullName: currentUserData.fullName,
          //       email: currentUserData.email,
          //       phone: currentUserData.phone || '',
          //       role: currentUserData.role || '',
          //       status: currentUserData.status || 'active',
          //       commissionRate: currentUserData.commissionRate || '0',
          //       image: currentUserData.profileImage || '',
          //       city: currentUserData.city || '',
          //       state: currentUserData.state || '',
          //       pincode: currentUserData.pincode || '',
          //     });
          //     setIsFormOpen(true);
          //   }
          // }}
        >
          <div className="flex flex-col items-end">
            <span className="text-sm font-bold text-gray-800">{userName}</span>
            {userEmail && <span className="text-xs text-gray-500">{userEmail}</span>}
          </div>
          {userProfileImage && !imageError ? (
            <img
              src={userProfileImage.startsWith('http') ? userProfileImage : `${baseUrl.getImageUrl}/images/ResellerProfileImages/${userProfileImage}`}
              alt={userName}
              className="h-10 w-10 rounded-full object-contain shadow-md border border-gray-200"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#3B82F6] flex items-center justify-center text-white font-bold shadow-md">
              {userName ? userName.charAt(0).toUpperCase() : 'U'}
            </div>
          )}
        </div>

        {/* Alerts / Notifications */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => {
              if (!showNotifications) {
                fetchNotifications();
              }
              setShowNotifications(!showNotifications);
            }}
            className="relative flex items-center justify-center h-10 w-10 rounded-full hover:bg-gray-100 transition-colors"
          >
            <Bell className="h-5 w-5 text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute top-1 max-w-[20px] max-h-[20px] overflow-hidden right-1 flex h-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Dropdown Header matching user screenshot */}
              <div className="px-4 py-3.5 border-b border-gray-100 bg-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center shadow-sm">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      disabled={markingAllRead}
                      className="text-xs font-semibold text-blue-500 hover:text-blue-700 hover:underline cursor-pointer transition-colors"
                    >
                      {markingAllRead ? 'Marking...' : 'Mark all read'}
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors p-1 hover:bg-gray-50 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Permission denied message */}
              {notificationPermission === 'denied' && (
                <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100">
                  <p className="text-xs text-yellow-800">
                    Notifications are blocked. Please enable them in your browser settings to receive real-time updates.
                  </p>
                </div>
              )}

              {/* Scrollable Container with off-white background */}
              <div className="max-h-[60vh] overflow-y-auto bg-gray-50/60 p-2">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500 bg-white rounded-xl border border-gray-100 m-1">
                    No notifications
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map(notif => (
                      <div
                        key={notif._id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`relative rounded-xl border border-gray-100 flex items-start gap-3 cursor-pointer p-4 transition-all duration-200 hover:shadow-md bg-white`}
                      >
                        {/* Left Icon (Green Bell in Light Green Circle) */}
                        <div className="flex-shrink-0 h-9 w-9 rounded-full bg-green-100/50 flex items-center justify-center text-green-600">
                          <Bell className="h-4.5 w-4.5 fill-green-100" />
                        </div>

                        {/* Middle Text Section */}
                        <div className="flex-1 min-w-0 pr-4">
                          <h4 className="text-sm font-bold text-gray-900">
                            {notif.title}
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            {notif.message}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-2">
                            {notif.createdAt
                              ? new Date(notif.createdAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                }).replace(/, /g, ' ')
                              : 'Just now'}
                          </p>
                        </div>

                        {/* Right side indicators (Unread blue dot and indicator bar) */}
                        {!notif.isRead && (
                          <>
                            {/* Blue unread dot */}
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex h-2 w-2 rounded-full bg-blue-500" />
                            {/* Right-side gradient vertical bar */}
                            <div className="absolute right-0 top-0 bottom-0 w-1 rounded-r-xl bg-gradient-to-b from-[#8B5CF6] to-[#3B82F6]" />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-red-50 transition-all duration-200 text-gray-600 hover:text-red-600 focus:ring-red-500 focus:ring-offset-2"
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
        </button>
        <ResellerDialog
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingReseller(null);
          }}
          onSubmit={handleSubmit}
          initialData={editingReseller ? {
            _id: editingReseller.id,
            fullName: editingReseller.fullName,
            email: editingReseller.email,
            phone: editingReseller.phone,
            role: editingReseller.role,
            status: editingReseller.status,
            profileImage: editingReseller.image,
            commissionRate: editingReseller.commissionRate,
          } : null}
        />
      </div>

      {showProfileModal && typeof window !== 'undefined' && document.body && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Edit Profile</h3>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-50 rounded-full cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Profile Image Uploader */}
              <div className="flex flex-col items-center mb-4">
                <div className="relative group cursor-pointer">
                  {editImagePreview ? (
                    <img
                      src={editImagePreview}
                      alt="Preview"
                      className="h-20 w-20 rounded-full object-cover border-2 border-blue-500 shadow-md transition-all group-hover:brightness-75"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl border-2 border-blue-500 shadow-md transition-all group-hover:brightness-75">
                      {editName ? editName.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer text-white text-xs font-semibold">
                    Change
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          setEditImageFile(file);
                          setEditImagePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                </div>
                <span className="text-[10px] text-gray-400 mt-1.5">Click to upload photo</span>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  placeholder="Enter full name"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  placeholder="Enter email address"
                />
              </div>

              {/* Contact */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Contact Number</label>
                <input
                  type="text"
                  value={editContact}
                  onChange={(e) => setEditContact(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  placeholder="Enter contact number"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">New Password (optional)</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  placeholder="Leave blank to keep current"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-3 mt-6 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}