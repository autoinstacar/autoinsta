# 🚀 InstaAssist Local - Assistente de Automação de Comentários do Instagram

**InstaAssist** é um aplicativo desktop-first com interface SaaS moderna, projetado para ser executado 100% localmente no computador Windows. Ele organiza campanhas de comentários do Instagram e agiliza o envio de links no Direct através de um fluxo de **assistência com confirmação humana (Human-in-the-Loop)**.

---

## 🛡️ Filosofia de Segurança e Conformidade (Item 7)

- **Zero APIs Oficiais Pagas & Zero Serviços de Nuvem:** Não depende de servidores externos, bancos de dados remotos ou APIs pagas de IA.
- **Zero Bots Invasivos & Zero Scraping Ilegal:** O aplicativo **não** faz leitura automatizada de comentários, **não** envia mensagens sozinho e **não** contorna proteções da plataforma (CAPTCHAs, proxies ou falsificação de navegadores).
- **Zero Armazenamento de Credenciais:** O sistema **nunca** solicita ou armazena senhas, cookies de sessão ou tokens do Instagram.
- **Confirmação Humana Obrigatória:** O sistema diferencia com rigor o que foi meramente preparado ou copiado daquilo que o operador realmente enviou e confirmou manualmente no Direct.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide React
- **Backend Local:** Node.js + Express (porta local 3001)
- **Banco de Dados:** SQLite binário (`data/instagram_assistant.sqlite`) através de `sql.js` (WebAssembly SQLite de alta estabilidade, sem necessidade de ferramentas de compilação em C++)
- **Desktop Packaging:** Electron pré-configurado para inicialização desktop nativa no Windows
- **Exportação:** CSV (com BOM UTF-8 e delimitador `;` para Excel) e Backup/Restore em JSON e `.sqlite`

---

## 📋 Funcionalidades Principais

### 1. Dashboard de Métricas Operacionais
- Campanhas cadastradas e campanhas ativas em andamento.
- Links de grupos e destinos cadastrados.
- Total de atendimentos registrados na fila.
- **Funil estrito:** Mensagens preparadas vs. Directs confirmados pelo operador vs. Respostas públicas pendentes vs. Atendimentos concluídos.
- Feed cronológico com as últimas ações de auditoria.

### 2. Gestão de Campanhas e Modelos
- Cadastro com:
  - Nome da campanha
  - URL da publicação do Instagram (com botão para abrir no navegador padrão com 1 clique)
  - Link do grupo de destino
  - Mensagem privada padrão com interpolação de `{{link_grupo}}` e `{{usuario}}`
  - Resposta pública padrão orientando o seguidor a olhar as mensagens diretas
  - Palavras-chave de orientação para os operadores
  - Status ativo ou pausado
- Ações rápidas: Editar, duplicar modelo e campanha, alternar status e exclusão com diálogo de confirmação.

### 3. Assistente Copilot (Bancada de Atendimento Rápido)
- Seleção de campanha e abertura da publicação oficial no Instagram.
- Fila visual de comentários para evitar perder a ordem dos seguidores.
- Identificação manual do usuário (`@usuario`) e ID interno opcional.
- Prévia em tempo real com substituição automática do `{{link_grupo}}` cadastrado.
- Botões grandes com feedback tátil e visual (Toasts).
- Workflow guiado em 4 etapas:
  1. **Copiar Mensagem Privada** (muda estado para *Mensagem preparada*)
  2. **Abrir Direct no Instagram** (abre diretamente a conversa com o usuário no navegador padrão)
  3. **Confirmar Envio do Direct** (registro explícito pelo operador)
  4. **Copiar e Publicar Resposta Pública**
  5. **Concluir Atendimento** (avança automaticamente para o próximo da fila)
- Tratamento de cancelamento com motivo registrado no histórico.

