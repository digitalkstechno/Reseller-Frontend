import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';
import DataTable, { Column } from '@/components/DataTable';
import Dialog from '@/components/Dialog';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  IndianRupee,
  Search,
  CreditCard,
  Building2,
  X,
  FileSpreadsheet,
  Banknote,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  User,
  Mail,
  Phone,
  Percent,
  Briefcase,
  Layers,
  Receipt,
  History
} from 'lucide-react';
import { exportToExcel } from '@/utills/exportHelper';

interface ResellerInfo {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  profileImage?: string;
  commissionRate?: number;
  bankDetails?: string;
  upiId?: string;
}

interface PaymentItem {
  amount: number;
  paymentDate?: string | Date;
  paymentMode?: string;
  paymentProof?: string;
  note?: string;
  createdAt?: string | Date;
}

interface LeadSettlementItem {
  id: string;
  customerName: string;
  customerContact: string;
  customerEmail: string;
  companyName: string;
  projectName: string;
  baseProjectAmount?: number;
  status: string;
  paymentAmount: number;
  paidAmount?: number;
  paymentStatus?: string;
  commissionAmount: number;
  earnedCommission?: number;
  settledCommissionAmount?: number;
  payableCommissionNow?: number;
  commissionRate: number;
  settlementType?: 'payable' | 'receivable';
  settlementAmount?: number;
  resellerProfit?: number;
  paymentDate: string;
  paymentMode: string;
  isSettled: boolean;
  managedBy?: string;
  settlementDate?: string | null;
  settlementRef?: string;
  settlementMethod?: string;
  payments?: PaymentItem[];
}

