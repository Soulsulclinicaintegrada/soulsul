import 'package:flutter/foundation.dart';
import 'package:com_deus_app/src/features/journeys/domain/entities/journey_catalog.dart';
import 'package:com_deus_app/src/features/journeys/domain/entities/journey_category.dart';
import 'package:com_deus_app/src/features/journeys/domain/entities/journey_summary.dart';
import 'package:com_deus_app/src/features/journeys/domain/usecases/get_journey_catalog.dart';
import 'package:com_deus_app/src/features/journeys/domain/usecases/get_journey_details.dart';

class JourneyCatalogController extends ChangeNotifier {
  JourneyCatalogController({
    required GetJourneyCatalog getJourneyCatalog,
    required GetJourneyDetails getJourneyDetails,
  })  : _getJourneyCatalog = getJourneyCatalog,
        _getJourneyDetails = getJourneyDetails;

  final GetJourneyCatalog _getJourneyCatalog;
  final GetJourneyDetails _getJourneyDetails;

  JourneyCatalog? _catalog;
  String _selectedCategoryId = 'encounter';
  JourneySummary? _selectedJourney;
  bool _isLoading = false;

  JourneyCatalog? get catalog => _catalog;
  bool get isLoading => _isLoading;
  String get selectedCategoryId => _selectedCategoryId;
  JourneySummary? get selectedJourney => _selectedJourney;

  List<JourneyCategory> get categories => _catalog?.categories ?? <JourneyCategory>[];

  List<JourneySummary> get visibleJourneys {
    final journeys = _catalog?.journeys ?? <JourneySummary>[];
    return journeys.where((JourneySummary item) => item.category == _selectedCategoryId).toList();
  }

  Future<void> bootstrap() async {
    _isLoading = true;
    notifyListeners();
    _catalog = await _getJourneyCatalog();
    if (_catalog != null && !_catalog!.categories.any((item) => item.id == _selectedCategoryId)) {
      _selectedCategoryId =
          _catalog!.categories.isEmpty ? '' : _catalog!.categories.first.id;
    }
    _isLoading = false;
    notifyListeners();
  }

  void selectCategory(String categoryId) {
    _selectedCategoryId = categoryId;
    notifyListeners();
  }

  Future<void> openJourney(String id) async {
    _selectedJourney = await _getJourneyDetails(id);
    notifyListeners();
  }
}
