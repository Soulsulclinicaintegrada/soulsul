import 'package:com_deus_app/src/core/usecases/usecase.dart';
import 'package:com_deus_app/src/features/journey/domain/entities/day_journey.dart';
import 'package:com_deus_app/src/features/journey/domain/repositories/journey_repository.dart';

class GetThirtyDayJourney implements UseCase<List<DayJourney>> {
  GetThirtyDayJourney(this._repository);

  final JourneyRepository _repository;

  @override
  Future<List<DayJourney>> call() {
    return _repository.getThirtyDayJourney();
  }
}
