import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import DataTable, { Column } from '@/components/DataTable';
import DatePicker from '@/components/ui/DatePicker';
import { RefreshCw, Download, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { FormSelect } from '@/components/ui/FormSelect';

interface ReportLead {
  _id: string;
  customerName: string;
  customerEmail: string;
  product: string;
  paymentAmount: number;
  commissionAmount: number;
  createdAt: string;
  leadStatus: { name: string; _id: string };
  assignedTo: { fullName: string; _id: string };
}

export default function LeadsReport() {
  const router = useRouter();
  const { user, role } = useSelector((state: any) => state.auth);
  const [data, setData] = useState<ReportLead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [status, setStatus] = useState('');
  const [statuses, setStatuses] = useState<{ _id: string; name: string }[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const fetchStatuses = async () => {
      try {
        const token = getAuthToken();
        const res = await axios.get(baseUrl.leadStatuses, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStatuses(res.data?.data || res.data || []);
      } catch (err) {
        console.error('Failed to fetch statuses:', err);
      }
    };
    fetchStatuses();
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = getAuthToken();
      if (!token) return;

      const params: any = { limit: 1000, report: 'true' };
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (paymentStatus) params.paymentStatus = paymentStatus;
      if (status) params.status = status;

      const userRole = role?.toLowerCase() || user?.role?.roleName?.toLowerCase() || '';
      const url = userRole === 'admin' ? baseUrl.getAllLeads : baseUrl.myLeads;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setData(res.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch leads report:', error);
      toast.error('Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, paymentStatus, status, user, role]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData, user]);

  const handleExport = () => {
    const exportData = data.map(item => ({
      'Date': new Date(item.createdAt).toLocaleDateString('en-IN'),
      'Customer Name': item.customerName || '-',
      'Email': item.customerEmail || '-',
      'Product': item.product || '-',
      'Status': item.leadStatus?.name || '-',
      'Reseller': item.assignedTo?.fullName || '-',
      'Amount': item.paymentAmount || 0,
      'Commission': item.commissionAmount || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads_Report");
    XLSX.writeFile(wb, `Leads_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns: Column<ReportLead>[] = [
    {
      key: 'createdAt',
      label: 'DATE',
      render: (value) => new Date(value).toLocaleDateString('en-IN'),
    },
    {
      key: 'customerName',
      label: 'CUSTOMER',
      render: (value, row) => (
        <div>
          <div className="font-semibold text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">{row.customerEmail}</div>
        </div>
      ),
    },
    {
      key: 'assignedTo',
      label: 'RESELLER',
      render: (value) => <span className="font-medium text-gray-700">{value?.fullName || '-'}</span>,
    },
    {
      key: 'leadStatus',
      label: 'STATUS',
      render: (value) => (
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
          {value?.name || '-'}
        </span>
      ),
    },
    {
      key: 'paymentAmount',
      label: 'AMOUNT',
      render: (value) => (
        <div className="flex items-center gap-1 font-semibold text-emerald-700">
          <IndianRupee className="h-3 w-3" />
          <span>{value.toLocaleString('en-IN')}</span>
        </div>
      ),
    },
    {
      key: 'commissionAmount',
      label: 'COMMISSION',
      render: (value) => (
        <div className="flex items-center gap-1 font-semibold text-blue-700">
          <IndianRupee className="h-3 w-3" />
          <span>{value.toLocaleString('en-IN')}</span>
        </div>
      ),
    },
  ];

  const filteredData = data.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.customerName?.toLowerCase().includes(query) ||
      item.customerEmail?.toLowerCase().includes(query) ||
      item.product?.toLowerCase().includes(query)
    );
  });

  if (!isMounted) return null;

  return (
    <>
      <Head>
        <title>Leads Report | Reseller Panel</title>
      </Head>

      <div className="bg-white rounded-lg min-h-screen">
        <div className="w-full mx-auto">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500 mt-1">
                View detailed leads information and performance metrics.
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-t-lg border-b border-gray-100 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-[150px]">
                <DatePicker
                  value={fromDate}
                  onChange={(val) => setFromDate(val)}
                  placeholder="Start Date"
                />
              </div>
              <span className="text-gray-400 font-medium">-</span>
              <div className="w-[150px]">
                <DatePicker
                  value={toDate}
                  onChange={(val) => setToDate(val)}
                  placeholder="End Date"
                />
              </div>
              <div className="w-[150px]">
                <FormSelect
                  value={paymentStatus}
                  onChange={setPaymentStatus}
                  options={[
                    { value: '', label: 'All Payments' },
                    { value: 'Paid', label: 'Paid' },
                    { value: 'Unpaid', label: 'Unpaid' },
                  ]}
                />
              </div>
              <div className="w-[150px]">
                <FormSelect
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: '', label: 'All Statuses' },
                    ...statuses.map(s => ({ value: s._id, label: s.name }))
                  ]}
                />
              </div>
              <button
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  setPaymentStatus('');
                  setStatus('');
                }}
                className="p-2 ml-1 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-500 hover:text-blue-500 transition-all rounded-md shadow-sm"
                title="Reset Filters"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

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
            data={filteredData}
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
