import { Platform } from 'react-native';
import { SEEDED_TEAMS } from '../data/seedTeams';

const isWeb = Platform.OS === 'web';
let SQLite = null;

if (!isWeb) {
  SQLite = require('expo-sqlite');
}

const DB_NAME = 'tko_app.db';
const REPORT_DAYS = [
  {
    id: 'day-1',
    dayLabel: 'Day 1',
    dateLabel: 'Friday, 29th May 2026',
  },
  {
    id: 'day-2',
    dayLabel: 'Day 2',
    dateLabel: 'Saturday, 30th May 2026',
  },
  {
    id: 'day-3',
    dayLabel: 'Day 3',
    dateLabel: 'Sunday, 31st May 2026',
  },
];

const normalizeDayLookupValue = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/(\d+)(st|nd|rd|th)\b/g, '$1')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const mergeDayMetadataIntoSubmissionJson = (submissionJson, dayPayload) => {
  if (!submissionJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(submissionJson);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return submissionJson;
    }

    return JSON.stringify({
      ...parsed,
      ...dayPayload,
    });
  } catch (error) {
    return submissionJson;
  }
};

const resolveCanonicalReportDay = payload => {
  const rawDayId = String(payload?.selected_day_id || payload?.selectedDayId || '').trim();
  const rawDayLabel = String(payload?.selected_day_label || payload?.selectedDayLabel || '').trim();
  const rawDayDate = String(payload?.selected_day_date || payload?.selectedDayDate || '').trim();
  const lookupValues = [
    normalizeDayLookupValue(rawDayId),
    normalizeDayLookupValue(rawDayLabel),
    normalizeDayLookupValue(rawDayDate),
  ].filter(Boolean);

  const matchedDay = REPORT_DAYS.find(day =>
    lookupValues.some(
      lookupValue =>
        lookupValue === normalizeDayLookupValue(day.id) ||
        lookupValue === normalizeDayLookupValue(day.dayLabel) ||
        lookupValue === normalizeDayLookupValue(day.dateLabel)
    )
  );

  if (matchedDay) {
    return matchedDay;
  }

  return {
    id: rawDayId,
    dayLabel: rawDayLabel,
    dateLabel: rawDayDate,
  };
};

export const normalizeStoredDayPayload = payload => {
  const safePayload = payload || {};
  const resolvedDay = resolveCanonicalReportDay(safePayload);
  const dayPayload = {
    selected_day_id: resolvedDay.id || '',
    selectedDayId: resolvedDay.id || '',
    selected_day_label: resolvedDay.dayLabel || '',
    selectedDayLabel: resolvedDay.dayLabel || '',
    selected_day_date: resolvedDay.dateLabel || '',
    selectedDayDate: resolvedDay.dateLabel || '',
  };

  return {
    ...safePayload,
    ...dayPayload,
    submission_json: mergeDayMetadataIntoSubmissionJson(safePayload.submission_json, dayPayload),
  };
};

const LEGACY_SEEDED_TEAMS = [
  {
    team_name: 'Team offroaders Pune ',
    driver_name: 'Ritesh Bire ',
    codriver_name: 'Shaurya Bire ',
    car_number: '1',
  },
  {
    team_name: 'Team satara offroad ',
    driver_name: 'Raj Santosh deshmukh ',
    codriver_name: 'Ajay misal',
    car_number: '4',
  },
  {
    team_name: 'Team motoRnation ',
    driver_name: 'Aniket shete',
    codriver_name: 'Anvita shete',
    car_number: '4',
  },
  {
    team_name: 'TEAM SATARA OFF ROADERS',
    driver_name: 'PRATAP D. SHINGATE',
    codriver_name: 'SURAJ GULUMKAR',
    car_number: '7',
  },
  {
    team_name: 'Uzma',
    driver_name: 'Asif faras',
    codriver_name: 'Saeed shaikh',
    car_number: '7',
  },
  {
    team_name: 'Minal ',
    driver_name: 'Minal shete',
    codriver_name: 'Amit shete',
    car_number: '8',
  },
  {
    team_name: 'Team motoRnation ',
    driver_name: 'Anvita aniket shete',
    codriver_name: 'Aniket shete',
    car_number: '12',
  },
  {
    team_name: 'BAAZ',
    driver_name: 'Malkit Singh Saini',
    codriver_name: 'Gurdeep Singh Saini',
    car_number: '27',
  },
];

