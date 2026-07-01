class DayJourney {
  const DayJourney({
    required this.dayNumber,
    required this.title,
    required this.verse,
    required this.reflection,
    required this.prayerPrompt,
    required this.isCompleted,
  });

  final int dayNumber;
  final String title;
  final String verse;
  final String reflection;
  final String prayerPrompt;
  final bool isCompleted;

  DayJourney copyWith({
    int? dayNumber,
    String? title,
    String? verse,
    String? reflection,
    String? prayerPrompt,
    bool? isCompleted,
  }) {
    return DayJourney(
      dayNumber: dayNumber ?? this.dayNumber,
      title: title ?? this.title,
      verse: verse ?? this.verse,
      reflection: reflection ?? this.reflection,
      prayerPrompt: prayerPrompt ?? this.prayerPrompt,
      isCompleted: isCompleted ?? this.isCompleted,
    );
  }
}

