import 'package:com_deus_app/src/features/journeys/domain/entities/journey_category.dart';
import 'package:com_deus_app/src/features/journeys/domain/entities/journey_summary.dart';

class JourneyCatalog {
  const JourneyCatalog({
    required this.categories,
    required this.journeys,
  });

  final List<JourneyCategory> categories;
  final List<JourneySummary> journeys;
}
