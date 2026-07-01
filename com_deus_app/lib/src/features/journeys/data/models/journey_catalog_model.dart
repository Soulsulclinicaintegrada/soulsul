import 'package:com_deus_app/src/features/journeys/data/models/journey_category_model.dart';
import 'package:com_deus_app/src/features/journeys/data/models/journey_summary_model.dart';
import 'package:com_deus_app/src/features/journeys/domain/entities/journey_catalog.dart';

class JourneyCatalogModel extends JourneyCatalog {
  const JourneyCatalogModel({
    required super.categories,
    required super.journeys,
  });

  factory JourneyCatalogModel.fromMap(Map<String, dynamic> map) {
    return JourneyCatalogModel(
      categories: (map['categories'] as List<dynamic>)
          .map(
            (dynamic item) =>
                JourneyCategoryModel.fromMap(item as Map<String, dynamic>),
          )
          .toList(),
      journeys: (map['journeys'] as List<dynamic>)
          .map(
            (dynamic item) =>
                JourneySummaryModel.fromMap(item as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}
