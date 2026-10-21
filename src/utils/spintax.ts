/**
 * Parser e gerador de Spintax para variação de mensagens.
 * Suporta sintaxe {opção 1|opção 2|opção 3} com suporte a opções aninhadas.
 * Exemplo: "{Oi|Olá|E aí} {{usuario}}, {segue|aqui está} o link: {{link_grupo}}"
 */

export function parseSpintax(text: string): string {
  if (!text) return '';

  const spintaxRegex = /\{([^{}]+)\}/;
  let matches = spintaxRegex.exec(text);

  let result = text;
  while (matches) {
    const choices = matches[1].split('|');
    const randomChoice = choices[Math.floor(Math.random() * choices.length)];
    result = result.replace(matches[0], randomChoice);
    matches = spintaxRegex.exec(result);
  }

  return result;
}

/**
 * Calcula o número aproximado de variações possíveis em um texto com spintax
 */
export function calculateVariationsCount(text: string): number {
  if (!text) return 1;
  const matches = text.match(/\{([^{}]+)\}/g);
  if (!matches) return 1;

  let total = 1;
  for (const match of matches) {
    const content = match.slice(1, -1);
    const count = content.split('|').length;
    total *= count;
  }
  return total;
}
