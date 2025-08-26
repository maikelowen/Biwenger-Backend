import fs from 'fs/promises';
import { INITIAL_BALANCE } from './config.js';

/**
 * Actualiza el balance de los equipos en equipos.json basándose en el resumen de transacciones.
 * @param {string} teamsFilePath - Ruta al fichero equipos.json.
 * @param {string} transactionsFilePath - Ruta al fichero transacciones_agrupadas.json.
 */
async function updateTeams(teamsFilePath, transactionsFilePath) {
    console.log('\nIniciando la actualización de balances...');

    try {
        // 1. Leer ambos ficheros JSON
        const teamsFileContent = await fs.readFile(teamsFilePath, 'utf-8');
        const teams = JSON.parse(teamsFileContent);

        const transactionsFileContent = await fs.readFile(transactionsFilePath, 'utf-8');
        const transactionsSummary = JSON.parse(transactionsFileContent);

        // 2. Crear un mapa para una búsqueda más eficiente de los equipos por ID
        const teamsMap = new Map(teams.map(team => [team.id, team]));

        // 3. Iterar sobre el resumen de transacciones y actualizar el balance en el mapa
        for (const userId in transactionsSummary) {
            // Asegurarnos de que es una propiedad del objeto y no del prototipo
            if (Object.hasOwnProperty.call(transactionsSummary, userId)) {
                const teamId = parseInt(userId, 10);
                const team = teamsMap.get(teamId);
                
                if (team) {
                    const summary = transactionsSummary[userId];

                    const situacionIncial = 50000000;
                    
                    // Calcular el nuevo balance: Inicial + Ingresos - Gastos
                    const newBalance = INITIAL_BALANCE + summary.totalIngresos - summary.totalGastos;
                    
                    // Calcular la puja máxima: (teamValue / 4) + balance
                    const pujaMaxima = (team.teamValue / 4) + newBalance;

                    // Calcular la situación del equipo: teamValue + balance
                    const situacion = team.teamValue + newBalance - situacionIncial;

                    team.balance = newBalance;
                    team.pujaMaxima = pujaMaxima;
                    team.situacion = situacion;

                    console.log(`- Equipo: ${team.name}`);
                    console.log(`  - Balance actualizado: ${newBalance.toLocaleString('es-ES')} €`);
                    console.log(`  - Puja máxima calculada: ${pujaMaxima.toLocaleString('es-ES')} €`);
                    console.log(`  - Situación (Valor + Balance): ${situacion.toLocaleString('es-ES')} €`);
                }
            }
        }

        // 4. Convertir el mapa de vuelta a un array para guardarlo
        const updatedTeams = Array.from(teamsMap.values());

        // 5. Guardar el fichero equipos.json actualizado
        await fs.writeFile(teamsFilePath, JSON.stringify(updatedTeams, null, 2), 'utf-8');
        console.log(`\n✅ Fichero de equipos actualizado con balances, pujas y situación en '${teamsFilePath}'`);

    } catch (error) {
        console.error('❌ Error durante la actualización de balances:', error);
        throw error; // Re-lanzar el error para que el proceso principal lo capture
    }
}

export default updateTeams;