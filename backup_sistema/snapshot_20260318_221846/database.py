import sqlite3
from datetime import datetime
import hashlib
import hmac
import secrets


DB_PATH = "clinica.db"
USUARIO_ADMIN_INICIAL = "admin"
SENHA_ADMIN_INICIAL = "admin123"


def conectar():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def tabela_existe(conn, nome_tabela):
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (nome_tabela,),
    ).fetchone()
    return row is not None


def colunas_tabela(conn, nome_tabela):
    if not tabela_existe(conn, nome_tabela):
        return set()
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({nome_tabela})")}


def garantir_coluna(conn, nome_tabela, definicao_coluna):
    nome_coluna = definicao_coluna.split()[0]
    if nome_coluna not in colunas_tabela(conn, nome_tabela):
        conn.execute(f"ALTER TABLE {nome_tabela} ADD COLUMN {definicao_coluna}")


def agora_str():
    return datetime.now().isoformat(sep=" ", timespec="seconds")


def gerar_hash_senha(senha, salt=None):
    salt_bytes = salt or secrets.token_bytes(16)
    hash_bytes = hashlib.pbkdf2_hmac("sha256", str(senha or "").encode("utf-8"), salt_bytes, 100000)
    return f"{salt_bytes.hex()}${hash_bytes.hex()}"


def garantir_usuario_admin_inicial(conn):
    row = conn.execute("SELECT id FROM usuarios WHERE ativo=1 ORDER BY id LIMIT 1").fetchone()
    if row is not None:
        return
    conn.execute(
        """
        INSERT INTO usuarios
        (nome, usuario, senha_hash, perfil, ativo, acesso_dashboard, acesso_pacientes, acesso_contratos, acesso_financeiro, acesso_usuarios, data_criacao)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
        """,
        (
            "Administrador",
            USUARIO_ADMIN_INICIAL,
            gerar_hash_senha(SENHA_ADMIN_INICIAL),
            "Administrador",
            1,
            1,
            1,
            1,
            1,
            agora_str(),
        ),
    )


def garantir_metas_vendas_iniciais(conn, ano=None):
    ano_referencia = int(ano or datetime.now().year)
    row = conn.execute("SELECT id FROM metas_vendas WHERE ano=? LIMIT 1", (ano_referencia,)).fetchone()
    if row is not None:
        return
    conn.execute(
        """
        INSERT INTO metas_vendas
        (ano, meta, supermeta, hipermeta, data_atualizacao)
        VALUES (?, ?, ?, ?, ?)
        """,
        (ano_referencia, 100000.0, 150000.0, 200000.0, agora_str()),
    )


