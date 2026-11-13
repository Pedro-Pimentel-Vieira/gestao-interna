# Conectar o Supabase

Projeto escolhido: https://supabase.com/dashboard/project/nrhlvekrcouzdvummqmc

O código está preparado. A migração só cria tabelas no banco quando executada no projeto; nenhum banco remoto foi criado automaticamente por estes arquivos.

## 1. Criar as tabelas e o armazenamento

No projeto, abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/migrations/001_initial.sql` e execute **Run**. O arquivo cria:

- `member_profiles`: informações editadas nos perfis, versão para detectar conflitos e caminho da foto.
- `projects`: estrutura para futuras informações dos projetos.
- Bucket privado `member-photos`: fotos JPEG de até 1 MB após redução no site.

As tabelas têm RLS ativado, sem acesso direto para anon/authenticated. As operações passam pelo servidor. Isso protege a chave e o acesso direto ao banco; o site continua sem autenticação conforme solicitado, então qualquer pessoa com acesso ao site poderá consultar e editar os perfis pela API. A seleção Clara/Pedro não verifica identidade.

## 2. Configurar o servidor

Na área de API Keys do Supabase, crie ou use uma **secret key** (`sb_secret_...`). Também é aceita a chave legada `service_role`. Não use a chave publishable/anon para este servidor e não envie chaves secretas pelo chat.

Copie `.env.example` para `.env.local` na raiz do projeto e preencha:

```dotenv
SUPABASE_URL=https://nrhlvekrcouzdvummqmc.supabase.co
SUPABASE_SECRET_KEY=SUA_CHAVE_SECRETA
```

Não use prefixo `VITE_`. O arquivo `.env.local` está ignorado no Git. Reinicie `npm run dev` depois de preencher.

Na Vercel, configure as mesmas duas variáveis em **Settings → Environment Variables** e faça novo deploy. A integração não precisa da senha do PostgreSQL.

## 3. Importar os membros e projetos atuais

Depois de executar o SQL e configurar `.env.local`, rode:

```powershell
node --env-file=.env.local scripts/import-sheets.mjs
```

O script insere os membros ativos e projetos rodando/paralisados do Sheets, preservando os identificadores atuais. Pode ser executado novamente sem sobrescrever registros existentes. A presença permanece ligada à aba Clarimba. Os projetos continuam sendo listados a partir da planilha; a tabela projects reserva espaço para futuras informações adicionais, cuja tela de edição ainda não existe.

## 4. Salvar e migrar perfis

Quando o banco estiver configurado, o perfil carrega os dados compartilhados e o botão Salvar grava na API `/api/profiles`. A API só aceita membros ativos e valida os campos. Fotos são enviadas para o bucket privado e exibidas por links temporários. Cada gravação verifica a versão; se outra pessoa tiver salvo antes, a tela pede para recarregar em vez de sobrescrever a edição.

Se houver dados locais antigos, use **Importar dados deste navegador** dentro do perfil, confira os campos e clique em **Salvar alterações**. A cópia local é preservada. Dados do navegador não são enviados automaticamente.

Sem nenhuma variável Supabase, o site continua no modo local anterior. Com configuração incompleta ou banco indisponível, o site apresenta erro e não finge que salvou localmente. Perfis compartilhados são consultados ao abrir e a cada minuto quando não estão em edição.

Os identificadores atuais vêm do nome na planilha original. Editar o nome pelo site preserva o ID; renomear na planilha original exige remapear o registro para preservar suas informações. IDs permanentes na origem devem ser adotados antes de renomeações dessa forma.

## Verificação depois da conexão

Abra um perfil, altere uma informação e salve. Abra o mesmo perfil em outro navegador para confirmar o compartilhamento. Envie uma foto e confira o arquivo no bucket. As verificações automatizadas locais usam respostas simuladas; uma gravação real só pode ser verificada após conectar o banco.

Referências: https://supabase.com/docs/guides/database/tables e https://supabase.com/docs/guides/api/api-keys
