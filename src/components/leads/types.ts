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
  address?: string;
  contact: string;
  customerContact?: string;
  email: string;
  customerEmail?: string;
  product?: string;
  paymentAmount?: number | string;
  leadStatus?: ApiStatus;
  assignedTo?: ApiUser;
  priority?: 'High' | 'Medium' | 'Low' | 'high' | 'medium' | 'low';
  lastFollowUp?: string;
  nextFollowupDate?: string;
  nextFollowupTime?: string;
  note?: string;
  remarks?: string;
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
};

export type AddLeadForm = {
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

export type LeadCountSummary = {
  statusCounts: Record<string, number>;
  totalLeads: number;
  totalLost: number;
  totalWon: number;
};
