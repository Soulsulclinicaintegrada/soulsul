import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/design_system/components/quote_block.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_spacing.dart';

class QuoteOfTheDay extends StatelessWidget {
  const QuoteOfTheDay({
    super.key,
    required this.title,
    required this.quote,
    required this.reference,
  });

  final String title;
  final String quote;
  final String reference;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          title,
          style: theme.textTheme.titleLarge,
        ),
        const SizedBox(height: AppSpacing.md),
        QuoteBlock(
          text: quote,
          author: reference,
        ),
      ],
    );
  }
}
