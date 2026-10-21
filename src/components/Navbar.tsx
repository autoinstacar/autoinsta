import React from 'react';
import { CircleDot, User, HelpCircle, Command } from 'lucide-react';
import { isSupabaseConfigured } from '../utils/supabase';

interface NavbarProps {
  title: string;
  subtitle?: string;
  backendOnline: boolean;
  onOpenShortcutsHelp?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  subtitle,
  backendOnline,
  onOpenShortcutsHelp
}) => {
  return (
    <header className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0 transition-colors duration-200">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Backend / Cloud Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured || backendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-slate-600 dark:text-slate-300">
            {isSupabaseConfigured ? 'Supabase Nuvem 24h Ativo' : (backendOnline ? 'SQLite Local Ativo' : 'Desconectado')}
          </span>
        </div>

        {/* Atalhos de Teclado Modal Trigger */}
        {onOpenShortcutsHelp && (
          <button
            onClick={onOpenShortcutsHelp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            title="Ver atalhos de teclado de produtividade"
          >
            <Command className="w-3.5 h-3.5 text-rose-500" />
            <span>Atalhos</span>
          </button>
        )}
      </div>
    </header>
  );
};
