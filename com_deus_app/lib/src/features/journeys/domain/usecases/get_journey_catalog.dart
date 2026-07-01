import 'package:com_deus_app/src/features/journeys/domain/entities/journey_catalog.dart';
import 'package:com_deus_app/src/features/journeys/domain/repositories/journey_catalog_repository.dart';

class GetJourneyCatalog {
  GetJourneyCatalog(this._repository);

  final JourneyCatalogRepository _repository;

  Future<JourneyCatalog> call() {
    return _repository.loadCatalog();
  }
}
