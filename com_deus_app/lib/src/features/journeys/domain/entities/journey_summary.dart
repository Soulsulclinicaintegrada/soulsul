class JourneySummary {
  const JourneySummary({
    required this.id,
    required this.categoryId,
    required this.title,
    required this.subtitle,
    required this.label,
    required this.coverPalette,
  });

  final String id;
  final String categoryId;
  final String title;
  final String subtitle;
  final String label;
  final List<int> coverPalette;
}
