import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/design_system/components/entrance_transition.dart';
import 'package:com_deus_app/src/core/design_system/components/journey_card.dart';
import 'package:com_deus_app/src/core/design_system/components/section_title.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_spacing.dart';
import 'package:com_deus_app/src/core/di/service_locator.dart';
import 'package:com_deus_app/src/features/journeys/domain/entities/journey_catalog.dart';
import 'package:com_deus_app/src/features/journeys/domain/entities/journey_category.dart';
import 'package:com_deus_app/src/features/journeys/domain/entities/journey_summary.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/controllers/onboarding_controller.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/onboarding_scaffold.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/selectable_pill.dart';

class JourneyCatalogPage extends StatelessWidget {
  const JourneyCatalogPage({
    super.key,
    required this.selectedCategoryId,
    required this.onBack,
  });

  final String selectedCategoryId;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final selectedJourneys = JourneyCatalog.journeys
        .where((JourneySummary item) => item.categoryId == selectedCategoryId)
        .toList();

    return OnboardingScaffold(
      onBack: onBack,
      child: EntranceTransition(
        child: ListView(
          padding: EdgeInsets.zero,
          children: <Widget>[
            const SizedBox(height: AppSpacing.sm),
            const SectionTitle(
              title: 'Escolha uma jornada.',
              subtitle:
                  'Cada caminho foi pensado para começar simples, belo e possível.',
            ),
            const SizedBox(height: AppSpacing.xl),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: JourneyCatalog.categories
                  .map(
                    (JourneyCategory category) => SelectablePill(
                      label: '${category.emoji} ${category.title}',
                      isSelected: selectedCategoryId == category.id,
                      onTap: () => _handleCategoryTap(category),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: AppSpacing.xl),
            if (selectedJourneys.isNotEmpty)
              ...selectedJourneys.map(
                (JourneySummary journey) => Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                  child: JourneyCard(
                    title: journey.title,
                    subtitle: journey.subtitle,
                    label: journey.label,
                    coverPalette: journey.coverPalette
                        .map((int color) => Color(color))
                        .toList(),
                    onPressed: () {},
                  ),
                ),
              )
            else
              Text(
                'Selecione uma categoria para continuar.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
          ],
        ),
      ),
    );
  }

  void _handleCategoryTap(JourneyCategory category) {
    switch (category.action) {
      case JourneyCategoryAction.openCatalog:
        onboardingController.selectJourneyCategory(category.id);
        break;
      case JourneyCategoryAction.openFamilyFlow:
        onboardingController.openFamilyCompanion();
        break;
      case JourneyCategoryAction.openKidsPlaceholder:
        onboardingController.openPlaceholder(
          title: 'Modo Infantil',
          message: 'Este espaço está sendo preparado para pequenas caminhadas cheias de encanto, repetição e presença.',
          step: OnboardingStep.kidsPlaceholder,
        );
        break;
      case JourneyCategoryAction.openCouplesPlaceholder:
        onboardingController.openPlaceholder(
          title: 'Modo Casais',
          message: 'Estamos preparando jornadas para caminhar a dois, com mais escuta, oração e unidade.',
          step: OnboardingStep.couplesPlaceholder,
        );
        break;
      case JourneyCategoryAction.openComingSoon:
        onboardingController.openPlaceholder(
          title: 'Em breve',
          message: 'Novas categorias serão adicionadas aqui sem precisar mudar a estrutura principal do aplicativo.',
          step: OnboardingStep.comingSoonPlaceholder,
        );
        break;
    }
  }
}
