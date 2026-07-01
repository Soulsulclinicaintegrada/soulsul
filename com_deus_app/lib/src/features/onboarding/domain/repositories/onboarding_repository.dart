import 'package:com_deus_app/src/features/onboarding/domain/entities/onboarding_profile.dart';

abstract interface class OnboardingRepository {
  Future<OnboardingProfile> loadDraft();
  Future<void> saveDraft(OnboardingProfile profile);
}
