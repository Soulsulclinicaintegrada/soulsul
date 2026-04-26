from __future__ import annotations

import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

from database import DB_PATH, conectar, inicializar_banco
from importar_a_pagar_planilha import import_planilha as importar_contas_pagar_fieis
from importar_dados_operacionais import import_operational_data
from importar_faltas_desmarcacoes_planilha import importar_status_agendamentos
from importar_pacientes_planilha import importar as importar_pacientes
from importar_recebiveis_planilha import reconcile as importar_recebiveis_fieis


TABELAS_PARA_SUBSTITUIR = [
    "ordem_servico_protetico_etapas",
    "ordens_servico_protetico",
    "agendamento_procedimentos",
    "agendamentos",
    "procedimentos_dente",
    "procedimentos_contrato",
    "recebiveis",
    "financeiro",
    "contas_pagar",
    "contratos",
    "crm_pacientes",
    "pacientes_rapidos",
    "pacientes",
]


def caminho_banco() -> Path:
    return Path(DB_PATH).resolve()


def criar_backup_banco() -> Path:
    origem = caminho_banco()
    if not origem.exists():
        return origem
    destino_dir = Path("backup_db").resolve()
    destino_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    destino = destino_dir / f"{origem.stem}_antes_substituicao_planilhas_{timestamp}{origem.suffix}"
    shutil.copy2(origem, destino)
    return destino


def limpar_dados_negocio(conn: sqlite3.Connection) -> None:
    for tabela in TABELAS_PARA_SUBSTITUIR:
        conn.execute(f"DELETE FROM {tabela}")
    for tabela in TABELAS_PARA_SUBSTITUIR:
        conn.execute("DELETE FROM sqlite_sequence WHERE name=?", (tabela,))
    conn.commit()


def executar_substituicao() -> dict[str, object]:
    inicializar_banco()
    backup = criar_backup_banco()

    conn = conectar()
    limpar_dados_negocio(conn)
    conn.close()

    pacientes_importados, pacientes_descartados = importar_pacientes()
    operacionais = import_operational_data()
    status_agenda = importar_status_agendamentos()
    contas_pagar = importar_contas_pagar_fieis()
    recebiveis = importar_recebiveis_fieis()

    return {
        "backup": str(backup),
        "pacientes_importados": pacientes_importados,
        "pacientes_descartados": pacientes_descartados,
        "contratos_importados": operacionais["contratos"],
        "recebiveis_operacionais_importados": operacionais["recebiveis"],
        "financeiro_importado": operacionais["financeiro"],
        "contas_pagar_operacionais_importadas": operacionais["contas_pagar"],
        "agendamentos_importados": operacionais["agendamentos"],
        "status_agenda_importados": status_agenda["registros"],
        "status_agenda_atualizados": status_agenda["atualizados"],
        "status_agenda_criados": status_agenda["criados"],
        "contas_pagar_fieis_importadas": contas_pagar["IMPORTADOS"],
        "recebiveis_fieis_importados": recebiveis["importados"],
    }


if __name__ == "__main__":
    resultado = executar_substituicao()
    for chave, valor in resultado.items():
        print(f"{chave.upper()}={valor}")
