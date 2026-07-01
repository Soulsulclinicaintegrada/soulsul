import 'package:com_deus_app/src/features/journey/domain/entities/day_journey.dart';

class DayJourneyModel extends DayJourney {
  const DayJourneyModel({
    required super.dayNumber,
    required super.title,
    required super.verse,
    required super.reflection,
    required super.prayerPrompt,
    required super.isCompleted,
  });

  factory DayJourneyModel.fromMap(Map<String, dynamic> map) {
    return DayJourneyModel(
      dayNumber: map['day_number'] as int,
      title: map['title'] as String,
      verse: map['verse'] as String,
      reflection: map['reflection'] as String,
      prayerPrompt: map['prayer_prompt'] as String,
      isCompleted: (map['is_completed'] as bool?) ?? false,
    );
  }

  Map<String, dynamic> toMap() {
    return <String, dynamic>{
      'day_number': dayNumber,
      'title': title,
      'verse': verse,
      'reflection': reflection,
      'prayer_prompt': prayerPrompt,
      'is_completed': isCompleted,
    };
  }

  static List<DayJourneyModel> seed() {
    return List<DayJourneyModel>.generate(
      30,
      (int index) {
        final day = index + 1;
        return DayJourneyModel(
          dayNumber: day,
          title: _titleFor(day),
          verse: _verseFor(day),
          reflection: _reflectionFor(day),
          prayerPrompt: _prayerFor(day),
          isCompleted: false,
        );
      },
    );
  }

  static String _titleFor(int day) => switch (day) {
        1 => 'Comece com entrega',
        2 => 'Silencio e escuta',
        3 => 'Confianca na jornada',
        _ => 'Dia $day com Deus',
      };

  static String _verseFor(int day) => switch (day) {
        1 => 'Proverbios 3:5',
        2 => 'Salmos 46:10',
        3 => 'Mateus 6:33',
        _ => 'Romanos 12:${(day % 9) + 1}',
      };

  static String _reflectionFor(int day) => switch (day) {
        1 => 'Entregue seus planos a Deus e permita que Ele direcione seus passos hoje.',
        2 => 'A quietude tambem e uma forma de fe. Pare, respire e perceba a voz de Deus.',
        3 => 'Buscar o Reino primeiro reorganiza prioridades, medos e desejos.',
        _ => 'Reserve alguns minutos para ler, refletir e anotar como Deus falou com voce neste dia.',
      };

  static String _prayerFor(int day) => switch (day) {
        1 => 'Senhor, guia meu coracao durante estes 30 dias.',
        2 => 'Deus, ensina-me a ouvir Tua voz com calma e sensibilidade.',
        3 => 'Pai, alinha meus desejos com Tua vontade.',
        _ => 'Senhor, revela Tua presenca no meu cotidiano e fortalece minha fe.',
      };
}
