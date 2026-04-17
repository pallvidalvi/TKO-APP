/**
 * Hybrid Data Service
 * Provides automatic fallback between API and local SQLite database
 * Works seamlessly online or offline
 */

import axios from 'axios';
import { Platform } from 'react-native';
import { SEEDED_TEAMS } from '../data/seedTeams';
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
  getAllDisputes as getDisputesDB,
  saveDispute as saveDisputeDB,
  deleteDisputeById as deleteDisputeByIdDB,
  deleteResultById as deleteResultByIdDB,
  clearAllResults as clearAllResultsDB,
  normalizeStoredDayPayload,
} from '../db/database';
import {
  DISPUTE_AUTO_SUBMIT_WINDOW_MS,
  getDisputeAutoSubmitStatus,
  parseRegistrationPayload,
} from '../utils/scoring';

const API_BASE_URL = 'https://www.teamkaradoffroaders.online/api';
const isWeb = Platform.OS === 'web';
const WEB_RESULTS_KEY = 'tko_app_results';
const WEB_DISPUTES_KEY = 'tko_app_disputes';
const normalizeResultKey = value => String(value || '').trim().toLowerCase();
const getNormalizedResultIdentity = item => {
  const normalizedItem = normalizeStoredDayPayload(item);

  return {
    category: normalizeResultKey(normalizedItem.category),
    trackName: normalizeResultKey(normalizedItem.track_name),
    stickerNumber: normalizeResultKey(normalizedItem.sticker_number),
    dayId: normalizeResultKey(normalizedItem.selected_day_id || normalizedItem.selectedDayId),
  };
};

const isDuplicateResult = (existingResults, resultData) => {
  const nextIdentity = getNormalizedResultIdentity(resultData);

  return existingResults.some(item => {
    const existingIdentity = getNormalizedResultIdentity(item);

    return (
      existingIdentity.category === nextIdentity.category &&
      existingIdentity.trackName === nextIdentity.trackName &&
      existingIdentity.stickerNumber === nextIdentity.stickerNumber &&
      existingIdentity.dayId === nextIdentity.dayId
    );
  });
};
const getResultDuplicateKey = item => {
  const identity = getNormalizedResultIdentity(item);

  return [identity.category, identity.trackName, identity.stickerNumber, identity.dayId].join('|');
};
const getDisputeDraftKey = item => {
  const identity = getNormalizedResultIdentity(item);

  return [identity.category, identity.trackName, identity.stickerNumber, identity.dayId].join('|');
};
const safeParseJsonObject = value => {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
};

