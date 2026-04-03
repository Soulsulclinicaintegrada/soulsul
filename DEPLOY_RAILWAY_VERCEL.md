# Deploy do SoulSul ERP

## Estrategia recomendada

- Frontend: Vercel
- API de pacientes: Railway
- API da agenda: Railway

## Observacao importante

Hoje o sistema ainda usa o arquivo local `clinica.db` (SQLite).
Isso significa que, antes de um deploy definitivo em nuvem, precisamos escolher uma destas opcoes:

1. manter o sistema em um computador dedicado com acesso externo;
2. usar volume persistente na hospedagem;
3. migrar o banco para PostgreSQL/Supabase.

Sem persistencia, os dados podem sumir ao redeploy.

## Railway

Crie dois servicos separados a partir do mesmo repositorio:

- `api-pacientes`
- `api-agenda`

### API pacientes

- Builder: `Dockerfile`
- Dockerfile Path: `Dockerfile.api_pacientes`

### API agenda

- Builder: `Dockerfile`
- Dockerfile Path: `Dockerfile.api_agenda`

## Vercel

Projeto apontando para:

- Root Directory: `frontend`

Variaveis de ambiente:

- `VITE_API_BASE_URL=https://SEU-ENDERECO-DA-API-PACIENTES`
- `VITE_AGENDA_API_BASE_URL=https://SEU-ENDERECO-DA-API-AGENDA`
