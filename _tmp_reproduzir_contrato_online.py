import json

from database import conectar, inicializar_banco
from api_pacientes import gerar_documento_contrato


PACIENTE_ID = 3779
CONTRATO_ID = 6753358793211908


def main() -> None:
    inicializar_banco()
    conn = conectar()
    try:
        conn.execute("BEGIN")
        contrato = conn.execute("SELECT * FROM contratos WHERE id=?", (CONTRATO_ID,)).fetchone()
        if contrato is None:
            conn.execute(
                """
                INSERT INTO contratos (
                    id, paciente_id, valor_total, entrada, parcelas, primeiro_vencimento,
                    data_pagamento_entrada, forma_pagamento, hash_importacao, data_criacao,
                    status, aprovado_por, data_aprovacao, observacoes, clinica_snapshot,
                    criado_por_snapshot, tabela_snapshot, plano_pagamento_json,
                    desconto_percentual, desconto_valor, validade_orcamento
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    CONTRATO_ID,
                    PACIENTE_ID,
                    480.0,
                    0.0,
                    1,
                    "2026-04-15",
                    None,
                    "Pix",
                    None,
                    "2026-04-15",
                    "APROVADO",
                    "JULIANA",
                    "2026-04-15 21:11:31",
                    None,
                    "Soul Sul Clinica Integrada",
                    "Avaliacao",
                    "Soul Sul Clinica",
                    json.dumps([{"indice": 0, "descricao": "1", "data": "2026-04-15", "forma": "PIX", "valor": 480.0, "parcelas_cartao": 1}]),
                    0.0,
                    0.0,
                    None,
                ),
            )
            conn.execute(
                """
                INSERT INTO procedimentos_contrato (id, contrato_id, procedimento, valor, profissional_snapshot, denticao_snapshot)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (24185, CONTRATO_ID, "Coroa Provisória Sobre Dente", 480.0, "Avaliacao", "Permanente"),
            )
            conn.execute(
                """
                INSERT INTO procedimentos_dente (
                    id, paciente_id, contrato_id, dente, regiao, procedimento, status, faces, valor, data, grupo_item
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (26145, PACIENTE_ID, CONTRATO_ID, 15, "15", "Coroa Provisória Sobre Dente", "CONTRATADO", "V,D,M,C,P,I", 480.0, "2026-04-15", 1),
            )
        paciente = conn.execute("SELECT * FROM pacientes WHERE id=?", (PACIENTE_ID,)).fetchone()
        contrato_row = conn.execute("SELECT * FROM contratos WHERE id=?", (CONTRATO_ID,)).fetchone()
        print("PACIENTE", None if paciente is None else (paciente["id"], paciente["nome"], paciente["prontuario"]))
        print("CONTRATO", None if contrato_row is None else (contrato_row["id"], contrato_row["status"], contrato_row["data_criacao"]))
        if paciente and contrato_row:
            caminho = gerar_documento_contrato(conn, paciente, contrato_row, CONTRATO_ID)
            print("CAMINHO", caminho)
    finally:
        conn.rollback()
        conn.close()


if __name__ == "__main__":
    main()
