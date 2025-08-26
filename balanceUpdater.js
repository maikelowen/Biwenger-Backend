import fs from 'fs/promises';

/**
 * Una clase para obtener los movimientos del tablón de una liga de Biwenger,
 * filtrarlos y agruparlos por usuario.
 */
export class BalanceUpdater {
    /**
     * Inicializa el actualizador de balances.
     * @param {number} leagueId El ID de la liga.
     * @param {number} userId El ID del usuario para la autenticación.
     * @param {string} token El token de autorización (Bearer).
     * @param {string} inputFile Ruta al JSON de equipos.
     * @param {string} outputFile Ruta donde se guardará el JSON resultante.
     */
    constructor(leagueId, userId, token, inputFile, outputFile) {
        this.apiUrl = `https://biwenger.as.com/api/v2/league/${leagueId}/board`;
        this.headers = {
            'x-league': String(leagueId),
            'x-user': String(userId),
            'x-version': '628',
            'Authorization': `Bearer ${token}`
        };
        this.inputFile = inputFile;
        this.outputFile = outputFile;
        this.allowedTypes = new Set(["transfer", "market", "clauseIncrement", "roundFinished", "adminTransfer"]);
    }

    /** Carga los IDs de los equipos desde el fichero JSON de entrada. */
    async _loadTeamIds() {
        try {
            const fileContent = await fs.readFile(this.inputFile, 'utf-8');
            const teams = JSON.parse(fileContent);
            // Usamos un Set para una búsqueda más eficiente
            return new Set(teams.map(team => team.id));
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error(`Error: El fichero de entrada no fue encontrado en '${this.inputFile}'`);
            } else {
                console.error(`Error al leer o parsear el fichero '${this.inputFile}':`, error);
            }
            return null;
        }
    }

    /** Obtiene todas las transacciones de la API, manejando la paginación. */
    async _fetchAllTransactions() {
        const allTransactions = [];
        let offset = 0;
        const limit = 100;

        console.log("Iniciando la obtención de transacciones de la API...");
        while (true) {
            const url = new URL(this.apiUrl);
            url.searchParams.append('offset', String(offset));
            url.searchParams.append('limit', String(limit));

            try {
                const response = await fetch(url.toString(), { headers: this.headers });
                if (!response.ok) {
                    throw new Error(`Error de la API: ${response.status} ${response.statusText}`);
                }
                const result = await response.json();
                const data = result.data || [];

                if (data.length === 0) {
                    console.log("No se encontraron más transacciones. Finalizando paginación.");
                    break;
                }

                allTransactions.push(...data);
                console.log(`Obtenidas ${data.length} transacciones. Total acumulado: ${allTransactions.length}`);

                if (data.length < limit) break;

                offset += limit;
            } catch (error) {
                console.error(`Error al contactar la API de Biwenger:`, error);
                return null;
            }
        }
        return allTransactions;
    }

    /**
     * Procesa las transacciones para calcular ingresos y gastos, y las agrupa por usuario.
     * @param {Array} transactions - La lista de todas las transacciones.
     * @param {Set<number>} teamIds - Un Set con los IDs de los equipos de la liga.
     * @returns {Object} Un objeto con el resumen financiero y las transacciones de cada equipo.
     */
    _processAndSummarizeTransactions(transactions, teamIds) {
        console.log("Procesando y resumiendo transacciones por usuario...");
        const summaryData = {};
        // Inicializamos la estructura para cada equipo
        for (const teamId of teamIds) {
            summaryData[teamId] = {
                totalIngresos: 0,
                totalGastos: 0,
                transacciones: []
            };
        }

        for (const tx of transactions) {
            if (!this.allowedTypes.has(tx.type) || !tx.content) continue;

            // Usamos un Set para no añadir la misma transacción varias veces a un usuario
            const usersInThisTx = new Set();

            switch (tx.type) {
                case 'market':
                    for (const item of tx.content) {
                        if (item.to?.id && teamIds.has(item.to.id)) {
                            const userId = item.to.id;
                            summaryData[userId].totalGastos += item.amount;
                            usersInThisTx.add(userId);
                        }
                    }
                    break;

                case 'transfer':
                    for (const item of tx.content) {
                        // Ingresos para el vendedor
                        if (item.from?.id && teamIds.has(item.from.id)) {
                            summaryData[item.from.id].totalIngresos += item.amount;
                            usersInThisTx.add(item.from.id);
                        }
                        // Gastos para el comprador (si existe y es un usuario de la liga)
                        if (item.to?.id && teamIds.has(item.to.id) && item.from) {
                            summaryData[item.to.id].totalGastos += item.amount;
                            usersInThisTx.add(item.to.id);
                        }
                    }
                    break;

                case 'adminTransfer':
                    for (const item of tx.content) {
                        // Un 'adminTransfer' a un usuario ('to') es un gasto para ese usuario (ej. para cancelar una venta errónea)
                        if (item.to?.id && teamIds.has(item.to.id)) {
                            summaryData[item.to.id].totalGastos += item.amount;
                            usersInThisTx.add(item.to.id);
                        }
                        // Un 'adminTransfer' desde un usuario ('from') es un ingreso para ese usuario (ej. para cancelar una compra errónea)
                        if (item.from?.id && teamIds.has(item.from.id)) {
                            summaryData[item.from.id].totalIngresos += item.amount;
                            usersInThisTx.add(item.from.id);
                        }
                    }
                    break;

                case 'clauseIncrement':
                    for (const item of tx.content) {
                        if (item.user?.id && teamIds.has(item.user.id)) {
                            const userId = item.user.id;
                            const amount = item.amount;
                            // Si el 'amount' es negativo es un ingreso, si es positivo es un gasto.
                            amount < 0 ? summaryData[userId].totalIngresos += Math.abs(amount) : summaryData[userId].totalGastos += amount;
                            usersInThisTx.add(userId);
                        }
                    }
                    break;

                case 'roundFinished':
                    // Los bonus de la jornada son ingresos para los usuarios.
                    for (const result of tx.content.results) {
                        if (result.user?.id && teamIds.has(result.user.id)) {
                            const userId = result.user.id;
                            summaryData[userId].totalIngresos += result.bonus;
                            usersInThisTx.add(userId);
                        }
                    }
                    break;
            }

            // Añadimos la transacción completa a la lista de cada usuario involucrado
            for (const userId of usersInThisTx) {
                summaryData[userId].transacciones.push(tx);
            }
        }
        return summaryData;
    }

    /** Guarda los datos agrupados en el fichero JSON de salida. */
    async _saveResults(data) {
        try {
            const jsonData = JSON.stringify(data, null, 4);
            await fs.writeFile(this.outputFile, jsonData, 'utf-8');
            console.log(`Resultados guardados exitosamente en '${this.outputFile}'`);
        } catch (error) {
            console.error(`Error al escribir en el fichero de salida:`, error);
        }
    }

    /** Ejecuta el proceso completo. */
    async run() {
        const teamIds = await this._loadTeamIds();
        if (!teamIds) return;

        const transactions = await this._fetchAllTransactions();
        if (!transactions) return;

        // Reemplazamos la llamada al método antiguo
        const summary = this._processAndSummarizeTransactions(transactions, teamIds);
        await this._saveResults(summary);
    }
}