import { Campaign, MessageTemplate, ContactRecord, InteractionHistory, DashboardData, AppSettings } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

const BASE_URL = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorMsg = `Erro na requisição (${res.status})`;
    try {
      const errData = await res.json();
      if (errData.error) errorMsg = errData.error;
    } catch {}
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  // ==========================================
  // 1. DASHBOARD
  // ==========================================
  getDashboard: async (): Promise<DashboardData> => {
    if (isSupabaseConfigured && supabase) {
      const [
        { count: totalCampaigns },
        { count: activeCampaigns },
        { count: totalContacts },
        { count: preparedMessages },
        { count: confirmedDMs },
        { count: pendingPublicReplies },
        { count: completedContacts },
        { count: canceledContacts },
        { data: recentActivity },
        { data: campaignsList },
        { data: allContacts }
      ] = await Promise.all([
        supabase.from('campaigns').select('*', { count: 'exact', head: true }),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
        supabase.from('contact_records').select('*', { count: 'exact', head: true }),
        supabase.from('contact_records').select('*', { count: 'exact', head: true }).eq('status', 'Mensagem preparada'),
        supabase.from('contact_records').select('*', { count: 'exact', head: true }).eq('private_message_sent', 1),
        supabase.from('contact_records').select('*', { count: 'exact', head: true }).in('status', ['Resposta pública pendente', 'Direct confirmado pelo operador']).eq('public_reply_sent', 0),
        supabase.from('contact_records').select('*', { count: 'exact', head: true }).eq('status', 'Concluído'),
        supabase.from('contact_records').select('*', { count: 'exact', head: true }).eq('status', 'Cancelado'),
        supabase.from('interaction_history').select('*').order('id', { ascending: false }).limit(15),
        supabase.from('campaigns').select('*').order('id', { ascending: false }).limit(10),
        supabase.from('contact_records').select('id, campaign_id, status, private_message_sent')
      ]);

      const totalCont = totalContacts || 0;
      const completedCont = completedContacts || 0;
      const conversionRate = totalCont > 0 ? Math.round((completedCont / totalCont) * 100) : 0;

      const campaignsSummary = (campaignsList || []).map((c: any) => {
        const campContacts = (allContacts || []).filter((cr: any) => cr.campaign_id === c.id);
        const comp = campContacts.filter((cr: any) => cr.status === 'Concluído').length;
        const sent = campContacts.filter((cr: any) => cr.private_message_sent === 1).length;
        const pend = campContacts.filter((cr: any) => ['Pendente', 'Mensagem preparada', 'Direct confirmado pelo operador'].includes(cr.status)).length;
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          group_link: c.group_link,
          created_at: c.created_at,
          total_contacts: campContacts.length,
          completed_count: comp,
          sent_dms_count: sent,
          pending_count: pend
        };
      });

      return {
        metrics: {
          totalCampaigns: totalCampaigns || 0,
          activeCampaigns: activeCampaigns || 0,
          uniqueLinks: totalCampaigns || 0,
          totalContacts: totalCont,
          preparedMessages: preparedMessages || 0,
          confirmedDMs: confirmedDMs || 0,
          pendingPublicReplies: pendingPublicReplies || 0,
          completedContacts: completedCont,
          canceledContacts: canceledContacts || 0,
          conversionRate,
          avgResponseSeconds: 15
        },
        recentActivity: (recentActivity as any) || [],
        campaignsSummary
      };
    }

    return fetchJson<DashboardData>('/dashboard');
  },

  // ==========================================
  // 2. CAMPANHAS
  // ==========================================
  getCampaigns: async (): Promise<Campaign[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('campaigns').select('*').order('id', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as Campaign[]) || [];
    }
    return fetchJson<Campaign[]>('/campaigns');
  },

  getCampaign: async (id: number): Promise<Campaign & { templates: MessageTemplate[] }> => {
    if (isSupabaseConfigured && supabase) {
      const { data: campaign, error } = await supabase.from('campaigns').select('*').eq('id', id).single();
      if (error) throw new Error(error.message);
      const { data: templates } = await supabase.from('message_templates').select('*').eq('campaign_id', id);
      return { ...(campaign as Campaign), templates: (templates as MessageTemplate[]) || [] };
    }
    return fetchJson<Campaign & { templates: MessageTemplate[] }>(`/campaigns/${id}`);
  },

  createCampaign: async (data: Partial<Campaign>): Promise<Campaign> => {
    if (isSupabaseConfigured && supabase) {
      const now = new Date().toISOString();
      const { data: created, error } = await supabase.from('campaigns').insert([{
        name: data.name,
        post_url: data.post_url,
        group_link: data.group_link,
        private_message: data.private_message,
        public_reply: data.public_reply,
        keywords: data.keywords || 'todos os comentários',
        status: data.status || 'ativo',
        created_at: now,
        updated_at: now
      }]).select().single();

      if (error) throw new Error(error.message);

      await supabase.from('interaction_history').insert([{
        campaign_id: created.id,
        action_type: 'CAMPANHA_CRIADA',
        description: `Campanha "${created.name}" criada na nuvem.`,
        created_at: now
      }]);

      return created as Campaign;
    }
    return fetchJson<Campaign>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateCampaign: async (id: number, data: Partial<Campaign>): Promise<Campaign> => {
    if (isSupabaseConfigured && supabase) {
      const now = new Date().toISOString();
      const { data: updated, error } = await supabase.from('campaigns').update({
        ...data,
        updated_at: now
      }).eq('id', id).select().single();

      if (error) throw new Error(error.message);
      return updated as Campaign;
    }
    return fetchJson<Campaign>(`/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  duplicateCampaign: async (id: number): Promise<Campaign> => {
    if (isSupabaseConfigured && supabase) {
      const { data: source } = await supabase.from('campaigns').select('*').eq('id', id).single();
      if (!source) throw new Error('Campanha não encontrada');

      const now = new Date().toISOString();
      const { data: created, error } = await supabase.from('campaigns').insert([{
        name: `${source.name} (Cópia)`,
        post_url: source.post_url,
        group_link: source.group_link,
        private_message: source.private_message,
        public_reply: source.public_reply,
        keywords: source.keywords,
        status: 'ativo',
        created_at: now,
        updated_at: now
      }]).select().single();

      if (error) throw new Error(error.message);
      return created as Campaign;
    }
    return fetchJson<Campaign>(`/campaigns/${id}/duplicate`, { method: 'POST' });
  },

  toggleCampaignStatus: async (id: number, status: 'ativo' | 'pausado'): Promise<{ success: boolean; status: string }> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('campaigns').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true, status };
    }
    return fetchJson<{ success: boolean; status: string }>(`/campaigns/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  deleteCampaign: async (id: number): Promise<{ success: boolean; message: string }> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true, message: 'Campanha excluída com sucesso' };
    }
    return fetchJson<{ success: boolean; message: string }>(`/campaigns/${id}`, { method: 'DELETE' });
  },

  // ==========================================
  // 3. MODELOS DE MENSAGEM
  // ==========================================
  getTemplates: (campaignId?: number) => fetchJson<MessageTemplate[]>(`/templates${campaignId ? `?campaign_id=${campaignId}` : ''}`),
  createTemplate: (data: Partial<MessageTemplate>) => fetchJson<MessageTemplate>('/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateTemplate: (id: number, data: Partial<MessageTemplate>) => fetchJson<MessageTemplate>(`/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteTemplate: (id: number) => fetchJson<{ success: boolean }>(`/templates/${id}`, {
    method: 'DELETE',
  }),

  // ==========================================
  // 4. ATENDIMENTOS (CONTACT RECORDS)
  // ==========================================
  getContacts: async (params?: { campaign_id?: string | number; status?: string; search?: string; limit?: number }): Promise<ContactRecord[]> => {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('contact_records').select('*, campaigns(name, group_link, post_url)').order('id', { ascending: false });

      if (params?.campaign_id && params.campaign_id !== 'all') {
        query = query.eq('campaign_id', params.campaign_id);
      }
      if (params?.status && params.status !== 'all') {
        query = query.eq('status', params.status);
      }
      if (params?.search) {
        query = query.ilike('username', `%${params.search}%`);
      }
      if (params?.limit) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return (data || []).map((r: any) => ({
        ...r,
        campaign_name: r.campaigns?.name,
        group_link: r.campaigns?.group_link,
        post_url: r.campaigns?.post_url
      })) as ContactRecord[];
    }

    const query = new URLSearchParams();
    if (params?.campaign_id) query.append('campaign_id', String(params.campaign_id));
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.limit) query.append('limit', String(params.limit));
    return fetchJson<ContactRecord[]>(`/contacts?${query.toString()}`);
  },

  createContact: async (data: { campaign_id: number; username: string; internal_id?: string; comment_id?: string; notes?: string; tags?: string }): Promise<ContactRecord> => {
    if (isSupabaseConfigured && supabase) {
      const cleanUsername = data.username.trim().replace(/^@/, '');
      const now = new Date().toISOString();
      const { data: created, error } = await supabase.from('contact_records').insert([{
        campaign_id: data.campaign_id,
        username: cleanUsername,
        internal_id: data.internal_id || '',
        comment_id: data.comment_id || '',
        notes: data.notes || '',
        tags: data.tags || '',
        status: 'Pendente',
        private_message_sent: 0,
        public_reply_sent: 0,
        created_at: now,
        updated_at: now
      }]).select().single();

      if (error) throw new Error(error.message);

      await supabase.from('interaction_history').insert([{
        contact_record_id: created.id,
        campaign_id: data.campaign_id,
        action_type: 'REGISTRADO',
        description: `Atendimento para @${cleanUsername} registrado na fila.`,
        created_at: now
      }]);

      return created as ContactRecord;
    }

    return fetchJson<ContactRecord>('/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createContactsBatch: async (data: { campaign_id: number; raw_text: string; tag?: string; notes?: string }) => {
    if (isSupabaseConfigured && supabase) {
      const usernamesSet = new Set<string>();
      const atMatches = data.raw_text.match(/@([a-zA-Z0-9._]{2,30})/g);
      if (atMatches) {
        for (const m of atMatches) {
          const clean = m.replace('@', '').trim();
          if (clean.length >= 2) usernamesSet.add(clean);
        }
      }

      if (usernamesSet.size === 0) {
        const lines = data.raw_text.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim().replace(/^@/, '');
          if (/^[a-zA-Z0-9._]{2,30}$/.test(trimmed)) {
            usernamesSet.add(trimmed);
          }
        }
      }

      const uniqueUsernames = Array.from(usernamesSet);
      if (uniqueUsernames.length === 0) {
        throw new Error('Nenhum usuário válido encontrado no texto colado.');
      }

      const now = new Date().toISOString();
      const recordsToInsert = uniqueUsernames.map((u) => ({
        campaign_id: data.campaign_id,
        username: u,
        notes: data.notes || 'Importado em lote',
        tags: data.tag || '',
        status: 'Pendente',
        private_message_sent: 0,
        public_reply_sent: 0,
        created_at: now,
        updated_at: now
      }));

      const { data: inserted, error } = await supabase.from('contact_records').insert(recordsToInsert).select();
      if (error) throw new Error(error.message);

      return {
        success: true,
        found: uniqueUsernames.length,
        inserted: (inserted || []).length,
        usernames: uniqueUsernames
      };
    }

    return fetchJson<{
      success: boolean;
      found: number;
      inserted: number;
      usernames: string[];
    }>('/contacts/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateContactTags: async (id: number, tags: string): Promise<ContactRecord> => {
    if (isSupabaseConfigured && supabase) {
      const { data: updated, error } = await supabase.from('contact_records').update({ tags, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return updated as ContactRecord;
    }
    return fetchJson<ContactRecord>(`/contacts/${id}/tags`, {
      method: 'PATCH',
      body: JSON.stringify({ tags }),
    });
  },

  prepareContact: async (id: number): Promise<ContactRecord> => {
    if (isSupabaseConfigured && supabase) {
      const now = new Date().toISOString();
      const { data: updated, error } = await supabase.from('contact_records').update({
        status: 'Mensagem preparada',
        prepared_at: now,
        updated_at: now
      }).eq('id', id).select().single();

      if (error) throw new Error(error.message);

      await supabase.from('interaction_history').insert([{
        contact_record_id: id,
        campaign_id: updated.campaign_id,
        action_type: 'MENSAGEM_PREPARADA',
        description: `Mensagem privada preparada e copiada para @${updated.username}.`,
        created_at: now
      }]);

      return updated as ContactRecord;
    }
    return fetchJson<ContactRecord>(`/contacts/${id}/prepare`, { method: 'PATCH' });
  },

  confirmDirect: async (id: number): Promise<ContactRecord> => {
    if (isSupabaseConfigured && supabase) {
      const now = new Date().toISOString();
      const { data: updated, error } = await supabase.from('contact_records').update({
        status: 'Direct confirmado pelo operador',
        private_message_sent: 1,
        direct_confirmed_at: now,
        updated_at: now
      }).eq('id', id).select().single();

      if (error) throw new Error(error.message);

      await supabase.from('interaction_history').insert([{
        contact_record_id: id,
        campaign_id: updated.campaign_id,
        action_type: 'DIRECT_CONFIRMADO',
        description: `Operador confirmou envio manual do Direct para @${updated.username}.`,
        created_at: now
      }]);

      return updated as ContactRecord;
    }
    return fetchJson<ContactRecord>(`/contacts/${id}/confirm-direct`, { method: 'PATCH' });
  },

  confirmPublicReply: async (id: number): Promise<ContactRecord> => {
    if (isSupabaseConfigured && supabase) {
      const now = new Date().toISOString();
      const { data: updated, error } = await supabase.from('contact_records').update({
        public_reply_sent: 1,
        public_replied_at: now,
        updated_at: now
      }).eq('id', id).select().single();

      if (error) throw new Error(error.message);

      await supabase.from('interaction_history').insert([{
        contact_record_id: id,
        campaign_id: updated.campaign_id,
        action_type: 'RESPOSTA_PUBLICADA',
        description: `Operador confirmou resposta pública para @${updated.username}.`,
        created_at: now
      }]);

      return updated as ContactRecord;
    }
    return fetchJson<ContactRecord>(`/contacts/${id}/confirm-public-reply`, { method: 'PATCH' });
  },

  completeContact: async (id: number): Promise<ContactRecord> => {
    if (isSupabaseConfigured && supabase) {
      const now = new Date().toISOString();
      const { data: updated, error } = await supabase.from('contact_records').update({
        status: 'Concluído',
        completed_at: now,
        updated_at: now
      }).eq('id', id).select().single();

      if (error) throw new Error(error.message);

      await supabase.from('interaction_history').insert([{
        contact_record_id: id,
        campaign_id: updated.campaign_id,
        action_type: 'CONCLUIDO',
        description: `Atendimento de @${updated.username} finalizado como Concluído.`,
        created_at: now
      }]);

      return updated as ContactRecord;
    }
    return fetchJson<ContactRecord>(`/contacts/${id}/complete`, { method: 'PATCH' });
  },

  cancelContact: async (id: number, cancel_reason: string): Promise<ContactRecord> => {
    if (isSupabaseConfigured && supabase) {
      const now = new Date().toISOString();
      const { data: updated, error } = await supabase.from('contact_records').update({
        status: 'Cancelado',
        cancel_reason,
        canceled_at: now,
        updated_at: now
      }).eq('id', id).select().single();

      if (error) throw new Error(error.message);

      await supabase.from('interaction_history').insert([{
        contact_record_id: id,
        campaign_id: updated.campaign_id,
        action_type: 'CANCELADO',
        description: `Atendimento de @${updated.username} cancelado. Motivo: ${cancel_reason}`,
        created_at: now
      }]);

      return updated as ContactRecord;
    }
    return fetchJson<ContactRecord>(`/contacts/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ cancel_reason }),
    });
  },

  updateContactStatus: (id: number, status: string, notes?: string) => fetchJson<ContactRecord>(`/contacts/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  }),

  deleteContact: async (id: number): Promise<{ success: boolean }> => {
    if (isSupabaseConfigured && supabase) {
      await supabase.from('contact_records').delete().eq('id', id);
      return { success: true };
    }
    return fetchJson<{ success: boolean }>(`/contacts/${id}`, { method: 'DELETE' });
  },

  // ==========================================
  // 5. HISTÓRICO
  // ==========================================
  getHistory: async (params?: { campaign_id?: string | number; action_type?: string; limit?: number }): Promise<InteractionHistory[]> => {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('interaction_history').select('*, campaigns(name), contact_records(username)').order('id', { ascending: false });

      if (params?.campaign_id && params.campaign_id !== 'all') {
        query = query.eq('campaign_id', params.campaign_id);
      }
      if (params?.action_type && params.action_type !== 'all') {
        query = query.eq('action_type', params.action_type);
      }
      if (params?.limit) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return (data || []).map((h: any) => ({
        ...h,
        campaign_name: h.campaigns?.name,
        username: h.contact_records?.username
      })) as InteractionHistory[];
    }

    const query = new URLSearchParams();
    if (params?.campaign_id) query.append('campaign_id', String(params.campaign_id));
    if (params?.action_type) query.append('action_type', params.action_type);
    if (params?.limit) query.append('limit', String(params.limit));
    return fetchJson<InteractionHistory[]>(`/history?${query.toString()}`);
  },

  // ==========================================
  // 6. CONFIGURAÇÕES
  // ==========================================
  getSettings: async (): Promise<AppSettings> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('application_settings').select('*');
      const settings: any = {};
      (data || []).forEach((r: any) => { settings[r.key] = r.value; });
      return settings as AppSettings;
    }
    return fetchJson<AppSettings>('/settings');
  },

  saveSettings: async (settings: Partial<AppSettings>): Promise<{ success: boolean }> => {
    if (isSupabaseConfigured && supabase) {
      const now = new Date().toISOString();
      for (const [key, value] of Object.entries(settings)) {
        await supabase.from('application_settings').upsert({
          key,
          value: String(value),
          updated_at: now
        });
      }
      return { success: true };
    }
    return fetchJson<{ success: boolean }>('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  // Backup & Restauração
  restoreBackup: (data: any) => fetchJson<{ success: boolean; message: string }>('/backup/restore', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Abrir URL
  openUrl: (url: string) => fetchJson<{ success: boolean }>('/open-url', {
    method: 'POST',
    body: JSON.stringify({ url }),
  }),
};
