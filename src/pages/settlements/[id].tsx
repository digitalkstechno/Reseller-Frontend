import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { FiArrowLeft } from 'react-icons/fi';
import SettlementLeadsList from '@/components/leads/SettlementLeadsList';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';

export default function SettlementDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const resellerId = id as string;

  const [globalSelectedLeads, setGlobalSelectedLeads] = useState<any[]>([]);
  const [globalSettlementMethod, setGlobalSettlementMethod] = useState<string>('Bank Transfer');
  const [isSettlingLeads, setIsSettlingLeads] = useState(false);
  const [activeTab, setActiveTab] = useState<'unsettled' | 'settled'>('unsettled');

  useEffect(() => {
    if (globalSelectedLeads.length > 0) {
      const mode = globalSelectedLeads[0].paymentMode;
      if (mode && mode !== '-') {
        if (['Bank Transfer', 'UPI', 'GPay', 'Cash'].includes(mode)) {
          setGlobalSettlementMethod(mode);
        }
      }
    }
  }, [globalSelectedLeads]);

  const handleGlobalSettleLeads = async () => {
    if (globalSelectedLeads.length === 0) return;
    setIsSettlingLeads(true);
    try {
      const leadIds = globalSelectedLeads.map((l: any) => l.id);
      await axios.post(
        baseUrl.settleLeads,
        { 
          leadIds,
          paymentMethod: globalSettlementMethod
        },
        { headers: { Authorization: `Bearer ${getAuthToken()}` } }
      );
      toast.success('Leads settled successfully!');
      setGlobalSelectedLeads([]);
      setActiveTab('settled');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to settle leads');
    } finally {
      setIsSettlingLeads(false);
    }
  };

  if (!router.isReady || !resellerId) return null;

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Head>
        <title>Paid Leads | Reseller Panel</title>
      </Head>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/settlements')}
            className="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 cursor-pointer"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Paid Leads</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {globalSelectedLeads.length > 0 && (
            <select
              value={globalSettlementMethod}
              onChange={(e) => setGlobalSettlementMethod(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none cursor-pointer outline-none transition-shadow"
            >
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="GPay">GPay</option>
              <option value="Cash">Cash</option>
            </select>
          )}
          <button
            onClick={handleGlobalSettleLeads}
            disabled={globalSelectedLeads.length === 0 || isSettlingLeads}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            {isSettlingLeads ? 'Processing...' : 'Settle Selected'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 min-h-0 flex flex-col">
        <SettlementLeadsList
          resellerId={resellerId}
          onSuccess={() => {}}
          selectedLeads={globalSelectedLeads}
          onSelectionChange={setGlobalSelectedLeads}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </div>
    </div>
  );
}
