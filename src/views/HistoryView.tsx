import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Layers, 
  Calendar, 
  ArrowDownLeft, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Clock,
  User,
  ShieldCheck
} from 'lucide-react';
import { InteractionHistory, Campaign } from '../types';
import { api } from '../utils/api';
import { formatDate, formatRelativeTime } from '../utils/formatters';
import { useToast } from '../context/ToastContext';

export const HistoryView: React.FC = () => {
  const { showToast } = useToast();
  const [history, setHistory] = useState<InteractionHistory[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [historyData, campaignsData] = await Promise.all([
        api.getHistory({
          campaign_id: selectedCampaign !== 'all' ? selectedCampaign : undefined,
          action_type: selectedAction !== 'all' ? selectedAction : undefined,
          limit: 150
        }),
        api.getCampaigns()
      ]);
      setHistory(historyData);
      setCampaigns(campaignsData);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar histórico', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCampaign, selectedAction]);

  const filteredHistory = history.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.description.toLowerCase().includes(term) ||
      item.action_type.toLowerCase().includes(term) ||
      (item.username && item.username.toLowerCase().includes(term)) ||
      (item.campaign_name && item.campaign_name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Histórico e Auditoria de Operações</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Registro imutável de todas as ações de atendimento e alterações de status
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Recarregar</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por usuário, ação ou texto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
        </div>

        <div>
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
          >
            <option value="all">Todas as Campanhas</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
          >
            <option value="all">Todos os Tipos de Ação</option>
            <option value="REGISTRADO">Novo Atendimento Registrado</option>
            <option value="MENSAGEM_PREPARADA">Mensagem Preparada</option>
            <option value="DIRECT_CONFIRMADO">Direct Confirmado</option>
            <option value="RESPOSTA_PUBLICADA">Resposta Pública</option>
            <option value="CONCLUIDO">Concluído</option>
            <option value="CANCELADO">Cancelado</option>
            <option value="CAMPANHA_CRIADA">Campanha Criada</option>
          </select>
        </div>
      </div>

      {/* Lista Timeline */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Carregando logs de auditoria...</div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
            <p className="text-xs">Nenhum evento registrado com os filtros atuais.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredHistory.map((item) => {
              let tagColor = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
              if (item.action_type === 'DIRECT_CONFIRMADO') {
                tagColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400';
              } else if (item.action_type === 'MENSAGEM_PREPARADA') {
                tagColor = 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400';
              } else if (item.action_type === 'CONCLUIDO') {
                tagColor = 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-400';
              } else if (item.action_type === 'CANCELADO') {
                tagColor = 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400';
              }

              return (
                <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg shrink-0 mt-0.5 ${tagColor}`}>
                      {item.action_type}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        {item.campaign_name && (
                          <span className="flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
                            <Layers className="w-3 h-3" /> {item.campaign_name}
                          </span>
                        )}
                        {item.username && (
                          <span className="flex items-center gap-1 font-mono text-rose-600 dark:text-rose-400 font-semibold">
                            <User className="w-3 h-3" /> @{item.username}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 text-[11px] text-slate-400">
                    <div>{formatDate(item.created_at)}</div>
                    <div className="text-[10px] text-slate-500">{formatRelativeTime(item.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