const SEEDED_PLAYERS = SEEDED_TEAMS.flatMap(team => [
  {
    name: team.driver_name,
    role: 'Driver',
    team: team.team_name,
    blood_group: team.driver_blood_group,
    contact: '',
  },
  {
    name: team.codriver_name,
    role: 'Co-driver',
    team: team.team_name,
    blood_group: team.codriver_blood_group,
    contact: '',
  },
]);

const SEEDED_CATEGORIES = [
  { name: 'Extreme', description: 'Ultimate performance', icon: 'Extreme', color: '#ff4757' },
  { name: 'Diesel Modified', description: 'Diesel vehicles modified', icon: 'Diesel', color: '#ff6348' },
  { name: 'Petrol Modified', description: 'Petrol vehicles modified', icon: 'Petrol', color: '#ffa502' },
  { name: 'Diesel Expert', description: 'Expert diesel drivers', icon: 'Expert', color: '#2ed573' },
  { name: 'Petrol Expert', description: 'Expert petrol drivers', icon: 'Expert', color: '#1e90ff' },
  { name: 'Thar SUV', description: 'Mahindra Thar SUV category', icon: 'Thar', color: '#9b59b6' },
  { name: 'Jimny SUV', description: 'Maruti Jimny SUV category', icon: 'Jimny', color: '#34495e' },
  { name: 'SUV Modified', description: 'Modified SUVs', icon: 'SUV', color: '#e74c3c' },
  { name: 'Stock NDMS', description: 'Stock vehicles NDMS', icon: 'Stock', color: '#3498db' },
  { name: 'Ladies', description: 'Women drivers category', icon: 'Ladies', color: '#e91e63' },
];

let dbPromise = null;

const getDatabase = async () => {
  if (isWeb) {
    return null;
  }

  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
};

