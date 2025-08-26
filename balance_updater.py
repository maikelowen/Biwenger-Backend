import requests
import json
import os

class BalanceUpdater:
    """
    Una clase para obtener los movimientos del tablón de una liga de Biwenger,
    filtrarlos y agruparlos por usuario.
    """

    def __init__(self, league_id, user_id, token, input_file, output_file):
        """
        Inicializa el actualizador de balances.

        Args:
            league_id (int): El ID de la liga.
            user_id (int): El ID del usuario para la autenticación.
            token (str): El token de autorización (Bearer).
            input_file (str): Ruta al JSON de equipos.
            output_file (str): Ruta donde se guardará el JSON resultante.
        """
        self.api_url = f"https://biwenger.as.com/api/v2/league/{league_id}/board"
        self.headers = {
            'x-league': str(league_id),
            'x-user': str(user_id),
            'x-version': '628',
            'Authorization': f'Bearer {token}'
        }
        self.input_file = input_file
        self.output_file = output_file
        self.allowed_types = {"transfer", "market", "clauseIncrement"}

    def _load_team_ids(self):
        """Carga los IDs de los equipos desde el fichero JSON de entrada."""
        try:
            with open(self.input_file, 'r', encoding='utf-8') as f:
                teams = json.load(f)
            # Usamos un set para una búsqueda más eficiente
            return {team['id'] for team in teams}
        except FileNotFoundError:
            print(f"Error: El fichero de entrada no fue encontrado en '{self.input_file}'")
            return set()
        except json.JSONDecodeError:
            print(f"Error: El fichero '{self.input_file}' no es un JSON válido.")
            return set()

    def _fetch_all_transactions(self):
        """
        Obtiene todas las transacciones del tablón de anuncios de la API,
        manejando la paginación.
        """
        all_transactions = []
        offset = 0
        limit = 100  # Límite por página

        print("Iniciando la obtención de transacciones de la API...")
        while True:
            params = {'offset': offset, 'limit': limit}
            try:
                response = requests.get(self.api_url, headers=self.headers, params=params)
                response.raise_for_status()  # Lanza un error para respuestas 4xx/5xx
                
                data = response.json().get('data', [])
                if not data:
                    print("No se encontraron más transacciones. Finalizando paginación.")
                    break
                
                all_transactions.extend(data)
                print(f"Obtenidas {len(data)} transacciones. Total acumulado: {len(all_transactions)}")
                
                # Si la API devuelve menos resultados que el límite, es la última página.
                if len(data) < limit:
                    break

                offset += limit

            except requests.exceptions.RequestException as e:
                print(f"Error al contactar la API de Biwenger: {e}")
                return None

        return all_transactions

    def _group_transactions(self, transactions, team_ids):
        """Filtra y agrupa las transacciones por ID de usuario."""
        print("Agrupando transacciones por usuario...")
        grouped_data = {team_id: [] for team_id in team_ids}

        for tx in transactions:
            tx_type = tx.get('type')
            user_info = tx.get('user')
            
            if user_info and tx_type in self.allowed_types:
                user_id = user_info.get('id')
                if user_id in grouped_data:
                    grouped_data[user_id].append(tx)
        
        return grouped_data

    def _save_results(self, data):
        """Guarda los datos agrupados en el fichero JSON de salida."""
        try:
            with open(self.output_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            print(f"Resultados guardados exitosamente en '{self.output_file}'")
        except IOError as e:
            print(f"Error al escribir en el fichero de salida: {e}")

    def run(self):
        """Ejecuta el proceso completo."""
        team_ids = self._load_team_ids()
        if not team_ids:
            return

        transactions = self._fetch_all_transactions()
        if transactions is None:
            return

        grouped_transactions = self._group_transactions(transactions, team_ids)
        self._save_results(grouped_transactions)

if __name__ == '__main__':
    # --- CONFIGURACIÓN ---
    LEAGUE_ID = 1683930
    USER_ID = 10352455
    # ¡IMPORTANTE! Este token caduca. Deberás obtener uno nuevo si falla la autenticación.
    AUTH_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOjI3OTU3MTkwLCJpYXQiOjE3NTM4ODU3NjJ9.paAgVghdKnd284Eth572z9dGjT2j_FduqmLHi0qKiXk'
    INPUT_JSON_PATH = os.path.join(os.path.dirname(__file__), 'equipos.json')
    OUTPUT_JSON_PATH = os.path.join(os.path.dirname(__file__), 'transacciones_agrupadas.json')

    updater = BalanceUpdater(LEAGUE_ID, USER_ID, AUTH_TOKEN, INPUT_JSON_PATH, OUTPUT_JSON_PATH)
    updater.run()