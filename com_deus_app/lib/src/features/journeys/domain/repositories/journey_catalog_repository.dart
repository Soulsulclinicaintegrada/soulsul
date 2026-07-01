import 'package:com_deus_app/src/features/journeys/domain/entities/journey_catalog.dart';
import 'package:com_deus_app/src/features/journeys/domain/entities/journey_summary.dart';

abstract interface class JourneyCatalogRepository {
  Future<JourneyCatalog> loadCatalog();
  Future<JourneySummary?> findJourneyById(String id);
}
