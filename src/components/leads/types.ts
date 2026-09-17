// components/leads/types.ts
// Shared types used across all leads components

export type ApiUser = {
  _id: string;
  fullName: string;
  email: string;
  avatar?: string;
};


export type ApiStatus = {
  _id: string;
  name: string;
};

export type ApiSource = {
  _id: string;
  name: string;
};


export type ApiFollowUp = {
  _id?: string;
  date: string;
  time: string;
  note: string;
  staff: ApiUser;
  createdAt?: string;
};

export type ApiLead = {
  _id: string;
  fullName: string;
  customerName?: string;
  companyName?: string;
  contact: string;
  customerContact?: string;
  email: string;
  customerEmail?: string;
  managedBy?: string;
  project?: { _id: string; name: string } | string;
  projectAmount?: number;
  paymentAmount?: number | string;
  leadStatus?: ApiStatus;
  leadSource?: ApiSource;
  assignedTo?: ApiUser;
  priority?: 'High' | 'Medium' | 'Low' | 'high' | 'medium' | 'low';
  lastFollowUp?: string;
  nextFollowupDate?: string;
  nextFollowupTime?: string;
  note?: string;
  remarks?: string;
  description?: string;
  features?: string[];
  isActive?: boolean;
  followUps?: ApiFollowUp[];
  attachments?: {
    _id?: string;
    originalName?: string;
    name?: string;
    path: string;
    filename: string;
    size?: number;
  }[];
  isLost?: boolean;
  isWon?: boolean;
  amount?: number;
  lostReason?: string;
  lostDate?: string;
  wonDate?: string;
  amountDate?: string;
  paymentStatus?: string;
  paidAmount?: number;
  paymentDate?: any;
  paymentMode?: string;
  paymentProof?: string;
  payments?: {
    _id?: string;
    amount: number;
    paymentDate: string | Date;
    paymentMode: string;
    paymentProof?: string;
    note?: string;
    createdAt?: string | Date;
  }[];
  product?: string;
  city?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AddLeadForm = {
  name: string;
  companyName?: string;
  phone: string;
  email: string;
  paymentAmount?: string;
  status: string;
  staff: string;
  isActive?: boolean;
};

export type LeadCountSummary = {
  statusCounts: Record<string, number>;
  statusWiseCounts?: Record<string, number>;
  totalLeads: number;
  totalLost: number;
  totalWon: number;
};

export type SettlementTransactionHistory = {
  _id: string;
  reseller: string;
  amount: number;
  paymentMethod: string;
  referenceId?: string;
  status: string;
  note?: string;
  processedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
};