const initializeSchema = async database => {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY NOT NULL,
      team_name TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      driver_blood_group TEXT,
      codriver_name TEXT NOT NULL,
      codriver_blood_group TEXT,
      car_number TEXT NOT NULL,
      category TEXT NOT NULL,
      vehicle_name TEXT NOT NULL DEFAULT '',
      vehicle_model TEXT NOT NULL DEFAULT '',
      socials TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      role TEXT,
      team TEXT,
      blood_group TEXT,
      contact TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      color TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY NOT NULL,
      track_name TEXT NOT NULL,
      sticker_number TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      codriver_name TEXT NOT NULL,
      category TEXT NOT NULL,
      bunting_count INTEGER DEFAULT 0,
      seatbelt_count INTEGER DEFAULT 0,
      ground_touch_count INTEGER DEFAULT 0,
      late_start_count INTEGER DEFAULT 0,
      attempt_count INTEGER DEFAULT 0,
      task_skipped_count INTEGER DEFAULT 0,
      wrong_course_count INTEGER DEFAULT 0,
      fourth_attempt_count INTEGER DEFAULT 0,
      total_penalties_time INTEGER DEFAULT 0,
      performance_time TEXT,
      total_time TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY NOT NULL,
      track_name TEXT NOT NULL,
      sticker_number TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      codriver_name TEXT NOT NULL,
      category TEXT NOT NULL,
      bunting_count INTEGER DEFAULT 0,
      seatbelt_count INTEGER DEFAULT 0,
      ground_touch_count INTEGER DEFAULT 0,
      late_start_count INTEGER DEFAULT 0,
      attempt_count INTEGER DEFAULT 0,
      task_skipped_count INTEGER DEFAULT 0,
      wrong_course_count INTEGER DEFAULT 0,
      fourth_attempt_count INTEGER DEFAULT 0,
      is_dns INTEGER DEFAULT 0,
      total_penalties_time INTEGER DEFAULT 0,
      performance_time TEXT,
      total_time TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS disputes (
      id INTEGER PRIMARY KEY NOT NULL,
      track_name TEXT NOT NULL,
      sticker_number TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      codriver_name TEXT NOT NULL,
      category TEXT NOT NULL,
      total_penalties_time INTEGER DEFAULT 0,
      performance_time TEXT,
      total_time TEXT,
      submission_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

const addColumnIfMissing = async (database, tableName, columnName, columnSql) => {
  try {
    const columns = await database.getAllAsync(`PRAGMA table_info(${tableName})`);
    const hasColumn = columns.some(column => String(column.name) === String(columnName));

    if (!hasColumn) {
      await database.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql};`);
    }
  } catch (error) {
    console.warn(`Unable to ensure column ${columnName} on ${tableName}:`, error);
  }
};

const runDatabaseMigrations = async database => {
  await addColumnIfMissing(database, 'results', 'selected_day_id', 'selected_day_id TEXT');
  await addColumnIfMissing(database, 'results', 'selected_day_label', 'selected_day_label TEXT');
  await addColumnIfMissing(database, 'results', 'selected_day_date', 'selected_day_date TEXT');
  await addColumnIfMissing(database, 'results', 'submission_json', 'submission_json TEXT');
  await addColumnIfMissing(database, 'disputes', 'selected_day_id', 'selected_day_id TEXT');
  await addColumnIfMissing(database, 'disputes', 'selected_day_label', 'selected_day_label TEXT');
  await addColumnIfMissing(database, 'disputes', 'selected_day_date', 'selected_day_date TEXT');

  const syncStoredDayMetadata = async tableName => {
    const rows = await database.getAllAsync(
      `SELECT id, selected_day_id, selected_day_label, selected_day_date, submission_json FROM ${tableName}`
    );

    for (const row of rows) {
      const normalizedRow = normalizeStoredDayPayload(row);
      const hasChanged =
        String(row.selected_day_id || '') !== String(normalizedRow.selected_day_id || '') ||
        String(row.selected_day_label || '') !== String(normalizedRow.selected_day_label || '') ||
        String(row.selected_day_date || '') !== String(normalizedRow.selected_day_date || '') ||
        String(row.submission_json || '') !== String(normalizedRow.submission_json || '');

      if (!hasChanged) {
        continue;
      }

      await database.runAsync(
        `UPDATE ${tableName}
         SET selected_day_id = ?, selected_day_label = ?, selected_day_date = ?, submission_json = ?
         WHERE id = ?`,
        [
          normalizedRow.selected_day_id || '',
          normalizedRow.selected_day_label || '',
          normalizedRow.selected_day_date || '',
          normalizedRow.submission_json || null,
          row.id,
        ]
      );
    }
  };

  await syncStoredDayMetadata('results');
  await syncStoredDayMetadata('disputes');
};

const removeLegacySeedData = async database => {
  for (const legacyTeam of LEGACY_SEEDED_TEAMS) {
    await database.runAsync(
      `DELETE FROM teams
       WHERE TRIM(team_name) = TRIM(?)
         AND TRIM(driver_name) = TRIM(?)
         AND TRIM(codriver_name) = TRIM(?)
         AND car_number = ?`,
      [
        legacyTeam.team_name,
        legacyTeam.driver_name,
        legacyTeam.codriver_name,
        legacyTeam.car_number,
      ]
    );

    await database.runAsync(
      `DELETE FROM players
       WHERE TRIM(team) = TRIM(?)
         AND (
           (role = 'Driver' AND TRIM(name) = TRIM(?)) OR
           (role = 'Co-driver' AND TRIM(name) = TRIM(?))
         )`,
      [
        legacyTeam.team_name,
        legacyTeam.driver_name,
        legacyTeam.codriver_name,
      ]
    );
  }
};

export const initializeDatabase = async () => {
  try {
    if (isWeb) {
      return true;
    }

    const database = await getDatabase();
    await initializeSchema(database);
    await runDatabaseMigrations(database);
    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

export const seedDatabase = async () => {
  try {
    if (isWeb) {
      return true;
    }

    const database = await getDatabase();
    await initializeSchema(database);
    await runDatabaseMigrations(database);

    await database.withTransactionAsync(async () => {
      await removeLegacySeedData(database);

      for (const team of SEEDED_TEAMS) {
        const existingTeam = await database.getFirstAsync(
          `SELECT id FROM teams
           WHERE TRIM(team_name) = TRIM(?)
             AND TRIM(driver_name) = TRIM(?)
             AND TRIM(codriver_name) = TRIM(?)
             AND car_number = ?`,
          [
            team.team_name,
            team.driver_name,
            team.codriver_name,
            team.car_number,
          ]
        );

        if (existingTeam) {
          await database.runAsync(
            `UPDATE teams SET
              team_name = ?,
              driver_name = ?,
              driver_blood_group = ?,
              codriver_name = ?,
              codriver_blood_group = ?,
              car_number = ?,
              category = ?,
              vehicle_name = ?,
              vehicle_model = ?,
              socials = ?,
              status = ?,
              updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
              team.team_name,
              team.driver_name,
              team.driver_blood_group,
              team.codriver_name,
              team.codriver_blood_group,
              team.car_number,
              team.category,
              team.vehicle_name,
              team.vehicle_model,
              team.socials,
              team.status,
              existingTeam.id,
            ]
          );
          continue;
        }

        await database.runAsync(
          `INSERT INTO teams (
            team_name, driver_name, driver_blood_group, codriver_name, codriver_blood_group,
            car_number, category, vehicle_name, vehicle_model, socials, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            team.team_name,
            team.driver_name,
            team.driver_blood_group,
            team.codriver_name,
            team.codriver_blood_group,
            team.car_number,
            team.category,
            team.vehicle_name,
            team.vehicle_model,
            team.socials,
            team.status,
          ]
        );
      }

      for (const player of SEEDED_PLAYERS) {
        const existingPlayer = await database.getFirstAsync(
          'SELECT id FROM players WHERE TRIM(name) = TRIM(?) AND TRIM(team) = TRIM(?) AND role = ?',
          [player.name, player.team, player.role]
        );

        if (existingPlayer) {
          await database.runAsync(
            `UPDATE players SET
              name = ?,
              role = ?,
              team = ?,
              blood_group = ?,
              contact = ?,
              updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
              player.name,
              player.role,
              player.team,
              player.blood_group,
              player.contact,
              existingPlayer.id,
            ]
          );
          continue;
        }

        await database.runAsync(
          `INSERT INTO players (name, role, team, blood_group, contact)
           VALUES (?, ?, ?, ?, ?)`,
          [
            player.name,
            player.role,
            player.team,
            player.blood_group,
            player.contact,
          ]
        );
      }

      for (const category of SEEDED_CATEGORIES) {
        const existingCategory = await database.getFirstAsync(
          'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)',
          [category.name]
        );

        if (existingCategory) {
          await database.runAsync(
            `UPDATE categories SET
              name = ?,
              description = ?,
              icon = ?,
              color = ?
             WHERE id = ?`,
            [
              category.name,
              category.description,
              category.icon,
              category.color,
              existingCategory.id,
            ]
          );
          continue;
        }

        await database.runAsync(
          `INSERT INTO categories (name, description, icon, color)
           VALUES (?, ?, ?, ?)`,
          [category.name, category.description, category.icon, category.color]
        );
      }
    });

    console.log('Database seeded successfully');
    return true;
  } catch (error) {
    console.error('Database seeding error:', error);
    throw error;
  }
};

