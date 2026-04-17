from docx import Document


origem = r"C:\Users\jusgo\Documents\sistema_clinica\modelo_documento.docx"
destino = r"C:\Users\jusgo\Documents\sistema_clinica\modelo_documento_normalizado.docx"

doc = Document(origem)
doc.save(destino)
print(destino)
