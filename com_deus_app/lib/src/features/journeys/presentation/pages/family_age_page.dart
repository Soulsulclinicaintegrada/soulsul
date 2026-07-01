import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/design_system/components/entrance_transition.dart';
import 'package:com_deus_app/src/core/design_system/components/section_title.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_spacing.dart';
import 'package:com_deus_app/src/core/di/service_locator.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/onboarding_scaffold.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/selectable_pill.dart';

class FamilyAgePage extends StatelessWidget {
  const FamilyAgePage({
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
            const SectionTitle(title: 'Qual idade?'),
            const SizedBox(height: AppSpacing.xl),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: List<Widget>.generate(
                10,
                (int index) {
                  final age = index + 3;
                  return SelectablePill(
                    label: age.toString(),
                    isSelected: false,
                    onTap: () {
                      onboardingController.saveFamilyAge(age);
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
