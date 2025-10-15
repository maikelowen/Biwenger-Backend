import { BalanceUpdater } from './balanceUpdater.js';

/**
 * Una clase para analizar todos los tipos de transacciones de la API de Biwenger
 * y compararlos con una lista de tipos ya gestionados.
 */
export class TransactionTypeAnalyzer {
    /**
     * Inicializa el analizador.
     * @param {number} leagueId El ID de la liga.
     * @param {number} userId El ID del usuario para la autenticación.
     * @param {string} token El token de autorización (Bearer).
     */
    constructor(leagueId, userId, token) {
        this.apiUrl = `https://biwenger.as.com/api/v2/league/${leagueId}/board`;
        this.headers = {
            'x-league': String(leagueId),
            'x-user': String(userId),
            'x-version': '628',
            'Authorization': `Bearer ${token}`
        };
        // Obtenemos los tipos ya gestionados desde BalanceUpdater para la comparación.
        this.handledTypes = new BalanceUpdater().allowedTypes;
    }

    /**
     * Obtiene todas las transacciones de la API, manejando la paginación.
     */
    async _fetchAllTransactions() {
        const allTransactions = [];
        let offset = 0;
        const limit = 100;

        console.log("Analyzer: Iniciando la obtención de transacciones de la API...");
        while (true) {
            const url = new URL(this.apiUrl);
            url.searchParams.append('offset', String(offset));
            url.searchParams.append('limit', String(limit));

            try {
                const response = await fetch(url.toString(), { headers: this.headers });
                if (!response.ok) throw new Error(`Error de la API: ${response.status} ${response.statusText}`);
                
                const result = await response.json();
                const data = result.data || [];

                if (data.length === 0) break;

                allTransactions.push(...data);
                offset += limit;
            } catch (error) {
                console.error(`Analyzer: Error al contactar la API de Biwenger:`, error);
                return null;
            }
        }
        console.log(`Analyzer: Se han obtenido un total de ${allTransactions.length} transacciones.`);
        return allTransactions;
    }

    /**
     * Ejecuta el análisis de tipos de transacción y muestra un informe.
     */
    async run() {
        const transactions = await this._fetchAllTransactions();
        if (!transactions) {
            console.error("No se pudieron obtener las transacciones para el análisis.");
            return;
        }

        const foundTypes = new Set(transactions.map(tx => tx.type));

        console.log("\n--- Informe de Análisis de Tipos de Transacción ---");
        console.log(`\nSe encontraron ${foundTypes.size} tipos de transacción únicos en los datos:`);
        console.log(` -> ${[...foundTypes].sort().join(', ')}`);

        console.log("\nTipos actualmente gestionados por BalanceUpdater:");
        console.log(` -> ${[...this.handledTypes].sort().join(', ')}`);

        const unhandledTypes = [...foundTypes].filter(type => !this.handledTypes.has(type));

        if (unhandledTypes.length > 0) {
            console.log("\n\x1b[33m%s\x1b[0m", "¡ATENCIÓN! Se encontraron tipos de transacción no gestionados:");
            console.log("Los siguientes tipos existen en la API pero no están siendo procesados:");
            unhandledTypes.forEach(type => console.log(`  - ${type}`));
            console.log("\nRecomendación: Implementa estos tipos en 'balanceUpdater.js' para asegurar que todos los movimientos se contabilicen.");
        } else {
            console.log("\n\x1b[32m%s\x1b[0m", "ANÁLISIS CORRECTO: Todos los tipos de transacción encontrados ya están siendo gestionados.");
        }
        console.log("--- Fin del Informe ---\n");
    }
}