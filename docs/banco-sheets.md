# Base de dados no Google Sheets

Planilha criada: https://docs.google.com/spreadsheets/d/1XUU8ks4f5cNdOwd2b7zoqI_9qsYnTMAviRQz2yRvR0s/edit

ID: `1XUU8ks4f5cNdOwd2b7zoqI_9qsYnTMAviRQz2yRvR0s`

- `Perfis` (gid 728716079): carga inicial de 24 membros, com os identificadores usados pelo site e campos para nome, cargo, e-mail, telefone, descrição, URL da foto, presença manual e data da alteração.
- `Projetos` (gid 101): carga inicial de 15 projetos, com identificador, nome, descrição, responsável, prazo e data da alteração.
- `Instruções` (gid 102): descrição dos campos e fontes.

O site ainda salva as edições em localStorage. A criação dessa planilha não ativa escrita remota e não importa as alterações existentes nos navegadores.

Para conectar, o servidor na Vercel precisará receber credenciais de uma conta de serviço autorizada a editar apenas essa base (ou uma implantação de Apps Script configurada para esse fim). Credenciais devem ficar em variáveis de ambiente do servidor, nunca no frontend. A integração deverá ler e gravar por ID, tratar edições simultâneas e migrar explicitamente os dados locais. A presença automática continua sendo obtida da aba Clarimba, a menos que presenca_manual esteja preenchida.

Fotos devem ser guardadas em armazenamento de arquivos, com seu link em `foto_url`; não salvar base64 nas células. Renomear pessoas nas fontes altera os IDs atuais calculados pelo site; antes de adotar a base como armazenamento definitivo, estabilizar o vínculo com os registros de origem usando os IDs já criados.
