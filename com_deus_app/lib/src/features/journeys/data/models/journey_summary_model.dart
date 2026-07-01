import 'package:com_deus_app/src/features/journeys/domain/entities/journey_summary.dart';

class JourneySummaryModel extends JourneySummary {
  const JourneySummaryModel({
    required super.id,
    required super.title,
    required super.subtitle,
    required super.description,
    required super.coverImage,
    required super.category,
    required super.days,
    required super.estimatedMinutes,
    required super.themeColor,
    required super.recommendedAge,
    required super.isPremium,
    required super.tags,
    required super.objective,
    required super.kidsMetadata,
  });

  factory JourneySummaryModel.fromMap(Map<String, dynamic> map) {
    return JourneySummaryModel(
      id: map['id'] as String,
      title: map['title'] as String,
      subtitle: map['subtitle'] as String,
      description: map['description'] as String,
      coverImage: map['coverImage'] as String,
      category: map['category'] as String,
      days: map['days'] as int,
      estimatedMinutes: map['estimatedMinutes'] as int,
      themeColor: map['themeColor'] as String,
      recommendedAge: map['recommendedAge'] as String?,
      isPremium: map['isPremium'] as bool,
      tags: (map['tags'] as List<dynamic>).cast<String>(),
      objective: map['objective'] as String,
      kidsMetadata: map['kidsMetadata'] == null
          ? null
          : KidsJourneyMetadataModel.fromMap(
              map['kidsMetadata'] as Map<String, dynamic>,
            ),
    );
  }
}

class KidsJourneyMetadataModel extends KidsJourneyMetadata {
  const KidsJourneyMetadataModel({
    required super.minimumAge,
    required super.maximumAge,
    required super.activityType,
    required super.dailyChallenge,
    required super.practicalActivity,
    required super.questionForParents,
  });

  factory KidsJourneyMetadataModel.fromMap(Map<String, dynamic> map) {
    return KidsJourneyMetadataModel(
      minimumAge: map['minimumAge'] as int,
      maximumAge: map['maximumAge'] as int,
      activityType: map['activityType'] as String,
      dailyChallenge: map['dailyChallenge'] as String,
      practicalActivity: map['practicalActivity'] as String,
      questionForParents: map['questionForParents'] as String,
    );
  }
}
