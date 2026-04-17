import sqlite3
from database import conectar, inicializar_banco

inicializar_banco()
conn = conectar()
try:
    row = conn.execute("SELECT id, paciente_id, status, data_criacao, plano_pagamento_json FROM contratos WHERE id=?", (6753358793211906,)).fetchone()
    print(None if row is None else (row['id'], row['paciente_id'], row['status'], row['data_criacao'], str(row['plano_pagamento_json'])[:120]))
finally:
    conn.close()
