"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from "recharts";
import {
  Users,
  Calendar,
  Award,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
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
  MoreVertical,
  Eye,
  PhoneCall,
  Mail as MailIcon,
  MessageSquare,
  PieChartIcon,
  RefreshCw,
} from "lucide-react";
import axios from "axios";
import { baseUrl, getAuthToken } from "@/config";
import moment from "moment";
import Link from 'next/link';
import UpdateLeadStageDrawer from "@/components/leads/UpdateLeadStageDrawer";
import DatePicker from "@/components/ui/DatePicker";
import { formatContactNumber } from "@/utills/utill";
import { ApiLead } from "@/components/leads/types";
import ResellerWinRateChart from "@/components/ResellerWinRateChart";

interface StatusCount {
  statusId: string;
  statusName: string;
  count: number;
}

interface LeadSummary {
  totalLeads: number;
  currentMonthLeads: number;
  totalRevenue: number;
  totalCommission: number;
  totalSettlement: number;
  statusWiseCounts: StatusCount[];
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

  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [leadsBySource, setLeadsBySource] = useState<
    { name: string; value: number; fill: string }[]
  >([]);
  const [staffPerformance, setStaffPerformance] = useState<
    { name: string; converted: number; pending: number; lost: number }[]
  >([]);

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

  // Today's Tasks
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  // New state variables for Dashboard Tables
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  
  const [recentSettlements, setRecentSettlements] = useState<any[]>([]);
  const [settlementsLoading, setSettlementsLoading] = useState(true);
  
  const [resellerPerformance, setResellerPerformance] = useState<any[]>([]);
  const [performanceLoading, setPerformanceLoading] = useState(true);

  const [permissions, setPermissions] = useState<{ readAll: boolean; readOwn: boolean }>({ readAll: false, readOwn: false });
  const [user, setUser] = useState<any>(null);
  const [greeting, setGreeting] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [chartFilter, setChartFilter] = useState("All");
  const [chartFromDate, setChartFromDate] = useState("");
  const [chartToDate, setChartToDate] = useState("");

  const token =
    typeof window !== "undefined" ? getAuthToken() : null;

  const isReseller = user?.role?.roleName?.toLowerCase() === 'reseller';

  const { user: authUser, permissions: rawPerms } = useSelector((state: any) => state.auth);

