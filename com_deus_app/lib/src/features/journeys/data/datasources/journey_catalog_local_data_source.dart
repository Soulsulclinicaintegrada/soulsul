import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:com_deus_app/src/features/journeys/data/models/journey_catalog_model.dart';

abstract interface class JourneyCatalogLocalDataSource {
  Future<JourneyCatalogModel> loadCatalog();
}

class AssetJourneyCatalogLocalDataSource implements JourneyCatalogLocalDataSource {
  const AssetJourneyCatalogLocalDataSource({
    required AssetBundle assetBundle,
  }) : _assetBundle = assetBundle;

  final AssetBundle _assetBundle;

  @override
  Future<JourneyCatalogModel> loadCatalog() async {
    final jsonString =
        await _assetBundle.loadString('assets/data/journeys_catalog.json');
    final map = json.decode(jsonString) as Map<String, dynamic>;
    return JourneyCatalogModel.fromMap(map);
  }
}
