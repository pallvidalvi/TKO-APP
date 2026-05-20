const CATEGORY_TEAM_CONFIGS = [
  {
    category: 'EXTREME',
    label: 'Extreme',
    baseCarNumber: 101,
    vehicle_name: 'Mahindra',
    vehicle_model: 'Proto Extreme',
  },
  {
    category: 'DIESEL_MODIFIED',
    label: 'Diesel Modified',
    baseCarNumber: 201,
    vehicle_name: 'Toyota',
    vehicle_model: 'Fortuner Diesel Modified',
  },
  {
    category: 'PETROL_MODIFIED',
    label: 'Petrol Modified',
    baseCarNumber: 301,
    vehicle_name: 'Maruti Suzuki',
    vehicle_model: 'Gypsy Petrol Modified',
  },
  {
    category: 'DIESEL_EXPERT',
    label: 'Diesel Expert',
    baseCarNumber: 401,
    vehicle_name: 'Mahindra',
    vehicle_model: 'Bolero Diesel Expert',
  },
  {
    category: 'PETROL_EXPERT',
    label: 'Petrol Expert',
    baseCarNumber: 501,
    vehicle_name: 'Suzuki',
    vehicle_model: 'Jimny Petrol Expert',
  },
  {
    category: 'THAR_SUV',
    label: 'Thar SUV',
    baseCarNumber: 601,
    vehicle_name: 'Mahindra',
    vehicle_model: 'Thar 4x4',
  },
  {
    category: 'JIMNY_SUV',
    label: 'Jimny SUV',
    baseCarNumber: 701,
    vehicle_name: 'Maruti Suzuki',
    vehicle_model: 'Jimny Alpha',
  },
  {
    category: 'SUV_MODIFIED',
    label: 'SUV Modified',
    baseCarNumber: 801,
    vehicle_name: 'Ford',
    vehicle_model: 'Endeavour Modified',
  },
  {
    category: 'STOCK_NDMS',
    label: 'Stock NDMS',
    baseCarNumber: 901,
    vehicle_name: 'Mahindra',
    vehicle_model: 'Scorpio N Stock',
  },
  {
    category: 'LADIES_CATEGORY',
    label: 'Ladies Category',
    baseCarNumber: 1001,
    vehicle_name: 'Mahindra',
    vehicle_model: 'Thar Roxx',
  },
];

const TEAM_TEMPLATES = [
  ['Trail Blazers', 'Aarav Patil', 'Vivaan More', 'A+ve', 'O+ve'],
  ['Ridge Runners', 'Ishaan Jadhav', 'Reyansh Pawar', 'B+ve', 'A+ve'],
  ['Mud Masters', 'Arjun Shinde', 'Kabir Deshmukh', 'O+ve', 'B+ve'],
  ['Rock Crawlers', 'Aditya Kadam', 'Rohan Kulkarni', 'AB+ve', 'O+ve'],
  ['Valley Torque', 'Sahil Mane', 'Nikhil Chavan', 'A-ve', 'A+ve'],
  ['Hill Command', 'Omkar Bhosale', 'Pranav Ghorpade', 'B-ve', 'AB+ve'],
  ['Forest Line', 'Yash Salunkhe', 'Sanket Sawant', 'O-ve', 'B+ve'],
  ['Cliff Riders', 'Atharva Khot', 'Harshad Gaikwad', 'A+ve', 'O-ve'],
  ['Summit Drive', 'Rudra Nalawade', 'Tejas Patankar', 'B+ve', 'A-ve'],
  ['River Cross', 'Kunal Suryavanshi', 'Sameer Nikam', 'O+ve', 'B-ve'],
  ['Ghat Warriors', 'Prathamesh Kale', 'Abhay Dhere', 'AB-ve', 'A+ve'],
  ['Dune Patrol', 'Siddharth Pujari', 'Ninad Lokhande', 'A+ve', 'AB-ve'],
  ['Torque Tribe', 'Mihir Joshi', 'Tanishq Mahadik', 'B+ve', 'O+ve'],
  ['Axle Squad', 'Vedant Karmarkar', 'Saurabh Bendre', 'O+ve', 'A+ve'],
  ['Canyon Crew', 'Parth Sathe', 'Shreyas Inamdar', 'AB+ve', 'B+ve'],
];

const toSocialHandle = value => `@${value.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;

export const SEEDED_TEAMS = CATEGORY_TEAM_CONFIGS.flatMap(categoryConfig =>
  TEAM_TEMPLATES.map(([teamName, driverName, coDriverName, driverBloodGroup, coDriverBloodGroup], index) => {
    const sequence = String(index + 1).padStart(2, '0');
    const categoryLabel = categoryConfig.label;
    const fullTeamName = `${categoryLabel} ${teamName} ${sequence}`;

    return {
      team_name: fullTeamName,
      driver_name: driverName,
      driver_blood_group: driverBloodGroup,
      codriver_name: coDriverName,
      codriver_blood_group: coDriverBloodGroup,
      car_number: String(categoryConfig.baseCarNumber + index),
      category: categoryConfig.category,
      vehicle_name: categoryConfig.vehicle_name,
      vehicle_model: categoryConfig.vehicle_model,
      socials: toSocialHandle(fullTeamName),
      status: 'ACTIVE',
    };
  })
);