  // Fetch user info and permissions
  useEffect(() => {
    if (!token) return;
    
    setUser(authUser);
    const lp = rawPerms?.lead || {};
    setPermissions({
      readAll: !!lp.readAll,
      readOwn: !!lp.readOwn,
    });

    // Set greeting based on time
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, [token, authUser, rawPerms]);

  // Redirect if no token
  useEffect(() => {
    if (!token) router.replace("/login");
  }, [router, token]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      New: "bg-blue-100 text-blue-700 border-blue-200",
      Contacted: "bg-purple-100 text-purple-700 border-purple-200",
      "Follow-Up": "bg-orange-100 text-orange-700 border-orange-200",
      Interested: "bg-green-100 text-green-700 border-green-200",
      Qualified: "bg-emerald-100 text-emerald-700 border-emerald-200",
      "Not Interested": "bg-gray-100 text-gray-700 border-gray-200",
      Lost: "bg-red-100 text-red-700 border-red-200",
      Won: "bg-emerald-100 text-emerald-700 border-emerald-200",
    };
    return colors[status] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const fetchLeadSummary = async () => {
    if (!token) return;
    try {
      const isMyOnly = !permissions.readAll && permissions.readOwn;
      const url = isMyOnly ? baseUrl.myLeadCountSummary : baseUrl.leadCountSummary;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          from: fromDate || undefined,
          to: toDate || undefined,
        }
      });
      setSummary(res.data.data);
    } catch (err) {
      console.error("Lead summary error:", err);
    }
  };

  const fetchLeadsBySource = async () => {
    if (!token) return;
    try {
      const res = await axios.get(baseUrl.leadSources, {
        headers: { Authorization: `Bearer ${token}` },
      });

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

      const chartData = (res.data.data ?? []).map((item: any, idx: number) => ({
        name: item.name,
        value: item.count || 0,
        fill: colorPalette[idx % colorPalette.length],
      }));

      setLeadsBySource(chartData);
    } catch (err) {
      console.error("Leads by source error:", err);
    }
  };

  const fetchStaffPerformance = async () => {
    if (!token) return;
    try {
      const res = await axios.get(baseUrl.getAllStaff, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const chartData = (res.data.data ?? []).map((staff: any) => ({
        name: staff.fullName || "Unknown",
        converted: staff.status?.toLowerCase() === "active" ? 1 : 0,
        pending: staff.status?.toLowerCase() === "inactive" ? 1 : 0,
        lost: 0,
      }));
      setStaffPerformance(chartData);
    } catch (err) {
      console.error("Staff performance error:", err);
    }
  };

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

  const fetchTodayTasks = async () => {
    if (!token) return;
    setTasksLoading(true);
    try {
      const res = await axios.get(baseUrl.todayTasks, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTodayTasks(res.data?.data || []);
    } catch (err) {
      console.error("Today tasks error:", err);
      setTodayTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

  const fetchRecentLeads = async () => {
    if (!token) return;
    setLeadsLoading(true);
    try {
      const isMyOnly = !permissions.readAll && permissions.readOwn;
      const url = isMyOnly ? baseUrl.myLeads : baseUrl.getAllLeads;
      const res = await axios.get(`${url}?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecentLeads(res.data?.data || []);
    } catch (err) {
      console.error("Recent leads error:", err);
      setRecentLeads([]);
    } finally {
      setLeadsLoading(false);
    }
  };

  const fetchRecentSettlements = async () => {
    if (!token || !user) return;
    setSettlementsLoading(true);
    try {
      const isMyOnly = !permissions.readAll && permissions.readOwn;
      const url = isMyOnly 
        ? `${baseUrl.settlementHistory}/${user._id}` 
        : `${baseUrl.settlementHistory}/all`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // the history endpoint returns an array in data.data or directly in data
      // Limit to 5
      const dataArray = res.data?.data || res.data || [];
      setRecentSettlements(Array.isArray(dataArray) ? dataArray.slice(0, 5) : []);
    } catch (err) {
      console.error("Recent settlements error:", err);
      setRecentSettlements([]);
    } finally {
      setSettlementsLoading(false);
    }
  };

  const fetchResellerPerformance = async () => {
    if (!token) return;
    setPerformanceLoading(true);
    try {
      const params: any = {};
      if (chartFilter !== 'All') {
        params.filter = chartFilter.toLowerCase();
      }
      if (chartFromDate || chartToDate) {
        if (chartFromDate) params.from = chartFromDate;
        if (chartToDate) params.to = chartToDate;
      } else {
        if (fromDate) params.from = fromDate;
        if (toDate) params.to = toDate;
      }

      const res = await axios.get(baseUrl.settlements, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setResellerPerformance(res.data?.data || []);
    } catch (err) {
      console.error("Reseller performance error:", err);
      setResellerPerformance([]);
    } finally {
      setPerformanceLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchLeadSummary();
      fetchUpcomingFollowups(1);
      fetchDueFollowups(1);
      fetchAllFollowups(1);
      fetchTodayTasks();
      fetchRecentLeads();
      fetchRecentSettlements();

      // Only fetch admin stats if they have readAll
      if (permissions.readAll) {
        fetchLeadsBySource();
        fetchStaffPerformance();
        fetchResellerPerformance();
      }
    }
  }, [token, permissions, fromDate, toDate, user, chartFilter, chartFromDate, chartToDate]);
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

  // Color palette for statuses
  const statusColorPalette = [
    "#4e0158ff", // blue-500 - New
    "#146a05ff", // emerald-500 - Contacted
    "#674307ff", // amber-500 - Follow-Up
    "#936fe8ff", // violet-500 - Interested
    "#037184ff", // cyan-500 - Qualified
    "#43464bff", // gray-500 - Not Interested
    "#971f1fff", // red-500 - Lost
    "#557a1fff", // lime-500 - Won
    "#83194eff", // pink-500
    "#b3520cff", // orange-500
  ];

  const summaryCards: any[] = summary
    ? [
      {
        key: "total",
        label: "Total Leads",
        value: summary.totalLeads,
        trend: 12.5,
        tone: "up",
        Icon: Users,
        iconBg: "bg-blue-500/10",
        iconColor: "text-blue-500",
        type: "total",
        fill: "#3B82F6",
        name: "Total Leads",
        description: "Leads in selected range"
      },
      {
        key: "month",
        label: "New Leads",
        value: summary.currentMonthLeads,
        trend: 8.2,
        tone: "up",
        Icon: TrendingUp,
        iconBg: "bg-emerald-500/10",
        iconColor: "text-emerald-500",
        type: "month",
        subtitle: "This Month",
        fill: "#10B981",
        name: "New Leads",
        description: "Leads this month"
      },
      {
        key: "followups",
        label: "Follow-ups",
        value: upcomingFollowups.length,
        trend: 0,
        tone: "neutral",
        Icon: PhoneCall,
        iconBg: "bg-orange-500/10",
        iconColor: "text-orange-500",
        type: "custom",
        fill: "#F59E0B",
        name: "Follow-ups",
        description: "Scheduled follow-ups"
      },
      {
        key: "tasks",
        label: "Tasks",
        value: todayTasks.length,
        trend: 0,
        tone: "neutral",
        Icon: CheckCircle2,
        iconBg: "bg-purple-500/10",
        iconColor: "text-purple-500",
        type: "custom",
        fill: "#8B5CF6",
        name: "Tasks",
        description: "Tasks for today"
      },
      {
        key: "revenue",
        label: "Total Revenue",
        value: `₹${(summary.totalRevenue || 0).toLocaleString()}`,
        trend: 15.4,
        tone: "up",
        Icon: Activity,
        iconBg: "bg-amber-500/10",
        iconColor: "text-amber-500",
        type: "revenue",
        fill: "#F59E0B",
        name: "Revenue",
        description: "Total from won leads"
      },
      {
        key: "commission",
        label: "Total Commission",
        value: `₹${(summary.totalCommission || 0).toLocaleString()}`,
        trend: 0,
        tone: "neutral",
        Icon: Award,
        iconBg: "bg-indigo-500/10",
        iconColor: "text-indigo-500",
        type: "custom",
        fill: "#6366F1",
        name: "Commission",
        description: "Total commission earned"
      },
      {
        key: "settlement",
        label: "Total Settlement",
        value: `₹${(summary.totalSettlement || 0).toLocaleString()}`,
        trend: 0,
        tone: "neutral",
        Icon: CheckCircle2,
        iconBg: "bg-teal-500/10",
        iconColor: "text-teal-500",
        type: "custom",
        fill: "#14B8A6",
        name: "Settlement",
        description: "Total settled amount"
      }
    ]
    : [];

  const statusChartData = summary?.statusWiseCounts?.map((s, idx) => ({
    name: s.statusName,
    value: s.count,
    fill: statusColorPalette[idx % statusColorPalette.length]
  })) || [];

  const financialChartData = summary ? [
    { name: 'Revenue', value: summary.totalRevenue || 0, fill: '#F59E0B' },
    { name: 'Commission', value: summary.totalCommission || 0, fill: '#6366F1' },
    { name: 'Settlement', value: summary.totalSettlement || 0, fill: '#14B8A6' },
  ] : [];

  const handleQuickFilter = (range: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (range) {
      case 'today':
        break;
      case 'yesterday':
        start.setDate(now.getDate() - 1);
        end.setDate(now.getDate() - 1);
        break;
      case '7days':
        start.setDate(now.getDate() - 7);
        break;
      case '30days':
        start.setDate(now.getDate() - 30);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'reset':
        setFromDate("");
        setToDate("");
        return;
    }

    const format = (d: Date) => d.toISOString().split("T")[0];
    setFromDate(format(start));
    setToDate(format(end));
  };

  const handleCardClick = (card: SummaryCard) => {
    if (card.type === "total") {
      router.push("/leads");
      return;
    }

    if (card.type === "month") {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const format = (d: Date) => d.toISOString().split("T")[0];

      const params = new URLSearchParams({
        from: format(start),
        to: format(end),
      });

      router.push(`/leads?${params.toString()}`);
      return;
    }

    if (card.type === "status" && card.statusId) {
      const params = new URLSearchParams({
        status: String(card.statusId),
      });
      router.push(`/leads?${params.toString()}`);
    }
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
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${dateHeader === "Follow up Date"
            ? "bg-blue-100 text-blue-700"
            : "bg-red-100 text-red-700"
            }`}>
            {items.length} {items.length === 1 ? 'Lead' : 'Leads'}
          </span>
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

                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusColor(
                            lead.lead?.leadStatus?.name || lead.leadStatus?.name || "",
                          )}`}
                        >
                          {lead.lead?.leadStatus?.name || lead.leadStatus?.name || "-"}
                        </span>
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
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${task.taskStatus?.name?.toLowerCase() === 'completed'
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                          }`}>
                          {task.taskStatus?.name || 'In Progress'}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${getPriorityColor(task.priority)}`}>
                          {task.priority?.toUpperCase() || 'MEDIUM'}
                        </span>
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

  const winRateChartData = resellerPerformance.map((rp: any) => ({
    name: rp.resellerName?.split(' ')[0] || 'Unknown',
    fullName: rp.resellerName || 'Unknown Reseller',
    won: rp.wonLeads || 0,
    lost: rp.lostLeads || 0,
    inProgress: Math.max(0, (rp.totalAssignedLeads || 0) - (rp.wonLeads || 0) - (rp.lostLeads || 0))
  }));

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc]">
      <div className="p-6 space-y-8 max-w-[1600px] mx-auto w-full">

        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              {greeting}, {user?.fullName?.split(' ')[0] || 'User'} ! 
            </h2>
            <p className="text-gray-500 mt-1 flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Here's what's happening with your projects today.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-gray-50/50 p-2 rounded-2xl border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <label className="absolute -top-2 left-3 px-1 bg-white text-[9px] font-bold text-blue-500 uppercase tracking-widest z-10">From</label>
                  <DatePicker
                    value={fromDate}
                    onChange={(val) => setFromDate(val)}
                    placeholder="From date"
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-3 px-1 bg-white text-[9px] font-bold text-blue-500 uppercase tracking-widest z-10">To</label>
                  <DatePicker
                    value={toDate}
                    onChange={(val) => setToDate(val)}
                    placeholder="To date"
                  />
                </div>
              </div>
              <button
                onClick={() => handleQuickFilter('reset')}
                className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all rounded-xl"
                title="Reset Filter"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {summaryCards.map((card) => (
            <div
              key={card.key}
              onClick={() => handleCardClick(card)}
              className="group relative overflow-hidden bg-white p-6 rounded-2xl border border-gray-200 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl ${card.iconBg} ${card.iconColor} transition-transform duration-300 group-hover:scale-110`}>
                  <card.Icon className="h-6 w-6" />
                </div>
                {card.trend !== undefined && card.trend !== 0 && (
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${card.tone === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}>
                    {card.tone === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {card.trend}%
                  </div>
                )}
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-500">{card.label}</h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900">{card.value}</span>
                  {card.subtitle && <span className="text-xs text-gray-400">{card.subtitle}</span>}
                </div>
                <p className="text-xs text-gray-400 mt-2">{card.description}</p>
              </div>
              {/* Decorative background element */}
              <div className={`absolute -right-4 -bottom-4 h-24 w-24 rounded-full ${card.iconBg} opacity-0 group-hover:opacity-10 transition-opacity blur-3xl`}></div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Lead Statistics - Pie Chart */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Lead Status Overview</h3>
                <p className="text-sm text-gray-500 mt-1">Performance by status categories</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg">
                <PieChartIcon className="h-5 w-5 text-gray-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={8}
                      dataKey="value"
                      nameKey="name"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} stroke="white" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white border border-gray-100 p-3 rounded-xl shadow-xl">
                              <p className="text-sm font-bold text-gray-900">{payload[0].name}</p>
                              <p className="text-sm text-blue-600 font-semibold">{payload[0].value} Leads</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {statusChartData.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-50 bg-gray-50/50 hover:bg-gray-100/50 transition-colors cursor-default">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.fill }}></div>
                    <span className="text-sm font-semibold text-gray-700 flex-1">{s.name}</span>
                    <span className="text-sm font-bold text-gray-900 bg-white px-2 py-0.5 rounded-lg border border-gray-100">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Leads by Source - Pie Chart */}
          {leadsBySource.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Leads by Source</h3>
                  <p className="text-sm text-gray-500 mt-1">Traffic and acquisition channels</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-gray-400" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={leadsBySource}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={8}
                        dataKey="value"
                        nameKey="name"
                      >
                        {leadsBySource.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} stroke="white" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white border border-gray-100 p-3 rounded-xl shadow-xl">
                                <p className="text-sm font-bold text-gray-900">{payload[0].name}</p>
                                <p className="text-sm text-emerald-600 font-semibold">{payload[0].value} Leads</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {leadsBySource.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-50 bg-gray-50/30">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.fill }}></div>
                      <span className="text-sm font-medium text-gray-600 flex-1 truncate">{s.name}</span>
                      <span className="text-sm font-bold text-gray-900">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Financial Overview - Bar Chart */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Financial Overview</h3>
                <p className="text-sm text-gray-500 mt-1">Revenue vs Commission vs Settlement</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg">
                <BarChart3 className="h-5 w-5 text-gray-400" />
              </div>
            </div>

            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} width={60} tickFormatter={(value) => `₹${Intl.NumberFormat('en-IN', { notation: "compact" }).format(value)}`} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white border border-gray-100 p-3 rounded-xl shadow-xl">
                            <p className="text-sm font-bold text-gray-900">{payload[0].payload.name}</p>
                            <p className="text-sm font-semibold" style={{ color: payload[0].payload.fill }}>
                              ₹{Number(payload[0].value).toLocaleString()}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {financialChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Follow-ups and Tasks Section */}
        {isReseller && <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="h-full min-h-[450px]">
            {renderFollowupTable(
              "All Follow-ups",
              allFollowups,
              allLoading,
              allPage,
              allTotalPages,
              (p) => {
                if (p >= 1 && p <= allTotalPages) fetchAllFollowups(p);
              },
              "Follow up Date",
            )}
          </div>

          {/* <div className="h-full min-h-[450px]">
            {renderFollowupTable(
              "Upcoming Follow-ups",
              upcomingFollowups,
              upcomingLoading,
              upcomingPage,
              upcomingTotalPages,
              (p) => {
                if (p >= 1 && p <= upcomingTotalPages) fetchUpcomingFollowups(p);
              },
              "Follow up Date",
            )}
          </div> */}

          <div className="h-full min-h-[450px]">
            {renderFollowupTable(
              "Overdue Follow-ups",
              dueFollowups,
              dueLoading,
              duePage,
              dueTotalPages,
              (p) => {
                if (p >= 1 && p <= dueTotalPages) fetchDueFollowups(p);
              },
              "Due Date",
            )}
          </div>

          <div className="h-full min-h-[450px]">
            {renderTodayTasksTable(todayTasks, tasksLoading)}
          </div>
        </div>}

        {/* Recent Data Tables Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Recent Leads */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col max-h-[500px]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Recent Leads</h3>
              </div>
              <Link href="/leads/list" className="text-sm font-semibold text-blue-600 hover:text-blue-700">View All</Link>
            </div>
            {leadsLoading ? (
              <div className="flex-1 flex justify-center items-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div></div>
            ) : recentLeads.length === 0 ? (
              <div className="flex-1 flex justify-center items-center text-gray-500">No recent leads.</div>
            ) : (
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentLeads.map((lead: any) => (
                      <tr key={lead._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{lead.customerName || lead.fullName || 'Unknown'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.leadStatus?.name)}`}>
                            {lead.leadStatus?.name || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">₹{(lead.paymentAmount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Settlements */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col max-h-[500px]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Recent Settlements</h3>
              </div>
              <Link href="/settlements" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">View All</Link>
            </div>
            {settlementsLoading ? (
              <div className="flex-1 flex justify-center items-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent"></div></div>
            ) : recentSettlements.length === 0 ? (
              <div className="flex-1 flex justify-center items-center text-gray-500">No recent settlements.</div>
            ) : (
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      {permissions.readAll && <th className="px-4 py-3 font-medium">Reseller</th>}
                      <th className="px-4 py-3 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentSettlements.map((tx: any) => (
                      <tr key={tx._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500">{moment(tx.createdAt).format('DD MMM YYYY')}</td>
                        {permissions.readAll && <td className="px-4 py-3 font-medium text-gray-900">{tx.reseller?.fullName || '-'}</td>}
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">₹{(tx.amount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Reseller Performance Table & Win Rate Chart (Admin Only) */}
        {permissions.readAll && (
          <>
            <div className="mt-8">
              <ResellerWinRateChart 
                data={winRateChartData} 
                timeFilter={chartFilter}
                onFilterChange={(filter) => {
                  setChartFilter(filter);
                  if (filter !== 'Custom') {
                    setChartFromDate("");
                    setChartToDate("");
                  }
                }}
                onCustomDateChange={(from, to) => {
                  setChartFromDate(from);
                  setChartToDate(to);
                }}
              />
            </div>
            
            <div className="mt-8 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Award className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Reseller Performance Overview</h3>
            </div>
            
            {performanceLoading ? (
              <div className="h-32 flex justify-center items-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div></div>
            ) : resellerPerformance.length === 0 ? (
              <div className="h-32 flex justify-center items-center text-gray-500">No performance data found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-y border-gray-200">
                    <tr>
                      <th className="px-6 py-4 font-medium">Reseller Name</th>
                      <th className="px-6 py-4 font-medium text-center">Total Leads</th>
                      <th className="px-6 py-4 font-medium text-right">Total Revenue</th>
                      <th className="px-6 py-4 font-medium text-right">Total Commission</th>
                      <th className="px-6 py-4 font-medium text-right text-emerald-600">Settled</th>
                      <th className="px-6 py-4 font-medium text-right text-amber-600">Pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {resellerPerformance.map((rp: any) => (
                      <tr key={rp._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600">
                              {rp.resellerName?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{rp.resellerName}</p>
                              <p className="text-xs text-gray-500">{rp.resellerEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-semibold">{rp.totalLeadsCount}</td>
                        <td className="px-6 py-4 text-right font-medium">₹{(rp.totalLeadsAmount || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-medium">₹{(rp.totalCommission || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600">₹{(rp.paidCommission || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-bold text-amber-600">₹{(rp.unpaidCommission || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </>
        )}
      </div>

      <UpdateLeadStageDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        lead={selectedLead}
        onSuccess={() => {
          fetchUpcomingFollowups(upcomingPage);
          fetchDueFollowups(duePage);
          fetchAllFollowups(allPage);
        }}
      />
    </div>
  );
}
