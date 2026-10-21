import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Send, 
  Copy, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Check, 
  Sparkles, 
  Plus, 
  MessageSquare, 
  User, 
  ArrowRight, 
  Tag, 
  RefreshCw, 
  Search, 
  Filter, 
  CheckCheck, 
  XCircle, 
  HelpCircle, 
  Hash, 
  ChevronRight, 
  Flame,
  Shuffle,
  Volume2,
  VolumeX,
  ListPlus,
  ShieldCheck,
  Timer
} from 'lucide-react';
import { Campaign, ContactRecord, ContactStatus } from '../types';
import { api } from '../utils/api';
import { copyToClipboard, openExternalUrl, interpolateTemplate, formatDate, formatRelativeTime } from '../utils/formatters';
import { parseSpintax, calculateVariationsCount } from '../utils/spintax';
import { sound } from '../utils/audio';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/Modal';

interface AssistantViewProps {
  initialCampaignId?: number;
}

const PRESET_TAGS = [
  { id: '🔥 Quente', label: '🔥 Quente', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300' },
  { id: '💰 Pediu Preço', label: '💰 Pediu Preço', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300' },
  { id: '❓ Dúvida', label: '❓ Dúvida', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-300' },
  { id: '💬 Engajamento', label: '💬 Engajamento', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-300' },
  { id: '❌ Já no Grupo', label: '❌ Já no Grupo', color: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300' }
];

export const AssistantView: React.FC<AssistantViewProps> = ({ initialCampaignId }) => {
  const { showToast } = useToast();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | undefined>(initialCampaignId);
  const [loading, setLoading] = useState(true);

  // Fila de Atendimentos
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [activeContactId, setActiveContactId] = useState<number | null>(null);

  // Filtros da fila
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchContact, setSearchContact] = useState('');

  // Formulário de Novo Atendimento Individual
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newInternalId, setNewInternalId] = useState('');
  const [newCommentId, setNewCommentId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [addingContact, setAddingContact] = useState(false);

  // Modal de Importação em Lote
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchRawText, setBatchRawText] = useState('');
  const [batchDefaultTag, setBatchDefaultTag] = useState('🔥 Quente');
  const [batchImporting, setBatchImporting] = useState(false);

  // Modal Cancelar
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Estado de feedback de cópia
  const [copiedPrivate, setCopiedPrivate] = useState(false);
  const [copiedPublic, setCopiedPublic] = useState(false);

  // Som ativo/inativo
  const [soundEnabled, setSoundEnabled] = useState(sound.isEnabled());

  // Spintax shuffle seed (para re-embaralhar variações)
  const [spintaxSeed, setSpintaxSeed] = useState(0);

  // Cronômetro de Cadência Humana (Delay seguro entre envios)
  const [safeDelayConfig, setSafeDelayConfig] = useState(10); // 10 segundos recomendados
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Controla o timer de cadência
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          sound.playReady();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // Carrega campanhas
  const loadCampaigns = async () => {
    try {
      const data = await api.getCampaigns();
      setCampaigns(data);
      if (!selectedCampaignId && data.length > 0) {
        const active = data.find((c) => c.status === 'ativo') || data[0];
        setSelectedCampaignId(active.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar campanhas', 'error');
    }
  };

  // Carrega atendimentos da campanha selecionada
  const loadContacts = useCallback(async () => {
    try {
      const data = await api.getContacts({
        campaign_id: selectedCampaignId,
      });
      setContacts(data);

      if (data.length > 0) {
        if (!activeContactId || !data.some((c) => c.id === activeContactId)) {
          const firstPending = data.find((c) => c.status !== 'Concluído' && c.status !== 'Cancelado') || data[0];
          setActiveContactId(firstPending.id);
        }
      } else {
        setActiveContactId(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar lista de atendimentos', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedCampaignId, activeContactId, showToast]);

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaignId) {
      loadContacts();
    }
  }, [selectedCampaignId]);

  // Campanha atual selecionada
  const activeCampaign = useMemo(() => {
    return campaigns.find((c) => c.id === selectedCampaignId);
  }, [campaigns, selectedCampaignId]);

  // Contato ativo na bancada
  const currentContact = useMemo(() => {
    return contacts.find((c) => c.id === activeContactId) || null;
  }, [contacts, activeContactId]);

  // Calcula variações possíveis de Spintax
  const privateVariationsCount = useMemo(() => {
    return calculateVariationsCount(activeCampaign?.private_message || '');
  }, [activeCampaign]);

  const publicVariationsCount = useMemo(() => {
    return calculateVariationsCount(activeCampaign?.public_reply || '');
  }, [activeCampaign]);

  // Mensagens interpoladas com dados do contato e Spintax resolvido
  const interpolatedPrivateMessage = useMemo(() => {
    if (!activeCampaign) return '';
    // Resolve Spintax primeiro para garantir variação textual
    const spintaxResolved = parseSpintax(activeCampaign.private_message);
    return interpolateTemplate(spintaxResolved, {
      link_grupo: activeCampaign.group_link,
      usuario: currentContact ? currentContact.username : 'você',
    });
  }, [activeCampaign, currentContact, spintaxSeed]);

  const interpolatedPublicReply = useMemo(() => {
    if (!activeCampaign) return '';
    const spintaxResolved = parseSpintax(activeCampaign.public_reply);
    return interpolateTemplate(spintaxResolved, {
      usuario: currentContact ? currentContact.username : 'você',
      link_grupo: activeCampaign.group_link,
    });
  }, [activeCampaign, currentContact, spintaxSeed]);

  // Link do Direct do usuário ou perfil do Instagram
  const userInstagramUrl = useMemo(() => {
    if (!currentContact?.username) return 'https://www.instagram.com/direct/inbox/';
    const clean = currentContact.username.replace('@', '').trim();
    return `https://ig.me/m/${clean}`;
  }, [currentContact]);

  // Alterna som
  const toggleSound = () => {
    const next = !soundEnabled;
    sound.setEnabled(next);
    setSoundEnabled(next);
    showToast(`Efeitos sonoros ${next ? 'ativados' : 'desativados'}`, 'info');
  };

  // Sorteia nova variação Spintax
  const handleShuffleSpintax = () => {
    setSpintaxSeed((prev) => prev + 1);
    sound.playCopy();
    showToast('Nova variação Spintax gerada com sucesso!', 'info');
  };

  // Ações do Assistente
  const handleOpenPost = () => {
    if (activeCampaign?.post_url) {
      openExternalUrl(activeCampaign.post_url);
      showToast('Publicação aberta no navegador padrão.', 'info');
    }
  };

  const handleOpenDirect = () => {
    if (userInstagramUrl) {
      openExternalUrl(userInstagramUrl);
      showToast(`Abrindo Direct para @${currentContact?.username} no navegador.`, 'info');
    }
  };

  const handleOpenUserProfile = () => {
    if (currentContact?.username) {
      const clean = currentContact.username.replace('@', '').trim();
      openExternalUrl(`https://www.instagram.com/${clean}/`);
    }
  };

  // 1. Copiar mensagem privada
  const handleCopyPrivateMessage = async () => {
    if (!interpolatedPrivateMessage) return;
    const ok = await copyToClipboard(interpolatedPrivateMessage);
    if (ok) {
      sound.playCopy();
      setCopiedPrivate(true);
      setTimeout(() => setCopiedPrivate(false), 2000);
      showToast('Mensagem privada copiada! Cole no Direct do Instagram.', 'success');

      if (currentContact && currentContact.status === 'Pendente') {
        try {
          const updated = await api.prepareContact(currentContact.id);
          setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        } catch (err) {
          console.error(err);
        }
      }
    } else {
      showToast('Não foi possível copiar para a área de transferência', 'error');
    }
  };

  // 2. Confirmação manual de envio do Direct pelo operador
  const handleConfirmDirectSent = async () => {
    if (!currentContact) return;
    try {
      const updated = await api.confirmDirect(currentContact.id);
      setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      sound.playSuccess();
      showToast(`Direct confirmado para @${currentContact.username}! Próximo passo: resposta pública.`, 'success');

      // Dispara o Cronômetro de Cadência Humana
      if (safeDelayConfig > 0) {
        setCooldownRemaining(safeDelayConfig);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao confirmar envio do direct', 'error');
    }
  };

  // 3. Copiar resposta pública
  const handleCopyPublicReply = async () => {
    if (!interpolatedPublicReply) return;
    const ok = await copyToClipboard(interpolatedPublicReply);
    if (ok) {
      sound.playCopy();
      setCopiedPublic(true);
      setTimeout(() => setCopiedPublic(false), 2000);
      showToast('Resposta pública copiada! Cole no comentário do Instagram.', 'success');
    } else {
      showToast('Não foi possível copiar a resposta pública', 'error');
    }
  };

  // 4. Confirmar resposta pública postada
  const handleConfirmPublicReply = async () => {
    if (!currentContact) return;
    try {
      const updated = await api.confirmPublicReply(currentContact.id);
      setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      sound.playSuccess();
      showToast(`Resposta pública registrada para @${currentContact.username}!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao confirmar resposta pública', 'error');
    }
  };

  // 5. Concluir atendimento completo
  const handleCompleteContact = async () => {
    if (!currentContact) return;
    try {
      const updated = await api.completeContact(currentContact.id);
      setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      sound.playSuccess();
      showToast(`Atendimento de @${currentContact.username} concluído com sucesso!`, 'success');

      // Nova semente Spintax para o próximo atendimento
      setSpintaxSeed((prev) => prev + 1);

      // Avança para o próximo pendente da fila
      const nextPending = contacts.find((c) => c.id !== currentContact.id && c.status !== 'Concluído' && c.status !== 'Cancelado');
      if (nextPending) {
        setActiveContactId(nextPending.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao concluir atendimento', 'error');
    }
  };

  // 6. Cancelar atendimento
  const handleCancelContact = async () => {
    if (!currentContact) return;
    try {
      const updated = await api.cancelContact(currentContact.id, cancelReason);
      setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showToast(`Atendimento de @${currentContact.username} cancelado.`, 'info');
      setIsCancelModalOpen(false);
      setCancelReason('');

      const nextPending = contacts.find((c) => c.id !== currentContact.id && c.status !== 'Concluído' && c.status !== 'Cancelado');
      if (nextPending) {
        setActiveContactId(nextPending.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao cancelar atendimento', 'error');
    }
  };

  // 7. Alternar Tag de Segmentação no Contato Ativo
  const handleToggleTag = async (tagLabel: string) => {
    if (!currentContact) return;
    try {
      let currentTags = currentContact.tags ? currentContact.tags.split(',').map((t) => t.trim()) : [];
      if (currentTags.includes(tagLabel)) {
        currentTags = currentTags.filter((t) => t !== tagLabel);
      } else {
        currentTags.push(tagLabel);
      }
      const newTagsStr = currentTags.join(', ');
      const updated = await api.updateContactTags(currentContact.id, newTagsStr);
      setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      sound.playCopy();
      showToast(`Tags atualizadas para @${currentContact.username}`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar tag', 'error');
    }
  };

  // Adicionar novo atendimento individual
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaignId) {
      showToast('Selecione uma campanha primeiro', 'warning');
      return;
    }
    if (!newUsername.trim()) {
      showToast('Informe o nome de usuário do Instagram (@)', 'warning');
      return;
    }

    setAddingContact(true);
    try {
      const cleanUsername = newUsername.trim().replace(/^@/, '');
      const created = await api.createContact({
        campaign_id: selectedCampaignId,
        username: cleanUsername,
        internal_id: newInternalId.trim() || undefined,
        comment_id: newCommentId.trim() || undefined,
        notes: newNotes.trim() || undefined,
      });

      setContacts((prev) => [created, ...prev]);
      setActiveContactId(created.id);
      sound.playSuccess();
      showToast(`Atendimento para @${cleanUsername} adicionado à bancada!`, 'success');
      
      setNewUsername('');
      setNewInternalId('');
      setNewCommentId('');
      setNewNotes('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Erro ao cadastrar atendimento', 'error');
    } finally {
      setAddingContact(false);
    }
  };

  // Importar comentários em lote
  const handleBatchImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaignId) {
      showToast('Selecione uma campanha primeiro', 'warning');
      return;
    }
    if (!batchRawText.trim()) {
      showToast('Cole o texto dos comentários para extração', 'warning');
      return;
    }

    setBatchImporting(true);
    try {
      const result = await api.createContactsBatch({
        campaign_id: selectedCampaignId,
        raw_text: batchRawText,
        tag: batchDefaultTag,
      });

      sound.playSuccess();
      showToast(`${result.inserted} novos usuários importados para a fila! (${result.found} detectados)`, 'success');
      setBatchRawText('');
      setIsBatchModalOpen(false);
      loadContacts();
    } catch (err: any) {
      showToast(err.message || 'Erro ao importar lote', 'error');
    } finally {
      setBatchImporting(false);
    }
  };

  // Atalhos de teclado operacionais
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.altKey && e.key === '1') {
        e.preventDefault();
        handleCopyPrivateMessage();
      } else if (e.altKey && e.key === '2') {
        e.preventDefault();
        handleOpenDirect();
      } else if (e.altKey && e.key === '3') {
        e.preventDefault();
        handleConfirmDirectSent();
      } else if (e.altKey && e.key === '4') {
        e.preventDefault();
        handleCopyPublicReply();
      } else if ((e.altKey && e.key === '5') || (e.altKey && e.key === 'Enter')) {
        e.preventDefault();
        handleCompleteContact();
      } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setIsAddModalOpen(true);
      } else if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleShuffleSpintax();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentContact,
    interpolatedPrivateMessage,
    interpolatedPublicReply,
    userInstagramUrl,
    handleCopyPrivateMessage,
    handleOpenDirect,
    handleConfirmDirectSent,
    handleCopyPublicReply,
    handleCompleteContact,
    handleShuffleSpintax
  ]);

  // Filtra contatos da lista
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesSearch = c.username.toLowerCase().includes(searchContact.toLowerCase()) ||
        (c.internal_id && c.internal_id.toLowerCase().includes(searchContact.toLowerCase())) ||
        (c.tags && c.tags.toLowerCase().includes(searchContact.toLowerCase())) ||
        (c.notes && c.notes.toLowerCase().includes(searchContact.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [contacts, statusFilter, searchContact]);

  const pendingQueueCount = useMemo(() => {
    return contacts.filter((c) => c.status !== 'Concluído' && c.status !== 'Cancelado').length;
  }, [contacts]);

  // Contagem de @ detectados em tempo real no modal de lote
  const detectedBatchUsernamesCount = useMemo(() => {
    if (!batchRawText) return 0;
    const atMatches = batchRawText.match(/@([a-zA-Z0-9._]{2,30})/g);
    if (atMatches) return new Set(atMatches.map((m) => m.toLowerCase())).size;
    const lines = batchRawText.split(/\r?\n/).filter((l) => /^[a-zA-Z0-9._]{2,30}$/.test(l.trim().replace(/^@/, '')));
    return new Set(lines.map((l) => l.toLowerCase())).size;
  }, [batchRawText]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Top Bar da Bancada de Operação */}
      <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
        {/* Seletor de Campanha */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
            Campanha:
          </label>
          <select
            value={selectedCampaignId || ''}
            onChange={(e) => setSelectedCampaignId(Number(e.target.value))}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 max-w-xs"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.status})
              </option>
            ))}
          </select>

          {activeCampaign && (
            <>
              <button
                onClick={handleOpenPost}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 transition-colors"
                title="Abrir a publicação no Instagram no navegador padrão"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir Post</span>
              </button>

              {(!activeCampaign.keywords || activeCampaign.keywords === 'todos' || activeCampaign.keywords === '*' || activeCampaign.keywords === 'todos os comentários') ? (
                <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-semibold" title="Qualquer pessoa que comentar recebe o link">
                  <span>🎯 Todos os comentários</span>
                </span>
              ) : (
                <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[11px] font-semibold truncate max-w-xs" title={`Palavras-chave: ${activeCampaign.keywords}`}>
                  <span>🔍 {activeCampaign.keywords}</span>
                </span>
              )}
            </>
          )}
        </div>

        {/* Indicador de Cadência, Spintax e Controles */}
        <div className="flex items-center gap-2.5">
          {/* Alerta de Cadência Humana Segura */}
          {cooldownRemaining > 0 ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold animate-pulse">
              <Timer className="w-3.5 h-3.5 text-amber-500" />
              <span>Cadência segura: aguarde {cooldownRemaining}s</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Ritmo humano liberado</span>
            </div>
          )}

          {/* Botão de Som Mudo / Ativo */}
          <button
            onClick={toggleSound}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title={soundEnabled ? 'Desativar sons' : 'Ativar sons'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-rose-500" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          {/* Botão de Importação em Lote */}
          <button
            onClick={() => setIsBatchModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
            title="Importar múltiplos comentários colando o texto da página"
          >
            <ListPlus className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Importar em Lote</span>
          </button>

          {/* Botão Novo Atendimento Individual */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition-all"
            title="Cadastrar novo comentário para atendimento (Alt+N)"
          >
            <Plus className="w-4 h-4" />
            <span>Novo</span>
          </button>
        </div>
      </div>

      {/* Conteúdo Principal Split: Fila à Esquerda, Bancada de Operação à Direita */}
      <div className="flex-1 flex overflow-hidden">
        {/* Painel Esquerdo: Fila de Comentários / Atendimentos */}
        <div className="w-80 md:w-96 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
          {/* Busca e Filtros da Fila */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar usuário, tag ou nota..."
                value={searchContact}
                onChange={(e) => setSearchContact(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'Pendente', label: 'Pendentes' },
                { id: 'Mensagem preparada', label: 'Prep.' },
                { id: 'Direct confirmado pelo operador', label: 'DM Conf.' },
                { id: 'Concluído', label: 'Conc.' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Atendimentos */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredContacts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-3">
                <User className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                <p>Nenhum atendimento nesta fila.</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="text-xs text-rose-500 font-semibold hover:underline"
                  >
                    + Adicionar um usuário manual
                  </button>
                  <button
                    onClick={() => setIsBatchModalOpen(true)}
                    className="text-xs text-indigo-500 font-semibold hover:underline"
                  >
                    + Colar lista de comentários em lote
                  </button>
                </div>
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isActive = contact.id === activeContactId;

                let statusBadge = (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {contact.status}
                  </span>
                );

                if (contact.status === 'Pendente') {
                  statusBadge = (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300">
                      Pendente
                    </span>
                  );
                } else if (contact.status === 'Mensagem preparada') {
                  statusBadge = (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">
                      Msg Preparada
                    </span>
                  );
                } else if (contact.status === 'Direct confirmado pelo operador') {
                  statusBadge = (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300">
                      DM Confirmado
                    </span>
                  );
                } else if (contact.status === 'Concluído') {
                  statusBadge = (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300">
                      Concluído
                    </span>
                  );
                } else if (contact.status === 'Cancelado') {
                  statusBadge = (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300">
                      Cancelado
                    </span>
                  );
                }

                return (
                  <div
                    key={contact.id}
                    onClick={() => setActiveContactId(contact.id)}
                    className={`p-3 cursor-pointer transition-all flex items-start justify-between gap-3 ${
                      isActive
                        ? 'bg-rose-50/70 dark:bg-rose-950/30 border-l-4 border-rose-500'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          @{contact.username}
                        </span>
                        {contact.tags && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-semibold truncate max-w-[120px]">
                            {contact.tags}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        {statusBadge}
                        <span className="text-[10px] text-slate-400">
                          {formatRelativeTime(contact.created_at)}
                        </span>
                      </div>

                      {contact.notes && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1">
                          {contact.notes}
                        </p>
                      )}
                    </div>

                    <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-rose-500 translate-x-0.5' : 'text-slate-300 dark:text-slate-700'}`} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Painel Direito: A BANCADA DE ATENDIMENTO Guiada (Workflow Operacional Rápido) */}
        <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-6 overflow-y-auto space-y-6">
          {!currentContact ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-xs">
                <Sparkles className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Selecione ou cadastre um atendimento
              </h3>
              <p className="text-xs max-w-md text-slate-500 dark:text-slate-400">
                Identifique o comentário no Instagram, cadastre o usuário ou importe em lote para começar o atendimento acelerado com Spintax.
              </p>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => setIsBatchModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-2"
                >
                  <ListPlus className="w-4 h-4 text-indigo-400" />
                  <span>Importar em Lote</span>
                </button>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Individual</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Card do Usuário em Atendimento, Tags Rápidas e Etapas */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-rose-500/20">
                      {currentContact.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          @{currentContact.username}
                        </h3>
                        <button
                          onClick={handleOpenUserProfile}
                          className="text-xs text-rose-500 hover:underline flex items-center gap-1 font-semibold"
                          title="Abrir perfil no Instagram"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Perfil
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        {currentContact.internal_id && <span>ID: #{currentContact.internal_id}</span>}
                        <span>•</span>
                        <span>Registrado em {formatDate(currentContact.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Atual e Ação de Cancelamento */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Estado Atual</span>
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        {currentContact.status}
                      </span>
                    </div>

                    <button
                      onClick={() => setIsCancelModalOpen(true)}
                      className="px-2.5 py-1 text-xs text-slate-400 hover:text-rose-600 rounded-lg transition-colors border border-slate-200 dark:border-slate-800 hover:border-rose-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>

                {/* Seletor Rápido de Tags de Qualificação */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 shrink-0">
                    <Tag className="w-3 h-3" /> Qualificar Lead:
                  </span>
                  {PRESET_TAGS.map((t) => {
                    const isSelected = currentContact.tags?.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleToggleTag(t.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          isSelected
                            ? `${t.color} shadow-xs ring-1 ring-rose-500/30 scale-105`
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* Linha do Tempo das Etapas Operacionais (Regra de Confirmação Humana) */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className={`p-2 rounded-xl border ${currentContact.prepared_at ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-300' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
                    <div className="font-bold flex items-center justify-center gap-1">
                      {currentContact.prepared_at ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Clock className="w-3.5 h-3.5" />}
                      1. Msg Preparada
                    </div>
                    <span className="text-[10px] block mt-0.5">
                      {currentContact.prepared_at ? formatDate(currentContact.prepared_at) : 'Pendente'}
                    </span>
                  </div>

                  <div className={`p-2 rounded-xl border ${currentContact.private_message_sent ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-300' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
                    <div className="font-bold flex items-center justify-center gap-1">
                      {currentContact.private_message_sent ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Clock className="w-3.5 h-3.5" />}
                      2. Direct Enviado
                    </div>
                    <span className="text-[10px] block mt-0.5">
                      {currentContact.direct_confirmed_at ? formatDate(currentContact.direct_confirmed_at) : 'Confirmação pendente'}
                    </span>
                  </div>

                  <div className={`p-2 rounded-xl border ${currentContact.public_reply_sent ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-300' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
                    <div className="font-bold flex items-center justify-center gap-1">
                      {currentContact.public_reply_sent ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Clock className="w-3.5 h-3.5" />}
                      3. Resposta Pública
                    </div>
                    <span className="text-[10px] block mt-0.5">
                      {currentContact.public_replied_at ? formatDate(currentContact.public_replied_at) : 'Pendente'}
                    </span>
                  </div>

                  <div className={`p-2 rounded-xl border ${currentContact.status === 'Concluído' ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-300' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
                    <div className="font-bold flex items-center justify-center gap-1">
                      {currentContact.status === 'Concluído' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Clock className="w-3.5 h-3.5" />}
                      4. Concluído
                    </div>
                    <span className="text-[10px] block mt-0.5">
                      {currentContact.completed_at ? formatDate(currentContact.completed_at) : 'Em aberto'}
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD 1: MENSAGEM PRIVADA COM O LINK (DIRECT) & SPINTAX */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Passo 1: Envio do Link no Direct
                        {privateVariationsCount > 1 && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                            Spintax: ~{privateVariationsCount} variações
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Copie o texto, abra o Direct do Instagram e confirme o envio manualmente.
                      </p>
                    </div>
                  </div>

                  {/* Botão de Sortear Variação Spintax */}
                  <button
                    onClick={handleShuffleSpintax}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    title="Gerar outra variação de texto Spintax (Alt+S)"
                  >
                    <Shuffle className="w-3 h-3 text-purple-500" />
                    <span>Variar Texto</span>
                  </button>
                </div>

                {/* Caixa de Texto da Mensagem Privada com Preview Real */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
                    <span>Prévia com link interpolado e variação ativa:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Pronta para copiar</span>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap select-all font-sans leading-relaxed">
                    {interpolatedPrivateMessage}
                  </p>
                </div>

                {/* Botões Operacionais Grandes para Mensagem Privada */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handleCopyPrivateMessage}
                    className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                      copiedPrivate
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700'
                    }`}
                  >
                    {copiedPrivate ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-amber-400" />}
                    <span>{copiedPrivate ? 'Copiado!' : '1. Copiar Mensagem (Alt+1)'}</span>
                  </button>

                  <button
                    onClick={handleOpenDirect}
                    className="py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-sm shadow-purple-600/20"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>2. Abrir Direct IG (Alt+2)</span>
                  </button>

                  <button
                    onClick={handleConfirmDirectSent}
                    className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                      currentContact.private_message_sent
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                    }`}
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>
                      {currentContact.private_message_sent
                        ? 'Direct Confirmado ✓'
                        : '3. Confirmo Envio (Alt+3)'}
                    </span>
                  </button>
                </div>
              </div>

              {/* CARD 2: RESPOSTA PÚBLICA NO COMENTÁRIO */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Passo 2: Resposta Pública no Comentário
                        {publicVariationsCount > 1 && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            Spintax: ~{publicVariationsCount} variações
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Avise publicamente que o link foi enviado para incentivar outros comentários.
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400">Atalho: Alt+4</span>
                </div>

                {/* Caixa de Texto da Resposta Pública */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                  <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap select-all font-sans leading-relaxed">
                    {interpolatedPublicReply}
                  </p>
                </div>

                {/* Botões Operacionais da Resposta Pública */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleCopyPublicReply}
                    className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                      copiedPublic
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700'
                    }`}
                  >
                    {copiedPublic ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-rose-400" />}
                    <span>{copiedPublic ? 'Copiado!' : 'Copiar Resposta Pública (Alt+4)'}</span>
                  </button>

                  <button
                    onClick={handleConfirmPublicReply}
                    className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      currentContact.public_reply_sent
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {currentContact.public_reply_sent
                        ? 'Resposta Registrada ✓'
                        : 'Marcar Resposta como Publicada'}
                    </span>
                  </button>
                </div>
              </div>

              {/* BARRA FINAL: CONCLUIR ATENDIMENTO */}
              <div className="bg-gradient-to-r from-rose-600 to-indigo-600 p-4 rounded-2xl text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Finalizar ciclo para @{currentContact.username}
                  </h4>
                  <p className="text-xs text-rose-100 mt-0.5">
                    Garante o registro histórico completo e avança automaticamente para o próximo da fila.
                  </p>
                </div>

                <button
                  onClick={handleCompleteContact}
                  className="px-6 py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 active:scale-95 text-xs font-bold shadow-md transition-all shrink-0 flex items-center gap-2"
                >
                  <span>Concluir Atendimento (Alt+Enter)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Adicionar Novo Atendimento Individual */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Identificar Comentário para Atendimento"
        maxWidth="md"
      >
        <form onSubmit={handleAddContact} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nome de Usuário (@) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">@</span>
              <input
                type="text"
                required
                autoFocus
                placeholder="usuario.instagram"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ID Interno (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: LEAD-102"
                value={newInternalId}
                onChange={(e) => setNewInternalId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ID Comentário (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: c_178492..."
                value={newCommentId}
                onChange={(e) => setNewCommentId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observações / Comentário feito (opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Comentou 'quero o link vip'"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={addingContact}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20"
            >
              {addingContact ? 'Adicionando...' : 'Adicionar à Fila'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Importação em Lote de Comentários */}
      <Modal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        title="Importação em Lote de Comentários"
        maxWidth="lg"
      >
        <form onSubmit={handleBatchImport} className="space-y-4">
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-300 space-y-1">
            <span className="font-bold flex items-center gap-1.5">
              <ListPlus className="w-3.5 h-3.5" /> Colar Comentários do Instagram
            </span>
            <p>
              Abra a publicação no Instagram, selecione os comentários com o mouse (ou Ctrl+A) e copie. Cole tudo na caixa abaixo: nosso extrator inteligente identificará automaticamente todos os @arrobas e adicionará cada um na fila!
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Texto Copiado dos Comentários *
              </label>
              {detectedBatchUsernamesCount > 0 && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {detectedBatchUsernamesCount} usuários detectados
                </span>
              )}
            </div>
            <textarea
              rows={6}
              required
              autoFocus
              placeholder="Cole aqui o texto dos comentários copiados do Instagram... Ex:&#10;@maria_silva eu quero muito&#10;@joao.dev manda o link pfv&#10;@ana_clara vip"
              value={batchRawText}
              onChange={(e) => setBatchRawText(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tag Inicial para este Lote:
            </label>
            <select
              value={batchDefaultTag}
              onChange={(e) => setBatchDefaultTag(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="🔥 Quente">🔥 Quente</option>
              <option value="💰 Pediu Preço">💰 Pediu Preço</option>
              <option value="❓ Dúvida">❓ Dúvida</option>
              <option value="💬 Engajamento">💬 Engajamento</option>
              <option value="Sem tag">Sem tag</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsBatchModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={batchImporting || detectedBatchUsernamesCount === 0}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-md shadow-indigo-600/20 flex items-center gap-2"
            >
              <ListPlus className="w-4 h-4" />
              <span>{batchImporting ? 'Importando...' : `Importar ${detectedBatchUsernamesCount} Usuários`}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Cancelar Atendimento */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancelar Atendimento"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Informe o motivo do cancelamento para registro na auditoria:
          </p>

          <input
            type="text"
            placeholder="Ex: Perfil privado, comentário fora do contexto, etc."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCancelModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleCancelContact}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700"
            >
              Confirmar Cancelamento
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
