// getTeams.js
import axios from 'axios';
import { API_BASE_URL, LEAGUE_ID, API_VERSION, INITIAL_BALANCE, USER_ID_IN_LEAGUE } from './config.js';

async function getTeams({ token }) {
  const response = await axios.get(`${API_BASE_URL}/league?include=all%2C-lastAccess&fields=*%2Cstandings%2Ctournaments%2Cgroup%2Csettings(description)`, {
    headers: {
      'x-league': LEAGUE_ID,
      'x-user': USER_ID_IN_LEAGUE,
      'x-version': API_VERSION,
      'Authorization': `Bearer ${token}`
    }
  });

  const standings = response.data?.data?.standings || [];

  const teams = standings.map(team => ({
    id: team.id,
    name: team.name,
    teamValue: team.teamValue,
    balance: INITIAL_BALANCE,
    pujaMaxima: 0,
    situacion: 0
  }));

  return teams;
}

export default getTeams;
