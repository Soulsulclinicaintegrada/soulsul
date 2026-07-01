import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:com_deus_app/src/core/config/supabase_config.dart';
import 'package:com_deus_app/src/features/journey/data/datasources/journey_remote_data_source.dart';
import 'package:com_deus_app/src/features/journey/data/repositories/journey_repository_impl.dart';
import 'package:com_deus_app/src/features/journey/domain/repositories/journey_repository.dart';
import 'package:com_deus_app/src/features/journey/domain/usecases/get_thirty_day_journey.dart';
import 'package:com_deus_app/src/features/journey/presentation/controllers/journey_controller.dart';
import 'package:com_deus_app/src/features/onboarding/data/datasources/onboarding_local_data_source.dart';
import 'package:com_deus_app/src/features/onboarding/data/repositories/onboarding_repository_impl.dart';
import 'package:com_deus_app/src/features/onboarding/domain/repositories/onboarding_repository.dart';
import 'package:com_deus_app/src/features/onboarding/domain/usecases/load_onboarding_draft.dart';
import 'package:com_deus_app/src/features/onboarding/domain/usecases/save_onboarding_draft.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/controllers/onboarding_controller.dart';

late final JourneyController journeyController;
late final OnboardingController onboardingController;

Future<void> setupDependencies() async {
  SupabaseClient? client;

  if (SupabaseConfig.isConfigured) {
    await Supabase.initialize(
      url: SupabaseConfig.url,
      anonKey: SupabaseConfig.anonKey,
    );
    client = Supabase.instance.client;
  }

  final JourneyRemoteDataSource remoteDataSource = SupabaseJourneyRemoteDataSource(
    client: client,
  );

  final JourneyRepository journeyRepository = JourneyRepositoryImpl(
    remoteDataSource: remoteDataSource,
  );

  journeyController = JourneyController(
    getThirtyDayJourney: GetThirtyDayJourney(journeyRepository),
  );

  final OnboardingLocalDataSource onboardingLocalDataSource =
      InMemoryOnboardingLocalDataSource();

  final OnboardingRepository onboardingRepository = OnboardingRepositoryImpl(
    localDataSource: onboardingLocalDataSource,
  );

  onboardingController = OnboardingController(
    loadOnboardingDraft: LoadOnboardingDraft(onboardingRepository),
    saveOnboardingDraft: SaveOnboardingDraft(onboardingRepository),
  );

  await onboardingController.bootstrap();
}
