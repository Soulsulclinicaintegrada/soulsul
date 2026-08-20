import json
import sqlite3
from datetime import date

from api_pacientes import carregar_relatorio_comissoes


def test_relatorio_calcula_pagamento_misto_e_divisao_30_70():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript("""
        CREATE TABLE pacientes (id INTEGER PRIMARY KEY, nome TEXT);
        CREATE TABLE contratos (id INTEGER PRIMARY KEY, paciente_id INTEGER, valor_total REAL, forma_pagamento TEXT, plano_pagamento_json TEXT, status TEXT, data_aprovacao TEXT, data_criacao TEXT, data_pagamento_entrada TEXT, comissao_agendador TEXT, comissao_fechamento TEXT);
        CREATE TABLE recebiveis (id INTEGER PRIMARY KEY, contrato_id INTEGER, status TEXT);
        CREATE TABLE agendamentos (id INTEGER PRIMARY KEY, data TEXT, hora_inicio TEXT, paciente_id INTEGER, paciente_nome TEXT, profissional TEXT, procedimento TEXT, status TEXT, data_criacao TEXT, nome_paciente_snapshot TEXT, data_agendamento TEXT, criado_por TEXT, status_usuario TEXT, criado_em TEXT);
        CREATE TABLE agendamento_procedimentos (agendamento_id INTEGER, procedimento_nome_snapshot TEXT);
    """)
    conn.execute("INSERT INTO pacientes VALUES (1, 'Paciente Teste')")
    plano = json.dumps([{"forma": "PIX", "valor": 400}, {"forma": "BOLETO", "valor": 600}])
    conn.execute("INSERT INTO contratos VALUES (10,1,1000,'Misto',?,'APROVADO','2026-08-10','2026-08-10','2026-08-10','','')", (plano,))
    conn.execute("INSERT INTO agendamentos VALUES (1,'2026-08-05','09:00',1,'Paciente Teste','AVALIAÇÃO','Avaliação','Atendido','2026-08-01','Paciente Teste','2026-08-01','captacao','','2026-08-01')")
    conn.execute("INSERT INTO agendamentos VALUES (2,'2026-08-10','09:00',1,'Paciente Teste','AVALIAÇÃO','Avaliação','Atendido','2026-08-09','Paciente Teste','2026-08-09','resgate','','2026-08-09')")

    relatorio = carregar_relatorio_comissoes(conn, date(2026, 8, 1), date(2026, 8, 31))

    assert len(relatorio.vendas) == 1
    assert relatorio.vendas[0].comissaoTotal == 6.40
    assert relatorio.vendas[0].comissaoCaptacao == 1.92
    assert relatorio.vendas[0].comissaoResgate == 4.48
    assert len(relatorio.avaliacoes) == 2
    assert [item.primeiraAvaliacao for item in relatorio.avaliacoes] == [True, False]