### 4. Atalhos de Produtividade no Teclado
Na bancada do assistente, opere tudo pelo teclado:
- `Alt + 1`: Copiar mensagem privada com link interpolado
- `Alt + 2`: Abrir direct do usuário no Instagram
- `Alt + 3`: Confirmar envio manual do direct
- `Alt + 4`: Copiar resposta pública
- `Alt + Enter` ou `Alt + 5`: Concluir atendimento e puxar próximo
- `Alt + N`: Cadastrar novo comentário/usuário

### 5. Histórico e Auditoria Completa
- Registro de cada passo: data/hora, tipo de ação, operador, campanha e usuário atendido.
- Filtros por campanha, tipo de ação e busca por texto.

### 6. Exportação e Backup Local
- Exportar tabela completa para `.csv` compatível com Excel e Google Sheets.
- Download do banco SQLite real (`.sqlite`) e exportação JSON completa.
- Restauração de dados por arquivo JSON com validação de esquema.

---

## 🚀 Como Executar

### Pré-requisitos
- Node.js versão 18 ou superior instalado no Windows.

### Opção 1: Início Rápido com Scripts (.bat)
Criamos scripts de clique duplo na pasta raiz do projeto:
- `iniciar.bat` -> Inicia o servidor local e abre a interface web no navegador padrão (`http://localhost:5173`).
- `iniciar-electron.bat` -> Inicia o aplicativo diretamente como janela desktop Windows via Electron.

### Opção 2: Via Terminal

1. **Instalar dependências (já realizado):**
   ```bash
   npm install
   ```

2. **Compilar o frontend:**
   ```bash
   npm run build
   ```

3. **Iniciar o ambiente completo (Backend + Frontend com recarga automática):**
   ```bash
   npm run dev
   ```
   Acesse no navegador: `http://localhost:5173`

4. **Executar em modo aplicativo Desktop (Electron):**
   ```bash
   npm run electron
   ```

---

## 🗄️ Estrutura do Banco de Dados SQLite

O arquivo do banco é mantido em: `data/instagram_assistant.sqlite`.

Tabelas:
- `campaigns`: Armazena dados da publicação, links e modelos de mensagens.
- `message_templates`: Modelos alternativos e duplicados.
- `contact_records`: Fila de atendimentos com status (`Pendente`, `Mensagem preparada`, `Direct confirmado pelo operador`, `Resposta pública pendente`, `Concluído`, `Cancelado`) e tags.
- `interaction_history`: Log de auditoria de cada clique e alteração.
- `application_settings`: Configurações de tema (claro/escuro), operador e atalhos.

---

## ☁️ Como Deixar Online 24h Grátis (Supabase + GitHub + Vercel)

O aplicativo foi construído com arquitetura híbrida: se você não colocar chaves de nuvem, ele roda no seu PC com SQLite; se você colocar as chaves do Supabase, ele roda 100% na nuvem 24h por dia!

### 1. Criar o Banco no Supabase (2 minutos)
1. Crie uma conta gratuita em [supabase.com](https://supabase.com/).
2. Crie um novo projeto (ex: `instaassist`).
3. No menu lateral, acesse **SQL Editor**, cole todo o conteúdo do arquivo [`supabase_schema.sql`](file:///d:/Automacao%20instagram/supabase_schema.sql) e clique no botão **RUN**.
4. Acesse **Project Settings** -> **API** e copie:
   - **Project URL**
   - **anon public key**

### 2. Subir o Código no GitHub
1. Crie um repositório no seu [GitHub](https://github.com/).
2. No terminal da pasta do projeto, execute:
   ```bash
   git init
   git add .
   git commit -m "InstaAssist 24h Cloud"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```

### 3. Publicar na Vercel (1 minuto)
1. Acesse [vercel.com](https://vercel.com/) e faça login com seu GitHub.
2. Clique em **Add New...** -> **Project** e selecione o repositório do InstaAssist.
3. Em **Environment Variables**, adicione as duas variáveis copiadas do Supabase:
   - `VITE_SUPABASE_URL` = sua URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` = sua anon key do Supabase
4. Clique em **Deploy**!
5. Pronto! Você receberá um link gratuito (ex: `https://instaassist.vercel.app`) acessível pelo celular ou PC 24h por dia sem depender do computador de casa ligado.

