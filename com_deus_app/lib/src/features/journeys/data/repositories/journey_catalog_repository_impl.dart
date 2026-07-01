import 'package:com_deus_app/src/features/journeys/data/datasources/journey_catalog_local_data_source.dart';
import 'package:com_deus_app/src/features/journeys/domain/entities/journey_catalog.dart';
import 'package:com_deus_app/src/features/journeys/domain/entities/journey_summary.dart';
import 'package:com_deus_app/src/features/journeys/domain/repositories/journey_catalog_repository.dart';

class JourneyCatalogRepositoryImpl implements JourneyCatalogRepository {
  JourneyCatalogRepositoryImpl({
    required JourneyCatalogLocalDataSource localDataSource,
  }) : _localDataSource = localDataSource;

  final JourneyCatalogLocalDataSource _localDataSource;

  @override
  Future<JourneySummary?> findJourneyById(String id) async {
    final catalog = await _localDataSource.loadCatalog();
    for (final journey in catalog.journeys) {
      if (journey.id == id) {
        return journey;
      }
    }
    return null;
  }

  @override
  Future<JourneyCatalog> loadCatalog() {
    return _localDataSource.loadCatalog();
  }
}
