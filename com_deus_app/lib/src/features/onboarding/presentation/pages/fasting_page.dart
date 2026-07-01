import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/design_system/components/entrance_transition.dart';
import 'package:com_deus_app/src/core/design_system/components/section_title.dart';
import 'package:com_deus_app/src/core/di/service_locator.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/onboarding_scaffold.dart';

class FastingPage extends StatelessWidget {
  const FastingPage({
    super.key,
    required this.selectedValue,
    required this.onBack,
  });

  final bool? selectedValue;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return OnboardingScaffold(
      onBack: onBack,
      child: EntranceTransition(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const SizedBox(height: 18),
            const SectionTitle(
              title: 'Deseja incluir um jejum alimentar nesta caminhada?',
            ),
            const SizedBox(height: 30),
            _OptionTile(
              label: 'Sim',
              isSelected: selectedValue == true,
              onTap: () {
                onboardingController.setFasting(true);
              },
            ),
            const SizedBox(height: 14),
            _OptionTile(
              label: 'Agora não',
              isSelected: selectedValue == false,
              onTap: () {
                onboardingController.setFasting(false);
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: isSelected
          ? theme.colorScheme.primaryContainer
          : theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(24),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: isSelected
                  ? theme.colorScheme.primary
                  : const Color(0xFFE8DED0),
            ),
          ),
          child: Text(
            label,
            style: theme.textTheme.titleLarge,
          ),
        ),
      ),
    );
  }
}
