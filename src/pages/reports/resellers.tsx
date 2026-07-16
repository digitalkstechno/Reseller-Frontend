import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import DataTable, { Column } from '@/components/DataTable';
import { RefreshCw, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

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
        params: { limit: 1000, search: searchQuery }
      });

      setData(res.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch resellers report:', error);
      toast.error('Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (isMounted) fetchData();
  }, [fetchData, isMounted]);

  const handleExport = () => {
    const exportData = data.map(item => ({
      'Reseller Name': item.fullName || '-',
      'Email': item.email || '-',
      'Phone': item.phone || '-',
      'Role': item.role?.roleName || '-',
      'Status': item.status || '-',
      'Commission Rate (%)': item.commissionRate || 0,
      'Joined Date': new Date(item.createdAt).toLocaleDateString(),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resellers_Report");
    XLSX.writeFile(wb, `Resellers_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
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
      key: 'role',
      label: 'ROLE',
      render: (value: any) => (
        <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium capitalize">
          {value?.roleName || '-'}
        </span>
      ),
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
    <>
      <Head>
        <title>Resellers Report | Reseller Panel</title>
      </Head>

      <div className="bg-white rounded-lg min-h-screen">
        <div className="w-full mx-auto">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500 mt-1">
                View detailed report of all resellers, their roles, and commission rates.
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-t-lg border-b border-gray-100 flex flex-wrap items-center justify-end shadow-sm">
            <button
              onClick={handleExport}
              disabled={isLoading || data.length === 0}
              className="flex items-center gap-2 rounded-md bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export to Excel
            </button>
          </div>

          <DataTable
            data={data}
            columns={columns}
            loading={isLoading}
            searchable
            searchQuery={searchQuery}
            onSearch={(val) => setSearchQuery(val)}
          />
        </div>
      </div>
    </>
  );
}
