from __future__ import annotations

import unicodedata


def normalizar_nome_financeiro(valor: str) -> str:
    texto = unicodedata.normalize("NFKD", str(valor or ""))
    texto = texto.encode("ascii", "ignore").decode("ascii")
    return " ".join(texto.lower().split())


CASOS_RESPONSAVEL_FINANCEIRO: dict[str, dict[str, str]] = {
    normalizar_nome_financeiro("Ohana Siqueira Machado ( Salvador E Deilma)"): {
        "paciente": "Ohana Siqueira Machado",
        "nome_exibicao": "Ohana Siqueira Machado (Deilma)",
        "responsavel": "Deilma Bento Da Silva Rodrigues",
    },
    normalizar_nome_financeiro("Rackel Ernesto Alves De Melo Gomes (isabella De Melo Pacheco)"): {
        "paciente": "Rackel Ernesto Alves De Melo Gomes",
        "nome_exibicao": "Rackel Ernesto Alves De Melo Gomes (Isabella)",
        "responsavel": "Isabella De Melo Pacheco",
    },
    normalizar_nome_financeiro("Wiara Pessanha Da Silva Leandro Sabino"): {
        "paciente": "Felipe Gabriel Leandro Sabino",
        "nome_exibicao": "Felipe Gabriel Leandro Sabino (Wiara)",
        "responsavel": "Wiara Pessanha Da Silva Leandro Sabino",
    },
}


ALIAS_FINANCEIRO_POR_NOME: dict[str, str] = {
    normalizar_nome_financeiro("Carlos A C De Assis"): "Carlos Alberto Contage De Assis",
    normalizar_nome_financeiro("Carlos Adryan Da Silva Alves - Adrieli"): "Carlos Adryan Da Silva Alves",
    normalizar_nome_financeiro("Eliana Coutinho Da Rosa"): "Eliana Coutinho Da Rosa (sedacao)",
    normalizar_nome_financeiro("Jose Abreu"): "José Abreu Das Neves Não Agendar Mais",
    normalizar_nome_financeiro("Juliana Dischenger"): "Juliana Dischinger",
    normalizar_nome_financeiro("July Cabaral"): "July Cabral De Almeida",
    normalizar_nome_financeiro("Laylla Tavares De Silva"): "Layla Tavares De Silva",
    normalizar_nome_financeiro("Maria Cecilia De Carvalho"): "Maria Cecilia De Carvalho Carlos",
    normalizar_nome_financeiro("Nicolas Codeiro Rangel - Gilsa"): "Nicolas Codeiro Rangel",
    normalizar_nome_financeiro("Priscila Manhaes Da Silva"): "Pricila Manhaes Da Silva",
    **{alias: dados["paciente"] for alias, dados in CASOS_RESPONSAVEL_FINANCEIRO.items()},
}


NOME_EXIBICAO_FINANCEIRO_POR_ALIAS: dict[str, str] = {
    alias: dados["nome_exibicao"] for alias, dados in CASOS_RESPONSAVEL_FINANCEIRO.items()
}


RESPONSAVEL_FINANCEIRO_POR_ALIAS: dict[str, str] = {
    alias: dados["responsavel"] for alias, dados in CASOS_RESPONSAVEL_FINANCEIRO.items()
}
