import React, { useState, useEffect } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  Database, 
  Upload, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  FileCode,
  HardDrive
} from 'lucide-react';
import { Campaign } from '../types';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const ExportBackupView: React.FC = () => {
  const { showToast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [exportCampaignId, setExportCampaignId] = useState<string>('all');
  const [exportStatus, setExportStatus] = useState<string>('all');

  // Restauração states
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    api.getCampaigns().then(setCampaigns).catch(() => {});
  }, []);

  const handleExportCsv = () => {
    const query = new URLSearchParams();
    if (exportCampaignId !== 'all') query.append('campaign_id', exportCampaignId);
    if (exportStatus !== 'all') query.append('status', exportStatus);

    window.open(`/api/export/csv?${query.toString()}`, '_blank');
    showToast('Download do arquivo CSV iniciado!', 'success');
  };

  const handleDownloadSqlite = () => {
    window.open('/api/backup/sqlite', '_blank');
    showToast('Download do banco SQLite nativo iniciado!', 'success');
  };

  const handleDownloadJson = () => {
    window.open('/api/backup/json', '_blank');
    showToast('Backup completo em JSON baixado!', 'success');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.campaigns || !Array.isArray(json.campaigns)) {
          showToast('Arquivo de backup inválido ou incompatível', 'error');
          return;
        }
        setPendingRestoreData(json);
        setRestoreConfirmOpen(true);
      } catch (err) {
        showToast('Erro ao ler arquivo JSON', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const executeRestore = async () => {
    if (!pendingRestoreData) return;
    setRestoring(true);
    try {
      await api.restoreBackup(pendingRestoreData);
      showToast('Banco de dados local restaurado com sucesso!', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      showToast(err.message || 'Erro ao restaurar dados', 'error');
    } finally {
      setRestoring(false);
      setPendingRestoreData(null);
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Exportação e Backup Local</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Exporte seus atendimentos para relatórios ou crie cópias de segurança do SQLite
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: Exportação CSV (Excel / Planilhas) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Exportação em Planilha (CSV)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Formato com codificação UTF-8 e separador de ponto e vírgula ideal para Excel e Google Sheets.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Filtrar por Campanha:
              </label>
              <select
                value={exportCampaignId}
                onChange={(e) => setExportCampaignId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                <option value="all">Todas as Campanhas</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Filtrar por Status:
              </label>
              <select
                value={exportStatus}
                onChange={(e) => setExportStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                <option value="all">Todos os Status</option>
                <option value="Concluído">Apenas Concluídos</option>
                <option value="Direct confirmado pelo operador">Direct Confirmado</option>
                <option value="Mensagem preparada">Mensagem Preparada</option>
                <option value="Pendente">Pendentes</option>
                <option value="Cancelado">Cancelados</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleExportCsv}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Relatório CSV</span>
            </button>
          </div>
        </div>

        {/* CARD 2: Backup Completo SQLite & JSON */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Backup e Cópia do Banco de Dados</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Seus dados ficam 100% gravados localmente em disco no arquivo SQLite nativo.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Banco SQLite Binário (.sqlite)
                </span>
                <span className="text-[11px] text-slate-500">
                  Compatível com DB Browser for SQLite e migrações.
                </span>
              </div>
              <button
                onClick={handleDownloadSqlite}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 text-white text-xs font-semibold transition-colors shrink-0"
              >
                Baixar .sqlite
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Backup Completo em JSON
                </span>
                <span className="text-[11px] text-slate-500">
                  Exporta todas as tabelas em formato aberto legível.
                </span>
              </div>
              <button
                onClick={handleDownloadJson}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 text-white text-xs font-semibold transition-colors shrink-0"
              >
                Baixar JSON
              </button>
            </div>
          </div>

          {/* Restauração */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Restaurar Dados a partir de Arquivo JSON:
            </label>
            <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-rose-500 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-rose-500" />
              <span>Selecionar Arquivo de Backup JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Confirmação de Restauração */}
      <ConfirmDialog
        isOpen={restoreConfirmOpen}
        onClose={() => {
          setRestoreConfirmOpen(false);
          setPendingRestoreData(null);
        }}
        onConfirm={executeRestore}
        title="Confirmar Restauração de Backup"
        message="ATENÇÃO: A restauração substituirá todas as campanhas, atendimentos e histórico atuais pelos dados contidos no arquivo de backup. Deseja prosseguir?"
        confirmText="Sim, restaurar dados"
      />
    </div>
  );
};