const buildResultDataFromDispute = dispute => {
  const parsedDispute = parseRegistrationPayload(dispute);
  const sourcePayload = safeParseJsonObject(dispute?.submission_json);
  const autoSubmittedAt = new Date().toISOString();
  const normalizedFormPayload = {
    ...sourcePayload,
    trackName:
      parsedDispute.track_name || parsedDispute.trackName || sourcePayload.trackName || '',
    stickerNumber:
      parsedDispute.sticker_number || parsedDispute.stickerNumber || sourcePayload.stickerNumber || '',
    driverName:
      parsedDispute.driver_name || parsedDispute.driverName || sourcePayload.driverName || '',
    coDriverName:
      parsedDispute.codriver_name || parsedDispute.coDriverName || sourcePayload.coDriverName || '',
    category: parsedDispute.category || sourcePayload.category || '',
    selectedDayId:
      parsedDispute.selected_day_id || parsedDispute.selectedDayId || sourcePayload.selectedDayId || '',
    selectedDayLabel:
      parsedDispute.selected_day_label || parsedDispute.selectedDayLabel || sourcePayload.selectedDayLabel || '',
    selectedDayDate:
      parsedDispute.selected_day_date || parsedDispute.selectedDayDate || sourcePayload.selectedDayDate || '',
    disputeId: dispute?.id || sourcePayload.disputeId || null,
    source: 'dispute-auto-submit',
    autoSubmittedFromDispute: true,
    autoSubmittedAt,
    disputeCreatedAt: dispute?.created_at || sourcePayload.disputeCreatedAt || null,
    disputeAutoSubmitWindowMs: DISPUTE_AUTO_SUBMIT_WINDOW_MS,
  };

  return normalizeStoredDayPayload({
    sr_no: parsedDispute.sr_no || parsedDispute.srNo || sourcePayload.srNo || null,
    srNo: parsedDispute.sr_no || parsedDispute.srNo || sourcePayload.srNo || null,
    track_name: normalizedFormPayload.trackName,
    trackName: normalizedFormPayload.trackName,
    sticker_number: normalizedFormPayload.stickerNumber,
    stickerNumber: normalizedFormPayload.stickerNumber,
    driver_name: normalizedFormPayload.driverName,
    driverName: normalizedFormPayload.driverName,
    codriver_name: normalizedFormPayload.coDriverName,
    coDriverName: normalizedFormPayload.coDriverName,
    category: normalizedFormPayload.category,
    selected_day_id: normalizedFormPayload.selectedDayId || '',
    selectedDayId: normalizedFormPayload.selectedDayId || '',
    selected_day_label: normalizedFormPayload.selectedDayLabel || '',
    selectedDayLabel: normalizedFormPayload.selectedDayLabel || '',
    selected_day_date: normalizedFormPayload.selectedDayDate || '',
    selectedDayDate: normalizedFormPayload.selectedDayDate || '',
    bunting_count:
      parsedDispute.bunting_count ?? parsedDispute.bustingCount ?? sourcePayload.bustingCount ?? 0,
    bustingCount:
      parsedDispute.bunting_count ?? parsedDispute.bustingCount ?? sourcePayload.bustingCount ?? 0,
    seatbelt_count:
      parsedDispute.seatbelt_count ?? parsedDispute.seatbeltCount ?? sourcePayload.seatbeltCount ?? 0,
    seatbeltCount:
      parsedDispute.seatbelt_count ?? parsedDispute.seatbeltCount ?? sourcePayload.seatbeltCount ?? 0,
    ground_touch_count:
      parsedDispute.ground_touch_count ?? parsedDispute.groundTouchCount ?? sourcePayload.groundTouchCount ?? 0,
    groundTouchCount:
      parsedDispute.ground_touch_count ?? parsedDispute.groundTouchCount ?? sourcePayload.groundTouchCount ?? 0,
    late_start_count:
      parsedDispute.late_start_count ??
      parsedDispute.lateStartCount ??
      sourcePayload.lateStartCount ??
      (parsedDispute.lateStartMode || sourcePayload.lateStartMode ? 1 : 0),
    lateStartCount:
      parsedDispute.late_start_count ??
      parsedDispute.lateStartCount ??
      sourcePayload.lateStartCount ??
      (parsedDispute.lateStartMode || sourcePayload.lateStartMode ? 1 : 0),
    late_start_mode: parsedDispute.late_start_mode || parsedDispute.lateStartMode || sourcePayload.lateStartMode || null,
    lateStartMode: parsedDispute.late_start_mode || parsedDispute.lateStartMode || sourcePayload.lateStartMode || null,
    late_start_status:
      parsedDispute.late_start_status || parsedDispute.lateStartStatus || sourcePayload.lateStartStatus || 'No',
    lateStartStatus:
      parsedDispute.late_start_status || parsedDispute.lateStartStatus || sourcePayload.lateStartStatus || 'No',
    late_start_penalty_time:
      parsedDispute.late_start_penalty_time ??
      parsedDispute.lateStartPenaltyTime ??
      sourcePayload.lateStartPenaltyTime ??
      0,
    lateStartPenaltyTime:
      parsedDispute.late_start_penalty_time ??
      parsedDispute.lateStartPenaltyTime ??
      sourcePayload.lateStartPenaltyTime ??
      0,
    attempt_count:
      parsedDispute.attempt_count ?? parsedDispute.attemptCount ?? sourcePayload.attemptCount ?? 0,
    attemptCount:
      parsedDispute.attempt_count ?? parsedDispute.attemptCount ?? sourcePayload.attemptCount ?? 0,
    attempt_penalty_time:
      parsedDispute.attempt_penalty_time ?? parsedDispute.attemptPenaltyTime ?? sourcePayload.attemptPenaltyTime ?? 0,
    task_skipped_count:
      parsedDispute.task_skipped_count ?? parsedDispute.taskSkippedCount ?? sourcePayload.taskSkippedCount ?? 0,
    taskSkippedCount:
      parsedDispute.task_skipped_count ?? parsedDispute.taskSkippedCount ?? sourcePayload.taskSkippedCount ?? 0,
    task_skipped_penalty_time:
      parsedDispute.task_skipped_penalty_time ??
      parsedDispute.taskSkippedPenaltyTime ??
      sourcePayload.taskSkippedPenaltyTime ??
      0,
    wrong_course_count:
      parsedDispute.wrong_course_count ??
      parsedDispute.wrongCourseCount ??
      (parsedDispute.wrongCourseSelected || sourcePayload.wrongCourseSelected ? 1 : 0),
    wrongCourseCount:
      parsedDispute.wrong_course_count ??
      parsedDispute.wrongCourseCount ??
      (parsedDispute.wrongCourseSelected || sourcePayload.wrongCourseSelected ? 1 : 0),
    wrong_course_selected:
      parsedDispute.wrong_course_selected ?? parsedDispute.wrongCourseSelected ?? sourcePayload.wrongCourseSelected ?? false,
    fourth_attempt_count:
      parsedDispute.fourth_attempt_count ??
      parsedDispute.fourthAttemptCount ??
      (parsedDispute.fourthAttemptSelected || sourcePayload.fourthAttemptSelected ? 1 : 0),
    fourthAttemptCount:
      parsedDispute.fourth_attempt_count ??
      parsedDispute.fourthAttemptCount ??
      (parsedDispute.fourthAttemptSelected || sourcePayload.fourthAttemptSelected ? 1 : 0),
    fourth_attempt_selected:
      parsedDispute.fourth_attempt_selected ??
      parsedDispute.fourthAttemptSelected ??
      sourcePayload.fourthAttemptSelected ??
      false,
    time_over_selected:
      parsedDispute.time_over_selected ?? parsedDispute.timeOverSelected ?? sourcePayload.timeOverSelected ?? false,
    is_dnf: parsedDispute.is_dnf ?? parsedDispute.isDNF ?? sourcePayload.isDNF ?? false,
    is_dns: parsedDispute.is_dns ?? parsedDispute.isDNS ?? sourcePayload.isDNS ?? false,
    dnf_selection: parsedDispute.dnf_selection ?? parsedDispute.dnfSelection ?? sourcePayload.dnfSelection ?? null,
    dnf_points: parsedDispute.dnf_points ?? parsedDispute.dnfPoints ?? sourcePayload.dnfPoints ?? 0,
    bunting_penalty_time:
      parsedDispute.bunting_penalty_time ?? parsedDispute.bustingPenaltyTime ?? sourcePayload.bustingPenaltyTime ?? 0,
    seatbelt_penalty_time:
      parsedDispute.seatbelt_penalty_time ?? parsedDispute.seatbeltPenaltyTime ?? sourcePayload.seatbeltPenaltyTime ?? 0,
    ground_touch_penalty_time:
      parsedDispute.ground_touch_penalty_time ??
      parsedDispute.groundTouchPenaltyTime ??
      sourcePayload.groundTouchPenaltyTime ??
      0,
    total_penalties_time:
      parsedDispute.total_penalties_time ?? parsedDispute.totalPenaltiesTime ?? sourcePayload.totalPenaltiesTime ?? 0,
    performance_time:
      parsedDispute.performance_time || parsedDispute.performanceTimeDisplay || sourcePayload.performanceTimeDisplay || null,
    performanceTimeDisplay:
      parsedDispute.performance_time || parsedDispute.performanceTimeDisplay || sourcePayload.performanceTimeDisplay || null,
    total_time: parsedDispute.total_time || parsedDispute.totalTimeDisplay || sourcePayload.totalTimeDisplay || null,
    totalTimeDisplay:
      parsedDispute.total_time || parsedDispute.totalTimeDisplay || sourcePayload.totalTimeDisplay || null,
    submission_json: JSON.stringify(normalizedFormPayload),
  });
};
const WEB_FALLBACK_TEAMS = SEEDED_TEAMS;

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
      const normalizedResultData = normalizeStoredDayPayload(resultData);
      if (isWeb) {
        const existingResults = JSON.parse(window.localStorage.getItem(WEB_RESULTS_KEY) || '[]');
        if (isDuplicateResult(existingResults, normalizedResultData)) {
          const duplicateError = new Error('Duplicate result already exists');
          duplicateError.code = 'DUPLICATE_RESULT';
          throw duplicateError;
        }

        const nextResults = [
          {
            ...normalizedResultData,
            id: Date.now(),
            created_at: new Date().toISOString(),
          },
          ...existingResults,
        ];
        window.localStorage.setItem(WEB_RESULTS_KEY, JSON.stringify(nextResults));
        return nextResults[0].id;
      }

      const localId = await addResultDB(normalizedResultData);
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

