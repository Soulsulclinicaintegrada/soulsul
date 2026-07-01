# Arquitetura inicial

O app `Com Deus` comeca com foco em crescimento previsivel.

## Principios

- `domain` nao depende de Flutter, Supabase ou detalhes de UI
- `data` implementa contratos do dominio
- `presentation` depende de `domain`
- `core` concentra configuracao transversal, tema e bootstrap

## Feature atual

`journey` representa a caminhada espiritual de 30 dias.

Camadas:

- `domain/entities/day_journey.dart`
- `domain/repositories/journey_repository.dart`
- `domain/usecases/get_thirty_day_journey.dart`
- `data/datasources/journey_remote_data_source.dart`
- `data/repositories/journey_repository_impl.dart`
- `presentation/controllers/journey_controller.dart`
- `presentation/pages/journey_page.dart`

## Estrategia de Supabase

Enquanto as credenciais nao forem configuradas, o app usa `seed()` local para destravar a evolucao da interface.

Quando o projeto estiver conectado, a tabela inicial pode seguir este formato:

```sql
create table public.journey_days (
  id uuid primary key default gen_random_uuid(),
  day_number integer not null unique,
  title text not null,
  verse text not null,
  reflection text not null,
  prayer_prompt text not null,
  is_completed boolean not null default false
);
```

## Proximas features naturais

- autenticacao
- progresso por usuario
- favoritos e anotacoes
- audio devocional
- notificacoes diarias
