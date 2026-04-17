from database import conectar, inicializar_banco
from api_pacientes import gerar_documento_contrato


def main() -> None:
    inicializar_banco()
    conn = conectar()
    try:
        pacientes = conn.execute(
            "SELECT id, nome, prontuario FROM pacientes WHERE prontuario IN (?, ?) ORDER BY id DESC",
            ("2468", "3696"),
        ).fetchall()
        print("PACIENTES", [tuple(row) for row in pacientes])
        print("PACIENTES_2468", [tuple(row) for row in pacientes if str(row["prontuario"] or "") == "2468"])
        alvo = next((row for row in pacientes if int(row["id"]) == 3779), None)
        if alvo is None:
            print("NOT_FOUND")
            return
        paciente_id = int(alvo["id"])
        contratos = conn.execute(
            "SELECT id, paciente_id, status, data_criacao FROM contratos WHERE paciente_id=? ORDER BY COALESCE(data_criacao,'') DESC, id DESC",
            (paciente_id,),
        ).fetchall()
        print("CONTRATOS", [tuple(row) for row in contratos])
        if not contratos:
            print("NOT_FOUND")
            return
        alvo_contrato = next((row for row in contratos if int(row["id"]) == 6753358793211906), contratos[0])
        contrato_id = int(alvo_contrato["id"])
        paciente = conn.execute("SELECT * FROM pacientes WHERE id=?", (paciente_id,)).fetchone()
        contrato = conn.execute("SELECT * FROM contratos WHERE id=?", (contrato_id,)).fetchone()
        caminho = gerar_documento_contrato(conn, paciente, contrato, contrato_id)
        print(f"OK={caminho}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
