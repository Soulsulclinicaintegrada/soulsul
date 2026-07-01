import 'package:com_deus_app/src/features/journey/data/datasources/journey_remote_data_source.dart';
import 'package:com_deus_app/src/features/journey/domain/entities/day_journey.dart';
import 'package:com_deus_app/src/features/journey/domain/repositories/journey_repository.dart';

class JourneyRepositoryImpl implements JourneyRepository {
  JourneyRepositoryImpl({required JourneyRemoteDataSource remoteDataSource})
      : _remoteDataSource = remoteDataSource;

  final JourneyRemoteDataSource _remoteDataSource;

  @override
  Future<List<DayJourney>> getThirtyDayJourney() {
    return _remoteDataSource.fetchThirtyDayJourney();
  }
}
