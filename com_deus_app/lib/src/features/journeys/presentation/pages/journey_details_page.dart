import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/design_system/components/entrance_transition.dart';
import 'package:com_deus_app/src/core/design_system/components/primary_button.dart';
import 'package:com_deus_app/src/core/design_system/components/section_title.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_radius.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_shadow.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_spacing.dart';
import 'package:com_deus_app/src/core/di/service_locator.dart';
import 'package:com_deus_app/src/features/journeys/domain/entities/journey_summary.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/onboarding_scaffold.dart';

class JourneyDetailsPage extends StatefulWidget {
  const JourneyDetailsPage({
    super.key,
    required this.onBack,
  });

  final VoidCallback onBack;

  @override
  State<JourneyDetailsPage> createState() => _JourneyDetailsPageState();
}

class _JourneyDetailsPageState extends State<JourneyDetailsPage> {
  @override
  void initState() {
    super.initState();
    if (journeyCatalogController.selectedJourney == null) {
      journeyCatalogController.openJourney('30-dias-com-deus');
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: journeyCatalogController,
      builder: (BuildContext context, Widget? child) {
        final journey = journeyCatalogController.selectedJourney;
        if (journey == null) {
          return OnboardingScaffold(
            onBack: widget.onBack,
            child: const Center(
              child: CircularProgressIndicator(),
            ),
          );
        }

        final themeColor = _parseThemeColor(journey.themeColor);

        return OnboardingScaffold(
          onBack: widget.onBack,
          child: EntranceTransition(
            child: ListView(
              padding: EdgeInsets.zero,
              children: <Widget>[
                _JourneyDetailCover(
                  title: journey.title,
                  coverImage: journey.coverImage,
                  themeColor: themeColor,
                ),
                const SizedBox(height: AppSpacing.xl),
                SectionTitle(
                  title: journey.title,
                  subtitle: journey.description,
                ),
                const SizedBox(height: AppSpacing.xl),
                _DetailLine(
                  label: 'Objetivo',
                  value: journey.objective,
                ),
                const SizedBox(height: AppSpacing.lg),
                _DetailLine(
                  label: 'Quantidade de dias',
                  value: '${journey.days} dias',
                ),
                const SizedBox(height: AppSpacing.lg),
                _DetailLine(
                  label: 'Tempo diário',
                  value: '${journey.estimatedMinutes} minutos',
                ),
                if (journey.recommendedAge != null) ...<Widget>[
                  const SizedBox(height: AppSpacing.lg),
                  _DetailLine(
                    label: 'Faixa recomendada',
                    value: journey.recommendedAge!,
                  ),
                ],
                if (journey.kidsMetadata != null) ...<Widget>[
                  const SizedBox(height: AppSpacing.xl),
                  _KidsMetadataBlock(metadata: journey.kidsMetadata!),
                ],
                const SizedBox(height: AppSpacing.xxl),
                PrimaryButton(
                  label: 'Começar Jornada',
                  onPressed: () => _handleStartJourney(journey),
                ),
                const SizedBox(height: AppSpacing.xl),
              ],
            ),
          ),
        );
      },
    );
  }
}

void _handleStartJourney(JourneySummary journey) {
  switch (journey.category) {
    case 'family':
      onboardingController.openFamilyCompanion();
      return;
    case 'kids':
      onboardingController.openPlaceholder(
        title: 'Modo Infantil',
        message:
            'A estrutura da jornada infantil já está pronta. O conteúdo guiado será adicionado em uma próxima sprint.',
        step: OnboardingStep.kidsPlaceholder,
      );
      return;
    case 'couples':
      onboardingController.openPlaceholder(
        title: 'Modo Casais',
        message:
            'A estrutura da jornada para casais está pronta. O conteúdo guiado será adicionado em uma próxima sprint.',
        step: OnboardingStep.couplesPlaceholder,
      );
      return;
    default:
      return;
  }
}

class _JourneyDetailCover extends StatelessWidget {
  const _JourneyDetailCover({
    required this.title,
    required this.coverImage,
    required this.themeColor,
  });

  final String title;
  final String coverImage;
  final Color themeColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 300,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadow.soft,
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: <Widget>[
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: <Color>[
                  themeColor.withOpacity(0.96),
                  Color.lerp(themeColor, Colors.white, 0.45) ?? themeColor,
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
          ),
          Image.asset(
            coverImage,
            fit: BoxFit.cover,
            errorBuilder: (BuildContext context, Object error, StackTrace? stackTrace) {
              return const SizedBox.shrink();
            },
          ),
          Positioned(
            left: 26,
            right: 26,
            bottom: 24,
            child: Text(
              title,
              style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                    color: Colors.white,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailLine extends StatelessWidget {
  const _DetailLine({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.primary,
          ),
        ),
        const SizedBox(height: AppSpacing.xxs),
        Text(
          value,
          style: theme.textTheme.titleMedium,
        ),
      ],
    );
  }
}

class _KidsMetadataBlock extends StatelessWidget {
  const _KidsMetadataBlock({required this.metadata});

  final KidsJourneyMetadata metadata;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFCF8),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: const Color(0xFFEADFCC)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            'Estrutura infantil',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Idades: ${metadata.minimumAge} a ${metadata.maximumAge}',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Tipo de atividade: ${metadata.activityType}',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Campos preparados: desafio do dia, atividade prática e pergunta para os pais.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}

Color _parseThemeColor(String hex) {
  final normalized = hex.replaceFirst('#', '');
  final value = int.parse('FF$normalized', radix: 16);
  return Color(value);
}
