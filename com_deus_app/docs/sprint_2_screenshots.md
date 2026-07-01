# Sprint 2: captura local de screenshots

Este ambiente nao possui Flutter SDK disponivel no `PATH`, entao as imagens nao puderam ser geradas aqui.

## Preparacao

Execute estes comandos dentro de `C:\Users\jusgo\Documents\sistema_clinica\com_deus_app`:

```powershell
flutter create .
flutter pub get
```

## Como abrir cada tela

Cada comando abaixo abre uma cena especifica do app para captura:

```powershell
flutter run -d windows --dart-define=SCREENSHOT_TARGET=respire
flutter run -d windows --dart-define=SCREENSHOT_TARGET=splash
flutter run -d windows --dart-define=SCREENSHOT_TARGET=welcome
flutter run -d windows --dart-define=SCREENSHOT_TARGET=choice
flutter run -d windows --dart-define=SCREENSHOT_TARGET=privacy
flutter run -d windows --dart-define=SCREENSHOT_TARGET=name
flutter run -d windows --dart-define=SCREENSHOT_TARGET=purpose
flutter run -d windows --dart-define=SCREENSHOT_TARGET=fasting
flutter run -d windows --dart-define=SCREENSHOT_TARGET=schedule
flutter run -d windows --dart-define=SCREENSHOT_TARGET=home
flutter run -d windows --dart-define=SCREENSHOT_TARGET=journeys
flutter run -d windows --dart-define=SCREENSHOT_TARGET=journeys-biblical
flutter run -d windows --dart-define=SCREENSHOT_TARGET=family-companion
flutter run -d windows --dart-define=SCREENSHOT_TARGET=family-age
flutter run -d windows --dart-define=SCREENSHOT_TARGET=family-placeholder
flutter run -d windows --dart-define=SCREENSHOT_TARGET=kids-placeholder
flutter run -d windows --dart-define=SCREENSHOT_TARGET=couples-placeholder
flutter run -d windows --dart-define=SCREENSHOT_TARGET=coming-soon
```

## Captura das imagens

Para cada tela aberta:

1. Aguarde a animacao terminar.
2. Capture a janela com `Win + Shift + S`.
3. Salve a imagem com o nome da cena correspondente.

## Validacao rapida

Antes das capturas finais, rode:

```powershell
flutter analyze
flutter run -d windows
```
