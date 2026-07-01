import 'package:com_deus_app/src/features/onboarding/domain/entities/onboarding_profile.dart';
import 'package:com_deus_app/src/features/onboarding/domain/repositories/onboarding_repository.dart';

class SaveOnboardingDraft {
  SaveOnboardingDraft(this._repository);

  final OnboardingRepository _repository;

  Future<void> call(OnboardingProfile profile) {
    return _repository.saveDraft(profile);
  }
}
