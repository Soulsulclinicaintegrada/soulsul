import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:com_deus_app/src/features/journey/data/models/day_journey_model.dart';

abstract interface class JourneyRemoteDataSource {
  Future<List<DayJourneyModel>> fetchThirtyDayJourney();
}

class SupabaseJourneyRemoteDataSource implements JourneyRemoteDataSource {
  SupabaseJourneyRemoteDataSource({required SupabaseClient? client})
      : _client = client;

  final SupabaseClient? _client;

  @override
  Future<List<DayJourneyModel>> fetchThirtyDayJourney() async {
    final client = _client;

    if (client == null) {
      return DayJourneyModel.seed();
    }

    try {
      final response = await client
          .from('journey_days')
          .select()
          .order('day_number');

      return response
          .map<DayJourneyModel>(
            (dynamic item) => DayJourneyModel.fromMap(item as Map<String, dynamic>),
          )
          .toList();
    } catch (_) {
      // Fallback local para permitir evolucao da UI antes da tabela no Supabase.
      return DayJourneyModel.seed();
    }
  }
}
