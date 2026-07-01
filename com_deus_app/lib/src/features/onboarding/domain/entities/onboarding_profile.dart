enum JourneyStyle {
  guided,
  accompanied,
}

enum BlessingFocus {
  anxiety,
  marriage,
  family,
  finances,
  peace,
  other,
}

class OnboardingProfile {
  const OnboardingProfile({
    required this.name,
    required this.journeyStyle,
    required this.blessingFocus,
    required this.includeFasting,
    required this.reminderTime,
  });

  final String name;
  final JourneyStyle? journeyStyle;
  final BlessingFocus? blessingFocus;
  final bool? includeFasting;
  final String reminderTime;

  factory OnboardingProfile.initial() {
    return const OnboardingProfile(
      name: '',
      journeyStyle: null,
      blessingFocus: null,
      includeFasting: null,
      reminderTime: '',
    );
  }

  String get greetingName => name.trim().isEmpty ? 'amiga' : name.trim();

  OnboardingProfile copyWith({
    String? name,
    JourneyStyle? journeyStyle,
    BlessingFocus? blessingFocus,
    bool? includeFasting,
    String? reminderTime,
    bool resetJourneyStyle = false,
    bool resetBlessingFocus = false,
    bool resetIncludeFasting = false,
  }) {
    return OnboardingProfile(
      name: name ?? this.name,
      journeyStyle: resetJourneyStyle ? null : (journeyStyle ?? this.journeyStyle),
      blessingFocus: resetBlessingFocus ? null : (blessingFocus ?? this.blessingFocus),
      includeFasting:
          resetIncludeFasting ? null : (includeFasting ?? this.includeFasting),
      reminderTime: reminderTime ?? this.reminderTime,
    );
  }
}
