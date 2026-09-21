import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';
import DataTable, { Column } from '@/components/DataTable';
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
  Layers
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

  const [isMounted, setIsMounted] = useState(false);
  const [reseller, setReseller] = useState<ResellerInfo | null>(null);

  // Tabs: 'unsettled' | 'settled'
  const [activeTab, setActiveTab] = useState<'unsettled' | 'settled'>('unsettled');

  // Leads list & stats
  const [leads, setLeads] = useState<LeadSettlementItem[]>([]);
  const [unsettledCount, setUnsettledCount] = useState(0);
  const [settledCount, setSettledCount] = useState(0);
  const [totalPayableCommission, setTotalPayableCommission] = useState(0);
  const [totalReceivableProjectCost, setTotalReceivableProjectCost] = useState(0);
  const [netBalance, setNetBalance] = useState(0);
  const [payableCount, setPayableCount] = useState(0);
  const [receivableCount, setReceivableCount] = useState(0);
  const [managedByFilter, setManagedByFilter] = useState<'all' | 'Digitalks' | 'Manage by Me'>('all');
  const [isLoading, setIsLoading] = useState(true);

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

  const token = typeof window !== 'undefined' ? getAuthToken() : null;

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
  }, [resellerId, activeTab, page, limit, debouncedSearch, token]);

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

  // Selection handlers
  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newItems = [...selectedLeads];
      leads.forEach((lead) => {
        if (!newItems.some((item) => item.id === lead.id)) {
          newItems.push(lead);
        }
      });
      setSelectedLeads(newItems);
    } else {
      const currentPageIds = leads.map((l) => l.id);
      setSelectedLeads(selectedLeads.filter((item) => !currentPageIds.includes(item.id)));
    }
  };

  const handleToggleSelectLead = (lead: LeadSettlementItem, checked: boolean) => {
    if (checked) {
      setSelectedLeads([...selectedLeads, lead]);
    } else {
      setSelectedLeads(selectedLeads.filter((item) => item.id !== lead.id));
    }
  };

  // Selected Total Commission Calculation
  const selectedTotalCommission = selectedLeads.reduce(
    (sum, item) => sum + (Number(item.commissionAmount) || 0),
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

      toast.success(`Successfully settled ${selectedLeads.length} leads!`);
      setIsSettleModalOpen(false);
      setSelectedLeads([]);
      setSettleRefId('');
      setSettleNote('');
      setActiveTab('settled');
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
      { header: 'Settlement Amount (₹)', key: 'settlementAmount', width: 22 },
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

  const isAllCurrentPageSelected =
    leads.length > 0 && leads.every((l) => selectedLeads.some((item) => item.id === l.id));

  // Table Columns Definition
  const columns: Column<LeadSettlementItem>[] = [];

  // Checkbox column for Unsettled tab only
  if (activeTab === 'unsettled') {
    columns.push({
      key: 'id',
      label: 'SELECT',
      render: (_, row) => {
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
      label: 'LEAD REVENUE',
      render: (value) => {
        const total = Number(value) || 0;
        return (
          <span className="font-bold text-gray-900 text-sm">
            ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
    },
    {
      key: 'paidAmount',
      label: 'PAID AMOUNT',
      render: (value, row) => {
        const total = Number(row.paymentAmount) || 0;
        const paid = Number(value || (row.paymentStatus === 'Paid' ? total : 0));
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-emerald-700 text-sm">
              ₹{paid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {paid >= total && total > 0 ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 w-fit mt-0.5">
                Full Paid
              </span>
            ) : paid > 0 && paid < total ? (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 w-fit mt-0.5">
                Partial
              </span>
            ) : (
              <span className="text-[10px] font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 w-fit mt-0.5">
                Unpaid
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'balanceAmount',
      label: 'BALANCE (REMAINING)',
      render: (_, row) => {
        const total = Number(row.paymentAmount) || 0;
        const paid = Number(row.paidAmount || (row.paymentStatus === 'Paid' ? total : 0));
        const balance = Math.max(0, total - paid);
        return (
          <div className="flex flex-col">
            <span className={`font-bold text-sm ${balance > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
              ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {balance > 0 ? (
              <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-200 w-fit mt-0.5">
                Pending Bal
              </span>
            ) : (
              <span className="text-[10px] font-medium text-gray-400 mt-0.5">
                Nil
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'settlementAmount',
      label: 'SETTLEMENT AMOUNT',
      render: (_, row) => {
        const isDigitalks = row.managedBy === 'Digitalks';
        const amt = Number(row.settlementAmount || (isDigitalks ? row.commissionAmount : row.baseProjectAmount) || 0);
        if (amt <= 0) {
          return <span className="text-gray-400 font-medium text-sm">-</span>;
        }
        return (
          <div className="flex items-center gap-1.5">
            <span className={`font-black text-sm tracking-tight ${isDigitalks ? 'text-emerald-700' : 'text-rose-700'}`}>
              {isDigitalks ? '−' : '+'} ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                isDigitalks
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {isDigitalks ? 'Payable' : 'Receivable'}
            </span>
          </div>
        );
      }
    },
    {
      key: 'resellerProfit',
      label: 'RESELLER EARNING / PROFIT',
      render: (value, row) => {
        const isDigitalks = row.managedBy === 'Digitalks';
        const amt = Number(value || (isDigitalks ? row.commissionAmount : 0));
        return (
          <div className="flex flex-col">
            <span className="font-bold text-blue-700 text-sm">
              ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] font-medium text-gray-500 mt-0.5">
              {isDigitalks ? `Commission (${row.commissionRate || reseller?.commissionRate || 0}%)` : 'Selling Margin'}
            </span>
          </div>
        );
      }
    },
    {
      key: 'paymentDate',
      label: 'PAYMENT DATE',
      render: (value) => (
        <span className="text-xs text-gray-700 font-medium whitespace-nowrap">
          {formatLeadDate(value)}
        </span>
      )
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

  const filteredLeads = leads.filter((l) => {
    if (managedByFilter === 'all') return true;
    if (managedByFilter === 'Digitalks') return l.managedBy === 'Digitalks';
    return l.managedBy !== 'Digitalks';
  });

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
      {selectedLeads.length > 0 && (
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

      {/* Financial Settlement KPI Cards (Compact & Sleek) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Payable to Reseller (Digitalks Leads) */}
        <div className="bg-white border border-gray-200 border-l-4 border-l-emerald-500 rounded-lg px-3.5 py-2.5 shadow-2xs flex flex-col justify-between transition-all hover:shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <ArrowDownLeft className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-gray-700">Payable to Reseller</span>
            </div>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {payableCount} Digitalks
            </span>
          </div>
          <div className="my-1">
            <p className="text-lg sm:text-xl font-bold text-emerald-700 tracking-tight">
              ₹{totalPayableCommission.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <span className="text-[10px] text-gray-500">
            Commission company owes to reseller
          </span>
        </div>

        {/* Receivable from Reseller (Manage by Me Leads) */}
        <div className="bg-white border border-gray-200 border-l-4 border-l-rose-500 rounded-lg px-3.5 py-2.5 shadow-2xs flex flex-col justify-between transition-all hover:shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded bg-rose-50 text-rose-700 border border-rose-200/60">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-gray-700">Receivable from Reseller</span>
            </div>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
              {receivableCount} Manage by Me
            </span>
          </div>
          <div className="my-1">
            <p className="text-lg sm:text-xl font-bold text-rose-700 tracking-tight">
              ₹{totalReceivableProjectCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <span className="text-[10px] text-gray-500">
            Project cost reseller owes to company
          </span>
        </div>

        {/* Net Settlement Balance */}
        <div className={`bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 shadow-2xs flex flex-col justify-between transition-all hover:shadow-xs ${
          netBalance > 0
            ? 'border-l-4 border-l-emerald-500'
            : netBalance < 0
            ? 'border-l-4 border-l-rose-500'
            : 'border-l-4 border-l-blue-500'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded bg-blue-50 text-blue-700 border border-blue-200/60">
                <Scale className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-gray-700">Net Settlement</span>
            </div>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
              netBalance > 0
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : netBalance < 0
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-gray-100 text-gray-700 border-gray-200'
            }`}>
              {netBalance > 0 ? '🟢 Company Pays' : netBalance < 0 ? '🔴 Reseller Pays' : '⚖️ Balanced'}
            </span>
          </div>
          <div className="my-1">
            <p className={`text-lg sm:text-xl font-bold tracking-tight ${
              netBalance > 0 ? 'text-emerald-700' : netBalance < 0 ? 'text-rose-700' : 'text-gray-900'
            }`}>
              ₹{Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <span className="text-[10px] text-gray-500">
            {netBalance > 0
              ? 'Net payout due to reseller'
              : netBalance < 0
              ? 'Net amount due from reseller'
              : 'All accounts balanced (₹0.00)'}
          </span>
        </div>
      </div>

      {/* Tabs & DataTable Container */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Navigation & Segmented Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 px-5 pt-3 pb-2.5 bg-gray-50/50 gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-6">
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
                {unsettledCount}
              </span>
            </button>

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
                {settledCount}
              </span>
            </button>
          </div>

          {/* Filter Bar */}
        </div>

        {/* DataTable */}
        <DataTable
          data={filteredLeads}
          columns={columns}
          loading={isLoading}
          searchable={false}
          headerActions={
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {activeTab === 'unsettled' && filteredLeads.length > 0 && (
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
    </div>
  );
}
