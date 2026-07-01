import 'dart:async';

import 'package:flutter/material.dart';

class RespireIntroPage extends StatefulWidget {
  const RespireIntroPage({
    super.key,
    required this.onCompleted,
  });

  final VoidCallback onCompleted;

  @override
  State<RespireIntroPage> createState() => _RespireIntroPageState();
}

class _RespireIntroPageState extends State<RespireIntroPage> {
  Timer? _secondStageTimer;
  Timer? _completionTimer;

  bool _showPresenceText = false;

  @override
  void initState() {
    super.initState();

    _secondStageTimer = Timer(const Duration(seconds: 2), () {
      if (!mounted) {
        return;
      }
      setState(() {
        _showPresenceText = true;
      });
    });

    _completionTimer = Timer(const Duration(seconds: 4), () {
      if (!mounted) {
        return;
      }
      widget.onCompleted();
    });
  }

  @override
  void dispose() {
    _secondStageTimer?.cancel();
    _completionTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: <Color>[Color(0xFFF7F0E7), Color(0xFFFDF9F2)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  AnimatedOpacity(
                    duration: const Duration(milliseconds: 1400),
                    curve: Curves.easeOutCubic,
                    opacity: 1,
                    child: Text(
                      'Respire.',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.displayLarge,
                    ),
                  ),
                  const SizedBox(height: 20),
                  AnimatedOpacity(
                    duration: const Duration(milliseconds: 1200),
                    curve: Curves.easeOutCubic,
                    opacity: _showPresenceText ? 1 : 0,
                    child: AnimatedSlide(
                      duration: const Duration(milliseconds: 1200),
                      curve: Curves.easeOutCubic,
                      offset: _showPresenceText ? Offset.zero : const Offset(0, 0.06),
                      child: Text(
                        'Deus já está aqui.',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyLarge,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
