import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/di/service_locator.dart';
import 'package:com_deus_app/src/features/onboarding/domain/entities/onboarding_profile.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/onboarding_scaffold.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/selection_card.dart';

class PurposePage extends StatelessWidget {
  const PurposePage({
    super.key,
    required this.selectedFocus,
    required this.onBack,
  });

  final BlessingFocus? selectedFocus;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return OnboardingScaffold(
      onBack: onBack,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const SizedBox(height: 18),
          Text(
            'Qual bênção você deseja colocar diante de Deus durante esta caminhada?',
            style: theme.textTheme.headlineLarge,
          ),
          const SizedBox(height: 28),
          LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) {
              final itemWidth = (constraints.maxWidth - 12) / 2;

              return Wrap(
                spacing: 12,
                runSpacing: 12,
                children: <Widget>[
                  SizedBox(
                    width: itemWidth,
                    child: SelectionCard(
                      label: 'Ansiedade',
                      isSelected: selectedFocus == BlessingFocus.anxiety,
                      onTap: () {
                        onboardingController.selectBlessingFocus(BlessingFocus.anxiety);
                      },
                    ),
                  ),
                  SizedBox(
                    width: itemWidth,
                    child: SelectionCard(
                      label: 'Casamento',
                      isSelected: selectedFocus == BlessingFocus.marriage,
                      onTap: () {
                        onboardingController.selectBlessingFocus(BlessingFocus.marriage);
                      },
                    ),
                  ),
                  SizedBox(
                    width: itemWidth,
                    child: SelectionCard(
                      label: 'Família',
                      isSelected: selectedFocus == BlessingFocus.family,
                      onTap: () {
                        onboardingController.selectBlessingFocus(BlessingFocus.family);
                      },
                    ),
                  ),
                  SizedBox(
                    width: itemWidth,
                    child: SelectionCard(
                      label: 'Financeiro',
                      isSelected: selectedFocus == BlessingFocus.finances,
                      onTap: () {
                        onboardingController.selectBlessingFocus(BlessingFocus.finances);
                      },
                    ),
                  ),
                  SizedBox(
                    width: itemWidth,
                    child: SelectionCard(
                      label: 'Paz',
                      isSelected: selectedFocus == BlessingFocus.peace,
                      onTap: () {
                        onboardingController.selectBlessingFocus(BlessingFocus.peace);
                      },
                    ),
                  ),
                  SizedBox(
                    width: itemWidth,
                    child: SelectionCard(
                      label: 'Outro',
                      isSelected: selectedFocus == BlessingFocus.other,
                      onTap: () {
                        onboardingController.selectBlessingFocus(BlessingFocus.other);
                      },
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
