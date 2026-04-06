import * as SQLite from 'expo-sqlite';

// Create or open the database (old API - compatible with expo-sqlite 16)
let db = null;

const getDatabase = () => {
  if (!db) {
    db = SQLite.openDatabase('tko_app.db');
  }
  return db;
};

/**
 * Execute SQL with Promise wrapper for old expo-sqlite API
 */
const executeSql = (database, sql, params = []) => {
  return new Promise((resolve, reject) => {
    database.transaction((tx) => {
      tx.executeSql(
        sql,
        params,
        (_, result) => resolve(result),
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Execute multiple SQL statements
 */
const executeSqlBatch = (database, sqls) => {
  return new Promise((resolve, reject) => {
    database.transaction((tx) => {
      sqls.forEach((sql) => {
        tx.executeSql(sql);
      });
      resolve();
    }, reject);
  });
};

/**
 * Initialize Database
 * Creates all tables if they don't exist
 */
export const initializeDatabase = async () => {
  try {
    const database = getDatabase();

    const createTablesSql = [
      `CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY NOT NULL,
        team_name TEXT NOT NULL,
        driver_name TEXT NOT NULL,
        driver_blood_group TEXT,
        codriver_name TEXT NOT NULL,
        codriver_blood_group TEXT,
        car_number TEXT NOT NULL,
        category TEXT NOT NULL,
        vehicle_name TEXT NOT NULL,
        vehicle_model TEXT NOT NULL,
        socials TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      
      `CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        role TEXT,
        team TEXT,
        blood_group TEXT,
        contact TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        color TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      
      `CREATE TABLE IF NOT EXISTS registrations (
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
      );`,
    ];

    await executeSqlBatch(database, createTablesSql);
    console.log('✅ Database initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
};

/**
 * Seed Database with Dummy Data
 */
export const seedDatabase = async () => {
  try {
    const database = getDatabase();

    // Check if teams table already has data
    const result = await executeSql(database, 'SELECT COUNT(*) as count FROM teams');
    
    if (result.rows.length > 0 && result.rows._array[0].count > 0) {
      console.log('⚠️  Database already has teams data, skipping seed');
      return;
    }

    // Insert dummy teams
    const teams = [
      {
        team_name: 'Team Xtreme',
        driver_name: 'Rohan Jadhav',
        driver_blood_group: 'O+ve',
        codriver_name: 'Pallavi Jadhav',
        codriver_blood_group: 'B+ve',
        car_number: '15',
        category: 'THAR_SUV',
        vehicle_name: 'Mahindra',
        vehicle_model: 'Thar',
        socials: 'Instagram: @teamxtreme',
        status: 'CONFIRMED',
      },
      {
        team_name: 'Thunder Racing',
        driver_name: 'Amit Singh',
        driver_blood_group: 'A+ve',
        codriver_name: 'Priya Singh',
        codriver_blood_group: 'AB+ve',
        car_number: '8',
        category: 'EXTREME',
        vehicle_name: 'Modified Thar',
        vehicle_model: 'Custom',
        socials: 'Instagram: @thunderracing',
        status: 'CONFIRMED',
      },
      {
        team_name: 'Diesel Kings',
        driver_name: 'Vikram Sharma',
        driver_blood_group: 'B+ve',
        codriver_name: 'Deepika Sharma',
        codriver_blood_group: 'O+ve',
        car_number: '12',
        category: 'DIESEL_MODIFIED',
        vehicle_name: 'Tata i20',
        vehicle_model: 'Modified',
        socials: 'Instagram: @dieselkings',
        status: 'CONFIRMED',
      },
      {
        team_name: 'Petrol Mavericks',
        driver_name: 'Arjun Patel',
        driver_blood_group: 'AB+ve',
        codriver_name: 'Anjali Patel',
        codriver_blood_group: 'A+ve',
        car_number: '22',
        category: 'PETROL_MODIFIED',
        vehicle_name: 'Mahindra',
        vehicle_model: 'XUV',
        socials: 'Instagram: @petrolfamily',
        status: 'CONFIRMED',
      },
      {
        team_name: 'Expert Zone',
        driver_name: 'Rajesh Nair',
        driver_blood_group: 'O-ve',
        codriver_name: 'Sneha Nair',
        codriver_blood_group: 'B-ve',
        car_number: '18',
        category: 'DIESEL_EXPERT',
        vehicle_name: 'Mahindra',
        vehicle_model: 'Bolero',
        socials: 'Instagram: @expertzone',
        status: 'CONFIRMED',
      },
      {
        team_name: 'Power Players',
        driver_name: 'Sanjay Verma',
        driver_blood_group: 'A+ve',
        codriver_name: 'Isha Verma',
        codriver_blood_group: 'O+ve',
        car_number: '9',
        category: 'PETROL_EXPERT',
        vehicle_name: 'Tata',
        vehicle_model: 'Safari',
        socials: 'Instagram: @powerplayers',
        status: 'CONFIRMED',
      },
      {
        team_name: 'Jimny Legends',
        driver_name: 'Nikhil Gupta',
        driver_blood_group: 'B+ve',
        codriver_name: 'Kavya Gupta',
        codriver_blood_group: 'AB+ve',
        car_number: '21',
        category: 'JIMNY_SUV',
        vehicle_name: 'Maruti',
        vehicle_model: 'Jimny',
        socials: 'Instagram: @jimnylegends',
        status: 'CONFIRMED',
      },
      {
        team_name: 'SUV Warriors',
        driver_name: 'Harjit Singh',
        driver_blood_group: 'O+ve',
        codriver_name: 'Simran Singh',
        codriver_blood_group: 'B+ve',
        car_number: '14',
        category: 'SUV_MODIFIED',
        vehicle_name: 'Ford',
        vehicle_model: 'EcoSport',
        socials: 'Instagram: @suvwarriors',
        status: 'CONFIRMED',
      },
      {
        team_name: 'Off-Road Elite',
        driver_name: 'Aditya Sharma',
        driver_blood_group: 'AB+ve',
        codriver_name: 'Neha Sharma',
        codriver_blood_group: 'O+ve',
        car_number: '11',
        category: 'STOCK_NDMS',
        vehicle_name: 'Mahindra',
        vehicle_model: 'Thar',
        socials: 'Instagram: @offroadselite',
        status: 'CONFIRMED',
      },
      {
        team_name: 'Ladies First',
        driver_name: 'Priya Desai',
        driver_blood_group: 'A+ve',
        codriver_name: 'Anaya Desai',
        codriver_blood_group: 'B+ve',
        car_number: '25',
        category: 'LADIES_CATEGORY',
        vehicle_name: 'Mahindra',
        vehicle_model: 'Thar',
        socials: 'Instagram: @ladiesfirst',
        status: 'CONFIRMED',
      },
    ];

    // Insert teams
    for (const team of teams) {
      await executeSql(
        database,
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

    // Insert dummy players
    const players = [
      { name: 'Rohan Jadhav', role: 'Driver', team: 'Team Xtreme', blood_group: 'O+ve', contact: '9876543210' },
      { name: 'Pallavi Jadhav', role: 'Co-driver', team: 'Team Xtreme', blood_group: 'B+ve', contact: '9876543211' },
      { name: 'Amit Singh', role: 'Driver', team: 'Thunder Racing', blood_group: 'A+ve', contact: '9876543212' },
      { name: 'Priya Singh', role: 'Co-driver', team: 'Thunder Racing', blood_group: 'AB+ve', contact: '9876543213' },
      { name: 'Vikram Sharma', role: 'Driver', team: 'Diesel Kings', blood_group: 'B+ve', contact: '9876543214' },
      { name: 'Deepika Sharma', role: 'Co-driver', team: 'Diesel Kings', blood_group: 'O+ve', contact: '9876543215' },
      { name: 'Arjun Patel', role: 'Driver', team: 'Petrol Mavericks', blood_group: 'AB+ve', contact: '9876543216' },
      { name: 'Anjali Patel', role: 'Co-driver', team: 'Petrol Mavericks', blood_group: 'A+ve', contact: '9876543217' },
      { name: 'Rajesh Nair', role: 'Driver', team: 'Expert Zone', blood_group: 'O-ve', contact: '9876543218' },
      { name: 'Sneha Nair', role: 'Co-driver', team: 'Expert Zone', blood_group: 'B-ve', contact: '9876543219' },
    ];

    for (const player of players) {
      await executeSql(
        database,
        'INSERT INTO players (name, role, team, blood_group, contact) VALUES (?, ?, ?, ?, ?)',
        [player.name, player.role, player.team, player.blood_group, player.contact]
      );
    }

    // Insert dummy categories
    const categories = [
      { name: 'Extreme', description: 'Ultimate performance', icon: '⚡', color: '#ff4757' },
      { name: 'Diesel Modified', description: 'Diesel vehicles modified', icon: '🚨', color: '#ff6348' },
      { name: 'Petrol Modified', description: 'Petrol vehicles modified', icon: '🔥', color: '#ffa502' },
      { name: 'Diesel Expert', description: 'Expert diesel drivers', icon: '🛠️', color: '#2ed573' },
      { name: 'Petrol Expert', description: 'Expert petrol drivers', icon: '⚙️', color: '#1e90ff' },
      { name: 'Thar SUV', description: 'Mahindra Thar SUV category', icon: '🏔️', color: '#9b59b6' },
      { name: 'Jimny SUV', description: 'Maruti Jimny SUV category', icon: '🚗', color: '#34495e' },
      { name: 'SUV Modified', description: 'Modified SUVs', icon: '🚙', color: '#e74c3c' },
      { name: 'Stock NDMS', description: 'Stock vehicles NDMS', icon: '📋', color: '#3498db' },
      { name: 'Ladies Category', description: 'Women drivers category', icon: '👩', color: '#e91e63' },
    ];

    for (const category of categories) {
      await executeSql(
        database,
        'INSERT INTO categories (name, description, icon, color) VALUES (?, ?, ?, ?)',
        [category.name, category.description, category.icon, category.color]
      );
    }

    console.log('✅ Database seeded with dummy data');
  } catch (error) {
    console.error('❌ Database seeding error:', error);
    throw error;
  }
};

/**
 * Get all teams
 */
export const getAllTeams = async () => {
  try {
    const database = getDatabase();
    const result = await executeSql(database, 'SELECT * FROM teams');
    return result.rows._array || [];
  } catch (error) {
    console.error('❌ Error fetching teams:', error);
    return [];
  }
};

/**
 * Get team by ID
 */
export const getTeamById = async (id) => {
  try {
    const database = getDatabase();
    const result = await executeSql(database, 'SELECT * FROM teams WHERE id = ?', [id]);
    return result.rows._array[0] || null;
  } catch (error) {
    console.error('❌ Error fetching team:', error);
    return null;
  }
};

/**
 * Get teams by category
 */
export const getTeamsByCategory = async (category) => {
  try {
    const database = getDatabase();
    const result = await executeSql(database, 'SELECT * FROM teams WHERE category = ?', [category]);
    return result.rows._array || [];
  } catch (error) {
    console.error('❌ Error fetching teams by category:', error);
    return [];
  }
};

/**
 * Add a new team
 */
export const addTeam = async (team) => {
  try {
    const database = getDatabase();
    const result = await executeSql(
      database,
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
        team.status || 'PENDING',
      ]
    );
    return result.insertId;
  } catch (error) {
    console.error('❌ Error adding team:', error);
    throw error;
  }
};

/**
 * Update team
 */
export const updateTeam = async (id, updates) => {
  try {
    const database = getDatabase();
    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);

    await executeSql(
      database,
      `UPDATE teams SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    return true;
  } catch (error) {
    console.error('❌ Error updating team:', error);
    throw error;
  }
};

/**
 * Delete team
 */
export const deleteTeam = async (id) => {
  try {
    const database = getDatabase();
    await executeSql(database, 'DELETE FROM teams WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('❌ Error deleting team:', error);
    throw error;
  }
};

/**
 * Get all players
 */
export const getAllPlayers = async () => {
  try {
    const database = getDatabase();
    const result = await executeSql(database, 'SELECT * FROM players');
    return result.rows._array || [];
  } catch (error) {
    console.error('❌ Error fetching players:', error);
    return [];
  }
};

/**
 * Get players by team
 */
export const getPlayersByTeam = async (teamName) => {
  try {
    const database = getDatabase();
    const result = await executeSql(database, 'SELECT * FROM players WHERE team = ?', [teamName]);
    return result.rows._array || [];
  } catch (error) {
    console.error('❌ Error fetching players by team:', error);
    return [];
  }
};

/**
 * Get all categories
 */
export const getAllCategories = async () => {
  try {
    const database = getDatabase();
    const result = await executeSql(database, 'SELECT * FROM categories');
    return result.rows._array || [];
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    return [];
  }
};

/**
 * Add a new registration
 */
export const addRegistration = async (registration) => {
  try {
    const database = getDatabase();
    const result = await executeSql(
      database,
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
    return result.insertId;
  } catch (error) {
    console.error('❌ Error adding registration:', error);
    throw error;
  }
};

/**
 * Get all registrations
 */
export const getAllRegistrations = async () => {
  try {
    const database = getDatabase();
    const result = await executeSql(database, 'SELECT * FROM registrations');
    return result.rows._array || [];
  } catch (error) {
    console.error('❌ Error fetching registrations:', error);
    return [];
  }
};

/**
 * Get registrations by category
 */
export const getRegistrationsByCategory = async (category) => {
  try {
    const database = getDatabase();
    const result = await executeSql(database, 'SELECT * FROM registrations WHERE category = ?', [category]);
    return result.rows._array || [];
  } catch (error) {
    console.error('❌ Error fetching registrations by category:', error);
    return [];
  }
};
