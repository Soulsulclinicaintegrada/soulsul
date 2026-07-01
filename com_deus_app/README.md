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
- splash com fade in
- boas-vindas
- escolha de caminhada
- privacidade
- nome
- proposito
- jejum
- horario
- home inicial enxuta

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
