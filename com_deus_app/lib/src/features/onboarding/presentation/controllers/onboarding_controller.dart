import 'package:flutter/foundation.dart';
import 'package:com_deus_app/src/features/onboarding/domain/entities/onboarding_profile.dart';
import 'package:com_deus_app/src/features/onboarding/domain/usecases/load_onboarding_draft.dart';
import 'package:com_deus_app/src/features/onboarding/domain/usecases/save_onboarding_draft.dart';

enum OnboardingStep {
  splash,
  welcome,
  pathChoice,
  privacy,
  name,
  purpose,
  fasting,
  schedule,
  home,
}

class OnboardingController extends ChangeNotifier {
  OnboardingController({
    required LoadOnboardingDraft loadOnboardingDraft,
    required SaveOnboardingDraft saveOnboardingDraft,
  })  : _loadOnboardingDraft = loadOnboardingDraft,
        _saveOnboardingDraft = saveOnboardingDraft;

  final LoadOnboardingDraft _loadOnboardingDraft;
  final SaveOnboardingDraft _saveOnboardingDraft;

  OnboardingStep _currentStep = OnboardingStep.splash;
  OnboardingProfile _profile = OnboardingProfile.initial();

  OnboardingStep get currentStep => _currentStep;
  OnboardingProfile get profile => _profile;

  Future<void> bootstrap() async {
    _profile = await _loadOnboardingDraft();
    notifyListeners();
  }

  Future<void> completeSplash() async {
    _currentStep = OnboardingStep.welcome;
    notifyListeners();
  }

  void goBack() {
    switch (_currentStep) {
      case OnboardingStep.splash:
      case OnboardingStep.welcome:
        return;
      case OnboardingStep.pathChoice:
        _currentStep = OnboardingStep.welcome;
        break;
      case OnboardingStep.privacy:
        _currentStep = OnboardingStep.pathChoice;
        break;
      case OnboardingStep.name:
        _currentStep = OnboardingStep.privacy;
        break;
      case OnboardingStep.purpose:
        _currentStep = OnboardingStep.name;
        break;
      case OnboardingStep.fasting:
        _currentStep = OnboardingStep.purpose;
        break;
      case OnboardingStep.schedule:
        _currentStep = OnboardingStep.fasting;
        break;
      case OnboardingStep.home:
        _currentStep = OnboardingStep.schedule;
        break;
    }
    notifyListeners();
  }

  void goToPathChoice() {
    _currentStep = OnboardingStep.pathChoice;
    notifyListeners();
  }

  Future<void> selectJourneyStyle(JourneyStyle style) async {
    _profile = _profile.copyWith(journeyStyle: style);
    await _persist();
    _currentStep = OnboardingStep.privacy;
    notifyListeners();
  }

  void acknowledgePrivacy() {
    _currentStep = OnboardingStep.name;
    notifyListeners();
  }

  Future<void> saveName(String name) async {
    _profile = _profile.copyWith(name: name.trim());
    await _persist();
    _currentStep = OnboardingStep.purpose;
    notifyListeners();
  }

  Future<void> selectBlessingFocus(BlessingFocus focus) async {
    _profile = _profile.copyWith(blessingFocus: focus);
    await _persist();
    _currentStep = OnboardingStep.fasting;
    notifyListeners();
  }

  Future<void> setFasting(bool includeFasting) async {
    _profile = _profile.copyWith(includeFasting: includeFasting);
    await _persist();
    _currentStep = OnboardingStep.schedule;
    notifyListeners();
  }

  Future<void> saveReminderTime(String reminderTime) async {
    _profile = _profile.copyWith(reminderTime: reminderTime.trim());
    await _persist();
    _currentStep = OnboardingStep.home;
    notifyListeners();
  }

  Future<void> _persist() {
    return _saveOnboardingDraft(_profile);
  }
}
