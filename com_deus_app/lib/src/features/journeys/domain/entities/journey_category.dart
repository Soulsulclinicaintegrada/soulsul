enum JourneyCategoryAction {
  openCatalog,
  openFamilyFlow,
  openKidsPlaceholder,
  openCouplesPlaceholder,
  openComingSoon,
}

class JourneyCategory {
  const JourneyCategory({
    required this.id,
    required this.emoji,
    required this.title,
    required this.action,
  });

  final String id;
  final String emoji;
  final String title;
  final JourneyCategoryAction action;
}