export const DisputesService = {
  saveDispute: async disputeData => {
    try {
      const normalizedDisputeData = normalizeStoredDayPayload(disputeData);
      if (isWeb) {
        const existingDisputes = JSON.parse(window.localStorage.getItem(WEB_DISPUTES_KEY) || '[]');
        const draftKey = getDisputeDraftKey(normalizedDisputeData);
        const existingIndex = existingDisputes.findIndex(item => getDisputeDraftKey(item) === draftKey);
        const nextDispute = {
          ...normalizedDisputeData,
          id: existingIndex >= 0 ? existingDisputes[existingIndex].id : Date.now(),
          updated_at: new Date().toISOString(),
          created_at: existingIndex >= 0 ? existingDisputes[existingIndex].created_at : new Date().toISOString(),
        };

        const nextDisputes =
          existingIndex >= 0
            ? existingDisputes.map((item, index) => (index === existingIndex ? nextDispute : item))
            : [nextDispute, ...existingDisputes];

        window.localStorage.setItem(WEB_DISPUTES_KEY, JSON.stringify(nextDisputes));
        return nextDispute.id;
      }

      return await saveDisputeDB(normalizedDisputeData);
    } catch (error) {
      console.error('Error saving dispute:', error);
      throw error;
    }
  },

  getAllDisputes: async () => {
    try {
      if (isWeb) {
        return JSON.parse(window.localStorage.getItem(WEB_DISPUTES_KEY) || '[]');
      }

      return await getDisputesDB();
    } catch (error) {
      console.error('Error fetching disputes:', error);
      return [];
    }
  },

  deleteDisputeById: async id => {
    try {
      if (isWeb) {
        const existingDisputes = JSON.parse(window.localStorage.getItem(WEB_DISPUTES_KEY) || '[]');
        window.localStorage.setItem(
          WEB_DISPUTES_KEY,
          JSON.stringify(existingDisputes.filter(item => String(item.id) !== String(id)))
        );
        return true;
      }

      return await deleteDisputeByIdDB(id);
    } catch (error) {
      console.error('Error deleting dispute:', error);
      throw error;
    }
  },
};

