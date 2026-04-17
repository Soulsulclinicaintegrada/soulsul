import sqlite3


def main():
    conn = sqlite3.connect('clinica.db')
    tables = ['pacientes', 'recebiveis', 'contas_pagar', 'agendamentos']
    for table in tables:
        try:
            cursor = conn.execute(f"SELECT COUNT(*) FROM {table}")
            print(table, cursor.fetchone()[0])
        except sqlite3.Error as exc:
            print(table, 'error', exc)
    conn.close()


if __name__ == '__main__':
    main()
