import { useState, useEffect } from "react";
import {
  FiSearch,
  FiPhone,
  FiMail,
  FiEye,
  FiEdit,
} from "react-icons/fi";
import axios from "axios";
import toast from "react-hot-toast";
import { useRouter } from "next/router";
import { baseUrl, getAuthToken } from "@/config";
import Dialog from "@/components/Dialog";
import { ListCollapse, Plus } from "lucide-react";
import Select from "react-select";

type ApiUser = {
  _id: string;
  fullName: string;
  email: string;
  avatar?: string;
};

type ApiSource = {
  _id: string;
  name: string;
};

type ApiStatus = {
  _id: string;
  name: string;
};



type ApiLead = {
  _id: string;
  fullName: string;
  customerName?: string;
  companyName?: string;
  address?: string;
  contact: string;
  customerContact?: string;
  email: string;
  customerEmail?: string;
  leadSource?: ApiSource;
  product?: string;
  paymentAmount?: number | string;

  leadStatus?: ApiStatus;
  assignedTo?: ApiUser;
  isActive?: boolean;
  attachments?: { name: string; url?: string }[];
  isLost?: boolean;
  isWon?: boolean;
  amount?: number;
  lostReason?: string;
  lostDate?: string;
  wonDate?: string;

};

type StatusGroup = {
  id: string;
  title: string;
  leads: ApiLead[];
};

