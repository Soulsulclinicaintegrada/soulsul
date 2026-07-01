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

- explorar jornadas com carregamento por JSON
- categorias elegantes no estilo biblioteca
- detalhe bonito de jornada
- suporte estrutural para jornadas infantis
- modo Respire
- home editorial
- design system proprio
- espaco Familia preparado
- placeholders para Infantil, Familia e Casais
- suporte a cenas isoladas para screenshots via `--dart-define`

Tudo organizado em Clean Architecture nas features `onboarding`, `journeys` e `experience`.

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
