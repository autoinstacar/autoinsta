import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes.js';
import { getDb, saveDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Rotas da API
app.use('/api', apiRoutes);

// Servir frontend compilado em produção se existir
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback para SPA React no Express v5 (usando middleware padrão em vez de '*')
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('InstaAssist Backend Ativo. Acesse via frontend em desenvolvimento (porta 5173).');
    }
  });
});

async function startServer() {
  try {
    await getDb();
    app.listen(PORT, () => {
      console.log(`[InstaAssist] Backend rodando localmente em http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[InstaAssist] Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Salva o banco ao desligar
process.on('SIGINT', () => {
  console.log('[InstaAssist] Salvando banco de dados e encerrando...');
  saveDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[InstaAssist] Salvando banco de dados e encerrando...');
  saveDb();
  process.exit(0);
});

startServer();
