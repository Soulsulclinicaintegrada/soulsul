import 'package:flutter/foundation.dart';
import 'package:com_deus_app/src/features/journey/domain/entities/day_journey.dart';
import 'package:com_deus_app/src/features/journey/domain/usecases/get_thirty_day_journey.dart';

class JourneyController extends ChangeNotifier {
  JourneyController({required GetThirtyDayJourney getThirtyDayJourney})
      : _getThirtyDayJourney = getThirtyDayJourney;

  final GetThirtyDayJourney _getThirtyDayJourney;

  bool _isLoading = false;
  List<DayJourney> _days = <DayJourney>[];

  bool get isLoading => _isLoading;
  List<DayJourney> get days => _days;
  int get completedDays => _days.where((DayJourney day) => day.isCompleted).length;

  Future<void> load() async {
    _isLoading = true;
    notifyListeners();

    _days = await _getThirtyDayJourney();

    _isLoading = false;
    notifyListeners();
  }

  void toggleCompleted(int dayNumber) {
    _days = _days
        .map(
          (DayJourney day) => day.dayNumber == dayNumber
              ? day.copyWith(isCompleted: !day.isCompleted)
              : day,
        )
        .toList();
    notifyListeners();
  }
}