def inicializar_banco():
    conn = conectar()

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pacientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            prontuario TEXT,
            cpf TEXT,
            data_nascimento TEXT,
            telefone TEXT,
            cep TEXT,
            endereco TEXT,
            numero TEXT,
            bairro TEXT,
            cidade TEXT,
            estado TEXT,
            menor_idade INTEGER DEFAULT 0,
            responsavel TEXT,
            cpf_responsavel TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS contratos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER,
            valor_total REAL DEFAULT 0,
            entrada REAL DEFAULT 0,
            parcelas INTEGER DEFAULT 1,
            primeiro_vencimento TEXT,
            data_pagamento_entrada TEXT,
            forma_pagamento TEXT,
            hash_importacao TEXT,
            data_criacao TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS procedimentos_contrato (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contrato_id INTEGER,
            procedimento TEXT,
            valor REAL DEFAULT 0
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS financeiro (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            origem TEXT,
            descricao TEXT,
            valor REAL DEFAULT 0,
            data TEXT,
            tipo TEXT,
            contrato_id INTEGER,
            recebivel_id INTEGER,
            prontuario TEXT,
            forma_pagamento TEXT,
            observacao TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS recebiveis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contrato_id INTEGER,
            paciente_id INTEGER,
            paciente_nome TEXT,
            prontuario TEXT,
            parcela_numero INTEGER,
            vencimento TEXT,
            valor REAL DEFAULT 0,
            forma_pagamento TEXT,
            status TEXT DEFAULT 'Aberto',
            observacao TEXT,
            data_criacao TEXT,
            hash_importacao TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS contas_pagar (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_vencimento TEXT,
            descricao TEXT,
            fornecedor TEXT,
            valor REAL DEFAULT 0,
            pago TEXT,
            valor_pago REAL DEFAULT 0,
            status TEXT DEFAULT 'A vencer',
            observacao TEXT,
            data_criacao TEXT,
            hash_importacao TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_venda TEXT,
            paciente_nome TEXT,
            valor_total REAL DEFAULT 0,
            valor_a_vista REAL DEFAULT 0,
            valor_cartao REAL DEFAULT 0,
            valor_boleto REAL DEFAULT 0,
            saldo REAL DEFAULT 0,
            data_a_pagar TEXT,
            avaliador TEXT,
            vendedor TEXT,
            nf TEXT,
            contrato_id INTEGER,
            hash_importacao TEXT,
            data_criacao TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS metas_vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ano INTEGER,
            meta REAL DEFAULT 100000,
            supermeta REAL DEFAULT 150000,
            hipermeta REAL DEFAULT 200000,
            data_atualizacao TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            usuario TEXT,
            senha_hash TEXT,
            perfil TEXT DEFAULT 'Administrador',
            ativo INTEGER DEFAULT 1,
            acesso_dashboard INTEGER DEFAULT 1,
            acesso_pacientes INTEGER DEFAULT 1,
            acesso_contratos INTEGER DEFAULT 1,
            acesso_financeiro INTEGER DEFAULT 1,
            acesso_usuarios INTEGER DEFAULT 0,
            data_criacao TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS logs_acesso (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            usuario TEXT,
            evento TEXT,
            data_hora TEXT
        )
        """
    )

    garantir_coluna(conn, "financeiro", "origem TEXT")
    garantir_coluna(conn, "financeiro", "contrato_id INTEGER")
    garantir_coluna(conn, "financeiro", "recebivel_id INTEGER")
    garantir_coluna(conn, "financeiro", "prontuario TEXT")
    garantir_coluna(conn, "financeiro", "forma_pagamento TEXT")
    garantir_coluna(conn, "financeiro", "observacao TEXT")
    garantir_coluna(conn, "recebiveis", "paciente_id INTEGER")
    garantir_coluna(conn, "recebiveis", "paciente_nome TEXT")
    garantir_coluna(conn, "recebiveis", "prontuario TEXT")
    garantir_coluna(conn, "recebiveis", "parcela_numero INTEGER")
    garantir_coluna(conn, "recebiveis", "vencimento TEXT")
    garantir_coluna(conn, "recebiveis", "valor REAL DEFAULT 0")
    garantir_coluna(conn, "recebiveis", "forma_pagamento TEXT")
    garantir_coluna(conn, "recebiveis", "status TEXT DEFAULT 'Aberto'")
    garantir_coluna(conn, "recebiveis", "observacao TEXT")
    garantir_coluna(conn, "recebiveis", "data_criacao TEXT")
    garantir_coluna(conn, "recebiveis", "data_pagamento TEXT")
    garantir_coluna(conn, "recebiveis", "hash_importacao TEXT")
    garantir_coluna(conn, "contas_pagar", "data_vencimento TEXT")
    garantir_coluna(conn, "contas_pagar", "descricao TEXT")
    garantir_coluna(conn, "contas_pagar", "fornecedor TEXT")
    garantir_coluna(conn, "contas_pagar", "valor REAL DEFAULT 0")
    garantir_coluna(conn, "contas_pagar", "pago TEXT")
    garantir_coluna(conn, "contas_pagar", "valor_pago REAL DEFAULT 0")
    garantir_coluna(conn, "contas_pagar", "status TEXT DEFAULT 'A vencer'")
    garantir_coluna(conn, "contas_pagar", "observacao TEXT")
    garantir_coluna(conn, "contas_pagar", "data_criacao TEXT")
    garantir_coluna(conn, "contas_pagar", "hash_importacao TEXT")
    garantir_coluna(conn, "vendas", "data_venda TEXT")
    garantir_coluna(conn, "vendas", "paciente_nome TEXT")
    garantir_coluna(conn, "vendas", "valor_total REAL DEFAULT 0")
    garantir_coluna(conn, "vendas", "valor_a_vista REAL DEFAULT 0")
    garantir_coluna(conn, "vendas", "valor_cartao REAL DEFAULT 0")
    garantir_coluna(conn, "vendas", "valor_boleto REAL DEFAULT 0")
    garantir_coluna(conn, "vendas", "saldo REAL DEFAULT 0")
    garantir_coluna(conn, "vendas", "data_a_pagar TEXT")
    garantir_coluna(conn, "vendas", "avaliador TEXT")
    garantir_coluna(conn, "vendas", "vendedor TEXT")
    garantir_coluna(conn, "vendas", "nf TEXT")
    garantir_coluna(conn, "vendas", "contrato_id INTEGER")
    garantir_coluna(conn, "vendas", "hash_importacao TEXT")
    garantir_coluna(conn, "vendas", "data_criacao TEXT")
    garantir_coluna(conn, "metas_vendas", "ano INTEGER")
    garantir_coluna(conn, "metas_vendas", "meta REAL DEFAULT 100000")
    garantir_coluna(conn, "metas_vendas", "supermeta REAL DEFAULT 150000")
    garantir_coluna(conn, "metas_vendas", "hipermeta REAL DEFAULT 200000")
    garantir_coluna(conn, "metas_vendas", "data_atualizacao TEXT")
    garantir_coluna(conn, "usuarios", "nome TEXT")
    garantir_coluna(conn, "usuarios", "usuario TEXT")
    garantir_coluna(conn, "usuarios", "senha_hash TEXT")
    garantir_coluna(conn, "usuarios", "perfil TEXT DEFAULT 'Administrador'")
    garantir_coluna(conn, "usuarios", "ativo INTEGER DEFAULT 1")
    garantir_coluna(conn, "usuarios", "acesso_dashboard INTEGER DEFAULT 1")
    garantir_coluna(conn, "usuarios", "acesso_pacientes INTEGER DEFAULT 1")
    garantir_coluna(conn, "usuarios", "acesso_contratos INTEGER DEFAULT 1")
    garantir_coluna(conn, "usuarios", "acesso_financeiro INTEGER DEFAULT 1")
    garantir_coluna(conn, "usuarios", "acesso_usuarios INTEGER DEFAULT 0")
    garantir_coluna(conn, "usuarios", "data_criacao TEXT")
    garantir_coluna(conn, "logs_acesso", "usuario_id INTEGER")
    garantir_coluna(conn, "logs_acesso", "usuario TEXT")
    garantir_coluna(conn, "logs_acesso", "evento TEXT")
    garantir_coluna(conn, "logs_acesso", "data_hora TEXT")
    garantir_coluna(conn, "contratos", "data_criacao TEXT")
    garantir_coluna(conn, "contratos", "data_pagamento_entrada TEXT")
    garantir_coluna(conn, "contratos", "hash_importacao TEXT")
    garantir_coluna(conn, "pacientes", "numero TEXT")
    garantir_coluna(conn, "pacientes", "bairro TEXT")
    garantir_coluna(conn, "pacientes", "cidade TEXT")
    garantir_coluna(conn, "pacientes", "estado TEXT")
    garantir_coluna(conn, "pacientes", "responsavel TEXT")
    garantir_coluna(conn, "pacientes", "cpf_responsavel TEXT")
    garantir_coluna(conn, "financeiro", "conta_caixa TEXT")

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS saldos_conta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT,
            conta TEXT,
            saldo REAL DEFAULT 0,
            observacao TEXT
        )
        """
    )
    garantir_coluna(conn, "saldos_conta", "data TEXT")
    garantir_coluna(conn, "saldos_conta", "conta TEXT")
    garantir_coluna(conn, "saldos_conta", "saldo REAL DEFAULT 0")
    garantir_coluna(conn, "saldos_conta", "observacao TEXT")

    garantir_usuario_admin_inicial(conn)
    garantir_metas_vendas_iniciais(conn)
    conn.commit()
    conn.close()


if __name__ == "__main__":
    inicializar_banco()
    print("Banco alinhado com o aplicativo principal.")
