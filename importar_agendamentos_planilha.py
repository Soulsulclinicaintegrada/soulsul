from __future__ import annotations

from pathlib import Path

from api_agenda import garantir_colunas_agenda_api
from api_pacientes import garantir_colunas_pacientes_api
from database import conectar, inicializar_banco
from importar_dados_operacionais import (
    build_patient_mapping,
    import_agendamentos,
    load_dataframe,
)


POSSIVEIS_APPOINTMENTS = [
    Path(r"C:\Users\jusgo\Downloads\Appointment (8).xlsx"),
    Path(r"C:\Users\jusgo\Downloads\Appointment (7).xlsx"),
    Path(r"C:\Users\jusgo\Downloads\Appointment (6).xlsx"),
    Path(r"C:\Users\jusgo\Downloads\Appointment (5).xlsx"),
]


def localizar_arquivo_agendamentos() -> Path:
    for arquivo in POSSIVEIS_APPOINTMENTS:
        if arquivo.exists():
            return arquivo
    return POSSIVEIS_APPOINTMENTS[0]


def importar_agendamentos_planilha() -> int:
    inicializar_banco()
    garantir_colunas_pacientes_api()
    garantir_colunas_agenda_api()

    appointment_df = load_dataframe(localizar_arquivo_agendamentos())
    conn = conectar()
    conn.execute("DELETE FROM agendamento_procedimentos")
    conn.execute("DELETE FROM agendamentos")
    patient_map = build_patient_mapping(conn)
    total = import_agendamentos(conn, appointment_df, patient_map)
    conn.commit()
    conn.close()
    return total


if __name__ == "__main__":
    total = importar_agendamentos_planilha()
    print(f"AGENDAMENTOS_IMPORTADOS={total}")
