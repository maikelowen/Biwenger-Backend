// login.js
import axios from 'axios';
import 'dotenv/config';
import { jwtDecode } from 'jwt-decode';
import { API_BASE_URL, API_VERSION } from './config.js';

async function login() {
  const credentials = {
    email: process.env.BIWENGER_EMAIL,
    password: process.env.BIWENGER_PASSWORD
  };

  const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials, {
    headers: {
      'x-version': API_VERSION
    }
  });

  // La respuesta del login es un objeto plano, no está envuelto en 'data'.
  const apiData = response.data;

  if (!apiData || !apiData.token) {
    const errorMessage = typeof apiData === 'string' ? apiData : 'Login fallido: la respuesta de la API no tiene el formato esperado.';
    throw new Error(errorMessage);
  }

  const { token } = apiData;

  // Decodificamos el token para obtener el ID de usuario, que se encuentra en el campo 'iss' (issuer).
  const decodedToken = jwtDecode(token);
  const userId = decodedToken.iss;

  if (!userId) throw new Error('No se pudo obtener el ID de usuario desde el token.');

  console.log('✅ Login exitoso!');
  return { token, userId };
}

export default login;
