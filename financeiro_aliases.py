from __future__ import annotations

import unicodedata


def normalizar_nome_financeiro(valor: str) -> str:
    texto = unicodedata.normalize("NFKD", str(valor or ""))
    texto = texto.encode("ascii", "ignore").decode("ascii")
    return " ".join(texto.lower().split())


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
    normalizar_nome_financeiro("Ohana Siqueira Machado ( Salvador E Deilma)"): "Deilma Bento Da Silva Rodrigues",
    normalizar_nome_financeiro("Priscila Manhaes Da Silva"): "Pricila Manhaes Da Silva",
    normalizar_nome_financeiro("Rackel Ernesto Alves De Melo Gomes (isabella De Melo Pacheco)"): "Isabella De Melo Pacheco",
    normalizar_nome_financeiro("Wiara Pessanha Da Silva Leandro Sabino"): "Felipe Gabriel Leandro Sabino",
}

