"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useSelector } from "react-redux";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ComposedChart,
  Bar,
  BarChart,
  Line,
} from "recharts";
import {
  Users,
  Calendar,
  Award,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  AlertCircle,
  User,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Star,
  CheckCircle2,
  XCircle,
  X,
  MoreVertical,
  Eye,
  PhoneCall,
  Mail as MailIcon,
  MessageSquare,
  PieChartIcon,
  RefreshCw,
  IndianRupee,
} from "lucide-react";
import axios from "axios";
import { baseUrl, getAuthToken } from "@/config";
import moment from "moment";
import Link from 'next/link';
import Badge from "@/components/Badge";
import UpdateLeadStageDrawer from "@/components/leads/UpdateLeadStageDrawer";
import DatePicker from "@/components/ui/DatePicker";
import { formatContactNumber } from "@/utills/utill";
import { ApiLead } from "@/components/leads/types";

interface StatusCount {
  statusId: string;
  statusName: string;
  count: number;
}

interface LeadSummary {
  totalLeads: number;
  currentMonthLeads: number;
  totalRevenue: number;
  totalPaid?: number;
  totalPending?: number;
  totalReseller?: number;
  totalCommission?: number;
  paidCommission?: number;
  pendingCommission?: number;
  pendingCommissionUsersCount?: number;
  statusWiseCounts: StatusCount[];
  chartType?: "weekly" | "monthly";
  chartData?: any[];
}

interface SummaryCard {
  key: string;
  label: string;
  value: number | string;
  trend?: number;
  tone?: "up" | "down" | "neutral";
  Icon: ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  type: "total" | "month" | "status" | "revenue" | "custom";
  statusId?: string;
  fill?: string;
  name?: string;
  description?: string;
}

const ITEMS_PER_PAGE = 5;

