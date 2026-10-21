import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Layers, 
  Search, 
  Copy, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  Play, 
  Pause, 
  Zap, 
  Check, 
  Tag, 
  Link as LinkIcon,
  MessageCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { Campaign } from '../types';
import { api } from '../utils/api';
import { formatDate, openExternalUrl } from '../utils/formatters';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';

interface CampaignsViewProps {
  onSelectCampaignForAssistant: (campaignId: number) => void;
}

const DEFAULT_PRIVATE_MSG = "{Oi|Olá|Opa}! 💛 {Aqui está|Segue} o link do nosso grupo: {{link_grupo}}. É só clicar para participar!";
const DEFAULT_PUBLIC_REPLY = "{Te enviei|Mandei} o link no Direct! 💌 Dá uma olhadinha nas suas mensagens.";

export const CampaignsView: React.FC<CampaignsViewProps> = ({ onSelectCampaignForAssistant }) => {
  const { showToast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ativo' | 'pausado'>('all');

  // Modal de Criar / Editar Campanha
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formPostUrl, setFormPostUrl] = useState('');
  const [formGroupLink, setFormGroupLink] = useState('');
  const [formPrivateMessage, setFormPrivateMessage] = useState(DEFAULT_PRIVATE_MSG);
  const [formPublicReply, setFormPublicReply] = useState(DEFAULT_PUBLIC_REPLY);
  const [formKeywords, setFormKeywords] = useState('');
  const [formMatchMode, setFormMatchMode] = useState<'all' | 'keywords'>('all');
  const [formStatus, setFormStatus] = useState<'ativo' | 'pausado'>('ativo');
  const [submitting, setSubmitting] = useState(false);

  // Modal de Exclusão
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [campaignToDeleteName, setCampaignToDeleteName] = useState('');

  const loadCampaigns = async () => {
    try {
      const data = await api.getCampaigns();
      setCampaigns(data);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar campanhas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const openCreateModal = () => {
    setEditingCampaign(null);
    setFormName('');
    setFormPostUrl('');
    setFormGroupLink('');
    setFormPrivateMessage(DEFAULT_PRIVATE_MSG);
    setFormPublicReply(DEFAULT_PUBLIC_REPLY);
    setFormMatchMode('all');
    setFormKeywords('');
    setFormStatus('ativo');
    setIsModalOpen(true);
  };

  const openEditModal = (camp: Campaign) => {
    setEditingCampaign(camp);
    setFormName(camp.name);
    setFormPostUrl(camp.post_url);
    setFormGroupLink(camp.group_link);
    setFormPrivateMessage(camp.private_message || DEFAULT_PRIVATE_MSG);
    setFormPublicReply(camp.public_reply || DEFAULT_PUBLIC_REPLY);
    
    const isAll = !camp.keywords || camp.keywords === 'todos' || camp.keywords === '*' || camp.keywords === 'todos os comentários';
    setFormMatchMode(isAll ? 'all' : 'keywords');
    setFormKeywords(isAll ? '' : (camp.keywords || ''));
    setFormStatus(camp.status);
    setIsModalOpen(true);
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPostUrl.trim() || !formGroupLink.trim()) {
      showToast('Preencha os campos obrigatórios (Nome, URL do post e Link do grupo)', 'warning');
      return;
    }

    const finalKeywords = formMatchMode === 'all' ? 'todos os comentários' : formKeywords.trim();

    setSubmitting(true);
    try {
      if (editingCampaign) {
        await api.updateCampaign(editingCampaign.id, {
          name: formName.trim(),
          post_url: formPostUrl.trim(),
          group_link: formGroupLink.trim(),
          private_message: formPrivateMessage,
          public_reply: formPublicReply,
          keywords: finalKeywords,
          status: formStatus,
        });
        showToast('Campanha atualizada com sucesso!', 'success');
      } else {
        await api.createCampaign({
          name: formName.trim(),
          post_url: formPostUrl.trim(),
          group_link: formGroupLink.trim(),
          private_message: formPrivateMessage,
          public_reply: formPublicReply,
          keywords: finalKeywords,
          status: formStatus,
        });
        showToast('Nova campanha criada com sucesso!', 'success');
      }
      setIsModalOpen(false);
      loadCampaigns();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar campanha', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await api.duplicateCampaign(id);
      showToast('Campanha e modelos duplicados com sucesso!', 'success');
      loadCampaigns();
    } catch (err: any) {
      showToast(err.message || 'Erro ao duplicar campanha', 'error');
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: 'ativo' | 'pausado') => {
    const nextStatus = currentStatus === 'ativo' ? 'pausado' : 'ativo';
    try {
      await api.toggleCampaignStatus(id, nextStatus);
      showToast(`Campanha ${nextStatus === 'ativo' ? 'ativada' : 'pausada'} com sucesso!`, 'info');
      loadCampaigns();
    } catch (err: any) {
      showToast(err.message || 'Erro ao alterar status', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await api.deleteCampaign(deleteConfirmId);
      showToast('Campanha excluída com sucesso!', 'info');
      loadCampaigns();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir campanha', 'error');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.keywords?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.group_link.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto">
      {/* Header com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Gerenciamento de Campanhas</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cadastre publicações, configure modelos com {'{{link_grupo}}'} e oriente sua equipe
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Campanha</span>
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, palavras-chave ou link..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500">Status:</span>
          {(['all', 'ativo', 'pausado'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl capitalize transition-colors ${
                filterStatus === st
                  ? 'bg-rose-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {st === 'all' ? 'Todas' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Campanhas */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Carregando campanhas...</div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          <Layers className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhuma campanha encontrada</h3>
          <p className="text-xs text-slate-400 mt-1">Crie uma nova campanha ou altere os termos de filtro.</p>
          <button
            onClick={openCreateModal}
            className="mt-4 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors"
          >
            Cadastrar Campanha
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCampaigns.map((camp) => (
            <div
              key={camp.id}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-4"
            >
              <div>
                {/* Header do Card */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                        {camp.name}
                      </h3>
                      <button
                        onClick={() => handleToggleStatus(camp.id, camp.status)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full flex items-center gap-1 transition-transform active:scale-95 ${
                          camp.status === 'ativo'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                        title="Clique para alternar ativo/pausado"
                      >
                        {camp.status === 'ativo' ? <Play className="w-2.5 h-2.5 fill-current" /> : <Pause className="w-2.5 h-2.5 fill-current" />}
                        {camp.status.toUpperCase()}
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                      Criada em {formatDate(camp.created_at)}
                    </span>
                  </div>

                  {/* Ações Rápidas de Edição */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDuplicate(camp.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Duplicar campanha"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(camp)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Editar campanha"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteConfirmId(camp.id);
                        setCampaignToDeleteName(camp.name);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                      title="Excluir campanha"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Links da Campanha */}
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <ExternalLink className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="font-medium text-slate-400">Post IG:</span>
                    <button
                      onClick={() => openExternalUrl(camp.post_url)}
                      className="text-rose-600 dark:text-rose-400 hover:underline truncate max-w-xs font-mono"
                      title="Abrir no navegador"
                    >
                      {camp.post_url}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <LinkIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="font-medium text-slate-400">Link Destino:</span>
                    <span className="truncate max-w-xs font-mono text-slate-700 dark:text-slate-300">
                      {camp.group_link}
                    </span>
                  </div>

                  {(!camp.keywords || camp.keywords === 'todos' || camp.keywords === '*' || camp.keywords === 'todos os comentários') ? (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-semibold text-[11px] flex items-center gap-1.5">
                        <span>🎯 Atende TODOS os comentários</span>
                        <span className="text-[10px] opacity-75 font-normal">(sem restrição de palavras)</span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 pt-1">
                      <Tag className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Palavras-chave: <strong>{camp.keywords}</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Prévia dos Modelos */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Mensagem Privada:
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 line-clamp-2">
                      {camp.private_message}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Resposta Pública:
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 line-clamp-2">
                      {camp.public_reply}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer do Card com Botão de Atendimento */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-slate-200">
                    {camp.total_contacts || 0}
                  </span>{' '}
                  atendimentos registrados
                </div>

                <button
                  onClick={() => onSelectCampaignForAssistant(camp.id)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors shadow-2xs"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Atender no Copilot</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar / Editar Campanha */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCampaign ? 'Editar Campanha' : 'Criar Nova Campanha'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveCampaign} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nome da Campanha *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Campanha Lançamento Curso VIP"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                URL da Publicação do Instagram *
              </label>
              <input
                type="url"
                required
                placeholder="https://www.instagram.com/p/..."
                value={formPostUrl}
                onChange={(e) => setFormPostUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Link do Grupo / Destino *
              </label>
              <input
                type="text"
                required
                placeholder="https://chat.whatsapp.com/... ou https://..."
                value={formGroupLink}
                onChange={(e) => setFormGroupLink(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
          </div>

          {/* Critério de Elegibilidade: Todos os Comentários ou Palavras-chave */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 dark:text-white">
                Critério de Envio nos Comentários:
              </label>
              <span className="text-[10px] text-slate-500">Como você quer qualificar os comentários</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setFormMatchMode('all')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  formMatchMode === 'all'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/30'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span className="text-base">🎯</span>
                  <span>Todos os comentários</span>
                </div>
                <p className="text-[11px] opacity-80 mt-1 leading-snug">
                  Se a pessoa comentar <strong>qualquer coisa</strong>, manda a mensagem normalmente.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormMatchMode('keywords')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  formMatchMode === 'keywords'
                    ? 'bg-rose-500/10 border-rose-500 text-rose-950 dark:text-rose-200 ring-2 ring-rose-500/30'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span className="text-base">🔍</span>
                  <span>Apenas palavras-chave</span>
                </div>
                <p className="text-[11px] opacity-80 mt-1 leading-snug">
                  Apenas comentários que contenham palavras específicas (ex: "eu quero", "link").
                </p>
              </button>
            </div>

            {formMatchMode === 'all' ? (
              <div className="p-2.5 rounded-xl bg-emerald-100/60 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Modo Universal Ativo:</strong> Todo e qualquer comentário na postagem receberá o link no Direct e a resposta pública.
                </span>
              </div>
            ) : (
              <div className="space-y-1 pt-1 animate-in fade-in duration-150">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Palavras-chave desejadas:
                </label>
                <input
                  type="text"
                  placeholder="Ex: eu quero, vip, link, entrar, valor"
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Status da Campanha
            </label>
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            >
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
            </select>
          </div>

          {/* Modelos de Mensagens com tags {{link_grupo}} */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  1. Mensagem Privada (Direct) *
                </label>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">
                  Suporta Spintax &#123;Oi|Olá&#125;, &#123;&#123;link_grupo&#125;&#125; e &#123;&#123;usuario&#125;&#125;
                </span>
              </div>
              <textarea
                rows={3}
                required
                value={formPrivateMessage}
                onChange={(e) => setFormPrivateMessage(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setFormPrivateMessage(DEFAULT_PRIVATE_MSG)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
                >
                  Restaurar padrão
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  2. Resposta Pública no Comentário *
                </label>
                <span className="text-[10px] text-rose-500 font-mono">
                  Suporta &#123;&#123;usuario&#125;&#125;
                </span>
              </div>
              <textarea
                rows={2}
                required
                value={formPublicReply}
                onChange={(e) => setFormPublicReply(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setFormPublicReply(DEFAULT_PUBLIC_REPLY)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
                >
                  Restaurar padrão
                </button>
              </div>
            </div>
          </div>

          {/* Botões do Formulário */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-colors"
            >
              {submitting ? 'Salvando...' : editingCampaign ? 'Salvar Alterações' : 'Criar Campanha'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmação de Exclusão */}
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Excluir Campanha"
        message={`Tem certeza que deseja excluir permanentemente a campanha "${campaignToDeleteName}"? Todos os atendimentos e modelos vinculados também serão removidos.`}
        confirmText="Sim, excluir campanha"
      />
    </div>
  );
};
