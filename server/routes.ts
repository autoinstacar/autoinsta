import { Router, Request, Response } from 'express';
import { getDb, queryRows, queryOne, execute, saveDb, getDbPath } from './db.js';
import { exec } from 'child_process';
import fs from 'fs';

const router = Router();

// ==========================================
// 1. DASHBOARD
// ==========================================
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const db = await getDb();

    const totalCampaigns = queryOne(db, 'SELECT COUNT(*) as count FROM campaigns')?.count || 0;
    const activeCampaigns = queryOne(db, "SELECT COUNT(*) as count FROM campaigns WHERE status = 'ativo'")?.count || 0;
    const uniqueLinks = queryOne(db, 'SELECT COUNT(DISTINCT group_link) as count FROM campaigns')?.count || 0;

    const totalContacts = queryOne(db, 'SELECT COUNT(*) as count FROM contact_records')?.count || 0;
    
    // Status exatos conforme especificação
    const preparedMessages = queryOne(db, "SELECT COUNT(*) as count FROM contact_records WHERE status = 'Mensagem preparada'")?.count || 0;
    const confirmedDMs = queryOne(db, 'SELECT COUNT(*) as count FROM contact_records WHERE private_message_sent = 1')?.count || 0;
    const pendingPublicReplies = queryOne(db, "SELECT COUNT(*) as count FROM contact_records WHERE (status = 'Resposta pública pendente' OR (status = 'Direct confirmado pelo operador' AND public_reply_sent = 0))")?.count || 0;
    const completedContacts = queryOne(db, "SELECT COUNT(*) as count FROM contact_records WHERE status = 'Concluído'")?.count || 0;
    const canceledContacts = queryOne(db, "SELECT COUNT(*) as count FROM contact_records WHERE status = 'Cancelado'")?.count || 0;

    // Atividades recentes
    const recentActivity = queryRows(db, `
      SELECT h.*, c.name as campaign_name, cr.username
      FROM interaction_history h
      LEFT JOIN campaigns c ON h.campaign_id = c.id
      LEFT JOIN contact_records cr ON h.contact_record_id = cr.id
      ORDER BY h.id DESC
      LIMIT 15
    `);

    // Resumo por campanha
    const campaignsSummary = queryRows(db, `
      SELECT 
        c.id, c.name, c.status, c.group_link, c.created_at,
        COUNT(cr.id) as total_contacts,
        SUM(CASE WHEN cr.status = 'Concluído' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN cr.private_message_sent = 1 THEN 1 ELSE 0 END) as sent_dms_count,
        SUM(CASE WHEN cr.status IN ('Pendente', 'Mensagem preparada', 'Direct confirmado pelo operador', 'Resposta pública pendente') THEN 1 ELSE 0 END) as pending_count
      FROM campaigns c
      LEFT JOIN contact_records cr ON c.id = cr.campaign_id
      GROUP BY c.id
      ORDER BY c.id DESC
      LIMIT 10
    `);

    const conversionRate = totalContacts > 0 ? Math.round((completedContacts / totalContacts) * 100) : 0;

    // Tempo médio de atendimento (em segundos) para contatos concluídos
    const avgTimeRow = queryOne(db, `
      SELECT AVG((strftime('%s', completed_at) - strftime('%s', created_at))) as avg_seconds
      FROM contact_records
      WHERE status = 'Concluído' AND completed_at IS NOT NULL
    `);
    const avgResponseSeconds = avgTimeRow?.avg_seconds ? Math.max(1, Math.round(avgTimeRow.avg_seconds)) : 0;

    res.json({
      metrics: {
        totalCampaigns,
        activeCampaigns,
        uniqueLinks,
        totalContacts,
        preparedMessages,
        confirmedDMs,
        pendingPublicReplies,
        completedContacts,
        canceledContacts,
        conversionRate,
        avgResponseSeconds
      },
      recentActivity,
      campaignsSummary
    });
  } catch (error: any) {
    console.error('Erro ao buscar dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. CAMPANHAS
// ==========================================
router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const campaigns = queryRows(db, `
      SELECT 
        c.*,
        COUNT(cr.id) as total_contacts,
        SUM(CASE WHEN cr.status = 'Concluído' THEN 1 ELSE 0 END) as completed_contacts,
        SUM(CASE WHEN cr.status = 'Pendente' THEN 1 ELSE 0 END) as pending_contacts
      FROM campaigns c
      LEFT JOIN contact_records cr ON c.id = cr.campaign_id
      GROUP BY c.id
      ORDER BY c.id DESC
    `);
    res.json(campaigns);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const campaign = queryOne(db, 'SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }
    const templates = queryRows(db, 'SELECT * FROM message_templates WHERE campaign_id = ? ORDER BY id ASC', [req.params.id]);
    res.json({ ...campaign, templates });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/campaigns', async (req: Request, res: Response) => {
  try {
    const { name, post_url, group_link, private_message, public_reply, keywords, status } = req.body;
    if (!name || !post_url || !group_link) {
      return res.status(400).json({ error: 'Nome, URL do post e Link do grupo são obrigatórios' });
    }

    const defaultPrivateMsg = private_message || "Oi! 💛 Aqui está o link do nosso grupo: {{link_grupo}}. É só clicar para participar!";
    const defaultPublicReply = public_reply || "Te enviei o link no Direct! 💌 Dá uma olhadinha nas suas mensagens.";
    const campaignStatus = status === 'pausado' ? 'pausado' : 'ativo';
    const now = new Date().toISOString();

    const db = await getDb();
    const result = execute(db, `
      INSERT INTO campaigns (name, post_url, group_link, private_message, public_reply, keywords, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, post_url, group_link, defaultPrivateMsg, defaultPublicReply, keywords || '', campaignStatus, now, now]);

    const newId = result.lastInsertRowid;

    // Cria template padrão vinculado
    execute(db, `
      INSERT INTO message_templates (campaign_id, title, private_message, public_reply, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `, [newId, 'Modelo Principal', defaultPrivateMsg, defaultPublicReply, now, now]);

    // Registra histórico
    execute(db, `
      INSERT INTO interaction_history (campaign_id, action_type, description, created_at)
      VALUES (?, 'CAMPANHA_CRIADA', ?, ?)
    `, [newId, `Campanha "${name}" criada.`, now]);

    const created = queryOne(db, 'SELECT * FROM campaigns WHERE id = ?', [newId]);
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const { name, post_url, group_link, private_message, public_reply, keywords, status } = req.body;
    const now = new Date().toISOString();
    const db = await getDb();

    execute(db, `
      UPDATE campaigns 
      SET name = ?, post_url = ?, group_link = ?, private_message = ?, public_reply = ?, keywords = ?, status = ?, updated_at = ?
      WHERE id = ?
    `, [name, post_url, group_link, private_message, public_reply, keywords || '', status, now, req.params.id]);

    execute(db, `
      INSERT INTO interaction_history (campaign_id, action_type, description, created_at)
      VALUES (?, 'CAMPANHA_ATUALIZADA', ?, ?)
    `, [req.params.id, `Campanha "${name}" foi editada.`, now]);

    const updated = queryOne(db, 'SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/campaigns/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const source = queryOne(db, 'SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    if (!source) {
      return res.status(404).json({ error: 'Campanha não encontrada para duplicação' });
    }

    const now = new Date().toISOString();
    const newName = `${source.name} (Cópia)`;

    const result = execute(db, `
      INSERT INTO campaigns (name, post_url, group_link, private_message, public_reply, keywords, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'ativo', ?, ?)
    `, [newName, source.post_url, source.group_link, source.private_message, source.public_reply, source.keywords, now, now]);

    const newId = result.lastInsertRowid;

    // Copia templates
    const templates = queryRows(db, 'SELECT * FROM message_templates WHERE campaign_id = ?', [req.params.id]);
    for (const t of templates) {
      execute(db, `
        INSERT INTO message_templates (campaign_id, title, private_message, public_reply, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [newId, t.title, t.private_message, t.public_reply, t.is_default, now, now]);
    }

    execute(db, `
      INSERT INTO interaction_history (campaign_id, action_type, description, created_at)
      VALUES (?, 'CAMPANHA_DUPLICADA', ?, ?)
    `, [newId, `Campanha duplicada a partir de "${source.name}".`, now]);

    const duplicated = queryOne(db, 'SELECT * FROM campaigns WHERE id = ?', [newId]);
    res.status(201).json(duplicated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/campaigns/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const now = new Date().toISOString();
    const db = await getDb();
    execute(db, 'UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?', [status, now, req.params.id]);
    
    execute(db, `
      INSERT INTO interaction_history (campaign_id, action_type, description, created_at)
      VALUES (?, 'STATUS_ALTERADO', ?, ?)
    `, [req.params.id, `Status da campanha alterado para ${status}.`, now]);

    res.json({ success: true, status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const campaign = queryOne(db, 'SELECT name FROM campaigns WHERE id = ?', [req.params.id]);
    
    execute(db, 'DELETE FROM contact_records WHERE campaign_id = ?', [req.params.id]);
    execute(db, 'DELETE FROM message_templates WHERE campaign_id = ?', [req.params.id]);
    execute(db, 'DELETE FROM interaction_history WHERE campaign_id = ?', [req.params.id]);
    execute(db, 'DELETE FROM campaigns WHERE id = ?', [req.params.id]);

    res.json({ success: true, message: `Campanha "${campaign?.name || req.params.id}" excluída.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. MODELOS DE MENSAGEM
// ==========================================
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { campaign_id } = req.query;
    let sql = 'SELECT * FROM message_templates';
    const params: any[] = [];
    if (campaign_id) {
      sql += ' WHERE campaign_id = ?';
      params.push(campaign_id);
    }
    sql += ' ORDER BY is_default DESC, id ASC';
    const templates = queryRows(db, sql, params);
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/templates', async (req: Request, res: Response) => {
  try {
    const { campaign_id, title, private_message, public_reply, is_default } = req.body;
    const now = new Date().toISOString();
    const db = await getDb();
    const result = execute(db, `
      INSERT INTO message_templates (campaign_id, title, private_message, public_reply, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [campaign_id || null, title, private_message, public_reply, is_default ? 1 : 0, now, now]);

    const created = queryOne(db, 'SELECT * FROM message_templates WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { title, private_message, public_reply, is_default } = req.body;
    const now = new Date().toISOString();
    const db = await getDb();
    execute(db, `
      UPDATE message_templates
      SET title = ?, private_message = ?, public_reply = ?, is_default = ?, updated_at = ?
      WHERE id = ?
    `, [title, private_message, public_reply, is_default ? 1 : 0, now, req.params.id]);

    const updated = queryOne(db, 'SELECT * FROM message_templates WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    execute(db, 'DELETE FROM message_templates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. ATENDIMENTOS (CONTACT RECORDS)
// ==========================================
router.get('/contacts', async (req: Request, res: Response) => {
  try {
    const { campaign_id, status, search, limit } = req.query;
    const db = await getDb();
    let sql = `
      SELECT cr.*, c.name as campaign_name, c.group_link, c.post_url
      FROM contact_records cr
      LEFT JOIN campaigns c ON cr.campaign_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (campaign_id && campaign_id !== 'all') {
      sql += ' AND cr.campaign_id = ?';
      params.push(campaign_id);
    }

    if (status && status !== 'all') {
      sql += ' AND cr.status = ?';
      params.push(status);
    }

    if (search) {
      sql += ' AND (cr.username LIKE ? OR cr.internal_id LIKE ? OR cr.notes LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY cr.id DESC';

    if (limit) {
      sql += ` LIMIT ${parseInt(limit as string, 10)}`;
    }

    const records = queryRows(db, sql, params);
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/contacts', async (req: Request, res: Response) => {
  try {
    const { campaign_id, username, internal_id, comment_id, notes, tags } = req.body;
    if (!campaign_id || !username) {
      return res.status(400).json({ error: 'Campanha e nome de usuário são obrigatórios.' });
    }

    // Limpa o username para remover '@' se o usuário tiver digitado
    const cleanUsername = username.trim().replace(/^@/, '');
    const now = new Date().toISOString();

    const db = await getDb();
    const result = execute(db, `
      INSERT INTO contact_records (
        campaign_id, username, internal_id, comment_id, notes, tags, status,
        private_message_sent, public_reply_sent, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'Pendente', 0, 0, ?, ?)
    `, [campaign_id, cleanUsername, internal_id || '', comment_id || '', notes || '', tags || '', now, now]);

    const newId = result.lastInsertRowid;

    execute(db, `
      INSERT INTO interaction_history (contact_record_id, campaign_id, action_type, description, previous_status, new_status, created_at)
      VALUES (?, ?, 'REGISTRADO', ?, NULL, 'Pendente', ?)
    `, [newId, campaign_id, `Atendimento para @${cleanUsername} registrado na fila.`, now]);

    const created = queryOne(db, `
      SELECT cr.*, c.name as campaign_name, c.group_link, c.post_url
      FROM contact_records cr
      LEFT JOIN campaigns c ON cr.campaign_id = c.id
      WHERE cr.id = ?
    `, [newId]);

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Importação em Lote de Comentários / Usuários
router.post('/contacts/batch', async (req: Request, res: Response) => {
  try {
    const { campaign_id, raw_text, tag, notes } = req.body;
    if (!campaign_id || !raw_text) {
      return res.status(400).json({ error: 'Campanha e texto de entrada são obrigatórios.' });
    }

    // Extrai @arrobas ou nomes de usuário de formato válido do Instagram
    // Padrão: @username ou palavras isoladas em linhas
    const usernamesSet = new Set<string>();

    // 1. Procura por @username
    const atMatches = raw_text.match(/@([a-zA-Z0-9._]{2,30})/g);
    if (atMatches) {
      for (const m of atMatches) {
        const clean = m.replace('@', '').trim();
        if (clean.length >= 2) usernamesSet.add(clean);
      }
    }

    // 2. Se não encontrou @, tenta linha por linha
    if (usernamesSet.size === 0) {
      const lines = raw_text.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim().replace(/^@/, '');
        // Validação de username de Instagram: letras, números, pontos e underlines
        if (/^[a-zA-Z0-9._]{2,30}$/.test(trimmed)) {
          usernamesSet.add(trimmed);
        }
      }
    }

    const uniqueUsernames = Array.from(usernamesSet);
    if (uniqueUsernames.length === 0) {
      return res.status(400).json({ error: 'Nenhum nome de usuário válido do Instagram encontrado no texto colado.' });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    let insertedCount = 0;

    for (const username of uniqueUsernames) {
      // Verifica se já existe nessa campanha para evitar duplicata desnecessária
      const exists = queryOne(db, 'SELECT id FROM contact_records WHERE campaign_id = ? AND username = ?', [campaign_id, username]);
      if (!exists) {
        const result = execute(db, `
          INSERT INTO contact_records (
            campaign_id, username, notes, tags, status,
            private_message_sent, public_reply_sent, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'Pendente', 0, 0, ?, ?)
        `, [campaign_id, username, notes || 'Importado em lote', tag || '', now, now]);

        execute(db, `
          INSERT INTO interaction_history (contact_record_id, campaign_id, action_type, description, previous_status, new_status, created_at)
          VALUES (?, ?, 'REGISTRADO_LOTE', ?, NULL, 'Pendente', ?)
        `, [result.lastInsertRowid, campaign_id, `Atendimento para @${username} importado em lote.`, now]);

        insertedCount++;
      }
    }

    saveDb();
    res.json({
      success: true,
      found: uniqueUsernames.length,
      inserted: insertedCount,
      usernames: uniqueUsernames
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar tags de um atendimento
router.patch('/contacts/:id/tags', async (req: Request, res: Response) => {
  try {
    const { tags } = req.body;
    const db = await getDb();
    const now = new Date().toISOString();
    execute(db, 'UPDATE contact_records SET tags = ?, updated_at = ? WHERE id = ?', [tags || '', now, req.params.id]);

    const updated = queryOne(db, 'SELECT * FROM contact_records WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Ação de preparar / copiar mensagem privada
router.patch('/contacts/:id/prepare', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const record = queryOne(db, 'SELECT * FROM contact_records WHERE id = ?', [req.params.id]);
    if (!record) return res.status(404).json({ error: 'Atendimento não encontrado' });

    const now = new Date().toISOString();
    // Apenas transiciona se ainda estava Pendente, para não retroceder caso já tenha confirmado
    const newStatus = record.status === 'Pendente' ? 'Mensagem preparada' : record.status;

    execute(db, `
      UPDATE contact_records
      SET status = ?, prepared_at = ?, updated_at = ?
      WHERE id = ?
    `, [newStatus, now, now, req.params.id]);

    execute(db, `
      INSERT INTO interaction_history (contact_record_id, campaign_id, action_type, description, previous_status, new_status, created_at)
      VALUES (?, ?, 'MENSAGEM_PREPARADA', ?, ?, ?, ?)
    `, [record.id, record.campaign_id, `Mensagem privada preparada e copiada para @${record.username}.`, record.status, newStatus, now]);

    const updated = queryOne(db, 'SELECT * FROM contact_records WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Ação de confirmação manual explícita pelo operador do Direct enviado
router.patch('/contacts/:id/confirm-direct', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const record = queryOne(db, 'SELECT * FROM contact_records WHERE id = ?', [req.params.id]);
    if (!record) return res.status(404).json({ error: 'Atendimento não encontrado' });

    const now = new Date().toISOString();
    const newStatus = 'Direct confirmado pelo operador';

    execute(db, `
      UPDATE contact_records
      SET status = ?, private_message_sent = 1, direct_confirmed_at = ?, updated_at = ?
      WHERE id = ?
    `, [newStatus, now, now, req.params.id]);

    execute(db, `
      INSERT INTO interaction_history (contact_record_id, campaign_id, action_type, description, previous_status, new_status, created_at)
      VALUES (?, ?, 'DIRECT_CONFIRMADO', ?, ?, ?, ?)
    `, [record.id, record.campaign_id, `Operador confirmou envio manual do Direct para @${record.username}.`, record.status, newStatus, now]);

    const updated = queryOne(db, 'SELECT * FROM contact_records WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Ação de registrar resposta pública
router.patch('/contacts/:id/confirm-public-reply', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const record = queryOne(db, 'SELECT * FROM contact_records WHERE id = ?', [req.params.id]);
    if (!record) return res.status(404).json({ error: 'Atendimento não encontrado' });

    const now = new Date().toISOString();
    execute(db, `
      UPDATE contact_records
      SET public_reply_sent = 1, public_replied_at = ?, updated_at = ?
      WHERE id = ?
    `, [now, now, req.params.id]);

    execute(db, `
      INSERT INTO interaction_history (contact_record_id, campaign_id, action_type, description, previous_status, new_status, created_at)
      VALUES (?, ?, 'RESPOSTA_PUBLICADA', ?, ?, ?, ?)
    `, [record.id, record.campaign_id, `Operador confirmou publicação da resposta pública para @${record.username}.`, record.status, record.status, now]);

    const updated = queryOne(db, 'SELECT * FROM contact_records WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Concluir atendimento
router.patch('/contacts/:id/complete', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const record = queryOne(db, 'SELECT * FROM contact_records WHERE id = ?', [req.params.id]);
    if (!record) return res.status(404).json({ error: 'Atendimento não encontrado' });

    const now = new Date().toISOString();
    const newStatus = 'Concluído';

    execute(db, `
      UPDATE contact_records
      SET status = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `, [newStatus, now, now, req.params.id]);

    execute(db, `
      INSERT INTO interaction_history (contact_record_id, campaign_id, action_type, description, previous_status, new_status, created_at)
      VALUES (?, ?, 'CONCLUIDO', ?, ?, ?, ?)
    `, [record.id, record.campaign_id, `Atendimento de @${record.username} finalizado como Concluído.`, record.status, newStatus, now]);

    const updated = queryOne(db, 'SELECT * FROM contact_records WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancelar atendimento
router.patch('/contacts/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { cancel_reason } = req.body;
    const db = await getDb();
    const record = queryOne(db, 'SELECT * FROM contact_records WHERE id = ?', [req.params.id]);
    if (!record) return res.status(404).json({ error: 'Atendimento não encontrado' });

    const now = new Date().toISOString();
    const newStatus = 'Cancelado';

    execute(db, `
      UPDATE contact_records
      SET status = ?, canceled_at = ?, cancel_reason = ?, updated_at = ?
      WHERE id = ?
    `, [newStatus, now, cancel_reason || 'Cancelado pelo operador', now, req.params.id]);

    execute(db, `
      INSERT INTO interaction_history (contact_record_id, campaign_id, action_type, description, previous_status, new_status, created_at)
      VALUES (?, ?, 'CANCELADO', ?, ?, ?, ?)
    `, [record.id, record.campaign_id, `Atendimento de @${record.username} cancelado. Motivo: ${cancel_reason || 'Sem motivo'}`, record.status, newStatus, now]);

    const updated = queryOne(db, 'SELECT * FROM contact_records WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar status livremente
router.patch('/contacts/:id/status', async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body;
    const db = await getDb();
    const record = queryOne(db, 'SELECT * FROM contact_records WHERE id = ?', [req.params.id]);
    if (!record) return res.status(404).json({ error: 'Atendimento não encontrado' });

    const now = new Date().toISOString();
    execute(db, `
      UPDATE contact_records
      SET status = ?, notes = COALESCE(?, notes), updated_at = ?
      WHERE id = ?
    `, [status, notes || null, now, req.params.id]);

    execute(db, `
      INSERT INTO interaction_history (contact_record_id, campaign_id, action_type, description, previous_status, new_status, created_at)
      VALUES (?, ?, 'STATUS_ALTERADO', ?, ?, ?, ?)
    `, [record.id, record.campaign_id, `Status alterado manualmente para "${status}".`, record.status, status, now]);

    const updated = queryOne(db, 'SELECT * FROM contact_records WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar atendimento
router.delete('/contacts/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    execute(db, 'DELETE FROM interaction_history WHERE contact_record_id = ?', [req.params.id]);
    execute(db, 'DELETE FROM contact_records WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. HISTÓRICO
// ==========================================
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { campaign_id, contact_record_id, action_type, limit } = req.query;
    const db = await getDb();

    let sql = `
      SELECT h.*, c.name as campaign_name, cr.username
      FROM interaction_history h
      LEFT JOIN campaigns c ON h.campaign_id = c.id
      LEFT JOIN contact_records cr ON h.contact_record_id = cr.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (campaign_id && campaign_id !== 'all') {
      sql += ' AND h.campaign_id = ?';
      params.push(campaign_id);
    }
    if (contact_record_id) {
      sql += ' AND h.contact_record_id = ?';
      params.push(contact_record_id);
    }
    if (action_type && action_type !== 'all') {
      sql += ' AND h.action_type = ?';
      params.push(action_type);
    }

    sql += ' ORDER BY h.id DESC';
    const max = limit ? parseInt(limit as string, 10) : 100;
    sql += ` LIMIT ${max}`;

    const history = queryRows(db, sql, params);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6. EXPORTAÇÃO CSV E BACKUP
// ==========================================
router.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const { campaign_id, status } = req.query;
    const db = await getDb();

    let sql = `
      SELECT 
        cr.id,
        c.name as campanha,
        cr.username as usuario,
        cr.internal_id as id_interno,
        cr.comment_id as id_comentario,
        cr.status,
        cr.private_message_sent as direct_enviado,
        cr.public_reply_sent as resposta_publicada,
        cr.prepared_at as data_preparado,
        cr.direct_confirmed_at as data_direct_confirmado,
        cr.public_replied_at as data_resposta_publica,
        cr.completed_at as data_concluido,
        cr.canceled_at as data_cancelado,
        cr.cancel_reason as motivo_cancelamento,
        cr.notes as observacoes,
        cr.tags as tags_segmentacao,
        cr.created_at as data_criacao
      FROM contact_records cr
      LEFT JOIN campaigns c ON cr.campaign_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (campaign_id && campaign_id !== 'all') {
      sql += ' AND cr.campaign_id = ?';
      params.push(campaign_id);
    }
    if (status && status !== 'all') {
      sql += ' AND cr.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY cr.id DESC';

    const records = queryRows(db, sql, params);

    // Converte para CSV com BOM UTF-8 para abrir no Excel em português sem caracteres corrompidos
    const headers = [
      'ID', 'Campanha', 'Usuário Instagram', 'ID Interno', 'ID Comentário', 'Status',
      'Direct Enviado (1/0)', 'Resposta Pública Enviada (1/0)',
      'Data Preparado', 'Data Direct Confirmado', 'Data Resposta Pública',
      'Data Conclusão', 'Data Cancelamento', 'Motivo Cancelamento', 'Observações', 'Tags Segmentação', 'Data Registro'
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [
      headers.join(';'),
      ...records.map(r => [
        r.id,
        escapeCsv(r.campanha),
        escapeCsv(r.usuario),
        escapeCsv(r.id_interno),
        escapeCsv(r.id_comentario),
        escapeCsv(r.status),
        r.direct_enviado,
        r.resposta_publicada,
        escapeCsv(r.data_preparado),
        escapeCsv(r.data_direct_confirmado),
        escapeCsv(r.data_resposta_publica),
        escapeCsv(r.data_concluido),
        escapeCsv(r.data_cancelado),
        escapeCsv(r.motivo_cancelamento),
        escapeCsv(r.observacoes),
        escapeCsv(r.tags_segmentacao),
        escapeCsv(r.data_criacao)
      ].join(';'))
    ];

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="atendimentos_instagram_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Download do banco SQLite real
router.get('/backup/sqlite', async (req: Request, res: Response) => {
  try {
    saveDb();
    const dbPath = getDbPath();
    if (fs.existsSync(dbPath)) {
      res.download(dbPath, `instagram_assistant_backup_${Date.now()}.sqlite`);
    } else {
      res.status(404).json({ error: 'Arquivo do banco de dados não encontrado' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Exportação JSON completa
router.get('/backup/json', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const data = {
      exported_at: new Date().toISOString(),
      campaigns: queryRows(db, 'SELECT * FROM campaigns'),
      templates: queryRows(db, 'SELECT * FROM message_templates'),
      contacts: queryRows(db, 'SELECT * FROM contact_records'),
      history: queryRows(db, 'SELECT * FROM interaction_history'),
      settings: queryRows(db, 'SELECT * FROM application_settings')
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="backup_instagram_${Date.now()}.json"`);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Restauração via JSON
router.post('/backup/restore', async (req: Request, res: Response) => {
  try {
    const { campaigns, templates, contacts, history, settings } = req.body;
    if (!campaigns || !Array.isArray(campaigns)) {
      return res.status(400).json({ error: 'Formato de backup inválido' });
    }

    const db = await getDb();
    
    // Limpa tabelas existentes
    db.run('DELETE FROM interaction_history');
    db.run('DELETE FROM contact_records');
    db.run('DELETE FROM message_templates');
    db.run('DELETE FROM campaigns');

    // Restaura campanhas
    for (const c of campaigns) {
      db.run(`
        INSERT INTO campaigns (id, name, post_url, group_link, private_message, public_reply, keywords, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [c.id, c.name, c.post_url, c.group_link, c.private_message, c.public_reply, c.keywords, c.status, c.created_at, c.updated_at]);
    }

    // Restaura templates
    if (templates && Array.isArray(templates)) {
      for (const t of templates) {
        db.run(`
          INSERT INTO message_templates (id, campaign_id, title, private_message, public_reply, is_default, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [t.id, t.campaign_id, t.title, t.private_message, t.public_reply, t.is_default, t.created_at, t.updated_at]);
      }
    }

    // Restaura contatos
    if (contacts && Array.isArray(contacts)) {
      for (const cr of contacts) {
        db.run(`
          INSERT INTO contact_records (
            id, campaign_id, comment_id, username, internal_id, status,
            private_message_sent, public_reply_sent, prepared_at, direct_confirmed_at,
            public_replied_at, completed_at, canceled_at, cancel_reason, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          cr.id, cr.campaign_id, cr.comment_id, cr.username, cr.internal_id, cr.status,
          cr.private_message_sent, cr.public_reply_sent, cr.prepared_at, cr.direct_confirmed_at,
          cr.public_replied_at, cr.completed_at, cr.canceled_at, cr.cancel_reason, cr.notes, cr.created_at, cr.updated_at
        ]);
      }
    }

    // Restaura histórico
    if (history && Array.isArray(history)) {
      for (const h of history) {
        db.run(`
          INSERT INTO interaction_history (id, contact_record_id, campaign_id, action_type, description, previous_status, new_status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [h.id, h.contact_record_id, h.campaign_id, h.action_type, h.description, h.previous_status, h.new_status, h.created_at]);
      }
    }

    saveDb();
    res.json({ success: true, message: 'Dados restaurados com sucesso' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 7. CONFIGURAÇÕES
// ==========================================
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = queryRows(db, 'SELECT key, value FROM application_settings');
    const settings: Record<string, string> = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings', async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    const db = await getDb();
    const now = new Date().toISOString();

    for (const [key, value] of Object.entries(settings)) {
      const exists = queryOne(db, 'SELECT key FROM application_settings WHERE key = ?', [key]);
      if (exists) {
        db.run('UPDATE application_settings SET value = ?, updated_at = ? WHERE key = ?', [String(value), now, key]);
      } else {
        db.run('INSERT INTO application_settings (key, value, updated_at) VALUES (?, ?, ?)', [key, String(value), now]);
      }
    }
    saveDb();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 8. ABRIR URL NO NAVEGADOR PADRÃO DO WINDOWS
// ==========================================
router.post('/open-url', (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL inválida' });
  }

  // Validação básica de URL HTTP/HTTPS
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return res.status(400).json({ error: 'Apenas URLs HTTP/HTTPS são permitidas' });
  }

  // No Windows usamos o comando seguro `start ""`
  const cleanUrl = url.replace(/"/g, '%22');
  exec(`start "" "${cleanUrl}"`, (err) => {
    if (err) {
      console.error('Erro ao abrir navegador:', err);
      return res.status(500).json({ error: 'Não foi possível abrir o navegador padrão' });
    }
    res.json({ success: true, url });
  });
});

export default router;
