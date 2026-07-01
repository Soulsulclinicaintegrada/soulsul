# Com Deus

Base inicial do aplicativo cristao `Com Deus`.

## Stack

- Flutter
- Material 3
- Supabase
- Clean Architecture

## Estrutura

```text
lib/
  src/
    core/
    features/
      journey/
        data/
        domain/
        presentation/
```

## Sprint atual

Entrega atual:

- onboarding completo
- modo Respire
- home redesenhada como capa de livro
- animacoes suaves
- design system proprio
- selecao de jornadas por categoria
- espaco Familia preparado
- placeholders para Infantil, Familia e Casais
- suporte a cenas isoladas para screenshots via `--dart-define`

Tudo organizado em Clean Architecture dentro da feature `onboarding`.

## Como continuar localmente

1. Instale o Flutter SDK.
2. Entre em `com_deus_app`.
3. Rode `flutter create .` para gerar as pastas nativas ausentes.
4. Rode `flutter pub get`.
5. Configure as chaves do Supabase via `--dart-define` para `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
6. Rode `flutter run`.

## Proximos passos sugeridos

- adicionar autenticacao com Supabase Auth
- persistir progresso diario do usuario
- incluir devocional, oracao e versiculo por dia
- criar testes de dominio e widgets
