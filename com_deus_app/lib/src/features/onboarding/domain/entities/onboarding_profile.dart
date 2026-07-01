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

enum FamilyCompanion {
  son,
  daughter,
  wholeFamily,
  spouse,
}

class OnboardingProfile {
  const OnboardingProfile({
    required this.name,
    required this.journeyStyle,
    required this.blessingFocus,
    required this.includeFasting,
    required this.reminderTime,
    required this.enableRespireIntro,
    required this.familyCompanion,
    required this.familyAge,
  });

  final String name;
  final JourneyStyle? journeyStyle;
  final BlessingFocus? blessingFocus;
  final bool? includeFasting;
  final String reminderTime;
  final bool enableRespireIntro;
  final FamilyCompanion? familyCompanion;
  final int? familyAge;

  factory OnboardingProfile.initial() {
    return const OnboardingProfile(
      name: '',
      journeyStyle: null,
      blessingFocus: null,
      includeFasting: null,
      reminderTime: '',
      enableRespireIntro: true,
      familyCompanion: null,
      familyAge: null,
    );
  }

  String get greetingName => name.trim().isEmpty ? 'amiga' : name.trim();

  OnboardingProfile copyWith({
    String? name,
    JourneyStyle? journeyStyle,
    BlessingFocus? blessingFocus,
    bool? includeFasting,
    String? reminderTime,
    bool? enableRespireIntro,
    FamilyCompanion? familyCompanion,
    int? familyAge,
    bool resetJourneyStyle = false,
    bool resetBlessingFocus = false,
    bool resetIncludeFasting = false,
    bool resetFamilyCompanion = false,
    bool resetFamilyAge = false,
  }) {
    return OnboardingProfile(
      name: name ?? this.name,
      journeyStyle: resetJourneyStyle ? null : (journeyStyle ?? this.journeyStyle),
      blessingFocus: resetBlessingFocus ? null : (blessingFocus ?? this.blessingFocus),
      includeFasting:
          resetIncludeFasting ? null : (includeFasting ?? this.includeFasting),
      reminderTime: reminderTime ?? this.reminderTime,
      enableRespireIntro: enableRespireIntro ?? this.enableRespireIntro,
      familyCompanion:
          resetFamilyCompanion ? null : (familyCompanion ?? this.familyCompanion),
      familyAge: resetFamilyAge ? null : (familyAge ?? this.familyAge),
    );
  }
}
