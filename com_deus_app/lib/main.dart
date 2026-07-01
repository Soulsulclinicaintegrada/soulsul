import 'package:flutter/material.dart';
import 'package:com_deus_app/src/app.dart';
import 'package:com_deus_app/src/core/di/service_locator.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await setupDependencies();
  runApp(const ComDeusApp());
}
