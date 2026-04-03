# Deploy do SoulSul ERP

## Estrategia recomendada agora

- Frontend: Vercel
- Backend: Railway
- Banco: SQLite com volume persistente no Railway

## Por que esta estrategia

Hoje o sistema usa um unico arquivo `clinica.db`.
As APIs de pacientes e agenda compartilham esse mesmo banco.

Se elas forem publicadas como dois servicos separados, cada uma tende a ficar com um banco diferente.
Por isso, para subir em nuvem sem migrar tudo para PostgreSQL agora, o caminho mais seguro e rapido e:

- publicar uma API unificada
- manter o `clinica.db` em um volume persistente

## Backend no Railway

Crie um unico servico no Railway a partir deste repositorio.

Configuracao:

- Builder: `Dockerfile`
- Dockerfile Path: `Dockerfile.api_online`

Variaveis de ambiente recomendadas:

- `DB_PATH=/data/clinica.db`

Volume persistente:

- monte um volume no caminho `/data`

Start esperado:

- a aplicacao sobe em `api_online:app`
- healthcheck: `/health`

## Frontend no Vercel

Projeto apontando para:

- Root Directory: `frontend`

Variaveis de ambiente:

- `VITE_API_BASE_URL=https://SEU-ENDERECO-DO-BACKEND`
- `VITE_AGENDA_API_BASE_URL=https://SEU-ENDERECO-DO-BACKEND`

## Observacao importante sobre arquivos

Os arquivos locais de pacientes, fotos, exames e documentos continuam sendo gravados em disco local.
Para uma operacao 100% em nuvem, o ideal depois e migrar esses arquivos para armazenamento externo.

## Proximo passo recomendado

Depois que o sistema estiver no ar com volume persistente, a evolucao mais segura e:

1. migrar banco para PostgreSQL
2. migrar documentos e imagens para storage externo
3. separar servicos se ainda fizer sentido
