import 'package:com_deus_app/src/features/onboarding/data/datasources/onboarding_local_data_source.dart';
import 'package:com_deus_app/src/features/onboarding/domain/entities/onboarding_profile.dart';
import 'package:com_deus_app/src/features/onboarding/domain/repositories/onboarding_repository.dart';

class OnboardingRepositoryImpl implements OnboardingRepository {
  OnboardingRepositoryImpl({required OnboardingLocalDataSource localDataSource})
      : _localDataSource = localDataSource;

  final OnboardingLocalDataSource _localDataSource;

  @override
  Future<OnboardingProfile> loadDraft() {
    return _localDataSource.loadDraft();
  }

  @override
  Future<void> saveDraft(OnboardingProfile profile) {
    return _localDataSource.saveDraft(profile);
  }
}
