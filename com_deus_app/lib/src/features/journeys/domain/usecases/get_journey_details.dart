import 'package:com_deus_app/src/features/journeys/domain/entities/journey_summary.dart';
import 'package:com_deus_app/src/features/journeys/domain/repositories/journey_catalog_repository.dart';

class GetJourneyDetails {
  GetJourneyDetails(this._repository);

  final JourneyCatalogRepository _repository;

  Future<JourneySummary?> call(String id) {
    return _repository.findJourneyById(id);
  }
}
