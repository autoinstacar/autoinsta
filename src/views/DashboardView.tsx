import React, { useEffect, useState } from 'react';
import { 
  Layers, 
  PlayCircle, 
  Link2, 
  Users, 
  FileText, 
  CheckCheck, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { api } from '../utils/api';
import { DashboardData } from '../types';
import { formatDate, formatRelativeTime } from '../utils/formatters';
import { SafetyBanner } from '../components/SafetyBanner';

interface DashboardViewProps {
  onNavigateToAssistant: (campaignId?: number) => void;
  onNavigateToCampaigns: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToAssistant,
  onNavigateToCampaigns
}) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-rose-500" />
          <p className="text-sm">Carregando métricas locais...</p>
        </div>
      </div>
    );
  }

  const m = data?.metrics || {
    totalCampaigns: 0,
    activeCampaigns: 0,
    uniqueLinks: 0,
    totalContacts: 0,
    preparedMessages: 0,
    confirmedDMs: 0,
    pendingPublicReplies: 0,
    completedContacts: 0,
    canceledContacts: 0,
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto">
      {/* Banner de Conformidade e Segurança */}
      <SafetyBanner />

      {/* Header com Atualização */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Visão Geral de Operações</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Acompanhamento em tempo real das mensagens e atendimentos manuais
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Indicadores Principais (KPIs) - Cards discretos e modernos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Campanhas Cadastradas */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Campanhas Totais</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{m.totalCampaigns}</span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {m.activeCampaigns} ativas em andamento
            </span>
          </div>
        </div>

        {/* Links Cadastrados */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Links de Grupos</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Link2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{m.uniqueLinks}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">destinos únicos cadastrados</span>
          </div>
        </div>

        {/* Atendimentos Registrados */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Atendimentos Registrados</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{m.totalContacts}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">usuários informados</span>
          </div>
        </div>

        {/* Concluídos com Sucesso */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Concluídos</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{m.completedContacts}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">ciclos finalizados</span>
          </div>
        </div>
      </div>

      {/* Cartões de Desempenho e Conversão Avançada */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
              Taxa de Conversão da Fila
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-indigo-950 dark:text-indigo-100">{m.conversionRate || 0}%</span>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">dos comentários concluídos com link</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
            <CheckCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
              Velocidade Média por Atendimento
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-950 dark:text-emerald-100">
                {m.avgResponseSeconds ? `${m.avgResponseSeconds}s` : 'Imediato'}
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">ritmo humano saudável</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Grid de Funil Operacional: Separando estritamente Preparado vs Confirmado pelo Usuário */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Mensagens Preparadas */}
        <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <FileText className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Mensagens Preparadas</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Copiadas pelo operador, mas ainda <strong>NÃO confirmadas como enviadas</strong> no Direct.
          </p>
          <div className="mt-3">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{m.preparedMessages}</span>
          </div>
        </div>

        {/* Mensagens Confirmadas como Enviadas pelo Usuário */}
        <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <CheckCheck className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold">Directs Confirmados</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Envio realizado manualmente e <strong>confirmado explicitamente</strong> pelo operador.
          </p>
          <div className="mt-3">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{m.confirmedDMs}</span>
          </div>
        </div>

        {/* Respostas Públicas Pendentes */}
        <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <MessageSquare className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-semibold">Respostas Públicas Pendentes</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Comentários aguardando aviso público de que o link foi enviado no direct.
          </p>
          <div className="mt-3">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">{m.pendingPublicReplies}</span>
          </div>
        </div>
      </div>

      {/* Campanhas Ativas e Histórico Recente */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Campanhas e Acesso Rápido */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Campanhas em Andamento</h3>
            </div>
            <button
              onClick={onNavigateToCampaigns}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
            >
              Gerenciar Campanhas <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          {(!data?.campaignsSummary || data.campaignsSummary.length === 0) ? (
            <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400">
              <p className="text-sm">Nenhuma campanha cadastrada ainda.</p>
              <button
                onClick={onNavigateToCampaigns}
                className="mt-3 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors"
              >
                Criar Primeira Campanha
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.campaignsSummary.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{c.name}</h4>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        c.status === 'ativo'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {c.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono">
                      {c.group_link}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {c.completed_count} / {c.total_contacts} conc.
                      </div>
                      <div className="text-[11px] text-amber-600 dark:text-amber-400">
                        {c.pending_count} pendentes
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigateToAssistant(c.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-2xs"
                    >
                      Operar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Histórico Recente de Atividades */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Últimas Atividades</h3>
            </div>
            <span className="text-[11px] text-slate-400">Auditoria</span>
          </div>

          {(!data?.recentActivity || data.recentActivity.length === 0) ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-xs text-slate-400">
              Nenhuma atividade registrada no momento.
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1">
              {data.recentActivity.map((act) => (
                <div key={act.id} className="text-xs border-l-2 border-rose-500/50 pl-3 py-0.5 space-y-0.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {act.action_type}
                    </span>
                    <span className="text-[10px]">{formatRelativeTime(act.created_at)}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-snug">{act.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
