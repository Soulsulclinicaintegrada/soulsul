from docx import Document


for caminho in [
    r"C:\Users\jusgo\Documents\sistema_clinica\modelo_documento.docx",
    r"C:\Users\jusgo\Documents\sistema_clinica\modelo_documento_online.docx",
]:
    try:
        Document(caminho)
        print("OK", caminho)
    except Exception as exc:
        print("ERRO", caminho, exc)
