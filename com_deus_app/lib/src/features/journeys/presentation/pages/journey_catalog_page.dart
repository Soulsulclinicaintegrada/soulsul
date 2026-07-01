import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/design_system/components/entrance_transition.dart';
import 'package:com_deus_app/src/core/design_system/components/journey_card.dart';
import 'package:com_deus_app/src/core/design_system/components/section_title.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_radius.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_spacing.dart';
import 'package:com_deus_app/src/core/di/service_locator.dart';
import 'package:com_deus_app/src/features/journeys/domain/entities/journey_category.dart';
import 'package:com_deus_app/src/features/journeys/domain/entities/journey_summary.dart';
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
    return AnimatedBuilder(
      animation: journeyCatalogController,
      builder: (BuildContext context, Widget? child) {
        final categories = journeyCatalogController.categories;
        final allJourneys = journeyCatalogController.catalog?.journeys ?? <JourneySummary>[];
        final journeys = allJourneys
            .where((JourneySummary item) => item.category == selectedCategoryId)
            .toList();
        JourneyCategory? currentCategory;
        for (final category in categories) {
          if (category.id == selectedCategoryId) {
            currentCategory = category;
            break;
          }
        }

        return OnboardingScaffold(
          onBack: onBack,
          child: journeyCatalogController.isLoading
              ? const Center(child: CircularProgressIndicator())
              : EntranceTransition(
                  child: ListView(
                    padding: EdgeInsets.zero,
                    children: <Widget>[
                      const SizedBox(height: AppSpacing.sm),
                      const SectionTitle(
                        title: 'Explorar Jornadas',
                        subtitle:
                            'Escolha uma trilha para caminhar com calma, profundidade e beleza.',
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      _CategoryRail(
                        categories: categories,
                        selectedCategoryId: selectedCategoryId,
                      ),
                      if (currentCategory != null) ...<Widget>[
                        const SizedBox(height: AppSpacing.xl),
                        Text(
                          '${currentCategory.emoji} ${currentCategory.title}',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          currentCategory.subtitle,
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                      ],
                      const SizedBox(height: AppSpacing.xl),
                      if (journeys.isEmpty)
                        _EmptyCategoryState(
                          selectedCategoryId: selectedCategoryId,
                        )
                      else
                        ...journeys.map(
                          (JourneySummary journey) => Padding(
                            padding: const EdgeInsets.only(bottom: AppSpacing.xl),
                            child: JourneyCard(
                              coverImage: journey.coverImage,
                              title: journey.title,
                              subtitle: journey.subtitle,
                              description: journey.description,
                              themeColor: _parseThemeColor(journey.themeColor),
                              estimatedMinutes: journey.estimatedMinutes,
                              days: journey.days,
                              isPremium: journey.isPremium,
                              onPressed: () async {
                                await journeyCatalogController.openJourney(journey.id);
                                onboardingController.openJourneyDetails();
                              },
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
        );
      },
    );
  }
}

class _CategoryRail extends StatelessWidget {
  const _CategoryRail({
    required this.categories,
    required this.selectedCategoryId,
  });

  final List<JourneyCategory> categories;
  final String selectedCategoryId;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: categories
            .map(
              (JourneyCategory category) => Padding(
                padding: const EdgeInsets.only(right: AppSpacing.sm),
                child: SelectablePill(
                  label: '${category.emoji} ${category.title}',
                  isSelected: selectedCategoryId == category.id,
                  onTap: () => _handleCategoryTap(category),
                ),
              ),
            )
            .toList(),
      ),
    );
  }

  void _handleCategoryTap(JourneyCategory category) {
    switch (category.id) {
      case 'soon':
        onboardingController.openPlaceholder(
          title: 'Em breve',
          message:
              'Novas categorias serão adicionadas aqui sem precisar mudar a estrutura principal do aplicativo.',
          step: OnboardingStep.comingSoonPlaceholder,
        );
        return;
      default:
        journeyCatalogController.selectCategory(category.id);
        onboardingController.selectJourneyCategory(category.id);
    }
  }
}

class _EmptyCategoryState extends StatelessWidget {
  const _EmptyCategoryState({
    required this.selectedCategoryId,
  });

  final String selectedCategoryId;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: const Color(0xFFE9DECF)),
      ),
      child: Text(
        'Ainda não há jornadas visíveis para "$selectedCategoryId". Basta adicionar novas entradas ao JSON para expandir este espaço.',
        style: Theme.of(context).textTheme.bodyLarge,
      ),
    );
  }
}

Color _parseThemeColor(String hex) {
  final normalized = hex.replaceFirst('#', '');
  final value = int.parse('FF$normalized', radix: 16);
  return Color(value);
}
