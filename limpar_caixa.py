import sqlite3


DB_PATH = r"C:\Users\jusgo\Documents\sistema_clinica\clinica.db"


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    antes = cur.execute("SELECT COUNT(*) FROM financeiro").fetchone()[0]
    cur.execute("DELETE FROM financeiro")
    conn.commit()
    depois = cur.execute("SELECT COUNT(*) FROM financeiro").fetchone()[0]
    conn.close()
    print(f"FINANCEIRO_ANTES={antes}")
    print(f"FINANCEIRO_DEPOIS={depois}")


if __name__ == "__main__":
    main()
