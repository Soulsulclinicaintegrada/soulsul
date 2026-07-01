import 'package:flutter/material.dart';
import 'package:com_deus_app/src/features/experience/presentation/pages/app_entry_page.dart';
import 'package:com_deus_app/src/core/theme/app_theme.dart';

class ComDeusApp extends StatelessWidget {
  const ComDeusApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Com Deus',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: const AppEntryPage(),
    );
  }
}
