import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/design_system/components/secondary_button.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_radius.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_shadow.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_spacing.dart';

class JourneyCard extends StatelessWidget {
  const JourneyCard({
    super.key,
    required this.coverImage,
    required this.title,
    required this.subtitle,
    required this.themeColor,
    required this.estimatedMinutes,
    required this.days,
    required this.onPressed,
    required this.description,
    this.isPremium = false,
  });

  final String coverImage;
  final String title;
  final String subtitle;
  final Color themeColor;
  final int estimatedMinutes;
  final int days;
  final String description;
  final VoidCallback onPressed;
  final bool isPremium;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadow.soft,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            SizedBox(
              height: 196,
              width: double.infinity,
              child: _JourneyCover(
                coverImage: coverImage,
                themeColor: themeColor,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: Text(
                          title,
                          style: theme.textTheme.titleLarge,
                        ),
                      ),
                      if (isPremium)
                        Text(
                          'Premium',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.primary,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(subtitle, style: theme.textTheme.bodyMedium),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    description,
                    style: theme.textTheme.bodyMedium,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Wrap(
                    spacing: AppSpacing.md,
                    runSpacing: AppSpacing.xs,
                    children: <Widget>[
                      _MetaText(label: '$estimatedMinutes min'),
                      _MetaText(label: '$days dias'),
                      _MetaText(label: 'Cor ${_colorName(themeColor)}'),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SecondaryButton(
                    label: 'Abrir jornada',
                    onPressed: onPressed,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _JourneyCover extends StatelessWidget {
  const _JourneyCover({
    required this.coverImage,
    required this.themeColor,
  });

  final String coverImage;
  final Color themeColor;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: <Widget>[
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: <Color>[
                themeColor.withOpacity(0.92),
                Color.lerp(themeColor, Colors.white, 0.45) ?? themeColor,
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        Positioned.fill(
          child: Image.asset(
            coverImage,
            fit: BoxFit.cover,
            errorBuilder: (BuildContext context, Object error, StackTrace? stackTrace) {
              return Stack(
                fit: StackFit.expand,
                children: <Widget>[
                  Positioned(
                    top: 22,
                    right: 26,
                    child: Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                  Positioned(
                    left: 24,
                    bottom: 22,
                    child: Container(
                      width: 120,
                      height: 56,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.16),
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _MetaText extends StatelessWidget {
  const _MetaText({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: const Color(0xFF617061),
          ),
    );
  }
}

String _colorName(Color color) {
  final int value = color.value;
  if (value == const Color(0xFFB8CC9D).value) {
    return 'sage';
  }
  if (value == const Color(0xFFC7D9D1).value) {
    return 'mist';
  }
  if (value == const Color(0xFFE4C2B3).value) {
    return 'rose';
  }
  if (value == const Color(0xFFAFCFE4).value) {
    return 'sky';
  }
  if (value == const Color(0xFFF0D8A8).value) {
    return 'sun';
  }
  return 'soft';
}
