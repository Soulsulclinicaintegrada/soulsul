import 'package:com_deus_app/src/features/journeys/domain/entities/journey_category.dart';
import 'package:com_deus_app/src/features/journeys/domain/entities/journey_summary.dart';

class JourneyCatalog {
  const JourneyCatalog._();

  static const List<JourneyCategory> categories = <JourneyCategory>[
    JourneyCategory(
      id: 'encounter',
      emoji: '🌿',
      title: 'Meu Encontro',
      action: JourneyCategoryAction.openCatalog,
    ),
    JourneyCategory(
      id: 'biblical',
      emoji: '📖',
      title: 'Jornadas Bíblicas',
      action: JourneyCategoryAction.openCatalog,
    ),
    JourneyCategory(
      id: 'family',
      emoji: '👨‍👩‍👧',
      title: 'Família',
      action: JourneyCategoryAction.openFamilyFlow,
    ),
    JourneyCategory(
      id: 'kids',
      emoji: '👶',
      title: 'Infantil',
      action: JourneyCategoryAction.openKidsPlaceholder,
    ),
    JourneyCategory(
      id: 'couples',
      emoji: '❤️',
      title: 'Casais',
      action: JourneyCategoryAction.openCouplesPlaceholder,
    ),
    JourneyCategory(
      id: 'soon',
      emoji: '✨',
      title: 'Em breve',
      action: JourneyCategoryAction.openComingSoon,
    ),
  ];

  static const List<JourneySummary> journeys = <JourneySummary>[
    JourneySummary(
      id: 'antes-da-luz',
      categoryId: 'encounter',
      title: 'Antes da luz',
      subtitle: 'Uma jornada silenciosa para começar o dia mais perto de Deus.',
      label: 'Dia atual',
      coverPalette: <int>[0xFFB8CC9D, 0xFFF1E0C3],
    ),
    JourneySummary(
      id: 'lugar-secreto',
      categoryId: 'encounter',
      title: 'Lugar secreto',
      subtitle: 'Respiração, oração e presença para encontros breves e profundos.',
      label: 'Novo',
      coverPalette: <int>[0xFFE7D6B7, 0xFFD6E1C9],
    ),
    JourneySummary(
      id: 'salmos-que-abrigam',
      categoryId: 'biblical',
      title: 'Salmos que abrigam',
      subtitle: 'Versos para dias de cansaço, consolo e descanso interior.',
      label: 'Bíblico',
      coverPalette: <int>[0xFFD9C2A3, 0xFFF4E8D8],
    ),
    JourneySummary(
      id: 'evangelhos-aos-poucos',
      categoryId: 'biblical',
      title: 'Evangelhos aos poucos',
      subtitle: 'Pequenas leituras para caminhar com Jesus sem pressa.',
      label: 'Bíblico',
      coverPalette: <int>[0xFFC8D6C0, 0xFFF5E7D0],
    ),
  ];
}
