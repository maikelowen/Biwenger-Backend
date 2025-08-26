import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { BalanceUpdater } from './balanceUpdater.js';
import login from './login.js';
import getTeams from './getTeams.js';
import updateTeams from './updateTeams.js';
import { LEAGUE_ID, USER_ID_IN_LEAGUE } from './config.js';

// Helper para obtener la ruta del directorio actual en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    try {
        // 1. Iniciar sesión para obtener un token válido
        console.log('Iniciando sesión en Biwenger...');
        const { token } = await login();

        // 2. Obtener la lista de equipos actualizada y guardarla
        console.log('Obteniendo la lista de equipos actualizada...');
        const teams = await getTeams({ token });
        const TEAMS_JSON_PATH = path.join(__dirname, 'equipos.json');
        await fs.writeFile(TEAMS_JSON_PATH, JSON.stringify(teams, null, 2), 'utf-8');
        console.log(`✅ Lista de equipos guardada en '${TEAMS_JSON_PATH}'`);

        // 3. Ejecutar el actualizador de balances con el token nuevo
        const TRANSACTIONS_JSON_PATH = path.join(__dirname, 'transacciones_agrupadas.json');
        console.log('\nIniciando proceso de obtención de transacciones...');

        const updater = new BalanceUpdater(
            LEAGUE_ID,
            USER_ID_IN_LEAGUE, // Usamos el ID del fichero de configuración
            token,             // Usamos el token recién obtenido
            TEAMS_JSON_PATH,
            TRANSACTIONS_JSON_PATH
        );

        await updater.run();

        // 4. Actualizar los balances en equipos.json usando los resultados
        await updateTeams(TEAMS_JSON_PATH, TRANSACTIONS_JSON_PATH);

        console.log('\n🏁 Proceso completado.');
    } catch (error) {
        console.error('\n❌ Ocurrió un error fatal en el proceso principal:', error.message);
        // Si el error viene de una petición de red, puede tener más detalles
        if (error.response?.data) {
            console.error('Detalles del error de la API:', error.response.data);
        }
        process.exit(1); // Termina el script con un código de error
    }
}

main();