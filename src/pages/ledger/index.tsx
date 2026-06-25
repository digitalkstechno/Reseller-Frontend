import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import axios from 'axios';
import { toast } from 'react-toastify';
import { baseUrl, getAuthToken } from '@/config';
import DataTable, { Column } from '@/components/DataTable';
import * as XLSX from 'xlsx';

// Define the transaction interface based on the SettlementTransaction model
interface SettlementTransaction {
  _id: string;
  reseller: { _id: string; fullName: string; email: string };
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceId: string;
  status: string;
  note: string;
  leads: any[];
  createdAt: string;
}

export default function LedgerPage() {
  const [transactions, setTransactions] = useState<SettlementTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedReseller, setSelectedReseller] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      if (!token) return;

      const userRes = await axios.get(baseUrl.currentStaff, { headers: { Authorization: `Bearer ${token}` } });
      const role = userRes.data?.data?.role?.roleName?.toLowerCase() || '';
      const userId = userRes.data?.data?._id;

      const reqId = role === 'admin' ? 'all' : userId;
      const res = await axios.get(`${baseUrl.getBaseUrl}settlement/history/${reqId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      let data = res.data.data || [];
      
      // Apply filters manually if the API doesn't support them
      if (selectedMonth && selectedYear) {
        data = data.filter((tx: any) => {
          const date = new Date(tx.createdAt);
          return date.getMonth() + 1 === parseInt(selectedMonth) && date.getFullYear() === parseInt(selectedYear);
        });
      }
      
      setTransactions(data);
    } catch (error) {
      console.error("Error fetching ledger:", error);
      toast.error("Failed to load ledger data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedMonth, selectedYear]);

  const handleExport = () => {
    const exportData = transactions.map(tx => ({
      'Date': new Date(tx.createdAt).toLocaleDateString(),
      'Reseller': tx.reseller?.fullName || '-',
      'Amount': tx.amount,
      'Method': tx.paymentMethod,
      'Reference ID': tx.referenceId || '-',
      'Status': tx.status,
      'Note': tx.note || '-',
      'Leads Settled': tx.leads?.length || 0
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger");
    XLSX.writeFile(wb, `Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns: Column<SettlementTransaction>[] = [
    {
      key: 'createdAt',
      label: 'Date',
      render: (v) => new Date(v).toLocaleDateString()
    },
    {
      key: 'reseller',
      label: 'Reseller Name',
      render: (v) => v?.fullName || '-'
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (v) => <span className="font-bold text-emerald-600">₹{v?.toLocaleString('en-IN') || 0}</span>
    },
    {
      key: 'paymentMethod',
      label: 'Payment Method',
    },
    {
      key: 'referenceId',
      label: 'Ref ID',
      render: (v) => v || '-'
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold
          ${v === 'Completed' ? 'bg-green-100 text-green-800' : 
            v === 'Failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}
        >
          {v}
        </span>
      )
    },
    {
      key: 'note',
      label: 'Note',
      render: (v) => v || '-'
    }
  ];

  const filteredTransactions = transactions.filter((tx) => {
    // Search Query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = tx.reseller?.fullName?.toLowerCase().includes(query) ||
        tx.paymentMethod?.toLowerCase().includes(query) ||
        tx.referenceId?.toLowerCase().includes(query) ||
        tx.status?.toLowerCase().includes(query) ||
        tx.note?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Reseller Filter
    if (selectedReseller && tx.reseller?._id !== selectedReseller) return false;

    // Payment Method Filter
    if (selectedMethod && tx.paymentMethod !== selectedMethod) return false;

    // Date Filter
    if (selectedDate) {
      const txDate = new Date(tx.createdAt).toISOString().split('T')[0];
      if (txDate !== selectedDate) return false;
    }

    return true;
  });

  const uniqueResellers = Array.from(
    new Map(transactions.filter(t => t.reseller).map(t => [t.reseller._id, t.reseller])).values()
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <Head>
        <title>Ledger | Reseller Panel</title>
      </Head>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Ledger</h1>
          <p className="text-sm text-gray-500 mt-1">View and download your settlement transactions.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="">All Months</option>
            <option value="1">January</option>
            <option value="2">February</option>
            <option value="3">March</option>
            <option value="4">April</option>
            <option value="5">May</option>
            <option value="6">June</option>
            <option value="7">July</option>
            <option value="8">August</option>
            <option value="9">September</option>
            <option value="10">October</option>
            <option value="11">November</option>
            <option value="12">December</option>
          </select>

          <select 
            value={selectedYear} 
            onChange={e => setSelectedYear(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>

          <select
            value={selectedReseller}
            onChange={e => setSelectedReseller(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="">All Resellers</option>
            {uniqueResellers.map((r: any) => (
              <option key={r._id} value={r._id}>{r.fullName}</option>
            ))}
          </select>

          <select
            value={selectedMethod}
            onChange={e => setSelectedMethod(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="">All Methods</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="UPI">UPI</option>
            <option value="Cash">Cash</option>
          </select>

          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <DataTable
        data={filteredTransactions}
        columns={columns}
        loading={loading}
        onRefresh={fetchTransactions}
        onExport={handleExport}
        searchable={true}
        onSearch={(val) => setSearchQuery(val)}
        title="Transactions"
      />
    </div>
  );
}
