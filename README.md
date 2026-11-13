# Gestão interna

## Supabase

A integração com o Supabase está preparada para armazenar os perfis e fotos compartilhados. A configuração do projeto escolhido, a migração SQL e os passos de ativação estão em [docs/supabase.md](docs/supabase.md). Sem as variáveis do Supabase, continua valendo o armazenamento local descrito abaixo. A planilha criada anteriormente como banco não é usada para salvar os perfis.

Projeto React + Vite, preparado para publicação na Vercel. A Home exibe vendas e faturamento mensal e do ciclo, priorizando a CCE e lendo as planilhas em tempo real. Projetos exibe contadores e lista conectados ao Google Sheets. Membros exibe a lista de membros ativos da aba Clarimba. A escolha do coordenador é uma preferência local, sem senha ou autenticação.

### Indicadores da Home

`/api/dashboard` consulta as planilhas `Fluxo Assinados por Mês 26/27` e `Fluxo Faturado por Mês 26/27`. A Home atualiza ao abrir, a cada cinco minutos e pelo botão. O ciclo é descoberto na aba `Metas por coordenação`; realizados e metas do ciclo vêm da linha CCE na aba do ciclo. Vendas mensais vêm da coluna CCE na aba `Geral`. Faturamento mensal previsto e realizado vêm da aba `CCE`. Como as fontes não fornecem meta mensal própria de CCE, os cartões mensais mostram as metas gerais do Fluxo como contexto e dizem isso explicitamente; não calculam rateio artificial. Falhas preservam a última leitura visível.

## Google Sheets

### Edição de perfis

Cada membro tem um perfil com foto, nome, cargo, e-mail, telefone, descrição e presença. Com o Supabase configurado, `Editar perfil` salva dados compartilhados e fotos no bucket privado. Sem configuração do Supabase, o sistema mantém o modo local como fallback. A presença manual substitui somente a exibição local; deixar o campo vazio restaura a taxa automática do Sheets.

Membros consulta `/api/members`, que lê somente as colunas A:C da aba `Presença na CCEmanal - Clarimba` (gid `1682438240`) da planilha `11-GXPflwaUZy1nzEU0kFXj65AC7GqPxB_PfPQJI2NCo`. Inclui os nomes não vazios com a coluna Ativo marcada, na ordem da planilha; não usa os percentuais de presença como critério. Cada nome abre `#membros/<id>`, com nome, taxa da coluna `% Presença` e espaço para informações futuras. Células vazias ou com erro aparecem como taxa indisponível, nunca como zero. A lista e as taxas atualizam ao abrir, a cada minuto e pelo botão Atualizar. Nenhuma alteração é feita na fonte. O servidor envia somente identificador, nome, taxa e horário da consulta ao navegador. Os identificadores derivam do nome e ocorrência; renomear um membro muda seu link. Antes de salvar informações adicionais, adote um identificador permanente na fonte.

A lista abaixo dos contadores mostra os mesmos projetos rodando e paralisados. Cada item abre `#projetos/<id>`, com nome e área vazia para informações futuras. Links diretos e recarregamento são suportados. Os IDs derivam do nome do projeto (e ocorrência em caso de nomes iguais); reordenar projetos com nomes únicos não altera seus links. Renomear um projeto altera seu link. Antes de persistir informações adicionais, será necessário definir um identificador permanente na fonte.

A rota `/api/projects` lê a aba `Projetos - Todos` (gid `664433547`) da planilha fornecida, em modo somente leitura. O servidor devolve apenas os contadores e o horário da consulta, sem enviar as demais colunas ao navegador. A planilha já permite leitura sem credenciais; nenhuma permissão foi alterada. Se o acesso pelo link for removido, a integração exibirá um erro até ser configurada uma integração autenticada no servidor.

Regras: ignora linhas sem Projeto; exclui Finalizado? marcado e Prev. Prazo igual a Finalizado ou Rescindido; conta Paralizado/Paralisado como paralisados e os demais projetos restantes como rodando. Usa exclusivamente essa aba, evitando contar novamente os projetos repetidos na aba de paralisados. Os dados são consultados ao abrir Projetos, a cada 60 segundos e no botão Atualizar; pode haver atraso de atualização do próprio Google. Falhas preservam a última leitura com aviso, sem substituir os valores por zero.

A API funciona no `npm run dev`, no `npm run preview` e como função Node.js na Vercel. A pasta `dist` sozinha não contém a API: publique o projeto completo. Referência: https://vercel.com/docs/functions/runtimes/node-js

## Rodar no computador

Com Node.js 22.12 ou superior, no terminal:

```powershell
cd C:\Fluxo\gestao-interna
npm install
npm run dev
```

Abra o endereço informado pelo Vite (normalmente http://localhost:5173). Agora o projeto deve ser executado pelo servidor, em vez de abrir o HTML com dois cliques.

## Publicar na Vercel

Envie esta pasta para um repositório Git e importe o repositório na Vercel. Se o repositório contiver outras pastas, selecione `gestao-interna` como **Root Directory**.

- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

Essas opções também estão em `vercel.json`. Não há variáveis de ambiente necessárias. Referência: https://vercel.com/docs/frameworks/frontend/vite

## Perfis e fotos

Clara Guedes e Pedro Pimentel são definidos em `src/profiles.js`. Para adicionar fotos reais, coloque os arquivos em `public/fotos/` e preencha o campo `photo` de cada perfil com `/fotos/nome-do-arquivo.jpg`. Até lá, aparecem as iniciais. Fotos indisponíveis também usam as iniciais.

A seleção fica na chave `gestao-interna:coordenador` do localStorage. O botão de perfil no canto superior direito permite trocar o coordenador. A escolha persiste após recarregar ou reabrir no mesmo navegador e endereço; outro navegador ou domínio terá sua própria escolha.

## Verificação

```powershell
npm run build
npm test
```

Os testes de navegador usam Microsoft Edge instalado. Para usar o Chromium do Playwright, instale-o com `npx playwright install chromium`, defina `PLAYWRIGHT_CHANNEL=chromium` no ambiente e rode os testes.
