import 'package:com_deus_app/src/features/onboarding/domain/entities/onboarding_profile.dart';
import 'package:com_deus_app/src/features/onboarding/domain/repositories/onboarding_repository.dart';

class LoadOnboardingDraft {
  LoadOnboardingDraft(this._repository);

  final OnboardingRepository _repository;

  Future<OnboardingProfile> call() {
    return _repository.loadDraft();
  }
}
