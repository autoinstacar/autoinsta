import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

export const SafetyBanner: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-indigo-950/30 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-4 transition-all duration-200">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Modo Assistente Seguro (Human-in-the-Loop)
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                100% Em Conformidade
              </span>
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Sem scraping ilegal, sem armazenamento de senhas ou cookies, sem automações invasivas. Cada ação depende da sua confirmação manual.
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
        >
          {expanded ? 'Ocultar detalhes' : 'Diretrizes de segurança'}
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-emerald-500/20 dark:border-emerald-500/20 text-xs text-slate-600 dark:text-slate-300 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-start gap-2">
            <span className="font-bold text-emerald-600 dark:text-emerald-400">•</span>
            <span>
              <strong>Zero armazenamento de credenciais:</strong> O aplicativo nunca solicita nem salva sua senha, tokens de API ou cookies de sessão do Instagram.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-emerald-600 dark:text-emerald-400">•</span>
            <span>
              <strong>Ritmo humano:</strong> Mantenha intervalos naturais entre as respostas para evitar gatilhos anti-spam da plataforma do Instagram.
            </span>
          </div>
          <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <strong>Atenção operacional:</strong> Se você visualizar qualquer aviso de segurança ou limitação de ação no Instagram, interrompa imediatamente os atendimentos e siga as instruções diretamente no aplicativo oficial do Instagram. Não utilize proxies ou ferramentas de evasão.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
