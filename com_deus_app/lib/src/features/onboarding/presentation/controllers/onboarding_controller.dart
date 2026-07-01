import 'package:flutter/foundation.dart';
import 'package:com_deus_app/src/features/onboarding/domain/entities/onboarding_profile.dart';
import 'package:com_deus_app/src/features/onboarding/domain/usecases/load_onboarding_draft.dart';
import 'package:com_deus_app/src/features/onboarding/domain/usecases/save_onboarding_draft.dart';

enum OnboardingStep {
  respire,
  splash,
  welcome,
  pathChoice,
  privacy,
  name,
  purpose,
  fasting,
  schedule,
  home,
  journeyCatalog,
  familyCompanion,
  familyAge,
  familyPlaceholder,
  kidsPlaceholder,
  couplesPlaceholder,
  comingSoonPlaceholder,
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
  String _selectedJourneyCategoryId = 'encounter';
  String _selectedPlaceholderTitle = '';
  String _selectedPlaceholderMessage = '';

  OnboardingStep get currentStep => _currentStep;
  OnboardingProfile get profile => _profile;
  String get selectedJourneyCategoryId => _selectedJourneyCategoryId;
  String get selectedPlaceholderTitle => _selectedPlaceholderTitle;
  String get selectedPlaceholderMessage => _selectedPlaceholderMessage;

  Future<void> bootstrap() async {
    _profile = await _loadOnboardingDraft();
    final screenshotTarget = const String.fromEnvironment('SCREENSHOT_TARGET');
    if (screenshotTarget.isNotEmpty) {
      _applyScreenshotTarget(screenshotTarget);
      notifyListeners();
      return;
    }

    _currentStep =
        _profile.enableRespireIntro ? OnboardingStep.respire : OnboardingStep.splash;
    notifyListeners();
  }

  void completeRespire() {
    _currentStep = OnboardingStep.splash;
    notifyListeners();
  }

  Future<void> completeSplash() async {
    _currentStep = OnboardingStep.welcome;
    notifyListeners();
  }

  void goBack() {
    switch (_currentStep) {
      case OnboardingStep.respire:
        return;
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
      case OnboardingStep.journeyCatalog:
        _currentStep = OnboardingStep.home;
        break;
      case OnboardingStep.familyCompanion:
        _currentStep = OnboardingStep.journeyCatalog;
        break;
      case OnboardingStep.familyAge:
        _currentStep = OnboardingStep.familyCompanion;
        break;
      case OnboardingStep.familyPlaceholder:
        _currentStep = OnboardingStep.familyAge;
        break;
      case OnboardingStep.kidsPlaceholder:
      case OnboardingStep.couplesPlaceholder:
      case OnboardingStep.comingSoonPlaceholder:
        _currentStep = OnboardingStep.journeyCatalog;
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

  void openJourneyCatalog({String initialCategoryId = 'encounter'}) {
    _selectedJourneyCategoryId = initialCategoryId;
    _currentStep = OnboardingStep.journeyCatalog;
    notifyListeners();
  }

  void selectJourneyCategory(String categoryId) {
    _selectedJourneyCategoryId = categoryId;
    notifyListeners();
  }

  void openFamilyCompanion() {
    _currentStep = OnboardingStep.familyCompanion;
    notifyListeners();
  }

  Future<void> saveFamilyCompanion(FamilyCompanion companion) async {
    _profile = _profile.copyWith(
      familyCompanion: companion,
      resetFamilyAge: true,
    );
    await _persist();
    _currentStep = OnboardingStep.familyAge;
    notifyListeners();
  }

  Future<void> saveFamilyAge(int age) async {
    _profile = _profile.copyWith(familyAge: age);
    await _persist();
    _currentStep = OnboardingStep.familyPlaceholder;
    notifyListeners();
  }

  void openPlaceholder({
    required String title,
    required String message,
    required OnboardingStep step,
  }) {
    _selectedPlaceholderTitle = title;
    _selectedPlaceholderMessage = message;
    _currentStep = step;
    notifyListeners();
  }

  Future<void> _persist() {
    return _saveOnboardingDraft(_profile);
  }

  void _applyScreenshotTarget(String target) {
    _profile = _profile.copyWith(
      name: 'Juliana',
      blessingFocus: BlessingFocus.peace,
      includeFasting: false,
      reminderTime: '09h',
      familyCompanion: FamilyCompanion.wholeFamily,
      familyAge: 7,
    );

    switch (target) {
      case 'respire':
        _currentStep = OnboardingStep.respire;
        return;
      case 'splash':
        _currentStep = OnboardingStep.splash;
        return;
      case 'welcome':
        _currentStep = OnboardingStep.welcome;
        return;
      case 'choice':
        _currentStep = OnboardingStep.pathChoice;
        return;
      case 'privacy':
        _currentStep = OnboardingStep.privacy;
        return;
      case 'name':
        _currentStep = OnboardingStep.name;
        return;
      case 'purpose':
        _currentStep = OnboardingStep.purpose;
        return;
      case 'fasting':
        _currentStep = OnboardingStep.fasting;
        return;
      case 'schedule':
        _currentStep = OnboardingStep.schedule;
        return;
      case 'home':
        _currentStep = OnboardingStep.home;
        return;
      case 'journeys':
        _selectedJourneyCategoryId = 'encounter';
        _currentStep = OnboardingStep.journeyCatalog;
        return;
      case 'journeys-biblical':
        _selectedJourneyCategoryId = 'biblical';
        _currentStep = OnboardingStep.journeyCatalog;
        return;
      case 'family-companion':
        _currentStep = OnboardingStep.familyCompanion;
        return;
      case 'family-age':
        _currentStep = OnboardingStep.familyAge;
        return;
      case 'family-placeholder':
        _currentStep = OnboardingStep.familyPlaceholder;
        return;
      case 'kids-placeholder':
        _selectedPlaceholderTitle = 'Modo Infantil';
        _selectedPlaceholderMessage =
            'Este espaço está sendo preparado para pequenas caminhadas cheias de encanto, repetição e presença.';
        _currentStep = OnboardingStep.kidsPlaceholder;
        return;
      case 'couples-placeholder':
        _selectedPlaceholderTitle = 'Modo Casais';
        _selectedPlaceholderMessage =
            'Estamos preparando jornadas para caminhar a dois, com mais escuta, oração e unidade.';
        _currentStep = OnboardingStep.couplesPlaceholder;
        return;
      case 'coming-soon':
        _selectedPlaceholderTitle = 'Em breve';
        _selectedPlaceholderMessage =
            'Novas categorias serão adicionadas aqui sem precisar mudar a estrutura principal do aplicativo.';
        _currentStep = OnboardingStep.comingSoonPlaceholder;
        return;
      default:
        _currentStep =
            _profile.enableRespireIntro ? OnboardingStep.respire : OnboardingStep.splash;
        return;
    }
  }
}
