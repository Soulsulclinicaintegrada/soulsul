class KidsJourneyMetadata {
  const KidsJourneyMetadata({
    required this.minimumAge,
    required this.maximumAge,
    required this.activityType,
    required this.dailyChallenge,
    required this.practicalActivity,
    required this.questionForParents,
  });

  final int minimumAge;
  final int maximumAge;
  final String activityType;
  final String dailyChallenge;
  final String practicalActivity;
  final String questionForParents;
}

class JourneySummary {
  const JourneySummary({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.description,
    required this.coverImage,
    required this.category,
    required this.days,
    required this.estimatedMinutes,
    required this.themeColor,
    required this.recommendedAge,
    required this.isPremium,
    required this.tags,
    required this.objective,
    required this.kidsMetadata,
  });

  final String id;
  final String title;
  final String subtitle;
  final String description;
  final String coverImage;
  final String category;
  final int days;
  final int estimatedMinutes;
  final String themeColor;
  final String? recommendedAge;
  final bool isPremium;
  final List<String> tags;
  final String objective;
  final KidsJourneyMetadata? kidsMetadata;

  bool get isKidsJourney => kidsMetadata != null;
}
