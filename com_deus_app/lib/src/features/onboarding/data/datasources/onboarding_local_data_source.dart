import 'package:com_deus_app/src/features/onboarding/domain/entities/onboarding_profile.dart';

abstract interface class OnboardingLocalDataSource {
  Future<OnboardingProfile> loadDraft();
  Future<void> saveDraft(OnboardingProfile profile);
}

class InMemoryOnboardingLocalDataSource implements OnboardingLocalDataSource {
  OnboardingProfile _profile = OnboardingProfile.initial();

  @override
  Future<OnboardingProfile> loadDraft() async {
    return _profile;
  }

  @override
  Future<void> saveDraft(OnboardingProfile profile) async {
    _profile = profile;
  }
}
