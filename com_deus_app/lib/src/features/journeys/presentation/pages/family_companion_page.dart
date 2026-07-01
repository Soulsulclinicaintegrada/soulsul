import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/design_system/components/entrance_transition.dart';
import 'package:com_deus_app/src/core/design_system/components/section_title.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_spacing.dart';
import 'package:com_deus_app/src/core/di/service_locator.dart';
import 'package:com_deus_app/src/features/onboarding/domain/entities/onboarding_profile.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/onboarding_scaffold.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/selection_card.dart';

class FamilyCompanionPage extends StatelessWidget {
  const FamilyCompanionPage({
    super.key,
    required this.onBack,
  });

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return OnboardingScaffold(
      onBack: onBack,
      child: EntranceTransition(
        child: ListView(
          padding: EdgeInsets.zero,
          children: <Widget>[
            const SizedBox(height: AppSpacing.sm),
            const SectionTitle(title: 'Com quem você deseja caminhar?'),
            const SizedBox(height: AppSpacing.xl),
            SelectionCard(
              label: 'Meu filho',
              isSelected: false,
              onTap: () {
                onboardingController.saveFamilyCompanion(FamilyCompanion.son);
              },
            ),
            const SizedBox(height: AppSpacing.md),
            SelectionCard(
              label: 'Minha filha',
              isSelected: false,
              onTap: () {
                onboardingController.saveFamilyCompanion(FamilyCompanion.daughter);
              },
            ),
            const SizedBox(height: AppSpacing.md),
            SelectionCard(
              label: 'Toda a família',
              isSelected: false,
              onTap: () {
                onboardingController.saveFamilyCompanion(FamilyCompanion.wholeFamily);
              },
            ),
            const SizedBox(height: AppSpacing.md),
            SelectionCard(
              label: 'Meu cônjuge',
              isSelected: false,
              onTap: () {
                onboardingController.saveFamilyCompanion(FamilyCompanion.spouse);
              },
            ),
          ],
        ),
      ),
    );
  }
}