export const getAllTeams = async () => {
  try {
    const database = await getDatabase();
    return await database.getAllAsync('SELECT * FROM teams ORDER BY CAST(car_number AS INTEGER), id');
  } catch (error) {
    console.error('Error fetching teams:', error);
    return [];
  }
};

export const getTeamById = async id => {
  try {
    const database = await getDatabase();
    return await database.getFirstAsync('SELECT * FROM teams WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error fetching team:', error);
    return null;
  }
};

export const getTeamsByCategory = async category => {
  try {
    const database = await getDatabase();
    return await database.getAllAsync(
      'SELECT * FROM teams WHERE category = ? ORDER BY CAST(car_number AS INTEGER), id',
      [category]
    );
  } catch (error) {
    console.error('Error fetching teams by category:', error);
    return [];
  }
};

export const addTeam = async team => {
  try {
    const database = await getDatabase();
    const result = await database.runAsync(
      `INSERT INTO teams (
        team_name, driver_name, driver_blood_group, codriver_name, codriver_blood_group,
        car_number, category, vehicle_name, vehicle_model, socials, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        team.team_name,
        team.driver_name,
        team.driver_blood_group || '',
        team.codriver_name,
        team.codriver_blood_group || '',
        team.car_number,
        team.category,
        team.vehicle_name || '',
        team.vehicle_model || '',
        team.socials || '',
        team.status || 'PENDING',
      ]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error adding team:', error);
    throw error;
  }
};

export const updateTeam = async (id, updates) => {
  try {
    const database = await getDatabase();
    const keys = Object.keys(updates || {});

    if (keys.length === 0) {
      return true;
    }

    const setClauses = keys.map(key => `${key} = ?`).join(', ');
    const values = keys.map(key => updates[key]);
    values.push(id);

    await database.runAsync(
      `UPDATE teams SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    return true;
  } catch (error) {
    console.error('Error updating team:', error);
    throw error;
  }
};

export const deleteTeam = async id => {
  try {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM teams WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('Error deleting team:', error);
    throw error;
  }
};

export const getAllPlayers = async () => {
  try {
    const database = await getDatabase();
    return await database.getAllAsync('SELECT * FROM players');
  } catch (error) {
    console.error('Error fetching players:', error);
    return [];
  }
};

export const getPlayersByTeam = async teamName => {
  try {
    const database = await getDatabase();
    return await database.getAllAsync('SELECT * FROM players WHERE team = ?', [teamName]);
  } catch (error) {
    console.error('Error fetching players by team:', error);
    return [];
  }
};

export const getAllCategories = async () => {
  try {
    const database = await getDatabase();
    return await database.getAllAsync('SELECT * FROM categories');
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
};

export const addRegistration = async registration => {
  try {
    const database = await getDatabase();
    const result = await database.runAsync(
      `INSERT INTO registrations (
        track_name, sticker_number, driver_name, codriver_name, category,
        bunting_count, seatbelt_count, ground_touch_count, late_start_count,
        attempt_count, task_skipped_count, wrong_course_count, fourth_attempt_count,
        total_penalties_time, performance_time, total_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        registration.track_name,
        registration.sticker_number,
        registration.driver_name,
        registration.codriver_name,
        registration.category,
        registration.bunting_count || 0,
        registration.seatbelt_count || 0,
        registration.ground_touch_count || 0,
        registration.late_start_count || 0,
        registration.attempt_count || 0,
        registration.task_skipped_count || 0,
        registration.wrong_course_count || 0,
        registration.fourth_attempt_count || 0,
        registration.total_penalties_time || 0,
        registration.performance_time || null,
        registration.total_time || null,
      ]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error adding registration:', error);
    throw error;
  }
};

export const getAllRegistrations = async () => {
  try {
    const database = await getDatabase();
    return await database.getAllAsync('SELECT * FROM registrations ORDER BY id DESC');
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return [];
  }
};

export const addResult = async resultData => {
  try {
    const normalizedResultData = normalizeStoredDayPayload(resultData);
    const database = await getDatabase();
    const existingResult = await database.getFirstAsync(
      `SELECT id FROM results
       WHERE LOWER(TRIM(category)) = LOWER(TRIM(?))
         AND LOWER(TRIM(track_name)) = LOWER(TRIM(?))
         AND LOWER(TRIM(sticker_number)) = LOWER(TRIM(?))
         AND LOWER(TRIM(COALESCE(selected_day_id, ''))) = LOWER(TRIM(?))
      LIMIT 1`,
      [
        normalizedResultData.category || '',
        normalizedResultData.track_name || '',
        normalizedResultData.sticker_number || '',
        normalizedResultData.selected_day_id || normalizedResultData.selectedDayId || '',
      ]
    );

    if (existingResult) {
      const duplicateError = new Error('Duplicate result already exists');
      duplicateError.code = 'DUPLICATE_RESULT';
      throw duplicateError;
    }

    const result = await database.runAsync(
      `INSERT INTO results (
        track_name, sticker_number, driver_name, codriver_name, category,
        bunting_count, seatbelt_count, ground_touch_count, late_start_count,
        attempt_count, task_skipped_count, wrong_course_count, fourth_attempt_count,
        is_dns, total_penalties_time, performance_time, total_time,
        selected_day_id, selected_day_label, selected_day_date, submission_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalizedResultData.track_name,
        normalizedResultData.sticker_number,
        normalizedResultData.driver_name,
        normalizedResultData.codriver_name,
        normalizedResultData.category,
        normalizedResultData.bunting_count || 0,
        normalizedResultData.seatbelt_count || 0,
        normalizedResultData.ground_touch_count || 0,
        normalizedResultData.late_start_count || 0,
        normalizedResultData.attempt_count || 0,
        normalizedResultData.task_skipped_count || 0,
        normalizedResultData.wrong_course_count || 0,
        normalizedResultData.fourth_attempt_count || 0,
        normalizedResultData.is_dns ? 1 : 0,
        normalizedResultData.total_penalties_time || 0,
        normalizedResultData.performance_time || null,
        normalizedResultData.total_time || null,
        normalizedResultData.selected_day_id || normalizedResultData.selectedDayId || '',
        normalizedResultData.selected_day_label || normalizedResultData.selectedDayLabel || '',
        normalizedResultData.selected_day_date || normalizedResultData.selectedDayDate || '',
        normalizedResultData.submission_json || null,
      ]
    );
    return result.lastInsertRowId;
  } catch (error) {
    if (error?.code === 'DUPLICATE_RESULT') {
      throw error;
    }
    console.error('Error adding result:', error);
    throw error;
  }
};

export const getAllResults = async () => {
  try {
    const database = await getDatabase();
    return await database.getAllAsync('SELECT * FROM results ORDER BY id DESC');
  } catch (error) {
    console.error('Error fetching results:', error);
    return [];
  }
};

export const saveDispute = async disputeData => {
  try {
    const normalizedDisputeData = normalizeStoredDayPayload(disputeData);
    const database = await getDatabase();
    const existingDispute = await database.getFirstAsync(
      `SELECT id FROM disputes
       WHERE LOWER(TRIM(category)) = LOWER(TRIM(?))
         AND LOWER(TRIM(track_name)) = LOWER(TRIM(?))
         AND LOWER(TRIM(sticker_number)) = LOWER(TRIM(?))
         AND LOWER(TRIM(COALESCE(selected_day_id, ''))) = LOWER(TRIM(?))
      LIMIT 1`,
      [
        normalizedDisputeData.category || '',
        normalizedDisputeData.track_name || '',
        normalizedDisputeData.sticker_number || '',
        normalizedDisputeData.selected_day_id || normalizedDisputeData.selectedDayId || '',
      ]
    );

    if (existingDispute) {
      await database.runAsync(
        `UPDATE disputes SET
          track_name = ?,
          sticker_number = ?,
          driver_name = ?,
          codriver_name = ?,
          category = ?,
          selected_day_id = ?,
          selected_day_label = ?,
          selected_day_date = ?,
          total_penalties_time = ?,
          performance_time = ?,
          total_time = ?,
          submission_json = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          normalizedDisputeData.track_name || '',
          normalizedDisputeData.sticker_number || '',
          normalizedDisputeData.driver_name || '',
          normalizedDisputeData.codriver_name || '',
          normalizedDisputeData.category || '',
          normalizedDisputeData.selected_day_id || normalizedDisputeData.selectedDayId || '',
          normalizedDisputeData.selected_day_label || normalizedDisputeData.selectedDayLabel || '',
          normalizedDisputeData.selected_day_date || normalizedDisputeData.selectedDayDate || '',
          normalizedDisputeData.total_penalties_time || 0,
          normalizedDisputeData.performance_time || null,
          normalizedDisputeData.total_time || null,
          normalizedDisputeData.submission_json || null,
          existingDispute.id,
        ]
      );
      return existingDispute.id;
    }

    const result = await database.runAsync(
      `INSERT INTO disputes (
        track_name, sticker_number, driver_name, codriver_name, category,
        selected_day_id, selected_day_label, selected_day_date,
        total_penalties_time, performance_time, total_time, submission_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalizedDisputeData.track_name || '',
        normalizedDisputeData.sticker_number || '',
        normalizedDisputeData.driver_name || '',
        normalizedDisputeData.codriver_name || '',
        normalizedDisputeData.category || '',
        normalizedDisputeData.selected_day_id || normalizedDisputeData.selectedDayId || '',
        normalizedDisputeData.selected_day_label || normalizedDisputeData.selectedDayLabel || '',
        normalizedDisputeData.selected_day_date || normalizedDisputeData.selectedDayDate || '',
        normalizedDisputeData.total_penalties_time || 0,
        normalizedDisputeData.performance_time || null,
        normalizedDisputeData.total_time || null,
        normalizedDisputeData.submission_json || null,
      ]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error saving dispute:', error);
    throw error;
  }
};

export const getAllDisputes = async () => {
  try {
    const database = await getDatabase();
    return await database.getAllAsync('SELECT * FROM disputes ORDER BY updated_at DESC, id DESC');
  } catch (error) {
    console.error('Error fetching disputes:', error);
    return [];
  }
};

export const deleteDisputeById = async id => {
  try {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM disputes WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('Error deleting dispute:', error);
    throw error;
  }
};

export const deleteResultById = async id => {
  try {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM results WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('Error deleting result:', error);
    throw error;
  }
};

export const clearAllResults = async () => {
  try {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM results');
    return true;
  } catch (error) {
    console.error('Error clearing results:', error);
    throw error;
  }
};

export const getRegistrationsByCategory = async category => {
  try {
    const database = await getDatabase();
    return await database.getAllAsync(
      'SELECT * FROM registrations WHERE category = ? ORDER BY id DESC',
      [category]
    );
  } catch (error) {
    console.error('Error fetching registrations by category:', error);
    return [];
  }
};