type AddLeadForm = {
  name: string;
  companyName?: string;
  address?: string;
  phone: string;
  email: string;
  product?: string;
  paymentAmount?: string;
  status: string;
  staff: string;
  isActive?: boolean;
};

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<ApiLead[]>([]);
  const [sources, setSources] = useState<ApiSource[]>([]);
  const [statuses, setStatuses] = useState<ApiStatus[]>([]);
  const [staffMembers, setStaffMembers] = useState<ApiUser[]>([]);

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "board" | "lost" | "won">("board");
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingLead, setEditingLead] = useState<ApiLead | null>(null);
  const [viewLead, setViewLead] = useState<ApiLead | null>(null);
  const [addingLead, setAddingLead] = useState(false);
  const [lostSearch, setLostSearch] = useState("");
  const [wonSearch, setWonSearch] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [visibleStatusNames, setVisibleStatusNames] = useState<string[] | null>(null);
  const [pageMap, setPageMap] = useState<Record<string, number>>({});
  const [hasMoreMap, setHasMoreMap] = useState<Record<string, boolean>>({});
  const [loadingMoreMap, setLoadingMoreMap] = useState<Record<string, boolean>>({});
  const [lostLeadsList, setLostLeadsList] = useState<ApiLead[]>([]);
  const [wonLeadsList, setWonLeadsList] = useState<ApiLead[]>([]);
  const [loadingLost, setLoadingLost] = useState(false);
  const [loadingWon, setLoadingWon] = useState(false);

  const [addForm, setAddForm] = useState<AddLeadForm>({
    name: "",
    companyName: "",
    address: "",
    phone: "",
    email: "",
    product: "",
    paymentAmount: "",
    status: "",
    staff: "",
    isActive: true,
  });

  // View dialog edit states
  const [editingNextFollowupTime, setEditingNextFollowupTime] = useState("");
  const [requiredFields, setRequiredFields] = useState<string[]>([]);

  useEffect(() => {
    const loadRequiredFields = () => {
      const saved = localStorage.getItem('leadRequiredFields');
      if (saved) {
        try {
          setRequiredFields(JSON.parse(saved));
        } catch (e) {
          setRequiredFields(['fullName', 'contact', 'email', 'leadSource', 'leadStatus', 'assignedTo']);
        }
      } else {
        setRequiredFields(['fullName', 'contact', 'email', 'leadSource', 'leadStatus', 'assignedTo']);
      }
    };

    loadRequiredFields();
    window.addEventListener('fieldSettingsUpdated', loadRequiredFields);
    return () => window.removeEventListener('fieldSettingsUpdated', loadRequiredFields);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("kanbanVisibleStatusNames");
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

  const fetchLeads = async () => {
    try {
      const token = getAuthToken();
      // Use kanban endpoint for initial organized data
      const kanbanUrl = baseUrl.getAllLeads.replace(/\/?$/, '') + '/kanban';
      const kanbanRes = await axios.get(kanbanUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const kanbanData = kanbanRes.data?.data || [];
      const initialLeads: ApiLead[] = kanbanData.flatMap((g: any) => g.leads || []);
      setLeads(initialLeads);

      const initPages: Record<string, number> = {};
      const initHasMore: Record<string, boolean> = {};
      kanbanData.forEach((g: any) => {
        initPages[g.statusId] = 1;
        initHasMore[g.statusId] = g.leads?.length === 10;
      });
      setPageMap(initPages);
      setHasMoreMap(initHasMore);
    } catch (error) {
      console.error("Failed to fetch leads", error);
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  const loadMoreLeads = async (statusId: string) => {
    if (loadingMoreMap[statusId] || !hasMoreMap[statusId]) return;
    setLoadingMoreMap(prev => ({ ...prev, [statusId]: true }));
    try {
      const token = getAuthToken();
      const nextPage = (pageMap[statusId] || 1) + 1;
      const res = await axios.get(`${baseUrl.getAllLeads}?status=${statusId}&page=${nextPage}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data?.data || [];
      if (data.length > 0) {
        setLeads(prev => {
          const existingIds = new Set(prev.map(l => l._id));
          const newUnique = data.filter((l: ApiLead) => !existingIds.has(l._id));
          return [...prev, ...newUnique];
        });
        setPageMap(prev => ({ ...prev, [statusId]: nextPage }));
        setHasMoreMap(prev => ({ ...prev, [statusId]: data.length === 10 }));
      } else {
        setHasMoreMap(prev => ({ ...prev, [statusId]: false }));
      }
    } catch (error) {
      console.error("Failed to load more leads", error);
    } finally {
      setLoadingMoreMap(prev => ({ ...prev, [statusId]: false }));
    }
  };

  const fetchLostLeads = async () => {
    setLoadingLost(true);
    try {
      const token = getAuthToken();
      const res = await axios.get(baseUrl.getLostLeads, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLostLeadsList(res.data?.data || []);
    } catch (error) {
      console.error("Failed to fetch lost leads", error);
      setLostLeadsList([]);
    } finally {
      setLoadingLost(false);
    }
  };

  const fetchWonLeads = async () => {
    setLoadingWon(true);
    try {
      const token = getAuthToken();
      const res = await axios.get(baseUrl.getWonLeads, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWonLeadsList(res.data?.data || []);
    } catch (error) {
      console.error("Failed to fetch won leads", error);
      setWonLeadsList([]);
    } finally {
      setLoadingWon(false);
    }
  };

  const fetchSources = async () => {
    try {
      const token = getAuthToken();
      const res = await axios.get(baseUrl.leadSources, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data?.data ?? res.data;
      setSources(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch sources", error);
    }
  };



  const fetchStatuses = async () => {
    try {
      const token = getAuthToken();
      const res = await axios.get(baseUrl.leadStatuses, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data?.data ?? res.data;
      setStatuses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch statuses", error);
    }
  };

  const fetchStaff = async () => {
    try {
      const token = getAuthToken();
      const res = await axios.get(baseUrl.getAllStaff, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data?.data ?? res.data;
      setStaffMembers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch staff", error);
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchSources();
    fetchStatuses();
    fetchStaff();
    fetchLostLeads();
    fetchWonLeads();

  }, []);

  const handleSaveLead = async () => {
    // Dynamic validation based on settings
    const missingFields: string[] = [];
    if (requiredFields.includes('fullName') && !addForm.name) missingFields.push('Full Name');
    if (requiredFields.includes('companyName') && !addForm.companyName) missingFields.push('Company Name');
    if (requiredFields.includes('address') && !addForm.address) missingFields.push('Address');
    if (requiredFields.includes('contact') && !addForm.phone) missingFields.push('Phone');
    if (requiredFields.includes('email') && !addForm.email) missingFields.push('Email');
    if (requiredFields.includes('leadStatus') && !addForm.status && !editingLead) missingFields.push('Status');
    if (requiredFields.includes('assignedTo') && !addForm.staff) missingFields.push('Assigned Staff');


    if (missingFields.length > 0) {
      toast.error(`Required fields missing: ${missingFields.join(', ')}`);
      return;
    }

    setAddingLead(true);
    try {
      const token = getAuthToken();
      const payload = {
        customerName: addForm.name.trim(),
        companyName: addForm.companyName?.trim() || "",
        address: addForm.address?.trim() || "",
        customerContact: addForm.phone.trim(),
        customerEmail: addForm.email.trim().toLowerCase(),
        product: addForm.product?.trim() || "",
        paymentAmount: Number(addForm.paymentAmount) || 0,
        leadStatus: addForm.status,
        assignedTo: addForm.staff,
        isActive: addForm.isActive ?? true,
      };

      if (editingLead) {
        // Edit mode - don't include status and next follow-up date
        const { leadStatus, ...editPayload } = payload;
        await axios.put(`${baseUrl.updateLead}/${editingLead._id}`, editPayload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Lead updated successfully");
      } else {
        // Add mode
        await axios.post(baseUrl.addLead, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Lead added successfully");
      }

      setShowAddDialog(false);
      setEditingLead(null);
      resetForm();

      // Refresh all lead lists
      fetchLeads();
      fetchLostLeads();
      fetchWonLeads();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to save lead");
    } finally {
      setAddingLead(false);
    }
  };

  const resetForm = () => {
    setAddForm({
      name: "",
      companyName: "",
      address: "",
      phone: "",
      email: "",
      product: "",
      paymentAmount: "",
      status: "",
      staff: "",
      isActive: true,
    });
  };

  const handleEdit = (id: string) => {
    // Check in all lead lists
    const lead = leads.find((l) => l._id === id) ||
      lostLeadsList.find((l) => l._id === id) ||
      wonLeadsList.find((l) => l._id === id);

    if (!lead) return;



    setEditingLead(lead);
    setAddForm({
      name: lead.customerName || lead.fullName || "",
      companyName: lead.companyName || "",
      address: lead.address || "",
      phone: lead.customerContact || lead.contact || "",
      email: lead.customerEmail || lead.email || "",
      product: lead.product || "",
      paymentAmount: lead.paymentAmount ? String(lead.paymentAmount) : "",
      status: lead.leadStatus?._id || "",
      staff: lead.assignedTo?._id || "",
      isActive: lead.isActive ?? true,
    });
    setShowAddDialog(true);
  };

  const handleView = (id: string) => {
    // Check in all lead lists
    const lead = leads.find((l) => l._id === id) ||
      lostLeadsList.find((l) => l._id === id) ||
      wonLeadsList.find((l) => l._id === id);

    if (!lead) return;

    setViewLead(lead);
    // Initialize edit states with current values
  };



  const markLost = async (id: string) => {
    try {
      const token = getAuthToken();
      await axios.put(
        `${baseUrl.updateLead}/${id}`,
        { isLost: true, lostDate: new Date().toISOString() },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Lead marked as lost");
      fetchLeads();
      fetchLostLeads();
    } catch (error) {
      toast.error("Failed to update lead");
    }
  };

  const markWon = async (id: string) => {
    try {
      const token = getAuthToken();
      await axios.put(
        `${baseUrl.updateLead}/${id}`,
        { isWon: true, wonDate: new Date().toISOString() },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Lead marked as won");
      fetchLeads();
      fetchWonLeads();
    } catch (error) {
      toast.error("Failed to update lead");
    }
  };

  const reactivateLead = async (id: string) => {
    try {
      const token = getAuthToken();
      const qualifiedStatus = statuses.find(s => s.name.toLowerCase() === 'qualified');

      await axios.put(
        `${baseUrl.updateLead}/${id}`,
        {
          isLost: false,
          isWon: false,
          leadStatus: qualifiedStatus?._id || null
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Lead reactivated successfully");
      fetchLeads();
      fetchLostLeads();
      fetchWonLeads();
    } catch (error) {
      toast.error("Failed to reactivate lead");
    }
  };

  const handleDragStart = (leadId: string) => {
    setDraggingId(leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (statusId: string) => {
    if (!draggingId) return;

    const lead = leads.find((l) => l._id === draggingId);
    if (!lead) return;

    const status = statuses.find((s) => s._id === statusId);
    if (!status) return;

    const updateLeadStatus = async () => {
      try {
        const token = getAuthToken();
        await axios.put(
          `${baseUrl.updateLead}/${draggingId}`,
          { leadStatus: statusId },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success(`Lead moved to ${status.name}`);
        fetchLeads();
      } catch (error) {
        toast.error("Failed to update lead status");
      }
    };

    updateLeadStatus();
    setDraggingId(null);
  };

  const filteredLeads = leads.filter(
    (lead) =>
      !lead.isLost &&
      !lead.isWon &&
      ((lead.customerName || lead.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
        lead.companyName?.toLowerCase().includes(search.toLowerCase()) ||
        (lead.customerEmail || lead.email || '').toLowerCase().includes(search.toLowerCase())),
  );

  const lostLeads = lostLeadsList.filter(
    (lead) =>
      (lead.customerName || lead.fullName || '').toLowerCase().includes(lostSearch.toLowerCase()) ||
      lead.companyName?.toLowerCase().includes(lostSearch.toLowerCase())
  );

  const wonLeads = wonLeadsList.filter(
    (lead) =>
      (lead.customerName || lead.fullName || '').toLowerCase().includes(wonSearch.toLowerCase()) ||
      lead.companyName?.toLowerCase().includes(wonSearch.toLowerCase())
  );

  const statusGroups: StatusGroup[] = statuses.map((status) => ({
    id: status._id,
    title: status.name,
    leads: filteredLeads.filter((lead) => lead.leadStatus?._id === status._id),
  }));

  if (loading) {
    return (
      <>
        <div className="flex h-full items-center justify-center">
          <div className="text-xl text-gray-600">Loading leads...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Header */}

        <div className="flex flex-wrap items-center gap-3 p-4 mb-2 rounded-3xl border border-gray-200 bg-white shadow-sm">

          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-sm text-gray-600">Manage your leads pipeline</p>
          </div>

          <button
            className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-lg bg-secondary hover:bg-blue-700 text-white text-sm font-semibold shadow"
            onClick={() => {
              setEditingLead(null);
              resetForm();
              setShowAddDialog(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </button>

          <button
            onClick={() => router.push('/leads')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition text-sm"
          >
            <ListCollapse className="w-4 h-4 text-gray-700" />
            List
          </button>
        </div>

        {/* View Toggle and Filters */}
        <div className="flex items-center justify-between px-6 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("board")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === "board"
                ? "bg-secondary text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              Board View
            </button>
            <button
              onClick={() => setView("lost")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === "lost"
                ? "bg-red-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              Lost Leads
            </button>
            <button
              onClick={() => setView("won")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === "won"
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              Won Leads
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input pl-10"
              />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto px-4 pb-2">

          {/* Board View */}
          {view === "board" && (
            <div className=" overflow-x-auto">
              <div className="flex gap-4 h-[calc(100vh-288px)] w-100">
                {statusGroups.filter(
                  (status) =>
                    !visibleStatusNames ||
                    visibleStatusNames.includes(status.title),
                ).map((status: any) => (
                  <div
                    key={status.id}
                    className="w-80 flex-shrink-0"
                  >
                    {/* Column Header */}
                    <div className="bg-secondary rounded-t-xl px-6 py-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white capitalize">
                          {status.title}
                        </h3>
                        <span className="rounded-full bg-[#ffffff] px-3 py-1 text-sm font-medium text-[#0a2352]">
                          {status.leads.length}
                        </span>
                      </div>
                    </div>

                    {/* Column Content */}
                    <div
                      className={`flex-1 h-[calc(100vh-385px)] overflow-y-auto rounded-b-lg bg-[#f4f7fb] p-4 ${draggingId ? "" : ""
                        }`}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(status.id)}
                      onScroll={(e) => {
                        const target = e.target as HTMLDivElement;
                        // Trigger when within 20px from the bottom
                        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 20) {
                          loadMoreLeads(status.id);
                        }
                      }}
                    >
                      {status.leads.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-gray-500">
                          No leads
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {status.leads.map((lead: any) => (
                            <div
                              key={lead._id}
                              className="cursor-move rounded-lg bg-[#ffffff] p-3 transition-shadow hover:shadow-md"
                              draggable
                              onDragStart={() => handleDragStart(lead._id)}
                            >
                              {/* Lead Card Header */}
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="font-semibold text-gray-900">
                                    {lead.fullName}
                                  </div>
                                  <div className="mt-1 text-sm text-gray-600">
                                    {lead.companyName || "-"}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleView(lead._id)}
                                    className="h-8 w-8 rounded-full bg-[#007bff] text-[#ffffff] flex items-center justify-center
             hover:-translate-y-1 hover:shadow-md 
             transition-transform transition-shadow duration-200 ease-out"
                                    title="View"
                                  >
                                    <FiEye className="h-4 w-4" />
                                  </button>

                                  <button
                                    onClick={() => handleEdit(lead._id)}
                                    className="h-8 w-8 rounded-full bg-[#008001] text-[#ffffff] flex items-center justify-center
             hover:-translate-y-1 hover:shadow-md 
             transition-transform transition-shadow duration-200 ease-out"
                                    title="Edit"
                                  >
                                    <FiEdit className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Lead Details */}
                              <div className="mt-2 text-sm text-gray-700">

                                <div className="flex items-start gap-2">

                                  {/* Left Content */}
                                  <div className="flex-1 min-w-0 space-y-2">

                                    <div className="flex items-center gap-2">
                                      <FiPhone className="h-4 w-4 text-dark flex-shrink-0" />
                                      <span className="truncate">{lead.contact}</span>
                                    </div>

                                    <div className="flex items-center gap-2 min-w-0">
                                      <FiMail className="h-4 w-4 text-dark flex-shrink-0" />
                                      <span className="truncate">
                                        {lead.email}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {lead.assignedTo?.avatar ? (
                                        <img
                                          src={lead.assignedTo.avatar}
                                          alt={lead.assignedTo.fullName}
                                          className="h-6 w-6 rounded-full object-cover"
                                        />
                                      ) : (
                                        <div className="h-6 w-6 rounded-full bg-gradient-to-r from-[#9160ff] to-[#c387ff] flex items-center justify-center text-xs font-semibold text-white">
                                          {lead.assignedTo?.fullName?.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="truncate">{lead.assignedTo?.fullName || "Unassigned"}</span>
                                    </div>
                                  </div>

                                  {/* Priority Right */}
                                  {lead.priority && (
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-600 capitalize whitespace-nowrap">
                                      {lead.priority}
                                    </span>
                                  )}
                                </div>
                              </div>


                            </div>
                          ))}
                        </div>
                      )}
                      {loadingMoreMap[status.id] && (
                        <div className="flex justify-center mt-3 p-2">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lost Leads Section */}
          {view === "lost" && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-red-200 text-red-700 flex items-center justify-center">
                    ×
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-red-800">
                      Lost Leads
                    </h2>
                    <p className="text-sm text-red-700">
                      Leads that were not converted
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-red-200 px-3 py-1 text-sm font-semibold text-red-800">
                  {lostLeads.length} Total
                </span>
              </div>
              <div className="mt-4 rounded-xl bg-white border border-red-100 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    Show
                    <select className="border rounded px-2 py-1">
                      <option>100</option>
                    </select>
                    entries
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">Search:</span>
                    <input
                      value={lostSearch}
                      onChange={(e) => setLostSearch(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="table-responsive overflow-x-auto">
                  <table className="min-w-[1000px] w-full whitespace-nowrap">
                    <thead>
                      <tr className="bg-[#dee2e6] text-black text-xs font-bold">
                        <th className="px-4 py-3 text-left">Lead Name</th>
                        <th className="px-4 py-3 text-left">Company</th>
                        <th className="px-4 py-3 text-left">Location</th>
                        <th className="px-4 py-3 text-left">Contact</th>
                        <th className="px-4 py-3 text-left">Lost Date</th>
                        <th className="px-4 py-3 text-left">Assigned To</th>
                        <th className="px-4 py-3 text-left">Reason</th>
                        <th className="sticky right-0 z-10 bg-[#dee2e6] px-4 py-3 text-left shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.1)]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {lostLeads.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-6 py-12 text-center text-gray-600"
                          >
                            No data available in table
                          </td>
                        </tr>
                      ) : (
                        lostLeads.map((l) => (
                          <tr key={l._id} className="border-b">
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-900">
                                  {l.fullName}
                                </span>
                                <span className="text-xs text-red-600">• Lost</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">{l.companyName}</td>
                            <td className="px-4 py-3">{l.address}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1 text-sm text-gray-700">
                                <div className="flex items-center gap-2">
                                  <FiPhone className="h-4 w-4 text-gray-500" />
                                  {l.contact}
                                </div>
                                <div className="flex items-center gap-2">
                                  <FiMail className="h-4 w-4 text-gray-500" />
                                  {l.email}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {l.lostDate ? new Date(l.lostDate).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-4 py-3">{l.assignedTo?.fullName || '-'}</td>
                            <td className="px-4 py-3">{l.lostReason || 'Not specified'}</td>
                            <td className="sticky right-0 z-10 bg-white px-4 py-3 shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.1)]">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleView(l._id)}
                                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => handleEdit(l._id)}
                                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => reactivateLead(l._id)}
                                  className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
                                >
                                  Reactivate
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Won Leads Section */}
          {view === "won" && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-green-200 text-green-700 flex items-center justify-center">
                    ✓
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-green-800">
                      Won Leads
                    </h2>
                    <p className="text-sm text-green-700">
                      Leads that were converted
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-green-200 px-3 py-1 text-sm font-semibold text-green-800">
                  {wonLeads.length} Total
                </span>
              </div>
              <div className="mt-4 rounded-xl bg-white border border-green-100 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    Show
                    <select className="border rounded px-2 py-1">
                      <option>100</option>
                    </select>
                    entries
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">Search:</span>
                    <input
                      value={wonSearch}
                      onChange={(e) => setWonSearch(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="table-responsive overflow-x-auto">
                  <table className="min-w-[1000px] w-full whitespace-nowrap">
                    <thead>
                      <tr className="bg-[#dee2e6] text-black text-xs font-bold">
                        <th className="px-4 py-3 text-left">Lead Name</th>
                        <th className="px-4 py-3 text-left">Company</th>
                        <th className="px-4 py-3 text-left">Location</th>
                        <th className="px-4 py-3 text-left">Contact</th>
                        <th className="px-4 py-3 text-left">Won Date</th>
                        <th className="px-4 py-3 text-left">Assigned To</th>
                        <th className="px-4 py-3 text-left">Amount</th>
                        <th className="sticky right-0 z-10 bg-[#dee2e6] px-4 py-3 text-left shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.1)]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {wonLeads.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-6 py-12 text-center text-gray-600"
                          >
                            No data available in table
                          </td>
                        </tr>
                      ) : (
                        wonLeads.map((l) => (
                          <tr key={l._id} className="border-b">
                            <td className="px-4 py-3">
                              <span className="font-semibold text-gray-900">
                                {l.fullName}
                              </span>
                            </td>
                            <td className="px-4 py-3">{l.companyName}</td>
                            <td className="px-4 py-3">{l.address}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1 text-sm text-gray-700">
                                <div className="flex items-center gap-2">
                                  <FiPhone className="h-4 w-4 text-gray-500" />
                                  {l.contact}
                                </div>
                                <div className="flex items-center gap-2">
                                  <FiMail className="h-4 w-4 text-gray-500" />
                                  {l.email}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {l.wonDate ? new Date(l.wonDate).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-4 py-3">{l.assignedTo?.fullName || '-'}</td>
                            <td className="px-4 py-3">
                              {l.amount ? `₹${l.amount.toLocaleString()}` : "-"}
                            </td>
                            <td className="sticky right-0 z-10 bg-white px-4 py-3 shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.1)]">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleView(l._id)}
                                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => handleEdit(l._id)}
                                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Add/Edit Lead Dialog */}
        <Dialog
          isOpen={showAddDialog}
          onClose={() => {
            setShowAddDialog(false);
            setEditingLead(null);
            resetForm();
          }}
          title={editingLead ? "Edit Lead" : "Add Lead"}
          footer={
            <>
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setEditingLead(null);
                  resetForm();
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLead}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={addingLead}
              >
                {addingLead ? "Saving..." : editingLead ? "Update Lead" : "Save Lead"}
              </button>
            </>
          }
        >
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Full Name {requiredFields.includes('fullName') && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={addForm.name}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, name: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Company Name {requiredFields.includes('companyName') && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={addForm.companyName ?? ""}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, companyName: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Address {requiredFields.includes('address') && <span className="text-red-500">*</span>}
              </label>
              <textarea
                rows={3}
                value={addForm.address ?? ""}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, address: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Phone {requiredFields.includes('contact') && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={addForm.phone}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, phone: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Email {requiredFields.includes('email') && <span className="text-red-500">*</span>}
              </label>
              <input
                type="email"
                value={addForm.email}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, email: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Product Name
                </label>
                <input
                  type="text"
                  value={addForm.product ?? ""}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, product: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Payment Amount
                </label>
                <input
                  type="number"
                  value={addForm.paymentAmount ?? ""}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, paymentAmount: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Status field only shown in add mode */}
              {!editingLead && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Status {requiredFields.includes('leadStatus') && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={addForm.status}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    onChange={(e) =>
                      setAddForm((p) => ({ ...p, status: e.target.value }))
                    }
                  >
                    <option value="">Select Status</option>
                    {statuses.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Assigned Staff {requiredFields.includes('assignedTo') && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={addForm.staff}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, staff: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Staff</option>
                  {staffMembers.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={addForm.isActive ?? true}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, isActive: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="isActive"
                className="text-sm font-medium text-slate-700"
              >
                Active
              </label>
            </div>
          </form>
        </Dialog>

        {/* View Lead Dialog with Edit Capabilities */}
        <Dialog
          isOpen={!!viewLead}
          onClose={() => setViewLead(null)}
          title="Lead Details"
          footer={
            <>
              <button
                onClick={() => setViewLead(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </>
          }
        >
          {viewLead && (
            <div className="space-y-4">
              <div className="font-semibold text-xl">{viewLead.customerName || viewLead.fullName}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Company</div>
                  <div>{viewLead.companyName || "-"}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Phone</div>
                  <div>{viewLead.customerContact || viewLead.contact || "-"}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Email</div>
                  <div>{viewLead.customerEmail || viewLead.email || "-"}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Source</div>
                  <div>{viewLead.leadSource?.name || "-"}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg md:col-span-2">
                  <div className="text-sm text-gray-600">Status</div>
                  <div className="font-medium text-gray-900 mt-1">{viewLead.leadStatus?.name || "-"}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Product</div>
                  <div>{viewLead.product || "-"}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Payment Amount</div>
                  <div>{viewLead.paymentAmount || "-"}</div>
                </div>
              </div>
              {viewLead.attachments && viewLead.attachments.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Attachments</div>
                  <div className="space-y-2 mt-2">
                    {viewLead.attachments.map((attachment, index) => (
                      <a
                        key={index}
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline block"
                      >
                        {attachment.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {viewLead.isLost && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-sm text-red-600 font-medium">Lost Information</div>
                  <div className="mt-2 text-sm">
                    <div>Lost Date: {viewLead.lostDate ? new Date(viewLead.lostDate).toLocaleDateString() : 'N/A'}</div>
                    <div>Reason: {viewLead.lostReason || 'Not specified'}</div>
                  </div>
                </div>
              )}
              {viewLead.isWon && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-green-600 font-medium">Won Information</div>
                  <div className="mt-2 text-sm">
                    <div>Won Date: {viewLead.wonDate ? new Date(viewLead.wonDate).toLocaleDateString() : 'N/A'}</div>
                    <div>Amount: {viewLead.amount ? `₹${viewLead.amount.toLocaleString()}` : 'Not specified'}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Dialog>
      </div>
    </>
  );
}