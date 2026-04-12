const DRIVER_FIRST_NAMES = [
  'Rudra',
  'Aarav',
  'Vivaan',
  'Advait',
  'Kunal',
  'Samar',
  'Yash',
  'Pranav',
  'Neel',
  'Arjun',
];

const DRIVER_LAST_NAMES = [
  'Patil',
  'Jadhav',
  'Shinde',
  'Kale',
  'More',
  'Pawar',
  'Chavan',
  'Mane',
  'Kulkarni',
  'Khot',
];

const CODRIVER_FIRST_NAMES = [
  'Sakshi',
  'Pooja',
  'Naina',
  'Rutuja',
  'Ananya',
  'Tejaswini',
  'Komal',
  'Mugdha',
  'Nupur',
  'Vaidehi',
];

const CODRIVER_LAST_NAMES = [
  'Deshmukh',
  'Joshi',
  'Bhosale',
  'Naik',
  'Gaikwad',
  'Shelar',
  'Salunkhe',
  'Shirke',
  'Pathare',
  'Dalvi',
];

const DRIVER_BLOOD_GROUPS = ['A +ve', 'B +ve', 'O +ve', 'AB +ve', 'A -ve', 'B -ve', 'O -ve', 'AB -ve'];
const CODRIVER_BLOOD_GROUPS = ['O +ve', 'A +ve', 'B +ve', 'AB +ve', 'O -ve', 'A -ve', 'B -ve', 'AB -ve'];

const TEAM_SUFFIXES = [
  'Trail Squad',
  'Mud Masters',
  'Ridge Runners',
  'Torque Union',
  'Summit Crew',
  'Drift Force',
  'Stone Racers',
  'Dust Riders',
  'Peak Patrol',
  'Wild Lines',
];

const CATEGORY_TEAM_CONFIGS = [
  {
    category: 'EXTREME',
    teamPrefix: 'Extreme',
    stickerBase: 101,
    vehicleName: 'Mahindra',
    vehicleModel: 'Prototype X',
    socialHandle: 'extreme',
  },
  {
    category: 'DIESEL_MODIFIED',
    teamPrefix: 'Diesel Modified',
    stickerBase: 201,
    vehicleName: 'Toyota',
    vehicleModel: 'Fortuner Build',
    socialHandle: 'diesel_modified',
  },
  {
    category: 'PETROL_MODIFIED',
    teamPrefix: 'Petrol Modified',
    stickerBase: 301,
    vehicleName: 'Maruti Suzuki',
    vehicleModel: 'Gypsy Tune',
    socialHandle: 'petrol_modified',
  },
  {
    category: 'DIESEL_EXPERT',
    teamPrefix: 'Diesel Expert',
    stickerBase: 401,
    vehicleName: 'Mahindra',
    vehicleModel: 'Bolero Expert',
    socialHandle: 'diesel_expert',
  },
  {
    category: 'PETROL_EXPERT',
    teamPrefix: 'Petrol Expert',
    stickerBase: 501,
    vehicleName: 'Suzuki',
    vehicleModel: 'Gypsy Expert',
    socialHandle: 'petrol_expert',
  },
  {
    category: 'THAR_SUV',
    teamPrefix: 'Thar SUV',
    stickerBase: 601,
    vehicleName: 'Mahindra',
    vehicleModel: 'Thar Roxx',
    socialHandle: 'thar_suv',
  },
  {
    category: 'JIMNY_SUV',
    teamPrefix: 'Jimny SUV',
    stickerBase: 701,
    vehicleName: 'Maruti Suzuki',
    vehicleModel: 'Jimny Alpha',
    socialHandle: 'jimny_suv',
  },
  {
    category: 'SUV_MODIFIED',
    teamPrefix: 'SUV Modified',
    stickerBase: 801,
    vehicleName: 'Ford',
    vehicleModel: 'Endeavour Spec',
    socialHandle: 'suv_modified',
  },
  {
    category: 'STOCK_NDMS',
    teamPrefix: 'Stock NDMS',
    stickerBase: 901,
    vehicleName: 'Mahindra',
    vehicleModel: 'Scorpio N',
    socialHandle: 'stock_ndms',
  },
  {
    category: 'LADIES',
    teamPrefix: 'Ladies',
    stickerBase: 1001,
    vehicleName: 'Mahindra',
    vehicleModel: 'Thar Roxx',
    socialHandle: 'ladies',
  },
];

const buildUniqueName = (firstNames, lastNames, globalIndex) =>
  `${firstNames[globalIndex % firstNames.length]} ${lastNames[Math.floor(globalIndex / firstNames.length)]}`;

const buildSeededTeam = (config, categoryIndex, entryIndex) => {
  const globalIndex = categoryIndex * TEAM_SUFFIXES.length + entryIndex;
  const vehicleSerial = String(entryIndex + 1).padStart(2, '0');

  return {
    team_name: `${config.teamPrefix} ${TEAM_SUFFIXES[entryIndex]}`,
    driver_name: buildUniqueName(DRIVER_FIRST_NAMES, DRIVER_LAST_NAMES, globalIndex),
    driver_blood_group: DRIVER_BLOOD_GROUPS[globalIndex % DRIVER_BLOOD_GROUPS.length],
    codriver_name: buildUniqueName(CODRIVER_FIRST_NAMES, CODRIVER_LAST_NAMES, globalIndex),
    codriver_blood_group: CODRIVER_BLOOD_GROUPS[globalIndex % CODRIVER_BLOOD_GROUPS.length],
    car_number: String(config.stickerBase + entryIndex),
    category: config.category,
    vehicle_name: config.vehicleName,
    vehicle_model: `${config.vehicleModel} ${vehicleSerial}`,
    socials: `@${config.socialHandle}_${entryIndex + 1}`,
    status: 'SEEDED',
  };
};

export const SEEDED_TEAMS = CATEGORY_TEAM_CONFIGS.flatMap((config, categoryIndex) =>
  TEAM_SUFFIXES.map((_, entryIndex) => buildSeededTeam(config, categoryIndex, entryIndex))
);
