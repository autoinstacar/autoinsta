import React from 'react';
import { 
  LayoutDashboard, 
  Send, 
  Layers, 
  History, 
  Download, 
  Settings, 
  Sun, 
  Moon, 
  Sparkles,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export type NavTab = 'dashboard' | 'assistant' | 'campaigns' | 'history' | 'backup' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, pendingCount = 0 }) => {
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { 
      id: 'assistant' as NavTab, 
      label: 'Assistente Copilot', 
      icon: Zap,
      badge: pendingCount > 0 ? String(pendingCount) : undefined,
      highlight: true
    },
    { id: 'campaigns' as NavTab, label: 'Campanhas', icon: Layers },
    { id: 'history' as NavTab, label: 'Histórico & Logs', icon: History },
    { id: 'backup' as NavTab, label: 'Exportar & Backup', icon: Download },
    { id: 'settings' as NavTab, label: 'Configurações', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 select-none transition-colors duration-200">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
            <Send className="w-5 h-5 -rotate-12 translate-x-0.5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight flex items-center gap-1.5">
              InstaAssist
              <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">
                Local
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Operação Human-in-the-loop</p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Módulos
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left ${
                isActive
                  ? item.highlight
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20 dark:shadow-none'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive && !item.highlight ? 'text-rose-500' : ''}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                  isActive 
                    ? 'bg-white text-rose-600' 
                    : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Safety Badge / Footer */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Sem Bot / Sem Senha</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
            Execução 100% manual e segura no seu Windows.
          </p>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            {theme === 'dark' ? <Moon className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <span>{theme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Alternar</span>
        </button>
      </div>
    </aside>
  );
};