const formatLeadDate = (dateVal: any): string => {
  if (!dateVal) return '-';
  const raw = typeof dateVal === 'object' ? dateVal.startDate || dateVal.date || null : dateVal;
  if (!raw) return '-';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export default function SettlementDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const resellerId = id as string;

  const { role: userRole, user, permissions: rawPerms } = useSelector((state: any) => state.auth || {});
  
  // Safe robust Admin role detection from redux, jwt token, or localStorage
  const token = typeof window !== 'undefined' ? getAuthToken() : null;
  let tokenRole = '';
  let tokenEmail = '';
  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(window.atob(parts[1]));
        tokenRole = payload?.role?.roleName?.toLowerCase() || (typeof payload?.role === 'string' ? payload.role.toLowerCase() : '');
        tokenEmail = payload?.email || '';
      }
    } catch (e) {}
  }

  const roleName = (userRole || user?.role?.roleName || (typeof user?.role === 'string' ? user.role : '') || tokenRole || '').toLowerCase();
  const userEmail = user?.email || tokenEmail || '';
  const isAdmin = 
    roleName.includes('admin') || 
    roleName.includes('super') || 
    userEmail === 'admin@gmail.com' || 
    Boolean(rawPerms?.settlement?.create) ||
    Boolean(rawPerms?.settlement?.readAll) ||
    !roleName.includes('reseller');

  const [isMounted, setIsMounted] = useState(false);
  const [reseller, setReseller] = useState<ResellerInfo | null>(null);

  // Tabs: 'unsettled' | 'settled'
  const [activeTab, setActiveTab] = useState<'unsettled' | 'settled'>('unsettled');

  // Leads list & stats
  const [leads, setLeads] = useState<LeadSettlementItem[]>([]);
  const [unsettledCount, setUnsettledCount] = useState(0);
  const [settledCount, setSettledCount] = useState(0);
  const [selectedLeadForHistory, setSelectedLeadForHistory] = useState<LeadSettlementItem | null>(null);
  const [totalPayableCommission, setTotalPayableCommission] = useState(0);
  const [totalReceivableProjectCost, setTotalReceivableProjectCost] = useState(0);
  const [netBalance, setNetBalance] = useState(0);
  const [payableCount, setPayableCount] = useState(0);
  const [receivableCount, setReceivableCount] = useState(0);
  const [managedByFilter, setManagedByFilter] = useState<'Digitalks' | 'Manage by Me'>('Digitalks');
  const [isLoading, setIsLoading] = useState(true);

  // Overall Reseller Financial Aggregates
  const [summaryStats, setSummaryStats] = useState({
    totalAllLeads: 0,
    totalDigitalksLeads: 0,
    totalManageByMeLeads: 0,
    unsettledDigitalksCount: 0,
    unsettledManageByMeCount: 0,
    settledDigitalksCount: 0,
    settledManageByMeCount: 0,
    totalRevenue: 0,
    totalCollectedPaid: 0,
    totalPendingAmount: 0,
    totalEarnedCommission: 0,
    totalPayableCommission: 0,
    totalSettledCommission: 0,
  });

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Selection
  const [selectedLeads, setSelectedLeads] = useState<LeadSettlementItem[]>([]);

  // Settle Modal State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleMethod, setSettleMethod] = useState('Bank Transfer');
  const [settleRefId, setSettleRefId] = useState('');
  const [settleDate, setSettleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [settleNote, setSettleNote] = useState('');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch leads for this reseller
  const fetchLeads = useCallback(async () => {
    if (!resellerId) return;
    setIsLoading(true);
    try {
      const res = await axios.get(baseUrl.resellerLeadSettlements, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: {
          resellerId,
          settled: activeTab === 'settled',
          managedBy: managedByFilter,
          page,
          limit,
          search: debouncedSearch
        }
      });

      const responseData = res.data?.data;
      if (responseData) {
        setLeads(responseData.data || []);
        setTotalRecords(responseData.totalRecords || 0);
        setTotalPages(responseData.totalPages || 1);
        setUnsettledCount(responseData.unsettledCount || 0);
        setSettledCount(responseData.settledCount || 0);
        setTotalPayableCommission(responseData.totalPayableCommission || 0);
        setTotalReceivableProjectCost(responseData.totalReceivableProjectCost || 0);
        setNetBalance(responseData.netBalance || 0);
        setPayableCount(responseData.payableCount || 0);
        setReceivableCount(responseData.receivableCount || 0);

        setSummaryStats({
          totalAllLeads: responseData.totalAllLeads || 0,
          totalDigitalksLeads: responseData.totalDigitalksLeads || 0,
          totalManageByMeLeads: responseData.totalManageByMeLeads || 0,
          unsettledDigitalksCount: responseData.unsettledDigitalksCount || responseData.payableCount || 0,
          unsettledManageByMeCount: responseData.unsettledManageByMeCount || responseData.receivableCount || 0,
          settledDigitalksCount: responseData.settledDigitalksCount || 0,
          settledManageByMeCount: responseData.settledManageByMeCount || 0,
          totalRevenue: responseData.totalRevenue || 0,
          totalCollectedPaid: responseData.totalCollectedPaid || 0,
          totalPendingAmount: responseData.totalPendingAmount || 0,
          totalEarnedCommission: responseData.totalEarnedCommission || 0,
          totalPayableCommission: responseData.totalPayableCommission || 0,
          totalSettledCommission: responseData.totalSettledCommission || 0,
        });

        if (responseData.reseller) {
          setReseller(responseData.reseller);
        }
      }
    } catch (error) {
      console.error('Failed to fetch reseller leads:', error);
      toast.error('Failed to load lead settlements');
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, [resellerId, activeTab, managedByFilter, page, limit, debouncedSearch, token]);

  useEffect(() => {
    setIsMounted(true);
    if (resellerId) {
      fetchLeads();
    }
  }, [resellerId, fetchLeads]);

  // Clear selections when switching tabs
  const handleTabChange = (tab: 'unsettled' | 'settled') => {
    setActiveTab(tab);
    setSelectedLeads([]);
    setPage(1);
  };

  // Filtered Leads (Backend handles managedBy filtering directly)
  const filteredLeads = leads;

  const digitalksCurrentPageLeads = filteredLeads.filter((l) => l.managedBy === 'Digitalks');
  const isAllCurrentPageSelected =
    digitalksCurrentPageLeads.length > 0 &&
    digitalksCurrentPageLeads.every((l) => selectedLeads.some((item) => item.id === l.id));

  // Selection handlers (only for Digitalks leads)
  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newItems = [...selectedLeads];
      filteredLeads.forEach((lead) => {
        if (lead.managedBy === 'Digitalks' && !newItems.some((item) => item.id === lead.id)) {
          newItems.push(lead);
        }
      });
      setSelectedLeads(newItems);
    } else {
      const currentPageIds = filteredLeads.map((l) => l.id);
      setSelectedLeads(selectedLeads.filter((item) => !currentPageIds.includes(item.id)));
    }
  };

  const handleToggleSelectLead = (lead: LeadSettlementItem, checked: boolean) => {
    if (lead.managedBy !== 'Digitalks') return;
    if (checked) {
      setSelectedLeads([...selectedLeads, lead]);
    } else {
      setSelectedLeads(selectedLeads.filter((item) => item.id !== lead.id));
    }
  };

  // Selected Total Commission Calculation (strictly payable commission now)
  const selectedTotalCommission = selectedLeads.reduce(
    (sum, item) => sum + (Number(item.payableCommissionNow !== undefined ? item.payableCommissionNow : (item.managedBy === 'Digitalks' ? item.commissionAmount : 0)) || 0),
    0
  );

  // Submit Settlement Payout for selected leads
  const handleConfirmSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLeads.length === 0) {
      toast.error('Please select at least one lead to settle');
      return;
    }

    setIsSubmittingSettle(true);
    try {
      const leadIds = selectedLeads.map((l) => l.id);
      await axios.post(
        baseUrl.settleLeads,
        {
          leadIds,
          paymentMethod: settleMethod,
          referenceId: settleRefId,
          paymentDate: settleDate,
          note: settleNote
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );

      toast.success(`Successfully processed payout for ${selectedLeads.length} lead(s)!`);
      setIsSettleModalOpen(false);
      setSelectedLeads([]);
      setSettleRefId('');
      setSettleNote('');
      fetchLeads();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to settle leads');
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  // Export Excel
  const handleExportExcel = async () => {
    if (!leads.length) {
      toast.error('No data to export');
      return;
    }
    const columns = [
      { header: 'Customer Name', key: 'customerName', width: 20 },
      { header: 'Contact', key: 'customerContact', width: 15 },
      { header: 'Email', key: 'customerEmail', width: 25 },
      { header: 'Company', key: 'companyName', width: 20 },
      { header: 'Project', key: 'projectName', width: 20 },
      { header: 'Managed By', key: 'managedBy', width: 20 },
      { header: 'Lead Amount (₹)', key: 'paymentAmount', width: 18 },
      { header: 'Paid Amount (₹)', key: 'paidAmount', width: 18 },
      { header: 'Balance Amount (₹)', key: 'balanceAmount', width: 18 },
      { header: 'Commission Rate (%)', key: 'commissionRate', width: 18 },
      { header: 'Reseller Earnings (₹)', key: 'resellerProfit', width: 22 },
      { header: 'Payment Date', key: 'formattedPaymentDate', width: 15 },
      { header: 'Status', key: 'settlementStatus', width: 18 },
      { header: 'Settlement Date', key: 'formattedSettlementDate', width: 15 },
      { header: 'Settlement Mode', key: 'settlementMethod', width: 18 },
      { header: 'Reference / UTR', key: 'settlementRef', width: 20 }
    ];

    const exportRows = leads.map((l) => {
      const total = Number(l.paymentAmount) || 0;
      const paid = Number(l.paidAmount || (l.paymentStatus === 'Paid' ? total : 0));
      const balance = Math.max(0, total - paid);
      return {
        ...l,
        paidAmount: paid,
        balanceAmount: balance,
        formattedPaymentDate: formatLeadDate(l.paymentDate),
        settlementStatus: l.isSettled ? 'Settled' : 'Awaiting Settlement',
        formattedSettlementDate: formatLeadDate(l.settlementDate),
      };
    });

    const fileName = `${reseller?.fullName || 'Reseller'}_${activeTab === 'settled' ? 'Settled_Leads' : 'Unsettled_Leads'}.xlsx`;
    await exportToExcel(fileName, 'Leads', columns, exportRows);
  };

  if (!isMounted || !router.isReady) return null;

  // Table Columns Definition
  const columns: Column<LeadSettlementItem>[] = [];

  // Checkbox column for Unsettled tab only (Admin / Payout manager) - Strictly for Digitalks leads
  if (activeTab === 'unsettled' && isAdmin) {
    columns.push({
      key: 'id',
      label: 'SELECT',
      render: (_, row) => {
        const isDigitalks = row.managedBy === 'Digitalks';
        if (!isDigitalks) {
          return (
            <div className="flex items-center justify-center" title="Manage by Me leads do not have company payout settlement">
              <span className="text-[10px] text-gray-400 font-bold bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                Direct
              </span>
            </div>
          );
        }

        const isChecked = selectedLeads.some((item) => item.id === row.id);
        return (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => handleToggleSelectLead(row, e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        );
      }
    });
  }

  columns.push(
    {
      key: 'customerName',
      label: 'CUSTOMER & COMPANY',
      render: (value, row) => (
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
            {value ? value.charAt(0).toUpperCase() : 'C'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-gray-900 text-sm leading-tight hover:text-blue-600 transition-colors">
              {value}
            </span>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 mt-1">
              {row.companyName && row.companyName !== '-' && (
                <span className="font-medium text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[11px]">
                  {row.companyName}
                </span>
              )}
              {row.customerContact && row.customerContact !== '-' && (
                <span className="text-gray-500 flex items-center gap-0.5 text-[11px]">
                  <Phone className="w-3 h-3 text-gray-400" />
                  {row.customerContact}
                </span>
              )}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'projectName',
      label: 'PROJECT & TYPE',
      render: (value, row) => {
        const isDigitalks = row.managedBy === 'Digitalks';
        return (
          <div className="flex flex-col gap-1.5 items-start">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200/70">
              <Layers className="w-3.5 h-3.5 text-gray-500" />
              <span>{value || 'Project'}</span>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                isDigitalks
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isDigitalks ? 'bg-emerald-500' : 'bg-blue-500'}`} />
              {isDigitalks ? 'Digitalks (Commission)' : 'Manage by Me (Direct)'}
            </span>
          </div>
        );
      }
    },
    {
      key: 'paymentAmount',
      label: 'AMOUNT',
      render: (_, row) => {
        const total = Number(row.paymentAmount) || 0;
        const paid = Number(row.paidAmount || (row.paymentStatus === 'Paid' ? total : 0));
        const pending = Math.max(0, total - paid);

        if (!total && !paid) {
          return <span className="text-gray-400 font-medium text-xs">-</span>;
        }

        return (
          <div className="flex flex-col text-xs py-1 min-w-[155px] space-y-1">
            {/* Total Amount */}
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600">
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Total Amount
              </span>
              <span className="font-bold text-gray-900 text-xs tracking-tight">
                ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Paid Amount */}
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600">
                <span className="text-gray-400 font-bold text-[11px] w-3.5 text-center flex-shrink-0">₹</span>
                Paid Amount
              </span>
              <span className={`font-semibold text-xs tracking-tight ${paid > 0 ? 'text-emerald-600' : 'text-gray-600'}`}>
                ₹{paid.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Dashed divider line */}
            <div className="border-t border-dashed border-gray-300 w-full my-0.5" />

            {/* Pending Amount */}
            <div className="flex items-center justify-between gap-3">
              <span className={`flex items-center gap-1.5 text-[11px] font-bold ${pending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                <span className="font-bold text-[11px] w-3.5 text-center flex-shrink-0">₹</span>
                {pending > 0 ? 'Pending' : 'Total Paid'}
              </span>
              <span className={`font-bold text-xs tracking-tight ${pending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {pending > 0 ? `₹${pending.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '✓ Paid'}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      key: 'resellerProfit',
      label: 'RESELLER EARNING / PROFIT',
      render: (value, row) => {
        const isDigitalks = row.managedBy === 'Digitalks';
        const totalRev = Number(row.paymentAmount) || 0;
        const paid = Number(row.paidAmount || (row.paymentStatus === 'Paid' ? totalRev : 0));
        const commRate = row.commissionRate || reseller?.commissionRate || 0;
        const totalComm = Number(row.commissionAmount || 0);
        const earnedComm = row.earnedCommission !== undefined ? Number(row.earnedCommission) : Number(value || 0);
        const payableNow = Number(row.payableCommissionNow || 0);
        const settledComm = Number(row.settledCommissionAmount || 0);

        if (!isDigitalks) {
          // Manage by Me
          const profit = Number(value || Math.max(0, totalRev - (row.baseProjectAmount || 0)));
          return (
            <div className="flex flex-col text-xs py-1 min-w-[155px] space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600">
                  <span className="text-gray-400 font-bold text-[11px] w-3.5 text-center flex-shrink-0">₹</span>
                  Base Project
                </span>
                <span className="font-semibold text-gray-900 text-xs tracking-tight">
                  ₹{(Number(row.baseProjectAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t border-dashed border-gray-300 w-full my-0.5" />
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700">
                  <span className="font-bold text-[11px] w-3.5 text-center flex-shrink-0">₹</span>
                  Direct Margin
                </span>
                <span className="font-bold text-blue-700 text-xs tracking-tight">
                  ₹{profit.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          );
        }

        // Digitalks
        const isFullySettled = row.isSettled || (settledComm >= (earnedComm - 0.01) && earnedComm > 0);

        return (
          <div className="flex flex-col text-xs py-1 min-w-[165px] space-y-1">
            {/* Total Commission Deal */}
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600">
                <Percent className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span>Total Comm ({commRate}%)</span>
              </span>
              <span className="font-bold text-gray-900 text-xs tracking-tight">
                ₹{totalComm.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Earned on Paid So Far */}
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600">
                <span className="text-gray-400 font-bold text-[11px] w-3.5 text-center flex-shrink-0">₹</span>
                Earned Comm
              </span>
              <span className={`font-semibold text-xs tracking-tight ${earnedComm > 0 ? 'text-emerald-700' : 'text-gray-600'}`}>
                ₹{earnedComm.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Dashed divider line */}
            <div className="border-t border-dashed border-gray-300 w-full my-0.5" />

            {/* Status (Payable Now / Settled) */}
            <div className="flex items-center justify-between gap-3">
              {activeTab === 'unsettled' && payableNow > 0 ? (
                <>
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700">
                    <span className="font-bold text-[11px] w-3.5 text-center flex-shrink-0">₹</span>
                    Payable Now
                  </span>
                  <span className="font-bold text-xs tracking-tight text-blue-700">
                    ₹{payableNow.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </>
              ) : isFullySettled ? (
                <>
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                    <span className="font-bold text-[11px] w-3.5 text-center flex-shrink-0">✓</span>
                    Settled
                  </span>
                  <span className="font-bold text-xs tracking-tight text-emerald-700">
                    ₹{settledComm > 0 ? settledComm.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : earnedComm.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
                    <span className="font-bold text-[11px] w-3.5 text-center flex-shrink-0">₹</span>
                    Pending Payment
                  </span>
                  <span className="font-bold text-xs tracking-tight text-gray-500">
                    ₹0
                  </span>
                </>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'paymentHistory',
      label: 'PAYMENT HISTORY',
      render: (_, row) => {
        const paymentsList = row.payments && Array.isArray(row.payments) ? row.payments : [];
        const count = paymentsList.length;
        const totalPaid = Number(row.paidAmount) || 0;

        if (count === 0 && totalPaid <= 0) {
          return <span className="text-gray-400 font-medium text-xs">-</span>;
        }

        return (
          <div className="flex flex-col gap-1 min-w-[140px]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedLeadForHistory(row);
              }}
              className="inline-flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/90 hover:bg-blue-100 text-blue-700 border border-blue-200/80 transition-all text-xs font-semibold group cursor-pointer shadow-2xs"
              title="Click to view full payment installments history"
            >
              <span className="flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span>{count > 0 ? `${count} ${count === 1 ? 'Payment' : 'Installments'}` : '1 Payment'}</span>
              </span>
              <span className="text-[10px] text-blue-500 group-hover:text-blue-700 font-bold">View →</span>
            </button>

            {count > 0 ? (
              <span className="text-[10px] text-gray-500 truncate block">
                Last: {formatLeadDate(paymentsList[paymentsList.length - 1].paymentDate || paymentsList[paymentsList.length - 1].createdAt)} • ₹{Number(paymentsList[paymentsList.length - 1].amount || 0).toLocaleString('en-IN')}
              </span>
            ) : totalPaid > 0 ? (
              <span className="text-[10px] text-gray-500 truncate block">
                {formatLeadDate(row.paymentDate)} • {row.paymentMode || 'Cash'}
              </span>
            ) : null}
          </div>
        );
      }
    }
  );

  if (activeTab === 'settled') {
    columns.push(
      {
        key: 'settlementDate',
        label: 'SETTLED DATE & METHOD',
        render: (value, row) => (
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {formatLeadDate(value)}
            </span>
            <span className="text-[11px] text-gray-500 mt-0.5">
              via {row.settlementMethod || 'Bank Transfer'}{' '}
              {row.settlementRef && row.settlementRef !== '-' && `(Ref: ${row.settlementRef})`}
            </span>
          </div>
        )
      }
    );
  }

  return (
    <div className="flex flex-col h-full gap-4 animate-in fade-in duration-300">
      <Head>
        <title>{reseller?.fullName || 'Reseller'} | Lead Settlements</title>
      </Head>

      {/* Top Header Card */}
      <div className="bg-white border border-gray-200/80 shadow-xs rounded-lg px-4 py-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/settlements')}
              className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-md transition-all border border-gray-200 cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
              title="Back to Resellers"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-500/30 bg-blue-50 text-blue-700 shadow-2xs">
                <span className="text-xs font-bold">
                  {reseller?.fullName?.charAt(0)?.toUpperCase() || '?'}
                </span>
                {reseller?.profileImage && (
                  <img
                    src={
                      reseller.profileImage.includes('http')
                        ? reseller.profileImage
                        : `${baseUrl.getImageUrl}/images/ResellerProfileImages/${reseller.profileImage}`
                    }
                    alt={reseller.fullName}
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-sm font-bold text-gray-900 tracking-tight">
                    {reseller?.fullName || 'Reseller Settlement'}
                  </h1>
                  {reseller?.commissionRate !== undefined && Number(reseller.commissionRate) > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {reseller.commissionRate}% Commission
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                      Project-Based Commission
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-gray-500 mt-0.5">
                  {reseller?.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-gray-400" />
                      {reseller.email}
                    </span>
                  )}
                  {reseller?.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-gray-400" />
                      {reseller.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {reseller?.upiId && (
              <div className="px-2.5 py-1 rounded-md bg-purple-50/80 text-purple-900 border border-purple-200 text-[11px] font-medium flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-purple-600 flex-shrink-0" />
                <span>UPI: <strong className="font-semibold text-purple-950">{reseller.upiId}</strong></span>
              </div>
            )}
            {reseller?.bankDetails && (
              <div className="px-2.5 py-1 rounded-md bg-blue-50/80 text-blue-900 border border-blue-200 text-[11px] font-medium flex items-center gap-1 max-w-xs truncate" title={reseller.bankDetails}>
                <Building2 className="w-3 h-3 text-blue-600 flex-shrink-0" />
                <span className="truncate">{reseller.bankDetails}</span>
              </div>
            )}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1 px-2.5 py-1 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-md text-xs font-semibold transition-all cursor-pointer shadow-2xs hover:border-gray-300"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Select Action Banner */}
      {isAdmin && selectedLeads.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-gray-900 px-4 py-2.5 rounded-lg shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-blue-600 text-white shadow-2xs">
              <Banknote className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900 flex items-center gap-2">
                <span>{selectedLeads.length} Lead(s) Selected</span>
                <span className="text-emerald-700 font-extrabold">
                  (Payout: ₹{selectedTotalCommission.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedLeads([])}
              className="px-2.5 py-1 rounded-md bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              Clear
            </button>
            <button
              onClick={() => setIsSettleModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs transition-all cursor-pointer hover:shadow-md"
            >
              <Banknote className="w-3.5 h-3.5" />
              Process Payout
            </button>
          </div>
        </div>
      )}

      {/* Financial Settlement KPI Cards (Total Deal Revenue, Paid Amount, Pending Balance) */}
      {(() => {
        const fallbackDealRevenue = leads.reduce((sum, l) => sum + (Number(l.paymentAmount) || 0), 0);
        const fallbackCollectedPaid = leads.reduce((sum, l) => sum + (Number(l.paidAmount || (l.paymentStatus === 'Paid' ? l.paymentAmount : 0)) || 0), 0);
        const fallbackCommEarned = leads.reduce((sum, l) => sum + (l.managedBy === 'Digitalks' ? (Number(l.earnedCommission || l.resellerProfit || 0)) : 0), 0);
        const fallbackCommPayable = leads.reduce((sum, l) => sum + (l.managedBy === 'Digitalks' && !l.isSettled ? (Number(l.payableCommissionNow || 0)) : 0), 0);

        const totalDealRevenue = summaryStats.totalRevenue > 0 ? summaryStats.totalRevenue : fallbackDealRevenue;
        const totalCollectedPaid = summaryStats.totalCollectedPaid > 0 ? summaryStats.totalCollectedPaid : fallbackCollectedPaid;
        const totalPendingBal = summaryStats.totalPendingAmount > 0 ? summaryStats.totalPendingAmount : Math.max(0, totalDealRevenue - totalCollectedPaid);
        const totalCommEarned = summaryStats.totalEarnedCommission > 0 ? summaryStats.totalEarnedCommission : fallbackCommEarned;
        const totalCommPayable = summaryStats.totalPayableCommission > 0 ? summaryStats.totalPayableCommission : fallbackCommPayable;
        const totalCount = summaryStats.totalAllLeads > 0 ? summaryStats.totalAllLeads : leads.length;
        const digitalksCount = summaryStats.totalDigitalksLeads > 0 ? summaryStats.totalDigitalksLeads : leads.filter(l => l.managedBy === 'Digitalks').length;
        const manageByMeCount = summaryStats.totalManageByMeLeads > 0 ? summaryStats.totalManageByMeLeads : leads.filter(l => l.managedBy !== 'Digitalks').length;

        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Card 1: Total Leads Revenue */}
            <div className="bg-white border border-gray-200/90 border-l-4 border-l-blue-600 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-gray-700">Total Leads Revenue</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {totalCount} Leads
                </span>
              </div>
              <div className="my-1.5">
                <p className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  ₹{totalDealRevenue.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                <span>Total deal value</span>
                <span className="font-semibold text-gray-700">{digitalksCount} Digitalks • {manageByMeCount} Manage by Me</span>
              </div>
            </div>

            {/* Card 2: Total Paid Amount (Collected) */}
            <div className="bg-white border border-gray-200/90 border-l-4 border-l-emerald-500 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-gray-700">Total Paid Amount</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Collected
                </span>
              </div>
              <div className="my-1.5">
                <p className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight">
                  ₹{totalCollectedPaid.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                <span>Commission Earned</span>
                <span className="font-bold text-emerald-700">₹{totalCommEarned.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Card 3: Pending Balance & Payable Commission */}
            <div className="bg-white border border-gray-200/90 border-l-4 border-l-amber-500 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-gray-700">Pending Balance</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  Remaining
                </span>
              </div>
              <div className="my-1.5">
                <p className="text-xl sm:text-2xl font-black text-amber-600 tracking-tight">
                  ₹{totalPendingBal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                <span>Payable Commission Now</span>
                <span className="font-bold text-blue-700">₹{totalCommPayable.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tabs & DataTable Container */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Navigation & Segmented Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 px-5 pt-3 pb-2.5 bg-gray-50/50 gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-6">
              {/* Awaiting Settlement Tab */}
              <button
                onClick={() => handleTabChange('unsettled')}
                className={`pb-2.5 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
                  activeTab === 'unsettled'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Awaiting Settlement</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    activeTab === 'unsettled'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-200/80 text-gray-600'
                  }`}
                >
                  {managedByFilter === 'Digitalks'
                    ? (summaryStats.unsettledDigitalksCount ?? payableCount)
                    : (summaryStats.unsettledManageByMeCount ?? receivableCount)}
                </span>
              </button>

              {/* Settled Leads Tab */}
              <button
                onClick={() => handleTabChange('settled')}
                className={`pb-2.5 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
                  activeTab === 'settled'
                    ? 'text-emerald-700 border-b-2 border-emerald-600'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Settled Leads</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    activeTab === 'settled'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-gray-200/80 text-gray-600'
                  }`}
                >
                  {managedByFilter === 'Digitalks'
                    ? (summaryStats.settledDigitalksCount ?? 0)
                    : (summaryStats.settledManageByMeCount ?? 0)}
                </span>
              </button>
            </div>

            {/* Type Segmented Filter (Digitalks / Manage by Me) */}
            <div className="flex items-center bg-gray-200/70 p-0.5 rounded-lg border border-gray-300/60 shadow-2xs">
              <button
                onClick={() => {
                  setManagedByFilter('Digitalks');
                  setSelectedLeads([]);
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  managedByFilter === 'Digitalks'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-emerald-800'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${managedByFilter === 'Digitalks' ? 'bg-white' : 'bg-emerald-500'}`} />
                <span>Digitalks</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ml-0.5 ${
                  managedByFilter === 'Digitalks' ? 'bg-emerald-700/80 text-white' : 'bg-gray-300 text-gray-700'
                }`}>
                  {activeTab === 'unsettled' ? (summaryStats.unsettledDigitalksCount ?? payableCount) : (summaryStats.settledDigitalksCount ?? 0)}
                </span>
              </button>
              <button
                onClick={() => {
                  setManagedByFilter('Manage by Me');
                  setSelectedLeads([]);
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  managedByFilter === 'Manage by Me'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-blue-800'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${managedByFilter === 'Manage by Me' ? 'bg-white' : 'bg-blue-500'}`} />
                <span>Manage by Me</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ml-0.5 ${
                  managedByFilter === 'Manage by Me' ? 'bg-blue-700/80 text-white' : 'bg-gray-300 text-gray-700'
                }`}>
                  {activeTab === 'unsettled' ? (summaryStats.unsettledManageByMeCount ?? receivableCount) : (summaryStats.settledManageByMeCount ?? 0)}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* DataTable */}
        <DataTable
          data={filteredLeads}
          columns={columns}
          loading={isLoading}
          searchable={false}
          headerActions={
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {activeTab === 'unsettled' && digitalksCurrentPageLeads.length > 0 && (
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 transition-colors shadow-2xs">
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={handleToggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Select All on Page</span>
                </label>
              )}

              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                <input
                  type="search"
                  placeholder="Search lead name, company, contact..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-xs text-gray-800 placeholder:text-gray-400 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 hover:border-gray-300 shadow-2xs"
                />
              </div>
            </div>
          }
          pagination={true}
          serverSidePagination={true}
          currentPage={page}
          totalPages={totalPages}
          totalRecords={totalRecords}
          pageSize={limit}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(r) => {
            setLimit(r);
            setPage(1);
          }}
        />
      </div>

      {/* Settle Selected Leads Modal */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-gray-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-2xs">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Settle Selected Leads</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Recording commission payout for {selectedLeads.length} leads
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSettleModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Payout Summary */}
            <div className="mt-4 p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-800">Total Payout Amount:</span>
                <p className="text-xl font-black text-emerald-900 mt-0.5">
                  ₹{selectedTotalCommission.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right text-xs text-emerald-700 font-semibold bg-emerald-100/70 px-2.5 py-1 rounded-full border border-emerald-200">
                {selectedLeads.length} Leads Selected
              </div>
            </div>

            <form noValidate onSubmit={handleConfirmSettlement} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Payment Method</label>
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer shadow-2xs"
                  >
                    <option value="Bank Transfer">Bank Transfer (IMPS/NEFT)</option>
                    <option value="UPI">UPI</option>
                    <option value="GPay">Google Pay</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Payment Date</label>
                  <input
                    type="date"
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Transaction / UTR Reference ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR89327498234"
                  value={settleRefId}
                  onChange={(e) => setSettleRefId(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Note (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Commission cleared for closed won deals"
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all shadow-2xs"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSettle}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingSettle ? 'Settling...' : 'Confirm & Mark Settled'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment History Dialog */}
      <Dialog
        isOpen={!!selectedLeadForHistory}
        onClose={() => setSelectedLeadForHistory(null)}
        title={`Payment History — ${selectedLeadForHistory?.customerName || 'Lead'}`}
      >
        {selectedLeadForHistory && (() => {
          const effectivePaymentsList: PaymentItem[] =
            selectedLeadForHistory.payments && selectedLeadForHistory.payments.length > 0
              ? selectedLeadForHistory.payments
              : Number(selectedLeadForHistory.paidAmount || 0) > 0
              ? [
                  {
                    amount: Number(selectedLeadForHistory.paidAmount || 0),
                    paymentDate: selectedLeadForHistory.paymentDate,
                    paymentMode: selectedLeadForHistory.paymentMode || 'Bank Transfer',
                    note: 'Direct / Initial Payment',
                  },
                ]
              : [];

          const totalPaid = effectivePaymentsList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || Number(selectedLeadForHistory.paidAmount || 0);
          const totalRevenue = Number(selectedLeadForHistory.paymentAmount || selectedLeadForHistory.baseProjectAmount || 0);
          const remainingBalance = Math.max(0, totalRevenue - totalPaid);

          return (
            <div className="space-y-4">
              {/* Summary Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs">
                <div>
                  <span className="text-gray-400 block text-[11px] font-medium">Customer</span>
                  <span className="font-bold text-gray-800 truncate block">{selectedLeadForHistory.customerName}</span>
                  <span className="text-[10px] text-gray-500">{selectedLeadForHistory.customerContact}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px] font-medium">Project</span>
                  <span className="font-bold text-gray-800">{selectedLeadForHistory.projectName || '-'}</span>
                  <span className="text-[10px] text-blue-600 font-semibold block">{selectedLeadForHistory.managedBy}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px] font-medium">Total Deal / Revenue</span>
                  <span className="font-bold text-gray-800">
                    ₹{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-amber-600 block">
                    Bal: ₹{remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px] font-medium">Total Paid So Far</span>
                  <span className="font-bold text-emerald-600 text-sm">
                    ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded inline-block mt-0.5">
                    {remainingBalance === 0 ? 'Full Paid' : 'Partial Paid'}
                  </span>
                </div>
              </div>

              {/* Payment list table */}
              {effectivePaymentsList.length === 0 ? (
                <div className="py-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                  <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-semibold text-gray-600">No payment records found</p>
                  <p className="text-xs text-gray-400 mt-0.5">₹0.00 collected for this lead</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">Payment Mode</th>
                        <th className="py-2.5 px-3">Note / Reference</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {effectivePaymentsList.map((p, idx) => {
                        const dateObj = p.paymentDate || p.createdAt ? new Date(p.paymentDate || p.createdAt!) : null;
                        const isValidDate = dateObj && !isNaN(dateObj.getTime());

                        return (
                          <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-gray-500">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-medium text-gray-800">
                              {isValidDate ? (
                                <div className="flex flex-col">
                                  <span>
                                    {dateObj.toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </span>
                                  <span className="text-[10px] text-gray-500 font-normal">
                                    {dateObj.toLocaleTimeString('en-IN', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true,
                                    })}
                                  </span>
                                </div>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                {p.paymentMode || 'Online / Cash'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-gray-500 font-normal">
                              {p.note || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                              ₹{(Number(p.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50/80 border-t-2 border-gray-200 font-bold text-gray-800 text-xs">
                        <td colSpan={4} className="py-2.5 px-3 text-right text-gray-600">
                          Total ({effectivePaymentsList.length} {effectivePaymentsList.length === 1 ? 'Record' : 'Installments'}):
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-600">
                          ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLeadForHistory(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Dialog>
    </div>
  );
}
