import sqlite3
from pathlib import Path


def colunas(conn, tabela):
    return [row[1] for row in conn.execute(f"PRAGMA table_info({tabela})").fetchall()]


db_path = Path(__file__).with_name("clinica.db")
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

print("COLUNAS_USUARIOS", colunas(conn, "usuarios"))
try:
    print("COLUNAS_AGENDA_CONFIG", colunas(conn, "agenda_configuracao"))
except Exception as exc:
    print("COLUNAS_AGENDA_CONFIG_ERRO", exc)
print("COLUNAS_AGENDAMENTOS", colunas(conn, "agendamentos"))

print("USUARIOS")
for row in conn.execute("SELECT * FROM usuarios ORDER BY id LIMIT 20"):
    print(dict(row))

print("AGENDA_CONFIG")
try:
    for row in conn.execute("SELECT * FROM agenda_configuracao ORDER BY id LIMIT 30"):
        print(dict(row))
except Exception as exc:
    print("AGENDA_CONFIG_ERRO", exc)

print("PACIENTES_RECENTES")
for row in conn.execute("SELECT * FROM pacientes ORDER BY id DESC LIMIT 10"):
    print(dict(row))

print("AGENDAMENTOS_RECENTES")
for row in conn.execute("SELECT * FROM agendamentos ORDER BY id DESC LIMIT 10"):
    print(dict(row))

conn.close()
