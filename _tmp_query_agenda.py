import sqlite3

conn = sqlite3.connect(r"C:\Users\jusgo\Documents\sistema_clinica\clinica.db")
conn.row_factory = sqlite3.Row
datas = conn.execute(
    """
    SELECT COALESCE(data_agendamento, data) AS data_ref, COUNT(*) AS total
    FROM agendamentos
    GROUP BY COALESCE(data_agendamento, data)
    ORDER BY substr(COALESCE(data_agendamento, data), 7, 4), substr(COALESCE(data_agendamento, data), 4, 2), substr(COALESCE(data_agendamento, data), 1, 2)
    LIMIT 20
    """
).fetchall()
print("DATAS")
for row in datas:
    print(dict(row))

rows = conn.execute(
    """
    SELECT
      id,
      COALESCE(data_agendamento, data) AS data_ref,
      hora_inicio,
      hora_fim,
      profissional,
      profissional_id,
      status,
      COALESCE(nome_paciente_snapshot, paciente_nome) AS paciente
    FROM agendamentos
    WHERE COALESCE(data_agendamento, data)=?
    ORDER BY hora_inicio, profissional
    LIMIT 50
    """,
    ("13/04/2026",),
).fetchall()
print("TOTAL", len(rows))
for row in rows:
    print(dict(row))

rows_iso = conn.execute(
    """
    SELECT
      id,
      COALESCE(data_agendamento, data) AS data_ref,
      hora_inicio,
      hora_fim,
      profissional,
      profissional_id,
      status,
      COALESCE(nome_paciente_snapshot, paciente_nome) AS paciente
    FROM agendamentos
    WHERE COALESCE(data_agendamento, data)=?
    ORDER BY hora_inicio, profissional
    LIMIT 50
    """,
    ("2026-04-13",),
).fetchall()
print("TOTAL_ISO", len(rows_iso))
for row in rows_iso:
    print(dict(row))
conn.close()
