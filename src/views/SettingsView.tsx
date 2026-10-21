import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Sun, 
  Moon, 
  Command, 
  ShieldCheck, 
  AlertTriangle, 
  Save, 
  User, 
  CheckCircle2, 
  ExternalLink 
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { api } from '../utils/api';

export const SettingsView: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const [operatorName, setOperatorName] = useState('Operador Local');
  const [enableShortcuts, setEnableShortcuts] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      if (s.operator_name) setOperatorName(s.operator_name);
      if (s.enable_keyboard_shortcuts !== undefined) {
        setEnableShortcuts(s.enable_keyboard_shortcuts === 'true');
      }
    }).catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveSettings({
        operator_name: operatorName,
        enable_keyboard_shortcuts: String(enableShortcuts),
        theme,
      });
      showToast('Configurações salvas localmente!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar configurações', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Configurações & Diretrizes</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Personalize preferências locais do aplicativo e consulte as diretrizes de segurança
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card: Preferências Gerais */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-rose-500" />
            Preferências do Operador
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome ou Identificação do Operador
              </label>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tema Visual da Interface
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  {theme === 'dark' ? <Moon className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                  <span>{theme === 'dark' ? 'Modo Escuro (Dark)' : 'Modo Claro (Light)'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enableShortcuts}
                onChange={(e) => setEnableShortcuts(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
              />
              <span>Ativar atalhos rápidos de teclado globais no Assistente</span>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Card: Guia de Atalhos de Teclado */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Command className="w-4 h-4 text-purple-500" />
          Guia de Atalhos de Produtividade (Assistente)
        </h3>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300">Copiar Mensagem Privada</span>
            <kbd className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              Alt + 1
            </kbd>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300">Abrir Direct do Usuário no Instagram</span>
            <kbd className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              Alt + 2
            </kbd>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300">Confirmar Envio Manual do Direct</span>
            <kbd className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              Alt + 3
            </kbd>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300">Copiar Resposta Pública</span>
            <kbd className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              Alt + 4
            </kbd>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300">Concluir Atendimento e Avançar na Fila</span>
            <kbd className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              Alt + Enter ou Alt + 5
            </kbd>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300">Identificar Novo Comentário / Usuário</span>
            <kbd className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              Alt + N
            </kbd>
          </div>
        </div>
      </div>

      {/* Card: Segurança e Boas Práticas (Item 7) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Segurança e Conformidade (Item 7 da Especificação)
        </h3>

        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>
            Este aplicativo foi desenvolvido estritamente como um <strong>assistente local com confirmação humana</strong>.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Nenhuma senha ou token de autenticação é solicitado ou gravado em banco de dados.</li>
            <li>Não há conexões ocultas com robôs, nem scraping automatizado do código-fonte do Instagram.</li>
            <li>Não há contorno de CAPTCHAs, proxies ou tentativas de burlar os limites do Instagram.</li>
          </ul>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Procedimento em caso de aviso:</strong> Caso sua conta apresente qualquer aviso de atividade suspeita ou bloqueio temporário de envio de mensagens no Instagram, <strong>interrompa imediatamente o envio manual</strong> e realize o procedimento de verificação diretamente pelo aplicativo oficial da Meta.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