export default function Dashboard() {
  const router = useRouter();

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [tempFromDate, setTempFromDate] = useState("");
  const [tempToDate, setTempToDate] = useState("");
  const [activeRange, setActiveRange] = useState<string>("year");
  const [showCustomPopover, setShowCustomPopover] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const customPopoverRef = useRef<HTMLDivElement>(null);
  const [statusChartMode, setStatusChartMode] = useState<"pie" | "graph">("pie")

  // Sync selectedYear with date filters
  useEffect(() => {
    if (fromDate) {
      const year = new Date(fromDate).getFullYear();
      if (!isNaN(year)) {
        setSelectedYear(year);
      }
    } else {
      setSelectedYear(new Date().getFullYear());
    }
  }, [fromDate]);

  // Click outside to close year dropdown and custom popover
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target as Node)) {
        setYearDropdownOpen(false);
      }
      if (customPopoverRef.current && !customPopoverRef.current.contains(e.target as Node)) {
        const isDatePickerClick = (e.target as HTMLElement).closest('[data-datepicker-popup="true"]');
        if (!isDatePickerClick) {
          setShowCustomPopover(false);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    setYearDropdownOpen(false);
  };

  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [revenueChart, setRevenueChart] = useState<any[]>([]);
  const [leadsBySource, setLeadsBySource] = useState<
    { name: string; value: number; fill: string }[]
  >([]);
  const [salesCommissionChart, setSalesCommissionChart] = useState<any[]>([]);
  const [resellerRevenue, setResellerRevenue] = useState<
    { name: string; revenue: number; leadCount: number }[]
  >([]);
  const [recentActivity, setRecentActivity] = useState<{
    leadName: string;
    totalAmount: number;
    commissionAmount: number;
    paymentMode: string;
    paidAt: string;
    resellerName: string;
    resellerEmail: string;
    commissionRate: number | null;
  }[]>([]);
  const [recentActivityLoading, setRecentActivityLoading] = useState(false);
  const [recentActivityFilter, setRecentActivityFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Upcoming Follow-ups (paginated)
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingTotalPages, setUpcomingTotalPages] = useState(1);
  const [upcomingFollowups, setUpcomingFollowups] = useState<any[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [visibleStatusNames, setVisibleStatusNames] = useState<string[] | null>(null);

  // Due Follow-ups (paginated)
  const [duePage, setDuePage] = useState(1);
  const [dueTotalPages, setDueTotalPages] = useState(1);
  const [dueFollowups, setDueFollowups] = useState<any[]>([]);
  const [dueLoading, setDueLoading] = useState(false);

  // All Follow-ups (paginated)
  const [allPage, setAllPage] = useState(1);
  const [allTotalPages, setAllTotalPages] = useState(1);
  const [allFollowups, setAllFollowups] = useState<any[]>([]);
  const [allLoading, setAllLoading] = useState(false);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<ApiLead | null>(null);

  const [greeting, setGreeting] = useState("");

  const token =
    typeof window !== "undefined" ? getAuthToken() : null;

  const { user: authUser, permissions: rawPerms, role: userRole } = useSelector((state: any) => state.auth);

  const user = authUser;

  const permissions = useMemo(() => {
    const lp = rawPerms?.lead || {};
    return {
      readAll: !!lp.readAll,
      readOwn: !!lp.readOwn,
    };
  }, [rawPerms]);

  const isReseller = (!permissions.readAll && permissions.readOwn) || user?.role?.roleName?.toLowerCase() === 'reseller';

  // Set greeting based on time
  useEffect(() => {
    if (!token) return;

    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, [token]);

  // Redirect if no token
  useEffect(() => {
    if (!token) router.replace("/login");
  }, [router, token]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      New: "bg-blue-50 text-blue-600 border-blue-200",
      Contacted: "bg-purple-50 text-purple-600 border-purple-200",
      "Follow-Up": "bg-orange-50 text-orange-600 border-orange-200",
      Interested: "bg-green-50 text-green-700 border-green-200",
      Qualified: "bg-green-50 text-green-700 border-green-200",
      "Not Interested": "bg-gray-100 text-gray-500 border-gray-200",
      Lost: "bg-red-50 text-red-600 border-red-200",
      Won: "bg-green-50 text-green-700 border-green-200",
    };
    return colors[status] || "bg-gray-100 text-gray-500 border-gray-200";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'medium':
        return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'low':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  const statusColorPalette = [
    "#1D4ED8", // blue-700
    "#3B82F6", // blue-500 (brand)
    "#60A5FA", // blue-400
    "#93C5FD", // blue-300
    "#2563EB", // blue-600
    "#BFDBFE", // blue-200
    "#1E40AF", // blue-800
    "#DBEAFE", // blue-100
  ];

  const hasStatusData = summary?.statusWiseCounts && summary.statusWiseCounts.some(s => s.count > 0);
  const statusWiseData = hasStatusData
    ? (summary.statusWiseCounts).map((s, idx) => ({
      name: s.statusName,
      value: s.count,
      fill: statusColorPalette[idx % statusColorPalette.length],
    }))
    : [{ name: "No data", value: 1, fill: "#EFF6FF" }];

  const colorPalette = [
    "#3B82F6", // blue-500
    "#10B981", // emerald-500
    "#F59E0B", // amber-500
    "#EF4444", // red-500
    "#8B5CF6", // violet-500
    "#EC4899", // pink-500
    "#06B6D4", // cyan-500
    "#84CC16", // lime-500
    "#F97316", // orange-500
    "#6366F1", // indigo-500
  ];

  const leadsBySourceColorPalette = [
    "#1E40AF", // blue-800
    "#2563EB", // blue-600
    "#3B82F6", // blue-500
    "#60A5FA", // blue-400
    "#93C5FD", // blue-300
    "#BFDBFE", // blue-200
  ];

  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      const res = await axios.get(baseUrl.dashboardData, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          from: fromDate || undefined,
          to: toDate || undefined,
          filter: activeRange === 'year' ? 'year' : (activeRange === 'today' ? 'week' : 'month'),
        }
      });
      const data = res.data;
      if (!data || !data.counts) return;

      // Update Summary
      setSummary({
        totalLeads: data.counts?.total || 0,
        currentMonthLeads: data.counts?.currentMonthLeads || 0,
        totalRevenue: data.counts?.totalRevenue || 0,
        totalPaid: data.counts?.totalPaid || 0,
        totalPending: data.counts?.totalPending || 0,
        totalReseller: data.counts?.totalReseller || 0,
        totalCommission: data.counts?.totalCommission || 0,
        paidCommission: data.counts?.paidCommission || 0,
        pendingCommission: data.counts?.pendingCommission || 0,
        pendingCommissionUsersCount: data.counts?.pendingCommissionUsersCount || 0,
        statusWiseCounts: data.charts?.leadByStatus || [],
      });

      if (permissions.readAll) {
        // Update Leads By Source
        const sourceData = (data.charts?.leadsBySource ?? []).map((item: any, idx: number) => ({
          name: item.name,
          value: item.count || 0,
          fill: leadsBySourceColorPalette[idx % leadsBySourceColorPalette.length],
        }));
        setLeadsBySource(sourceData);

        // Update Sales & Commission chart data for resellers
        setSalesCommissionChart(data.charts?.salesAndCommission || []);

        // Update Reseller Revenue
        setResellerRevenue(data.charts?.resellerRevenue || []);
      } else {
        // Reseller: read their own sales & commission from dashboard
        setSalesCommissionChart(data.charts?.salesAndCommission || []);
      }
    } catch (err) {
      console.error("Dashboard data error:", err);
    }
  };

  const fetchRevenueChartData = async (year: number, range: string) => {
    if (!token) return;
    try {
      const res = await axios.get(baseUrl.revenueChartData, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          year,
          range,
        }
      });
      if (res.data?.data) {
        setRevenueChart(res.data.data);
      }
    } catch (err) {
      console.error("Revenue chart error:", err);
    }
  };

  const fetchRecentActivity = async (filter: string = 'all') => {
    if (!token) return;
    setRecentActivityLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter !== 'all') params.filter = filter;
      const res = await axios.get(baseUrl.recentActivity, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setRecentActivity(res.data?.activity || []);
    } catch (err) {
      console.error("Recent activity error:", err);
      setRecentActivity([]);
    } finally {
      setRecentActivityLoading(false);
    }
  };

  // When year or activeRange changes, fetch the chart
  useEffect(() => {
    if (token && userRole) {
      const currentYear = new Date().getFullYear();
      const isCurrentYear = selectedYear === currentYear;
      const queryRange = isCurrentYear
        ? (activeRange === 'custom' ? 'year' : activeRange)
        : 'year';
      fetchRevenueChartData(selectedYear, queryRange);
    }
  }, [selectedYear, activeRange, token, userRole]);

  const fetchUpcomingFollowups = async (page: number) => {
    if (!token) return;
    setUpcomingLoading(true);
    try {
      const isMyOnly = !permissions.readAll && permissions.readOwn;
      const url = isMyOnly ? baseUrl.leadUpcomingFollowupsMy : baseUrl.leadUpcomingFollowups;
      const res = await axios.get(
        `${url}?page=${page}&limit=${ITEMS_PER_PAGE}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const { data, pagination } = res.data;
      setUpcomingFollowups(data || []);
      setUpcomingTotalPages(pagination?.totalPages || 1);
      setUpcomingPage(pagination?.currentPage || 1);
    } catch (err) {
      console.error("Upcoming followups error:", err);
      setUpcomingFollowups([]);
    } finally {
      setUpcomingLoading(false);
    }
  };

  const fetchDueFollowups = async (page: number) => {
    if (!token) return;
    setDueLoading(true);
    try {
      const isMyOnly = !permissions.readAll && permissions.readOwn;
      const url = isMyOnly ? baseUrl.leadDueFollowupsMy : baseUrl.leadDueFollowups;
      const res = await axios.get(
        `${url}?page=${page}&limit=${ITEMS_PER_PAGE}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const { data, pagination } = res.data;
      setDueFollowups(data || []);
      setDueTotalPages(pagination?.totalPages || 1);
      setDuePage(pagination?.currentPage || 1);
    } catch (err) {
      console.error("Due followups error:", err);
      setDueFollowups([]);
    } finally {
      setDueLoading(false);
    }
  };

  const fetchAllFollowups = async (page: number) => {
    if (!token) return;
    setAllLoading(true);
    try {
      const isMyOnly = !permissions.readAll && permissions.readOwn;
      const url = isMyOnly ? baseUrl.leadAllFollowupsMy : baseUrl.leadAllFollowups;
      const res = await axios.get(
        `${url}?page=${page}&limit=${ITEMS_PER_PAGE}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const { data, pagination } = res.data;
      setAllFollowups(data || []);
      setAllTotalPages(pagination?.totalPages || 1);
      setAllPage(pagination?.currentPage || 1);
    } catch (err) {
      console.error("All followups error:", err);
      setAllFollowups([]);
    } finally {
      setAllLoading(false);
    }
  };

  useEffect(() => {
    if (token && userRole) {
      fetchDashboardData();
    }
  }, [token, permissions, fromDate, toDate, activeRange, userRole]);

  useEffect(() => {
    if (token && userRole) {
      const isAdmin = userRole?.toLowerCase() === 'admin';
      if (!isAdmin) {
        fetchUpcomingFollowups(1);
        fetchDueFollowups(1);
        fetchAllFollowups(1);
      } else {
        fetchRecentActivity(recentActivityFilter);
      }
    }
  }, [token, permissions, userRole]);

  // Re-fetch recent activity when filter changes (admin only)
  useEffect(() => {
    if (token && userRole?.toLowerCase() === 'admin') {
      fetchRecentActivity(recentActivityFilter);
    }
  }, [recentActivityFilter]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem("kanbanVisibleStatusNames");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setVisibleStatusNames(parsed.filter((x) => typeof x === "string"));
          }
        } catch {
        }
      }
    }
  }, []);

  const summaryCards: any[] = summary
    ? [
      {
        key: "reseller",
        label: "Total Reseller",
        value: summary.totalReseller || 0,
        trend: 0,
        tone: "neutral",
        Icon: User,
        iconBg: "bg-purple-500/10",
        iconColor: "text-purple-500",
        type: "resellers",
        fill: "#8B5CF6",
        name: "Total Resellers",
        description: "Resellers registered"
      },
      {
        key: "total",
        label: "Total Leads",
        value: summary.totalLeads,
        trend: 0,
        tone: "neutral",
        Icon: Users,
        iconBg: "bg-blue-500/10",
        iconColor: "text-blue-500",
        type: "total",
        fill: "#3B82F6",
        name: "Total Leads",
        description: "Leads in selected range"
      },
      {
        key: "lead_amount",
        label: "Total Lead Amount",
        value: `₹${(summary.totalRevenue || 0).toLocaleString('en-IN')}`,
        trend: 0,
        tone: "neutral",
        Icon: IndianRupee,
        iconBg: "bg-amber-500/10",
        iconColor: "text-amber-500",
        type: "revenue",
        fill: "#F59E0B",
        name: "Total Lead Amount",
        description: "Total amount of leads created"
      },
      {
        key: "commission",
        label: "Total Commission",
        value: `₹${(summary.totalCommission || 0).toLocaleString('en-IN')}`,
        trend: 0,
        tone: "neutral",
        Icon: Activity,
        iconBg: "bg-indigo-500/10",
        iconColor: "text-indigo-500",
        type: "revenue",
        fill: "#6366F1",
        name: "Total Commission",
        description: "Total commission earned"
      },
      {
        key: "paid",
        label: userRole?.toLowerCase() === 'admin' ? "Total Paid" : "Commission Received",
        value: `₹${((userRole?.toLowerCase() === 'admin' ? summary.totalPaid : summary.paidCommission) || 0).toLocaleString('en-IN')}`,
        trend: 0,
        tone: "neutral",
        Icon: CheckCircle2,
        iconBg: "bg-emerald-500/10",
        iconColor: "text-emerald-500",
        type: "paid",
        fill: "#10B981",
        name: userRole?.toLowerCase() === 'admin' ? "Total Paid" : "Commission Received",
        description: "Commission Received"
      },
      {
        key: "pending",
        label: userRole?.toLowerCase() === 'admin' ? "Pending Commission" : "Pending Commission",
        value: `₹${(summary.pendingCommission || 0).toLocaleString('en-IN')}`,
        trend: 0,
        tone: "neutral",
        Icon: Clock,
        iconBg: "bg-orange-500/10",
        iconColor: "text-orange-500",
        type: "pending",
        fill: "#EF4444",
        name: "Pending Commission",
        description: userRole?.toLowerCase() === 'admin' ? "Commission owed to resellers" : "Commission yet to be received"
      },
      {
        key: "pending_users",
        label: "Pending Commission Users",
        value: summary.pendingCommissionUsersCount || 0,
        trend: 0,
        tone: "neutral",
        Icon: AlertCircle,
        iconBg: "bg-rose-500/10",
        iconColor: "text-rose-500",
        type: "pending_users",
        fill: "#F43F5E",
        name: "Pending Commission Users",
        description: "Resellers with commission due"
      },
      
    ].filter((card) => {
      if (userRole?.toLowerCase() === "admin") {
        // Admin: show reseller, total, paid, pending, pending_users — hide lead_amount and commission
        return card.key !== "lead_amount" && card.key !== "commission";
      } else {
        // Reseller: hide reseller count card and pending_users card
        return card.key !== "reseller" && card.key !== "pending_users";
      }
    })
    : [];

  const monthlyRevenueData = revenueChart || [];

  // Total Leads Trend data (reseller-only chart)
  // NOTE: reads `leadCount` from summary.chartData items (same period-buckets used for revenue).
  // Backend should include a `leadCount` field alongside `revenue` in chartData for this to populate.
  const monthlyLeadsData = (() => {
    // 1. Daily Hourly baseline
    if (summary?.chartType === "daily") {
      const slots = [
        "12 AM - 4 AM",
        "4 AM - 8 AM",
        "8 AM - 12 PM",
        "12 PM - 4 PM",
        "4 PM - 8 PM",
        "8 PM - 12 AM"
      ];

      const todayStr = (() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      })();

      const isToday = fromDate === todayStr;
      let activeSlots = slots;
      if (isToday) {
        const currentHour = new Date().getHours();
        const maxSlotIndex = Math.floor(currentHour / 4);
        activeSlots = slots.slice(0, maxSlotIndex + 1);
      }

      const data = activeSlots.map(s => ({
        name: s,
        leads: 0
      }));

      if (summary.chartData) {
        summary.chartData.forEach((item: any) => {
          const match = data.find(d => d.name === item.name);
          if (match) match.leads = item.leadCount || 0;
        });
      }
      return data;
    }

    // 2. Weekly baseline
    if (summary?.chartType === "weekly") {
      let queryYear = new Date().getFullYear();
      let queryMonth = new Date().getMonth() + 1;
      if (fromDate) {
        const parsedDate = new Date(fromDate);
        if (!isNaN(parsedDate.getTime())) {
          queryYear = parsedDate.getFullYear();
          queryMonth = parsedDate.getMonth() + 1;
        }
      }

      const lastDay = new Date(queryYear, queryMonth, 0).getDate();
      const weeks = [
        "Week 1 (1-7)",
        "Week 2 (8-14)",
        "Week 3 (15-21)",
        "Week 4 (22-28)",
        `Week 5 (29-${lastDay})`
      ];

      const now = new Date();
      const isCurrentMonth = queryYear === now.getFullYear() && queryMonth === (now.getMonth() + 1);
      let activeWeeks = weeks;
      if (isCurrentMonth) {
        const currentDay = now.getDate();
        let maxWeekIndex = 4;
        if (currentDay <= 7) maxWeekIndex = 0;
        else if (currentDay <= 14) maxWeekIndex = 1;
        else if (currentDay <= 21) maxWeekIndex = 2;
        else if (currentDay <= 28) maxWeekIndex = 3;

        activeWeeks = weeks.slice(0, maxWeekIndex + 1);
      }

      const data = activeWeeks.map(w => ({
        name: w,
        leads: 0
      }));

      if (summary.chartData) {
        summary.chartData.forEach((item: any) => {
          const match = data.find(d => d.name.substring(0, 6) === item.name.substring(0, 6));
          if (match) match.leads = item.leadCount || 0;
        });
      }
      return data;
    }

    // 3. Monthly baseline
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const currentYear = selectedYear || new Date().getFullYear();

    const actualYear = new Date().getFullYear();
    const actualMonth = new Date().getMonth() + 1;
    const isCurrentYear = currentYear === actualYear;

    let activeMonths = months;
    if (isCurrentYear) {
      activeMonths = months.slice(0, actualMonth);
    }

    const data = activeMonths.map((monthName, idx) => ({
      name: monthName,
      leads: 0,
      monthNum: idx + 1,
      year: currentYear
    }));

    if (summary?.chartData && summary.chartType === "monthly") {
      summary.chartData.forEach((item: any) => {
        const match = data.find(d => d.monthNum === item.month && d.year === item.year);
        if (match) {
          match.leads = item.leadCount || 0;
        } else if (item.year && item.month) {
          data.push({
            name: `${months[item.month - 1]} ${item.year}`,
            leads: item.leadCount || 0,
            monthNum: item.month,
            year: item.year
          });
        }
      });
    }

    return data.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthNum - b.monthNum;
    });
  })();

  const handleQuickFilter = (range: string) => {
    if (range === 'custom') {
      setShowCustomPopover(!showCustomPopover);
      if (!showCustomPopover) {
        setTempFromDate(fromDate);
        setTempToDate(toDate);
      }
      return;
    }

    setShowCustomPopover(false);

    if (activeRange === range) {
      setFromDate("");
      setToDate("");
      setActiveRange("");
      return;
    }

    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (range) {
      case 'today':
        start = new Date();
        end = new Date();
        setActiveRange('today');
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setActiveRange('month');
        break;
      case 'prev_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        setActiveRange('prev_month');
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 12, 0);
        setActiveRange('year');
        break;
      case 'reset':
        setFromDate("");
        setToDate("");
        setActiveRange("");
        return;
    }

    const format = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    setFromDate(format(start));
    setToDate(format(end));
  };



  const renderFollowupTable = (
    title: string,
    items: any[],
    loading: boolean,
    page: number,
    totalPages: number,
    setPage: (p: number) => void,
    dateHeader: string = "Follow up Date",
  ) => (
    <div className="rounded-md bg-white border border-gray-200 overflow-hidden h-full flex flex-col transition-all hover:shadow-xl">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${dateHeader === "Follow up Date" ? "bg-blue-50" : "bg-red-50"}`}>
              {dateHeader === "Follow up Date" ? (
                <Clock className="h-5 w-5 text-blue-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <Badge
            label={`${items.length} ${items.length === 1 ? 'Lead' : 'Leads'}`}
            className={dateHeader === "Follow up Date" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-red-50 text-red-600 border-red-200"}
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center flex-1 flex items-center justify-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 bg-gray-50 rounded-full">
              <CheckCircle2 className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">No follow-ups found</p>
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-y-auto flex-1">
            <div className="divide-y divide-gray-50">
              {items.map((lead, index) => (
                <div
                  key={lead._id || lead.id || index}
                  className="p-4 hover:bg-blue-50/20 transition-all cursor-pointer group"
                  onClick={() => {
                    setSelectedLead(lead);
                    setDrawerOpen(true);
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">

                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900 text-sm">
                          {lead.lead?.customerName || lead.customerName || "Unknown"}
                        </h4>

                        <Badge
                          label={
                            (typeof lead.lead?.leadStatus === 'string' ? lead.lead.leadStatus : lead.lead?.leadStatus?.name) ||
                            ((typeof lead.leadStatus === 'string' ? lead.leadStatus : lead.leadStatus?.name) || "-")
                          }
                          className={`${getStatusColor(
                            (typeof lead.lead?.leadStatus === 'string' ? lead.lead.leadStatus : lead.lead?.leadStatus?.name) ||
                            ((typeof lead.leadStatus === 'string' ? lead.leadStatus : lead.leadStatus?.name) || "")
                          )} text-[10px] px-2 py-0.5`}
                        />
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {formatContactNumber(lead?.customerContact)}
                        </span>
                        <span className="text-gray-400 flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {lead.nextFollowupDate
                            ? moment(lead.nextFollowupDate).format("DD MMM, YYYY")
                            : "-"}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
              <span className="text-xs font-medium text-gray-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderTodayTasksTable = (
    items: any[],
    loading: boolean,
  ) => (
    <div className="rounded-md bg-white border border-gray-200 overflow-hidden h-full flex flex-col transition-all hover:shadow-xl">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50">
              <CalendarIcon className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Today's Tasks</h3>
          </div>
          <span className="inline-flex items-center rounded-full bg-purple-100 text-purple-700 px-2.5 py-1 text-xs font-medium">
            {items.length} {items.length === 1 ? 'Task' : 'Tasks'}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center flex-1 flex items-center justify-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 bg-gray-50 rounded-full">
              <CheckCircle2 className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">No tasks for today</p>
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-y-auto flex-1">
            <div className="divide-y divide-gray-50">
              {items.map((task, index) => (
                <div
                  key={task._id || index}
                  className="p-4 hover:bg-purple-50/20 transition-all cursor-pointer group"
                  onClick={() => router.push(`/tasks`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-sm mb-1">
                        {task.subject}
                      </h4>
                      <div className="flex items-center gap-2">
                        <Badge
                          label={task.taskStatus?.name || 'In Progress'}
                          className={`${task.taskStatus?.name?.toLowerCase() === 'completed'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-yellow-50 text-yellow-600 border-yellow-200'
                          } text-[10px] px-2 py-0.5`}
                        />
                        <Badge
                          label={task.priority?.toUpperCase() || 'MEDIUM'}
                          className={`${getPriorityColor(task.priority)} text-[10px] px-2 py-0.5`}
                        />
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 border-t border-gray-100 bg-gray-50/50">
            <Link
              href="/tasks"
              className="flex items-center justify-center gap-2 text-xs font-semibold text-purple-600 hover:text-purple-700 transition-colors py-1"
            >
              View all tasks
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <div className="space-y-8 mx-auto w-full">

        {/* Welcome Section */}
        <div className="sticky top-0 z-30 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white px-6 py-4 rounded-3xl border border-gray-200 shadow-sm">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              {greeting}, {user?.fullName?.split(' ')[0] || 'User'}! 👋
            </h2>
            <p className="text-gray-500 mt-1 flex items-center gap-2">
              Here's what's happening with your projects today.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex items-center gap-3 bg-white p-2 rounded-full border border-gray-200 shadow-sm" ref={customPopoverRef}>
              {/* Quick Filter Buttons inside a capsule */}
              <div className="flex items-center gap-0.5  rounded-full p-1">
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'month', label: 'This Month' },
                  { id: 'prev_month', label: 'Previous Month' },
                  { id: 'year', label: 'This Year' },
                  { id: 'custom', label: 'Custom' },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleQuickFilter(btn.id);
                    }}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${activeRange === btn.id
                      ? 'bg-[#3B82F6] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                      }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Pickers - Rendered as a popover */}
              {showCustomPopover && (
                <div className="absolute right-0 top-[110%] w-[320px] z-20 bg-white rounded-xl shadow-xl border border-gray-100 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                  <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-semibold text-gray-800 text-sm">Filter Reports</h3>
                    <button onClick={() => setShowCustomPopover(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-4 flex flex-col gap-6">
                    {/* Date Range */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Date Range</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <DatePicker
                            value={tempFromDate}
                            onChange={(val) => {
                              setTempFromDate(val);
                            }}
                            placeholder="Start Date"
                          />
                        </div>
                        <span className="text-gray-300 font-medium">-</span>
                        <div className="flex-1">
                          <DatePicker
                            value={tempToDate}
                            onChange={(val) => {
                              setTempToDate(val);
                            }}
                            placeholder="End Date"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex gap-3">
                    <button
                      onClick={() => {
                        setTempFromDate('');
                        setTempToDate('');
                        setFromDate('');
                        setToDate('');
                        setActiveRange('');
                        setShowCustomPopover(false);
                      }}
                      className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={() => {
                        setFromDate(tempFromDate);
                        setToDate(tempToDate);
                        setActiveRange('custom');
                        setShowCustomPopover(false);
                      }}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="relative z-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {summaryCards.map((card) => (
            <div
              key={card.key}
              className="bg-white p-4 rounded-3xl border border-gray-200/80 flex items-center gap-4 transition-all duration-300"
            >
              <div className={`p-3 rounded-xl ${card.iconBg} ${card.iconColor} transition-transform duration-300 group-hover:scale-110 flex-shrink-0`}>
                <card.Icon className="h-6 w-6" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] text-gray-500 tracking-wider truncate">{card.label}</span>
                <span className="text-2xl text-gray-900">{card.value}</span>
              </div>
              {/* Decorative background element */}
              <div className={`absolute -right-4 -bottom-4 h-20 w-20 rounded-full ${card.iconBg} opacity-0 group-hover:opacity-10 transition-opacity blur-2xl`}></div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-5 ">
          {/* Total Revenue Trend - Bar/Line Composed Chart */}
          <div className="bg-white rounded-3xl border border-gray-200/80 p-8 shadow-sm hover:shadow-md transition-shadow relative">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Total Revenue</h3>
                <p className="text-lg font-medium text-gray-500 mt-1">
                  ₹{(summary?.totalRevenue || 0).toLocaleString('en-IN')}
                </p>
              </div>

              {/* Year Dropdown Selector */}
              <div className="relative z-10" ref={yearDropdownRef}>
                <button
                  onClick={() => setYearDropdownOpen(!yearDropdownOpen)}
                  className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-1.5 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-all"
                >
                  {selectedYear}
                  <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${yearDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {yearDropdownOpen && (
                  <div className="absolute right-0 mt-1.5 w-28 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20 animate-in fade-in slide-in-from-top-2 duration-150">
                    {[2026, 2025, 2024].map((yr) => (
                      <button
                        key={yr}
                        onClick={() => handleYearSelect(yr)}
                        className={`w-full text-left px-4 py-2 text-sm font-semibold transition-colors
                          ${selectedYear === yr
                            ? 'bg-[#3B82F6] text-white'
                            : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="h-[280px] focus:outline-none outline-none">
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%" className="focus:outline-none outline-none">
                  <ComposedChart layout="vertical" data={monthlyRevenueData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} className="focus:outline-none outline-none">
                    <defs>
                      <linearGradient id="colorBarRevenue" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#93C5FD" />
                        <stop offset="100%" stopColor="#3B82F6" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => {
                        if (val >= 1000) return `${Math.round(val / 1000)}K`;
                        return String(val);
                      }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={45}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white border border-gray-100 p-3 rounded-xl shadow-xl">
                              <p className="text-xs font-semibold text-gray-400">
                                {payload[0].payload.name} {payload[0].payload.year ? payload[0].payload.year : ""}
                              </p>
                              <p className="text-sm text-[#3B82F6] font-bold mt-1">
                                ₹{Number(payload[0].value).toLocaleString('en-IN')}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="revenue" fill="url(#colorBarRevenue)" radius={[0, 6, 6, 0]} barSize={20} activeBar={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          {/* Total Paid Breakdown - Donut Pie Chart (2nd column) (Only for non-admins / resellers) */}
          {summary && userRole?.toLowerCase() !== 'admin' && (
            <div className="bg-white rounded-3xl border border-gray-200/80 p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Total Paid Breakdown</h3>
                  <p className="text-sm text-gray-500 mt-1">Payment collection overview</p>
                </div>
                <div className="p-2 rounded-xl" style={{ backgroundColor: '#EFF6FF' }}>
                  <IndianRupee className="h-5 w-5" style={{ color: '#3B82F6' }} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Donut Chart */}
                <div className="h-[280px]">
                  {isMounted && (() => {
                    const paid = summary.totalPaid || 0;
                    const pending = summary.totalPending || 0;
                    const total = paid + pending;
                    const hasData = paid > 0 || pending > 0;
                    const pieData = hasData
                      ? [
                        { name: "Paid", value: paid, fill: "#3B82F6" },
                        { name: "Pending", value: pending, fill: "#93C5FD" },
                      ]
                      : [{ name: "No data", value: 1, fill: "#EFF6FF" }];
                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                            <tspan x="50%" dy="-10" fontSize="14" fill="#6B7280">Total</tspan>
                            <tspan x="50%" dy="24" fontSize="16" fontWeight="bold" fill="#111827">
                              ₹{Number(total).toLocaleString('en-IN')}
                            </tspan>
                          </text>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={110}
                            paddingAngle={hasData ? 4 : 0}
                            dataKey="value"
                            nameKey="name"
                          >
                            {pieData.map((entry, index) => (
                              <Cell
                                key={`paid-cell-${index}`}
                                fill={entry.fill}
                                stroke={hasData ? "white" : "#BFDBFE"}
                                strokeWidth={hasData ? 3 : 1.5}
                                strokeDasharray={hasData ? "none" : "4 4"}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length && payload[0].name !== "No data") {
                                return (
                                  <div className="bg-white border border-gray-100 p-3 rounded-xl shadow-xl">
                                    <p className="text-sm font-bold text-gray-900">{payload[0].name}</p>
                                    <p className="text-sm font-semibold mt-1" style={{ color: (payload[0].payload as any).fill }}>
                                      ₹{Number(payload[0].value).toLocaleString('en-IN')}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>

                {/* Legend with progress bars */}
                <div className="space-y-4">
                  {[
                    { label: "Paid", value: summary.totalPaid || 0, color: "#3B82F6", bg: "#EFF6FF" },
                    { label: "Pending", value: summary.totalPending || 0, color: "#93C5FD", bg: "#EFF6FF" },
                  ].map((item, i) => {
                    return (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-2xl" style={{ backgroundColor: item.bg }}>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-gray-700">{item.label}</span>
                          <p className="text-sm font-bold mt-0.5" style={{ color: item.color }}>₹{Number(item.value).toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Top 10 Resellers by Revenue - Horizontal Bar Chart (Only for admins) */}
          {permissions.readAll && (
            <div className="bg-white rounded-3xl border border-gray-200/80 p-8 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Top Resellers by Revenue</h3>
                  <p className="text-sm text-gray-500 mt-1">Top 10 resellers ranked by total paid revenue</p>
                </div>
                <div className="p-2 rounded-xl" style={{ backgroundColor: '#EFF6FF' }}>
                  <TrendingUp className="h-5 w-5" style={{ color: '#3B82F6' }} />
                </div>
              </div>

              <div className="h-[280px] flex-1 focus:outline-none outline-none">
                {isMounted && (
                  resellerRevenue && resellerRevenue.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" className="focus:outline-none outline-none">
                      <BarChart
                        data={resellerRevenue}
                        margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                        className="focus:outline-none outline-none"
                      >
                        <defs>
                          <linearGradient id="resellerBarGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3B82F6" />
                            <stop offset="100%" stopColor="#93C5FD" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="name"
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          tick={(props: any) => {
                            const { x, y, payload } = props;
                            const name: string = payload.value || '';
                            const maxLen = 12;
                            const display = name.length > maxLen ? name.slice(0, maxLen) + '…' : name;
                            return (
                              <g transform={`translate(${x},${y})`}>
                                <text
                                  x={0}
                                  y={0}
                                  dy={14}
                                  textAnchor="middle"
                                  fill="#374151"
                                  fontSize={11}
                                  fontWeight={500}
                                >
                                  {display}
                                </text>
                              </g>
                            );
                          }}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          width={45}
                          tickFormatter={(val) => val >= 1000 ? `${Math.round(val / 1000)}K` : String(val)}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-white border border-gray-100 p-3 rounded-xl shadow-xl">
                                  <p className="text-sm font-bold text-gray-900">{d.name}</p>
                                  <p className="text-sm font-semibold mt-1" style={{ color: '#3B82F6' }}>
                                    ₹{Number(d.revenue).toLocaleString('en-IN')}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5">{d.leadCount} leads</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="revenue" fill="url(#resellerBarGrad)" radius={[6, 6, 0, 0]} maxBarSize={40} activeBar={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                      No reseller revenue data available
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Recent Activity Table - Admin Only */}
        {permissions.readAll && (
          <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Recent Activity</h3>
                <p className="text-sm text-gray-500 mt-1">Latest paid & won lead transactions by resellers</p>
              </div>
              {/* Filter Pills */}
              <div className="flex items-center gap-0.5 bg-gray-100/80 rounded-full py-1.5 px-2">
                {([
                  { id: 'all', label: 'All' },
                  { id: 'today', label: 'Today' },
                  { id: 'week', label: 'This Week' },
                  { id: 'month', label: 'This Month' },
                ] as { id: 'all' | 'today' | 'week' | 'month'; label: string }[]).map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setRecentActivityFilter(btn.id);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                      recentActivityFilter === btn.id
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={`relative min-h-[200px] transition-all duration-300 ${recentActivityLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>

              {recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="p-4 bg-gray-50 rounded-full">
                    <CheckCircle2 className="h-8 w-8 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">No recent paid activity found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100">
                        <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reseller</th>
                        <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead</th>
                        <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Amount</th>
                        <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Commission</th>
                        <th className="text-center px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate</th>
                        <th className="text-center px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Mode</th>
                        <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Paid Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentActivity.map((item, idx) => {
                        let payModeClass = 'bg-gray-100 text-gray-500 border-gray-200';
                        const modeUpper = item.paymentMode?.toUpperCase();
                        if (modeUpper === 'UPI') payModeClass = 'bg-blue-50 text-blue-600 border-blue-200';
                        else if (modeUpper === 'CASH') payModeClass = 'bg-green-50 text-green-700 border-green-200';
                        else if (modeUpper === 'GPAY' || modeUpper === 'GOOGLE PAY') payModeClass = 'bg-purple-50 text-purple-600 border-purple-200';
                        else if (modeUpper === 'BANK TRANSFER' || modeUpper === 'BANK') payModeClass = 'bg-indigo-50 text-indigo-600 border-indigo-200';

                        const isEven = idx % 2 === 1;
                        const rowBg = isEven ? 'bg-blue-50/50' : 'bg-white';

                        return (
                          <tr key={idx} className={`${rowBg} transition-colors group`}>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-bold text-blue-600">
                                    {item.resellerName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-900 truncate text-sm">{item.resellerName}</p>
                                  <p className="text-xs text-gray-400 truncate">{item.resellerEmail}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <Badge
                                label={item.leadName}
                                className="bg-green-50 text-green-700 border-green-200 font-bold"
                              />
                            </td>
                            <td className="px-6 py-4 text-left">
                              <span className="font-semibold text-gray-900">₹{item.totalAmount.toLocaleString('en-IN')}</span>
                            </td>
                            <td className="px-6 py-4 text-left">
                              <span className="font-semibold text-blue-600">₹{item.commissionAmount.toLocaleString('en-IN')}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {item.commissionRate !== null ? (
                                <Badge
                                  label={`${item.commissionRate}%`}
                                  className="bg-indigo-50 text-indigo-600 border-indigo-200 font-bold"
                                />
                              ) : (
                                <span className="text-gray-300 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Badge
                                label={item.paymentMode || '—'}
                                className={`${payModeClass} font-bold`}
                              />
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-xs text-gray-500">
                                {new Date(item.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lead Status Overview & Sales vs Commission - Only for Reseller */}
        {isReseller && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {summary && (
              <div className="bg-white rounded-3xl border border-gray-200/80 p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Lead Status Overview</h3>
                    <p className="text-sm text-gray-500 mt-1">Performance by status categories</p>
                  </div>
                  <div className="p-2 rounded-xl" style={{ backgroundColor: '#EFF6FF' }}>
                    <PieChartIcon className="h-5 w-5" style={{ color: '#3B82F6' }} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="h-[280px]">
                    {isMounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusWiseData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={110}
                            paddingAngle={hasStatusData ? 4 : 0}
                            dataKey="value"
                            nameKey="name"
                          >
                            {statusWiseData.map((entry, index) => (
                              <Cell
                                key={`status-cell-${index}`}
                                fill={entry.fill}
                                stroke={hasStatusData ? "white" : "#BFDBFE"}
                                strokeWidth={hasStatusData ? 3 : 1.5}
                                strokeDasharray={hasStatusData ? "none" : "4 4"}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length && payload[0].name !== "No data") {
                                return (
                                  <div className="bg-white border border-gray-100 p-3 rounded-xl shadow-xl">
                                    <p className="text-sm font-bold text-gray-900">{payload[0].name}</p>
                                    <p className="text-sm font-semibold mt-1" style={{ color: (payload[0].payload as any).fill }}>
                                      {payload[0].value} Leads
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {(summary?.statusWiseCounts || []).map((s, idx) => {
                      const fill = statusColorPalette[idx % statusColorPalette.length];
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-3 rounded-xl border border-gray-50 bg-gray-50/50 p-3 hover:bg-gray-100/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: fill }} />
                            <span className="text-sm font-bold text-slate-600">{s.statusName}</span>
                          </div>
                          <span
                            className="rounded-lg border px-2 py-0.5 text-sm font-bold"
                            style={{ color: fill, borderColor: fill + "40", backgroundColor: fill + "10" }}
                          >
                            {s.count} Leads
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl border border-gray-200/80 p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Sales & Commission</h3>
                  <p className="text-sm text-gray-500 mt-1">Total revenue vs commission earned</p>
                </div>
                <div className="p-2 rounded-xl" style={{ backgroundColor: '#EFF6FF' }}>
                  <IndianRupee className="h-5 w-5" style={{ color: '#3B82F6' }} />
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-6 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3B82F6' }}></span>
                  <span className="text-xs font-semibold text-gray-600">Sales</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10B981' }}></span>
                  <span className="text-xs font-semibold text-gray-600">Commission</span>
                </div>
              </div>

              <div className="h-[260px] focus:outline-none outline-none">
                {isMounted && (
                  <ResponsiveContainer width="100%" height="100%" className="focus:outline-none outline-none">
                    <ComposedChart data={salesCommissionChart} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} className="focus:outline-none outline-none">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => val >= 1000 ? `${Math.round(val / 1000)}K` : String(val)}
                        width={45}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white border border-gray-100 p-3 rounded-xl shadow-xl">
                                <p className="text-xs font-semibold text-gray-400">
                                  {d.name} {d.year ? d.year : ""}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3B82F6' }}></span>
                                  <p className="text-sm text-[#3B82F6] font-bold">
                                    Sales: ₹{Number(d.revenue).toLocaleString('en-IN')}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#10B981' }}></span>
                                  <p className="text-sm text-[#10B981] font-bold">
                                    Commission: ₹{Number(d.commission).toLocaleString('en-IN')}
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#3B82F6"
                        strokeWidth={2.5}
                        dot={{ r: 4, stroke: '#3B82F6', strokeWidth: 1, fill: '#fff' }}
                        activeDot={{ r: 6 }}
                        name="Sales"
                      />
                      <Line
                        type="monotone"
                        dataKey="commission"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        dot={{ r: 4, stroke: '#10B981', strokeWidth: 1, fill: '#fff' }}
                        activeDot={{ r: 6 }}
                        name="Commission"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      <UpdateLeadStageDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        lead={selectedLead}
        onSuccess={() => {
          const isAdmin = userRole?.toLowerCase() === 'admin';
          if (!isAdmin) {
            fetchUpcomingFollowups(upcomingPage);
            fetchDueFollowups(duePage);
            fetchAllFollowups(allPage);
          }
        }}
      />
    </div>
  );
}