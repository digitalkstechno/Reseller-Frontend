import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import DataTable, { Column } from '@/components/DataTable';
import { RefreshCw, Download, Search, MoreVertical, FileText, File } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportToExcel } from '@/utills/exportHelper';

interface ReportReseller {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  role: { roleName: string };
  commissionRate: string;
  createdAt: string;
}

export default function ResellersReport() {
  const [data, setData] = useState<ReportReseller[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = getAuthToken();
      if (!token) return;

      const res = await axios.get(baseUrl.getAllResellers, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 1000, search: debouncedSearch }
      });

      setData(res.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch resellers report:', error);
      toast.error('Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (isMounted) fetchData();
  }, [fetchData, isMounted]);

  const handleExport = async () => {
    const exportData = data.map(item => ({
      fullName: item.fullName || '-',
      email: item.email || '-',
      phone: item.phone || '-',
      role: item.role?.roleName || '-',
      status: item.status || '-',
      commissionRate: item.commissionRate || 0,
      joinedDate: new Date(item.createdAt).toLocaleDateString(),
    }));

    const columns = [
      { header: 'Reseller Name', key: 'fullName', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Role', key: 'role', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Commission Rate (%)', key: 'commissionRate', width: 22 },
      { header: 'Joined Date', key: 'joinedDate', width: 20 },
    ];

    const fileName = `Resellers_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    await exportToExcel(fileName, 'Resellers', columns, exportData);
  };

  const columns: Column<ReportReseller>[] = [
    {
      key: 'fullName',
      label: 'RESELLER NAME',
      render: (value, row) => (
        <div>
          <div className="font-semibold text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">{row.email}</div>
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'PHONE',
      render: (value) => <span className="text-gray-700">{value}</span>,
    },

    {
      key: 'commissionRate',
      label: 'COMMISSION RATE',
      render: (value) => <span className="text-gray-700">{value ? `${value}%` : '0%'}</span>,
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (value) => (
        <span className={`px-2 py-1 text-xs rounded-full font-medium capitalize ${
          value === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {value}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'JOINED DATE',
      render: (value) => (
        <span className="text-gray-600">
          {new Date(value).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })}
        </span>
      ),
    },
  ];

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Head>
        <title>Resellers Report | Reseller Panel</title>
      </Head>

      <div className="flex-1 min-h-0 flex flex-col rounded-lg">
          <DataTable
            data={data}
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
