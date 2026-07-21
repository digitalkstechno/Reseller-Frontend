import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import DataTable, { Column } from '@/components/DataTable';
import DatePicker from '@/components/ui/DatePicker';
import { RefreshCw, Download, IndianRupee, Filter, Search, MoreVertical, X, FileText, File } from 'lucide-react';
import FormInput from '@/components/ui/Input';
import toast from 'react-hot-toast';
import { exportToExcel } from '@/utills/exportHelper';

interface ReportSettlement {
  _id: string;
  resellerName: string;
  resellerEmail: string;
  resellerPhone: string;
  commissionRate: number;
  totalLeadsCount: number;
  totalLeadsAmount: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
}

export default function SettlementsReport() {
  const router = useRouter();
  const [data, setData] = useState<ReportSettlement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [minCommission, setMinCommission] = useState('');
  const [maxCommission, setMaxCommission] = useState('');
  const [minTotalAmount, setMinTotalAmount] = useState('');
  const [maxTotalAmount, setMaxTotalAmount] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Temporary state for the filter popover
  const [tempFromDate, setTempFromDate] = useState('');
  const [tempToDate, setTempToDate] = useState('');
  const [tempMinCommission, setTempMinCommission] = useState('');
  const [tempMaxCommission, setTempMaxCommission] = useState('');
  const [tempMinTotalAmount, setTempMinTotalAmount] = useState('');
  const [tempMaxTotalAmount, setTempMaxTotalAmount] = useState('');

  // Sync temp state when opening popover
  useEffect(() => {
    if (showFilters) {
      setTempFromDate(fromDate);
      setTempToDate(toDate);
      setTempMinCommission(minCommission);
      setTempMaxCommission(maxCommission);
      setTempMinTotalAmount(minTotalAmount);
      setTempMaxTotalAmount(maxTotalAmount);
    }
  }, [showFilters, fromDate, toDate, minCommission, maxCommission, minTotalAmount, maxTotalAmount]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = getAuthToken();
      if (!token) return;

      const params: any = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await axios.get(baseUrl.settlements, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setData(res.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch settlements report:', error);
      toast.error('Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = data.filter(item => {
    let match = true;
    if (minCommission) {
      match = item.totalCommission >= Number(minCommission);
    }
    if (match && maxCommission) {
      match = item.totalCommission <= Number(maxCommission);
    }
    if (match && minTotalAmount) {
      match = item.totalLeadsAmount >= Number(minTotalAmount);
    }
    if (match && maxTotalAmount) {
      match = item.totalLeadsAmount <= Number(maxTotalAmount);
    }
    return match;
  });

  const handleExport = async () => {
    const exportData = filteredData.map(item => ({
      resellerName: item.resellerName || '-',
      email: item.resellerEmail || '-',
      phone: item.resellerPhone || '-',
      commissionRate: item.commissionRate != null ? `${item.commissionRate}%` : '-',
      leadsCount: item.totalLeadsCount || 0,
      totalAmount: item.totalLeadsAmount || 0,
      totalCommission: item.totalCommission || 0,
    }));

    const columns = [
      { header: 'Reseller Name', key: 'resellerName', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Commission Rate', key: 'commissionRate', width: 15 },
      { header: 'Leads Count', key: 'leadsCount', width: 15 },
      { header: 'Total Amount', key: 'totalAmount', width: 20 },
      { header: 'Total Commission', key: 'totalCommission', width: 20 },
    ];

    const fileName = `Settlements_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    await exportToExcel(fileName, 'Settlements', columns, exportData);
  };

  const maxDataCommission = data.length > 0 ? Math.max(...data.map(d => d.totalCommission || 0)) : 100000;
  const maxDataAmount = data.length > 0 ? Math.max(...data.map(d => d.totalLeadsAmount || 0)) : 1000000;

  const columns: Column<ReportSettlement>[] = [
    {
      key: 'resellerName',
      label: 'RESELLER NAME',
      render: (value, row) => (
        <div>
          <div className="font-semibold text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">{row.resellerEmail}</div>
        </div>
      ),
    },
    {
      key: 'resellerPhone',
      label: 'PHONE',
      render: (value) => <span className="text-sm text-gray-600">{value || '-'}</span>,
    },
    {
      key: 'commissionRate',
      label: 'COMMISSION RATE',
      render: (value) => <span className="font-medium text-indigo-600">{value != null ? `${value}%` : '-'}</span>,
    },
    {
      key: 'totalLeadsCount',
      label: 'TOTAL LEADS',
      render: (value) => <span className="font-medium text-gray-700">{value}</span>,
    },
    {
      key: 'totalLeadsAmount',
      label: 'TOTAL AMOUNT',
      render: (value) => (
        <div className="flex items-center gap-1 font-semibold text-emerald-700">
          <IndianRupee className="h-3 w-3" />
          <span>{value.toLocaleString('en-IN')}</span>
        </div>
      ),
    },
    {
      key: 'totalCommission',
      label: 'TOTAL COMMISSION',
      render: (value) => (
        <div className="flex items-center gap-1 font-semibold text-blue-700">
          <IndianRupee className="h-3 w-3" />
          <span>{value.toLocaleString('en-IN')}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (_, row) => {
        const isPaid = row.totalCommission === 0 || row.status === 'paid';
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isPaid ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
            {isPaid ? 'Paid' : 'Unpaid'}
          </span>
        );
      },
    }
  ];


  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Head>
        <title>Settlements Report | Reseller Panel</title>
      </Head>

      <div className="flex-1 min-h-0 flex flex-col rounded-lg">

          <DataTable
            data={filteredData}
            columns={columns}
            loading={isLoading}
            searchable={false}
            headerActions={
              <div className="flex items-center gap-3">
                {/* Search Bar */}
                <div className="relative w-full sm:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                  <input
                    type="search"
                    placeholder="Search anything..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-64 rounded-md border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm text-gray-700 placeholder:text-gray-400 transition-all duration-200 focus:border-[#00b5ad] focus:outline-none focus:ring-1 focus:ring-[#00b5ad]/20 hover:border-gray-300"
                  />
                </div>

                {/* Filter Popover */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`inline-flex items-center justify-center h-9 w-9 rounded-md border transition-all ${showFilters ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  >
                    <Filter className="h-4 w-4" />
                  </button>
                  {showFilters && (
                    <div className="absolute right-0 top-full mt-2 w-[320px] bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden">
                      <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="font-semibold text-gray-800 text-sm">Filter Reports</h3>
                        <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                      </div>
                      <div className="p-4 flex flex-col gap-6">
                        {/* Date Range */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Range</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <DatePicker value={tempFromDate} onChange={setTempFromDate} placeholder="Start Date" />
                            </div>
                            <span className="text-gray-300 font-medium">-</span>
                            <div className="flex-1">
                              <DatePicker value={tempToDate} onChange={setTempToDate} placeholder="End Date" />
                            </div>
                          </div>
                        </div>

                        {/* Commission Range Slider */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex justify-between">
                            <span>Commission Range</span>
                            <span className="text-[#00b5ad] font-bold">
                              ₹{tempMinCommission || 0} - ₹{tempMaxCommission || maxDataCommission || 100000}
                            </span>
                          </label>
                          
                          <style>{`
                            .slider-thumb-grip::-webkit-slider-thumb {
                              background-image: linear-gradient(90deg, transparent 5px, #ccc 5px, #ccc 6px, transparent 6px, transparent 9px, #ccc 9px, #ccc 10px, transparent 10px);
                            }
                          `}</style>
                          <div className="relative w-full pt-3 pb-5">
                            <div className="relative h-1.5 w-full bg-gray-200 rounded-full">
                              <div 
                                className="absolute h-full bg-[#00b5ad] rounded-full"
                                style={{ 
                                  left: `${((Number(tempMinCommission || 0)) / (maxDataCommission || 100000)) * 100}%`,
                                  right: `${100 - ((Number(tempMaxCommission || maxDataCommission || 100000)) / (maxDataCommission || 100000)) * 100}%`
                                }}
                              />
                              <input
                                type="range"
                                min="0"
                                max={maxDataCommission || 100000}
                                step={Math.max(1, Math.floor((maxDataCommission || 100000) / 100))}
                                value={tempMinCommission || 0}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (!tempMaxCommission || val <= Number(tempMaxCommission)) setTempMinCommission(e.target.value);
                                }}
                                className="absolute -top-[7px] w-full appearance-none !bg-transparent !border-0 !p-0 !outline-none !ring-0 !shadow-none pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[16px] [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-[4px] [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.3)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-gray-200 slider-thumb-grip"
                                style={{ zIndex: 5 }}
                              />
                              <input
                                type="range"
                                min="0"
                                max={maxDataCommission || 100000}
                                step={Math.max(1, Math.floor((maxDataCommission || 100000) / 100))}
                                value={tempMaxCommission || maxDataCommission || 100000}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (val >= Number(tempMinCommission || 0)) setTempMaxCommission(e.target.value);
                                }}
                                className="absolute -top-[7px] w-full appearance-none !bg-transparent !border-0 !p-0 !outline-none !ring-0 !shadow-none pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[16px] [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-[4px] [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.3)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-gray-200 slider-thumb-grip"
                                style={{ zIndex: 4 }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Total Amount Range Slider */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex justify-between">
                            <span>Total Amount Range</span>
                            <span className="text-[#00b5ad] font-bold">
                              ₹{tempMinTotalAmount || 0} - ₹{tempMaxTotalAmount || maxDataAmount || 1000000}
                            </span>
                          </label>
                          <div className="relative w-full pt-3 pb-5">
                            <div className="relative h-1.5 w-full bg-gray-200 rounded-full">
                              <div 
                                className="absolute h-full bg-[#00b5ad] rounded-full"
                                style={{ 
                                  left: `${((Number(tempMinTotalAmount || 0)) / (maxDataAmount || 1000000)) * 100}%`,
                                  right: `${100 - ((Number(tempMaxTotalAmount || maxDataAmount || 1000000)) / (maxDataAmount || 1000000)) * 100}%`
                                }}
                              />
                              <input
                                type="range"
                                min="0"
                                max={maxDataAmount || 1000000}
                                step={Math.max(1, Math.floor((maxDataAmount || 1000000) / 100))}
                                value={tempMinTotalAmount || 0}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (!tempMaxTotalAmount || val <= Number(tempMaxTotalAmount)) setTempMinTotalAmount(e.target.value);
                                }}
                                className="absolute -top-[7px] w-full appearance-none !bg-transparent !border-0 !p-0 !outline-none !ring-0 !shadow-none pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[16px] [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-[4px] [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.3)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-gray-200 slider-thumb-grip"
                                style={{ zIndex: 5 }}
                              />
                              <input
                                type="range"
                                min="0"
                                max={maxDataAmount || 1000000}
                                step={Math.max(1, Math.floor((maxDataAmount || 1000000) / 100))}
                                value={tempMaxTotalAmount || maxDataAmount || 1000000}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (val >= Number(tempMinTotalAmount || 0)) setTempMaxTotalAmount(e.target.value);
                                }}
                                className="absolute -top-[7px] w-full appearance-none !bg-transparent !border-0 !p-0 !outline-none !ring-0 !shadow-none pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[16px] [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-[4px] [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.3)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-gray-200 slider-thumb-grip"
                                style={{ zIndex: 4 }}
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
                            setTempMinCommission(''); 
                            setTempMaxCommission(''); 
                            setTempMinTotalAmount('');
                            setTempMaxTotalAmount('');
                            setFromDate('');
                            setToDate('');
                            setMinCommission('');
                            setMaxCommission('');
                            setMinTotalAmount('');
                            setMaxTotalAmount('');
                            setShowFilters(false);
                          }}
                          className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          Clear All
                        </button>
                        <button 
                          onClick={() => {
                            setFromDate(tempFromDate);
                            setToDate(tempToDate);
                            setMinCommission(tempMinCommission);
                            setMaxCommission(tempMaxCommission);
                            setMinTotalAmount(tempMinTotalAmount);
                            setMaxTotalAmount(tempMaxTotalAmount);
                            setShowFilters(false);
                          }}
                          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#00b5ad] border border-[#00b5ad] rounded-md hover:bg-[#009b94] transition-colors cursor-pointer"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Export Dropdown Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className={`inline-flex items-center justify-center h-9 w-9 rounded-md border transition-all ${showExportMenu ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 py-1 overflow-hidden">
                      <button
                        onClick={() => { handleExport(); setShowExportMenu(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-emerald-600" /> Export to Excel
                      </button>
                      <button
                        onClick={() => { 
                          setShowExportMenu(false);
                          setTimeout(() => window.print(), 100);
                        }}
                        disabled={true}
                        title="Coming soon"
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <File className="h-4 w-4 text-red-600" /> Export to PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            }
          />
        </div>
      </div>
  );
}
