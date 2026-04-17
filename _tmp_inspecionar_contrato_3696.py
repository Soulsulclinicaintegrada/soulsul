from database import conectar, inicializar_banco
from api_pacientes import gerar_documento_contrato


def main() -> None:
    inicializar_banco()
    conn = conectar()
    try:
        pacientes = conn.execute(
            "SELECT id, nome, prontuario FROM pacientes WHERE prontuario=? ORDER BY id DESC",
            ("3696",),
        ).fetchall()
        print("PACIENTES", [tuple(row) for row in pacientes])
        if not pacientes:
            print("PACIENTE_NAO_ENCONTRADO")
            return
        paciente_id = int(pacientes[0]["id"])
        contratos = conn.execute(
            "SELECT id, paciente_id, status, data_criacao FROM contratos WHERE paciente_id=? ORDER BY COALESCE(data_criacao,'') DESC, id DESC",
            (paciente_id,),
        ).fetchall()
        print("CONTRATOS", [tuple(row) for row in contratos])
        if not contratos:
            print("CONTRATO_NAO_ENCONTRADO")
            return
        for contrato_row in contratos[:5]:
            contrato_id = int(contrato_row["id"])
            paciente = conn.execute("SELECT * FROM pacientes WHERE id=?", (paciente_id,)).fetchone()
            contrato = conn.execute("SELECT * FROM contratos WHERE id=?", (contrato_id,)).fetchone()
            caminho = gerar_documento_contrato(conn, paciente, contrato, contrato_id)
            print(f"GERADO {contrato_id} => {caminho}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
