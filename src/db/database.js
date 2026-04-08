import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';
let SQLite = null;

if (!isWeb) {
  SQLite = require('expo-sqlite');
}

const DB_NAME = 'tko_app.db';

const SEEDED_TEAMS = [
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
  `);
};

export const initializeDatabase = async () => {
  try {
    if (isWeb) {
      return true;
    }

    const database = await getDatabase();
    await initializeSchema(database);
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

    await database.withTransactionAsync(async () => {
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
    const database = await getDatabase();
    const existingResult = await database.getFirstAsync(
      `SELECT id FROM results
       WHERE LOWER(TRIM(category)) = LOWER(TRIM(?))
         AND LOWER(TRIM(track_name)) = LOWER(TRIM(?))
         AND LOWER(TRIM(sticker_number)) = LOWER(TRIM(?))
       LIMIT 1`,
      [
        resultData.category || '',
        resultData.track_name || '',
        resultData.sticker_number || '',
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
        is_dns, total_penalties_time, performance_time, total_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resultData.track_name,
        resultData.sticker_number,
        resultData.driver_name,
        resultData.codriver_name,
        resultData.category,
        resultData.bunting_count || 0,
        resultData.seatbelt_count || 0,
        resultData.ground_touch_count || 0,
        resultData.late_start_count || 0,
        resultData.attempt_count || 0,
        resultData.task_skipped_count || 0,
        resultData.wrong_course_count || 0,
        resultData.fourth_attempt_count || 0,
        resultData.is_dns ? 1 : 0,
        resultData.total_penalties_time || 0,
        resultData.performance_time || null,
        resultData.total_time || null,
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
