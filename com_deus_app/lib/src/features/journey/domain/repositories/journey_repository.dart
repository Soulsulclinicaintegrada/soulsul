import 'package:com_deus_app/src/features/journey/domain/entities/day_journey.dart';

abstract interface class JourneyRepository {
  Future<List<DayJourney>> getThirtyDayJourney();
}
