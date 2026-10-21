export type ContactStatus = 
  | 'Pendente' 
  | 'Mensagem preparada' 
  | 'Direct confirmado pelo operador' 
  | 'Resposta pública pendente' 
  | 'Concluído' 
  | 'Cancelado';

export interface Campaign {
  id: number;
  name: string;
  post_url: string;
  group_link: string;
  private_message: string;
  public_reply: string;
  keywords?: string;
  status: 'ativo' | 'pausado';
  created_at: string;
  updated_at: string;
  total_contacts?: number;
  completed_contacts?: number;
  pending_contacts?: number;
}

export interface MessageTemplate {
  id: number;
  campaign_id?: number | null;
  title: string;
  private_message: string;
  public_reply: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface ContactRecord {
  id: number;
  campaign_id: number;
  campaign_name?: string;
  group_link?: string;
  post_url?: string;
  comment_id?: string;
  username: string;
  internal_id?: string;
  status: ContactStatus;
  private_message_sent: number;
  public_reply_sent: number;
  prepared_at?: string | null;
  direct_confirmed_at?: string | null;
  public_replied_at?: string | null;
  completed_at?: string | null;
  canceled_at?: string | null;
  cancel_reason?: string | null;
  notes?: string | null;
  tags?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InteractionHistory {
  id: number;
  contact_record_id?: number | null;
  campaign_id?: number | null;
  campaign_name?: string;
  username?: string;
  action_type: string;
  description: string;
  previous_status?: string | null;
  new_status?: string | null;
  created_at: string;
}

export interface DashboardMetrics {
  totalCampaigns: number;
  activeCampaigns: number;
  uniqueLinks: number;
  totalContacts: number;
  preparedMessages: number;
  confirmedDMs: number;
  pendingPublicReplies: number;
  completedContacts: number;
  canceledContacts: number;
  avgResponseSeconds?: number;
  conversionRate?: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recentActivity: InteractionHistory[];
  campaignsSummary: Array<{
    id: number;
    name: string;
    status: 'ativo' | 'pausado';
    group_link: string;
    created_at: string;
    total_contacts: number;
    completed_count: number;
    sent_dms_count: number;
    pending_count: number;
  }>;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  operator_name: string;
  enable_keyboard_shortcuts: string;
  sound_feedback: string;
  safety_alert_dismissed: string;
  [key: string]: string;
}
