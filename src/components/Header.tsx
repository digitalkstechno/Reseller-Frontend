'use client';

import { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { baseUrl, clearAuthToken, getAuthToken } from '@/config';
import { useRouter } from 'next/router';
import { Bell, CheckCircle, CheckCheck, LogOut, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';

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
  const [imageError, setImageError] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pathName = usePathname()
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

    return ""
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
      } else {
        setNotificationPermission(Notification.permission);
      }
    }
  }, []);

  // Request notification permission with user interaction
  // const requestNotificationPermission = async () => {
  //   if (typeof window !== 'undefined' && 'Notification' in window) {
  //     try {
  //       const permission = await Notification.requestPermission();
  //       setNotificationPermission(permission);

  //       if (permission === 'granted') {
  //         console.log('Notification permission granted');
  //         // Show a test notification to confirm it's working
  //         new Notification('Notifications Enabled', {
  //           body: 'You will now receive notifications for new tasks and leads.',
  //           icon: '/favicon.ico'
  //         });
  //       } else if (permission === 'denied') {
  //         console.log('Notification permission denied');
  //         // You can show a toast or tooltip here to inform the user
  //       }
  //     } catch (error) {
  //       console.error('Error requesting notification permission:', error);
  //     }
  //   }
  // };

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

  // const fetchNotifications = async () => {
  //   try {
  //     const token = getAuthToken();
  //     if (!token) return;
  //     const base = baseUrl.getBaseUrl?.endsWith('/') ? baseUrl.getBaseUrl.slice(0, -1) : baseUrl.getBaseUrl;
  //     const res = await axios.get(`${base}/notification/my-notifications`, {
  //       headers: { Authorization: `Bearer ${token}` }
  //     });
  //     setNotifications(res.data?.data || []);
  //   } catch (error) {
  //     console.error('Failed to fetch notifications', error);
  //   }
  // };

  // useEffect(() => {
  //   fetchNotifications();
  // }, []);

  const { user: authUser, role: authRole } = useSelector((state: any) => state.auth);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    let socket: any;

    const staffData = authUser;
    if (!staffData) return;
    setUserName(staffData.fullName || 'User');
    setUserRole(authRole || '');
    setUserEmail(staffData.email || '');
    setUserProfileImage(staffData.profileImage || staffData.avatar || staffData.image || '');
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

          // setNotifications((prev) => [notif, ...prev]);

          if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              const browserNotif = new window.Notification(notif.title, {
                body: notif.message,
                icon: '/notification-icon.png',
                badge: '/badge-icon.png',
              });

              browserNotif.onclick = async () => {
                window.focus();
                try {
                  if (!notif.isRead) {
                    await axios.put(
                      `${baseUrl.getBaseUrl?.endsWith('/') ? baseUrl.getBaseUrl.slice(0, -1) : baseUrl.getBaseUrl}/notification/mark-read/${notif._id}`,
                      {},
                      {
                        headers: {
                          Authorization: `Bearer ${getAuthToken()}`,
                        },
                      }
                    );
                  }
                  router.push(
                    notif.type === 'task' ? '/tasks' : '/leads/list'
                  );
                } catch (e) {
                  console.error(e);
                }
                browserNotif.close();
              };
            }
          }
        });

        socket.on('new_lead_assigned', (notif: Notification) => {
          console.log('[Socket] 📩 new_lead_assigned:', notif);
          // setNotifications((prev) => [notif, ...prev]);
        });

        socket.on('task_updated', (notif: Notification) => {
          console.log('[Socket] 📩 task_updated:', notif);
          // setNotifications((prev) => [notif, ...prev]);
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
  }, [router]);

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
      // setNotifications(prev => prev.map(notification =>
      //   notification._id === notifId
      //     ? { ...notification, isRead: true }
      //     : notification
      // ));
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
      // setNotifications(prev => prev.map(notification => ({
      //   ...notification,
      //   isRead: true
      // })));
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
        // setNotifications(prev => prev.map(n =>
        //   n._id === notif._id ? { ...n, isRead: true } : n
        // ));
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

        clearAuthToken();
        if (typeof window !== "undefined") {
          localStorage.removeItem("token");
          localStorage.removeItem("auth");
        }

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

  // Calculate unread notifications count
  const unreadNotifications = notifications.filter(n => !n.isRead);
  const unreadCount = unreadNotifications.length;
  // const totalCount = notifications.length;

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
        <div className="hidden md:flex items-center gap-3 mr-2 pr-4 border-r border-gray-200">
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
            // onClick={() => {
            //   if (!showNotifications) {
            //     fetchNotifications();
            //   }
            //   setShowNotifications(!showNotifications);
            // }}
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
            <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm rounded-lg bg-white shadow-xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-gray-100 bg-[#3B82F6] flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">Notifications</h3>
                  {/* Counter badge on the right side of the header */}
                  <span className="bg-white text-primary text-xs font-medium px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                </div>
                <div className="flex gap-2">
                  {/* Permission status indicator and request button */}
                  {notificationPermission !== 'granted' && (
                    <button
                      // onClick={requestNotificationPermission}
                      className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer bg-blue-50 px-2 py-1 rounded"
                    >
                      {notificationPermission === 'denied' ? 'Enable Notifications' : 'Allow Notifications'}
                    </button>
                  )}
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

              <div className="max-h-[70vh] overflow-y-auto">
                {unreadNotifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-500">
                    {/* {totalCount === 0 ? 'No notifications' : 'No new notifications'} */}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-[30vh] overflow-y-auto">
                    {unreadNotifications.map(notif => (
                      <div
                        key={notif._id}
                        onClick={() => handleNotificationClick(notif)}
                        className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors bg-blue-50/30 group relative"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-sm font-semibold text-gray-900 pr-6">
                            {notif.title}
                          </h4>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                            {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString() : 'Just now'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-800 line-clamp-2 pr-6">
                          {notif.message}
                        </p>

                        <button
                          onClick={(e) => markAsReadSingle(e, notif._id)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 bg-white shadow-sm rounded-full p-1 transition-all"
                          title="Mark as read"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Full width Mark all as read button at the bottom */}
              {unreadCount > 0 && (
                <div className="border-t border-gray-100">
                  <button
                    onClick={markAllAsRead}
                    disabled={markingAllRead}
                    className="w-full px-4 py-3 text-sm bg-[#3B82F6] text-white font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCheck className="w-4 h-4" />
                    {markingAllRead ? 'Marking all as read...' : `Mark all as read (${unreadCount})`}
                  </button>
                </div>
              )}
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
      </div>
    </header>
  );
}