export const promoteExpiredDisputesToResults = async () => {
  try {
    const disputes = await DisputesService.getAllDisputes();
    let processedCount = 0;
    let promotedCount = 0;
    let removedDuplicateCount = 0;
    let failedCount = 0;

    for (const dispute of disputes) {
      const disputeStatus = getDisputeAutoSubmitStatus(dispute);

      if (!disputeStatus.isExpired) {
        continue;
      }

      const resultData = buildResultDataFromDispute(dispute);

      if (!resultData.track_name || !resultData.sticker_number || !resultData.category) {
        failedCount += 1;
        continue;
      }

      let shouldDeleteDispute = false;

      try {
        await ResultsService.addResult(resultData);
        promotedCount += 1;
        shouldDeleteDispute = true;
      } catch (error) {
        if (error?.code === 'DUPLICATE_RESULT') {
          removedDuplicateCount += 1;
          shouldDeleteDispute = true;
        } else {
          failedCount += 1;
          console.error('Error auto-submitting expired dispute:', error);
        }
      }

      if (!shouldDeleteDispute) {
        continue;
      }

      try {
        await DisputesService.deleteDisputeById(dispute.id);
        processedCount += 1;
      } catch (error) {
        failedCount += 1;
        console.error('Error deleting expired dispute after auto-submit:', error);
      }
    }

    return {
      processedCount,
      promotedCount,
      removedDuplicateCount,
      failedCount,
    };
  } catch (error) {
    console.error('Error processing expired disputes:', error);
    return {
      processedCount: 0,
      promotedCount: 0,
      removedDuplicateCount: 0,
      failedCount: 1,
    };
  }
};

export default {
  TeamsService,
  PlayersService,
  CategoriesService,
  RegistrationsService,
  ResultsService,
  DisputesService,
  promoteExpiredDisputesToResults,
};
