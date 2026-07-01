import 'package:com_deus_app/src/features/journeys/domain/entities/journey_category.dart';

class JourneyCategoryModel extends JourneyCategory {
  const JourneyCategoryModel({
    required super.id,
    required super.emoji,
    required super.title,
    required super.subtitle,
  });

  factory JourneyCategoryModel.fromMap(Map<String, dynamic> map) {
    return JourneyCategoryModel(
      id: map['id'] as String,
      emoji: map['emoji'] as String,
      title: map['title'] as String,
      subtitle: map['subtitle'] as String,
    );
  }
}
