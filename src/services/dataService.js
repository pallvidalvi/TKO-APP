/**
 * Hybrid Data Service
 * Provides automatic fallback between API and local SQLite database
 * Works seamlessly online or offline
 */

import axios from 'axios';
import { Platform } from 'react-native';
import {
  getAllTeams as getTeamsDB,
  getTeamsByCategory as getTeamsByCategoryDB,
  getTeamById as getTeamByIdDB,
  addTeam as addTeamDB,
  updateTeam as updateTeamDB,
  deleteTeam as deleteTeamDB,
  getAllPlayers as getPlayersDB,
  getPlayersByTeam as getPlayersByTeamDB,
  getAllCategories as getCategoriesDB,
  getAllRegistrations as getRegistrationsDB,
  addRegistration as addRegistrationDB,
  getAllResults as getResultsDB,
  addResult as addResultDB,
  deleteResultById as deleteResultByIdDB,
  clearAllResults as clearAllResultsDB,
} from '../db/database';

const API_BASE_URL = 'https://www.teamkaradoffroaders.online/api';
const isWeb = Platform.OS === 'web';
const WEB_RESULTS_KEY = 'tko_app_results';
const normalizeResultKey = value => String(value || '').trim().toLowerCase();
const isDuplicateResult = (existingResults, resultData) => {
  const nextCategory = normalizeResultKey(resultData.category);
  const nextTrack = normalizeResultKey(resultData.track_name);
  const nextSticker = normalizeResultKey(resultData.sticker_number);

  return existingResults.some(item =>
    normalizeResultKey(item.category) === nextCategory &&
    normalizeResultKey(item.track_name) === nextTrack &&
    normalizeResultKey(item.sticker_number) === nextSticker
  );
};
const getResultDuplicateKey = item => [
  normalizeResultKey(item.category),
  normalizeResultKey(item.track_name),
  normalizeResultKey(item.sticker_number),
].join('|');
const WEB_FALLBACK_TEAMS = [
  {
    team_name: 'Team offroaders Pune ',
    driver_name: 'Ritesh Bire ',
    driver_blood_group: 'O +ve',
    codriver_name: 'Shaurya Bire ',
    codriver_blood_group: 'O +ve',
    car_number: '1',
    category: 'PETROL_EXPERT',
    vehicle_name: '',
    vehicle_model: '',
    socials: '7999',
    status: 'CONFIRMED',
  },
  {
    team_name: 'Team satara offroad ',
    driver_name: 'Raj Santosh deshmukh ',
    driver_blood_group: 'B +ve',
    codriver_name: 'Ajay misal',
    codriver_blood_group: 'B +ve',
    car_number: '4',
    category: 'PETROL_EXPERT',
    vehicle_name: '',
    vehicle_model: '',
    socials: '7999',
    status: 'CONFIRMED',
  },
  {
    team_name: 'Team motoRnation ',
    driver_name: 'Aniket shete',
    driver_blood_group: 'A +ve',
    codriver_name: 'Anvita shete',
    codriver_blood_group: 'AB +ve',
    car_number: '4',
    category: 'JIMNY_SUV',
    vehicle_name: '',
    vehicle_model: '',
    socials: '7999',
    status: 'CONFIRMED',
  },
  {
    team_name: 'TEAM SATARA OFF ROADERS',
    driver_name: 'PRATAP D. SHINGATE',
    driver_blood_group: 'A +ve',
    codriver_name: 'SURAJ GULUMKAR',
    codriver_blood_group: 'AB +ve',
    car_number: '7',
    category: 'PETROL_EXPERT',
    vehicle_name: '',
    vehicle_model: '',
    socials: '7999',
    status: 'CONFIRMED',
  },
  {
    team_name: 'Uzma',
    driver_name: 'Asif faras',
    driver_blood_group: 'B +ve',
    codriver_name: 'Saeed shaikh',
    codriver_blood_group: 'O +ve',
    car_number: '7',
    category: 'DIESEL_EXPERT',
    vehicle_name: '',
    vehicle_model: '',
    socials: '7999',
    status: 'CONFIRMED',
  },
  {
    team_name: 'Minal ',
    driver_name: 'Minal shete',
    driver_blood_group: 'A +ve',
    codriver_name: 'Amit shete',
    codriver_blood_group: 'A +ve',
    car_number: '8',
    category: 'LADIES',
    vehicle_name: '',
    vehicle_model: '',
    socials: '0',
    status: 'CONFIRMED',
  },
  {
    team_name: 'Team motoRnation ',
    driver_name: 'Anvita aniket shete',
    driver_blood_group: 'AB -ve',
    codriver_name: 'Aniket shete',
    codriver_blood_group: 'A +ve',
    car_number: '12',
    category: 'LADIES',
    vehicle_name: '',
    vehicle_model: '',
    socials: '',
    status: 'CONFIRMED',
  },
  {
    team_name: 'BAAZ',
    driver_name: 'Malkit Singh Saini',
    driver_blood_group: '',
    codriver_name: 'Gurdeep Singh Saini',
    codriver_blood_group: 'B +ve',
    car_number: '27',
    category: 'DIESEL_MODIFIED',
    vehicle_name: '',
    vehicle_model: '',
    socials: '9999',
    status: 'CONFIRMED',
  },
];

