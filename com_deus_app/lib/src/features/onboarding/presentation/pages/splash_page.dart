import 'dart:async';

import 'package:flutter/material.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({
    super.key,
    required this.onCompleted,
  });

  final Future<void> Function() onCompleted;

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> with SingleTickerProviderStateMixin {
  late final AnimationController _animationController;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..forward();

    _timer = Timer(const Duration(milliseconds: 2400), () async {
      await widget.onCompleted();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF6F0E7),
      body: FadeTransition(
        opacity: CurvedAnimation(
          parent: _animationController,
          curve: Curves.easeIn,
        ),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Container(
                  width: 112,
                  height: 112,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.65),
                    borderRadius: BorderRadius.circular(34),
                  ),
                  child: const Icon(
                    Icons.auto_stories_rounded,
                    size: 48,
                    color: Color(0xFF3E5B3C),
                  ),
                ),
                const SizedBox(height: 28),
                Text(
                  'Com Deus',
                  style: theme.textTheme.displayMedium?.copyWith(
                    color: const Color(0xFF1D271D),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'Uma caminhada de cada vez.',
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: const Color(0xFF5C665C),
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
