import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { DashboardView } from './views/DashboardView';
import { CampaignsView } from './views/CampaignsView';
import { AssistantView } from './views/AssistantView';
import { HistoryView } from './views/HistoryView';
import { ExportBackupView } from './views/ExportBackupView';
import { SettingsView } from './views/SettingsView';
import { Modal } from './components/Modal';
import { api } from './utils/api';
import { Command } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [selectedCampaignForAssistant, setSelectedCampaignForAssistant] = useState<number | undefined>(undefined);
  const [backendOnline, setBackendOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Monitora contagem de pendentes e status do backend
  const checkStatus = async () => {
    try {
      const contacts = await api.getContacts({ status: 'Pendente' });
      setPendingCount(contacts.length);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, [currentTab]);

  const handleNavigateToAssistant = (campaignId?: number) => {
    if (campaignId) setSelectedCampaignForAssistant(campaignId);
    setCurrentTab('assistant');
  };

  const getTabTitle = (tab: NavTab) => {
    switch (tab) {
      case 'dashboard':
        return { title: 'Painel Geral', subtitle: 'Métricas e funil de conversão' };
      case 'assistant':
        return { title: 'Assistente Copilot de Atendimento', subtitle: 'Operação rápida com confirmação humana' };
      case 'campaigns':
        return { title: 'Campanhas & Links', subtitle: 'Configuração de publicações e modelos' };
      case 'history':
        return { title: 'Histórico & Logs', subtitle: 'Auditoria cronológica de atendimentos' };
      case 'backup':
        return { title: 'Exportar & Backup', subtitle: 'Download de relatórios CSV e banco SQLite' };
      case 'settings':
        return { title: 'Configurações', subtitle: 'Preferências do operador e segurança' };
      default:
        return { title: 'InstaAssist', subtitle: '' };
    }
  };

  const { title, subtitle } = getTabTitle(currentTab);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Sidebar Compacto */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        pendingCount={pendingCount}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          title={title}
          subtitle={subtitle}
          backendOnline={backendOnline}
          onOpenShortcutsHelp={() => setIsShortcutsModalOpen(true)}
        />

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {currentTab === 'dashboard' && (
            <DashboardView
              onNavigateToAssistant={handleNavigateToAssistant}
              onNavigateToCampaigns={() => setCurrentTab('campaigns')}
            />
          )}

          {currentTab === 'assistant' && (
            <AssistantView
              initialCampaignId={selectedCampaignForAssistant}
            />
          )}

          {currentTab === 'campaigns' && (
            <CampaignsView
              onSelectCampaignForAssistant={handleNavigateToAssistant}
            />
          )}

          {currentTab === 'history' && <HistoryView />}

          {currentTab === 'backup' && <ExportBackupView />}

          {currentTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Modal de Atalhos Rápidos */}
      <Modal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
        title="Atalhos de Teclado Globais"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Utilize estes atalhos dentro da tela do Assistente para acelerar o fluxo sem tirar a mão do teclado:
          </p>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300">1. Copiar mensagem privada</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-rose-500">Alt + 1</kbd>
            </div>
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300">2. Abrir direct no Instagram</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-rose-500">Alt + 2</kbd>
            </div>
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300">3. Confirmar envio manual do direct</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-rose-500">Alt + 3</kbd>
            </div>
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300">4. Copiar resposta pública</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-rose-500">Alt + 4</kbd>
            </div>
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300">5. Concluir atendimento (e avançar)</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-rose-500">Alt + Enter</kbd>
            </div>
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300">6. Adicionar novo comentário na fila</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-rose-500">Alt + N</kbd>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={() => setIsShortcutsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-slate-800 text-white hover:opacity-90"
            >
              Fechar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