const logAxiosError = (label, error) => {
  const status = error?.response?.status;
  const bodyPreview =
    typeof error?.response?.data === 'string'
      ? error.response.data.slice(0, 200)
      : JSON.stringify(error?.response?.data || {});
  console.error(`${label} | status=${status || 'NA'} | message=${error?.message || 'Unknown'}`);
  if (status) {
    console.error(`${label} | response preview: ${bodyPreview}`);
  }
};

const getWebFallbackTeams = () => {
  console.warn('🟡 Using web fallback teams because API is blocked/unavailable');
  return WEB_FALLBACK_TEAMS;
};

/**
 * Utility to check if API is reachable
 */
const isApiAvailable = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/teams`, {
      timeout: 3000, // 3 second timeout
    });
    return response.status === 200;
  } catch (error) {
    logAxiosError('⚠️ API unavailable, using local database', error);
    return false;
  }
};

/**
 * Hybrid Teams Service
 */
export const TeamsService = {
  /**
   * Get all teams (API first, fallback to DB)
   */
  getAllTeams: async () => {
    try {
      if (!isWeb) {
        const localTeams = await getTeamsDB();
        if (localTeams.length > 0) {
          console.log('Using local database teams:', localTeams.length);
          return localTeams;
        }
      }

      const apiAvailable = await isApiAvailable();
      
      if (apiAvailable) {
        try {
          const response = await axios.get(`${API_BASE_URL}/teams`);
          const data = response.data;
          const teams = Array.isArray(data) ? data : data.teams || [];
          console.log('🌐 Teams fetched from API:', teams.length);
          return teams;
        } catch (apiError) {
          logAxiosError('⚠️ API fetch failed, using local database', apiError);
          if (isWeb) return getWebFallbackTeams();
          return await getTeamsDB();
        }
      } else {
        // API not available, use local database
        if (isWeb) return getWebFallbackTeams();
        const teams = await getTeamsDB();
        console.log('💾 Teams fetched from local database:', teams.length);
        return teams;
      }
    } catch (error) {
      console.error('❌ Error fetching teams:', error);
      return [];
    }
  },

  /**
   * Get team by ID
   */
  getTeamById: async (id) => {
    try {
      const apiAvailable = await isApiAvailable();
      
      if (apiAvailable) {
        try {
          const response = await axios.get(`${API_BASE_URL}/teams/${id}`);
          console.log('🌐 Team fetched from API');
          return response.data;
        } catch (apiError) {
          if (isWeb) return null;
          return await getTeamByIdDB(id);
        }
      } else {
        if (isWeb) return null;
        return await getTeamByIdDB(id);
      }
    } catch (error) {
      console.error('❌ Error fetching team:', error);
      return null;
    }
  },

  /**
   * Get teams by category
   */
  getTeamsByCategory: async (category) => {
    try {
      const teams = await TeamsService.getAllTeams();
      return teams.filter(team => team.category === category);
    } catch (error) {
      console.error('❌ Error fetching teams by category:', error);
      return [];
    }
  },

  /**
   * Add new team (saves to DB and syncs to API when available)
   */
  addTeam: async (teamData) => {
    try {
      if (isWeb && (await isApiAvailable())) {
        const response = await axios.post(`${API_BASE_URL}/teams`, teamData);
        console.log('🌐 Team saved to API (web)');
        return response?.data?.id || null;
      }

      // Always save to local database first
      const localId = await addTeamDB(teamData);
      console.log('💾 Team saved to local database, ID:', localId);

      // Try to sync to API if available
      if (await isApiAvailable()) {
        try {
          const response = await axios.post(`${API_BASE_URL}/teams`, teamData);
          console.log('🌐 Team synced to API');
          return response.data.id || localId;
        } catch (apiError) {
          console.warn('⚠️  API sync failed, will retry later');
          return localId;
        }
      }

      return localId;
    } catch (error) {
      console.error('❌ Error adding team:', error);
      return null;
    }
  },

  /**
   * Update team
   */
  updateTeam: async (id, teamData) => {
    try {
      if (isWeb && (await isApiAvailable())) {
        await axios.put(`${API_BASE_URL}/teams/${id}`, teamData);
        console.log('🌐 Team updated in API (web)');
        return true;
      }

      // Update local database first
      await updateTeamDB(id, teamData);
      console.log('💾 Team updated in local database');

      // Sync to API if available
      if (await isApiAvailable()) {
        try {
          await axios.put(`${API_BASE_URL}/teams/${id}`, teamData);
          console.log('🌐 Team synced to API');
        } catch (apiError) {
          console.warn('⚠️  API sync failed');
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Error updating team:', error);
      return false;
    }
  },

  /**
   * Delete team
   */
  deleteTeam: async (id) => {
    try {
      if (isWeb && (await isApiAvailable())) {
        await axios.delete(`${API_BASE_URL}/teams/${id}`);
        console.log('🌐 Team deleted from API (web)');
        return true;
      }

      // Delete from local database first
      await deleteTeamDB(id);
      console.log('💾 Team deleted from local database');

      // Delete from API if available
      if (await isApiAvailable()) {
        try {
          await axios.delete(`${API_BASE_URL}/teams/${id}`);
          console.log('🌐 Team deleted from API');
        } catch (apiError) {
          console.warn('⚠️  API delete failed');
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Error deleting team:', error);
      return false;
    }
  },
};

/**
 * Hybrid Players Service
 */
export const PlayersService = {
  /**
   * Get all players
   */
  getAllPlayers: async () => {
    try {
      const apiAvailable = await isApiAvailable();
      
      if (apiAvailable) {
        try {
          const response = await axios.get(`${API_BASE_URL}/players`);
          const data = response.data;
          const players = Array.isArray(data) ? data : data.players || [];
          console.log('🌐 Players fetched from API:', players.length);
          return players;
        } catch (apiError) {
          if (isWeb) return [];
          return await getPlayersDB();
        }
      } else {
        if (isWeb) return [];
        const players = await getPlayersDB();
        console.log('💾 Players fetched from local database:', players.length);
        return players;
      }
    } catch (error) {
      console.error('❌ Error fetching players:', error);
      return [];
    }
  },

  /**
   * Get players by team
   */
  getPlayersByTeam: async (team) => {
    try {
      const players = await PlayersService.getAllPlayers();
      return players.filter(player => player.team === team);
    } catch (error) {
      console.error('❌ Error fetching players by team:', error);
      return [];
    }
  },
};

/**
 * Hybrid Categories Service
 */
export const CategoriesService = {
  /**
   * Get all categories
   */
  getAllCategories: async () => {
    try {
      if (!isWeb) {
        const localCategories = await getCategoriesDB();
        if (localCategories.length > 0) {
          console.log('Using local database categories:', localCategories.length);
          return localCategories;
        }
      }

      const apiAvailable = await isApiAvailable();
      
      if (apiAvailable) {
        try {
          const response = await axios.get(`${API_BASE_URL}/categories`);
          const data = response.data;
          const categories = Array.isArray(data) ? data : data.categories || [];
          console.log('🌐 Categories fetched from API:', categories.length);
          return categories;
        } catch (apiError) {
          if (isWeb) return [];
          return await getCategoriesDB();
        }
      } else {
        if (isWeb) return [];
        const categories = await getCategoriesDB();
        console.log('💾 Categories fetched from local database:', categories.length);
        return categories;
      }
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
      return [];
    }
  },
};

/**
 * Hybrid Registrations Service
 */
export const RegistrationsService = {
  /**
   * Add registration (saves to DB, syncs to API when available)
   */
  addRegistration: async (registrationData) => {
    try {
      // Always save to local database first
      const localId = await addRegistrationDB(registrationData);
      console.log('💾 Registration saved to local database, ID:', localId);

      // Try to sync to API if available
      if (await isApiAvailable()) {
        try {
          const response = await axios.post(`${API_BASE_URL}/registrations`, registrationData);
          console.log('🌐 Registration synced to API');
          return response.data.id || localId;
        } catch (apiError) {
          console.warn('⚠️  Registration sync to API failed, will retry later');
          return localId;
        }
      }

      return localId;
    } catch (error) {
      console.error('❌ Error adding registration:', error);
      return null;
    }
  },

  /**
   * Get all registrations
   */
  getAllRegistrations: async () => {
    try {
      const registrations = await getRegistrationsDB();
      console.log('💾 Registrations fetched from local database:', registrations.length);
      return registrations;
    } catch (error) {
      console.error('❌ Error fetching registrations:', error);
      return [];
    }
  },
};

/**
 * Results Service
 */
export const ResultsService = {
  isDuplicateResult: async resultData => {
    const results = await ResultsService.getAllResults();
    return isDuplicateResult(results, resultData);
  },

  cleanupDuplicateResults: async () => {
    try {
      if (isWeb) {
        const existingResults = JSON.parse(window.localStorage.getItem(WEB_RESULTS_KEY) || '[]');
        const seen = new Set();
        const deduped = [];

        for (const item of existingResults) {
          const key = getResultDuplicateKey(item);
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          deduped.push(item);
        }

        if (deduped.length !== existingResults.length) {
          window.localStorage.setItem(WEB_RESULTS_KEY, JSON.stringify(deduped));
        }

        return existingResults.length - deduped.length;
      }

      const results = await getResultsDB();
      const seen = new Set();
      const duplicateIds = [];

      for (const item of results) {
        const key = getResultDuplicateKey(item);
        if (seen.has(key)) {
          duplicateIds.push(item.id);
          continue;
        }
        seen.add(key);
      }

      for (const id of duplicateIds) {
        await deleteResultByIdDB(id);
      }

      return duplicateIds.length;
    } catch (error) {
      console.error('❌ Error cleaning duplicate results:', error);
      return 0;
    }
  },

  addResult: async resultData => {
    try {
      if (isWeb) {
        const existingResults = JSON.parse(window.localStorage.getItem(WEB_RESULTS_KEY) || '[]');
        if (isDuplicateResult(existingResults, resultData)) {
          const duplicateError = new Error('Duplicate result already exists');
          duplicateError.code = 'DUPLICATE_RESULT';
          throw duplicateError;
        }

        const nextResults = [
          {
            ...resultData,
            id: Date.now(),
            created_at: new Date().toISOString(),
          },
          ...existingResults,
        ];
        window.localStorage.setItem(WEB_RESULTS_KEY, JSON.stringify(nextResults));
        return nextResults[0].id;
      }

      const localId = await addResultDB(resultData);
      console.log('💾 Result saved to local database, ID:', localId);

      return localId;
    } catch (error) {
      console.error('❌ Error adding result:', error);
      throw error;
    }
  },

  getAllResults: async () => {
    try {
      if (isWeb) {
        const results = JSON.parse(window.localStorage.getItem(WEB_RESULTS_KEY) || '[]');
        console.log('💾 Results fetched from web storage:', results.length);
        return results;
      }

      const results = await getResultsDB();
      console.log('💾 Results fetched from local database:', results.length);
      return results;
    } catch (error) {
      console.error('❌ Error fetching results:', error);
      return [];
    }
  },

  clearAllResults: async () => {
    try {
      if (isWeb) {
        window.localStorage.removeItem(WEB_RESULTS_KEY);
        return true;
      }

      await clearAllResultsDB();
      return true;
    } catch (error) {
      console.error('❌ Error clearing results:', error);
      throw error;
    }
  },
};

export default {
  TeamsService,
  PlayersService,
  CategoriesService,
  RegistrationsService,
  ResultsService,
};
