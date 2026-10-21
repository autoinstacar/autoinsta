import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: Database | null = null;
let SQL: SqlJsStatic | null = null;

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'instagram_assistant.sqlite');

export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.error('Erro ao ler banco existente, recriando:', err);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  initTables(dbInstance);
  saveDb();

  return dbInstance;
}

export function saveDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Erro ao salvar SQLite em disco:', err);
  }
}

function initTables(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      post_url TEXT NOT NULL,
      group_link TEXT NOT NULL,
      private_message TEXT NOT NULL,
      public_reply TEXT NOT NULL,
      keywords TEXT,
      status TEXT NOT NULL DEFAULT 'ativo',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS message_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      title TEXT NOT NULL,
      private_message TEXT NOT NULL,
      public_reply TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      comment_id TEXT,
      username TEXT NOT NULL,
      internal_id TEXT,
      status TEXT NOT NULL DEFAULT 'Pendente',
      private_message_sent INTEGER DEFAULT 0,
      public_reply_sent INTEGER DEFAULT 0,
      prepared_at TEXT,
      direct_confirmed_at TEXT,
      public_replied_at TEXT,
      completed_at TEXT,
      canceled_at TEXT,
      cancel_reason TEXT,
      notes TEXT,
      tags TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interaction_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_record_id INTEGER,
      campaign_id INTEGER,
      action_type TEXT NOT NULL,
      description TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS application_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Migração segura para coluna tags
  try {
    const columns = queryRows(db, "PRAGMA table_info(contact_records)");
    const hasTags = columns.some((col: any) => col.name === 'tags');
    if (!hasTags) {
      db.run("ALTER TABLE contact_records ADD COLUMN tags TEXT;");
    }
  } catch (e) {
    console.error('Erro na migração de tags:', e);
  }

  // Configurações padrão se não existirem
  const settingsCheck = queryRows(db, 'SELECT key FROM application_settings WHERE key = ?', ['theme']);
  if (settingsCheck.length === 0) {
    db.run(`
      INSERT INTO application_settings (key, value, updated_at) VALUES 
      ('theme', 'dark', datetime('now', 'localtime')),
      ('operator_name', 'Operador Local', datetime('now', 'localtime')),
      ('enable_keyboard_shortcuts', 'true', datetime('now', 'localtime')),
      ('sound_feedback', 'true', datetime('now', 'localtime')),
      ('safety_alert_dismissed', 'false', datetime('now', 'localtime'))
    `);
  }

  // Campanha exemplo se vazio
  const campaignsCheck = queryRows(db, 'SELECT id FROM campaigns LIMIT 1');
  if (campaignsCheck.length === 0) {
    const now = new Date().toISOString();
    const defaultPrivateMsg = "Oi! 💛 Aqui está o link do nosso grupo: {{link_grupo}}. É só clicar para participar!";
    const defaultPublicReply = "Te enviei o link no Direct! 💌 Dá uma olhadinha nas suas mensagens.";
    
    db.run(`
      INSERT INTO campaigns (name, post_url, group_link, private_message, public_reply, keywords, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'ativo', ?, ?)
    `, [
      'Campanha VIP - Lançamento Exclusivo',
      'https://www.instagram.com/p/C0example/',
      'https://chat.whatsapp.com/exemplo-link-grupo',
      defaultPrivateMsg,
      defaultPublicReply,
      'eu quero, grupo, vip, link, quero participar',
      now,
      now
    ]);

    const campaignIdResult = queryRows(db, 'SELECT last_insert_rowid() as id');
    const campaignId = campaignIdResult[0]?.id || 1;

    // Template padrão
    db.run(`
      INSERT INTO message_templates (campaign_id, title, private_message, public_reply, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `, [
      campaignId,
      'Modelo Padrão WhatsApp/Grupo',
      defaultPrivateMsg,
      defaultPublicReply,
      now,
      now
    ]);

    // Histórico inicial
    db.run(`
      INSERT INTO interaction_history (campaign_id, action_type, description, created_at)
      VALUES (?, 'SISTEMA', 'Campanha de exemplo inicial criada com sucesso.', ?)
    `, [campaignId, now]);
  }
}

// Helpers para consultas convenientes
export function queryRows(db: Database, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function queryOne(db: Database, sql: string, params: any[] = []): any | null {
  const rows = queryRows(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function execute(db: Database, sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
  db.run(sql, params);
  const info = queryOne(db, 'SELECT last_insert_rowid() as id, changes() as changes');
  saveDb();
  return {
    lastInsertRowid: info?.id ?? 0,
    changes: info?.changes ?? 0
  };
}

export function getDbPath(): string {
  return DB_PATH;
}
