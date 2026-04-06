# Quick Database Reference Guide

## 🚀 Quick Start

### 1. Import the Service
```javascript
import { TeamsService, PlayersService, CategoriesService, RegistrationsService } 
  from './src/services/dataService';
```

### 2. Use the Service
```javascript
// Get all teams (works offline!)
const teams = await TeamsService.getAllTeams();

// Get players
const players = await PlayersService.getAllPlayers();

// Get categories
const categories = await CategoriesService.getAllCategories();
```

---

## 📊 Teams Operations

### Get All Teams
```javascript
const teams = await TeamsService.getAllTeams();
// Returns: Array of all teams
// Console: "🌐 Teams fetched from API" or "💾 Teams fetched from local database"
```

### Get Team by ID
```javascript
const team = await TeamsService.getTeamById(1);
// Returns: Single team object or null
```

### Get Teams by Category
```javascript
const extremeTeams = await TeamsService.getTeamsByCategory('EXTREME');
const tharTeams = await TeamsService.getTeamsByCategory('THAR_SUV');
// Returns: Array of teams in that category
```

### Add New Team
```javascript
const teamId = await TeamsService.addTeam({
  team_name: 'My Team',
  driver_name: 'John Doe',
  driver_blood_group: 'O+ve',
  codriver_name: 'Jane Doe',
  codriver_blood_group: 'B+ve',
  car_number: '25',
  category: 'EXTREME',
  vehicle_name: 'Thar',
  vehicle_model: 'Custom',
  socials: 'Instagram: @myteam',
  status: 'CONFIRMED'
});
// Returns: Team ID (number)
// Saves locally immediately, syncs to API when online
```

### Update Team
```javascript
await TeamsService.updateTeam(1, {
  status: 'CONFIRMED',
  socials: 'Updated Instagram: @newhandle'
});
// Returns: true/false
```

### Delete Team
```javascript
await TeamsService.deleteTeam(1);
// Returns: true/false
```

---

## 👥 Players Operations

### Get All Players
```javascript
const players = await PlayersService.getAllPlayers();
// Returns: Array of all players
```

### Get Players by Team
```javascript
const teamPlayers = await PlayersService.getPlayersByTeam('Team Xtreme');
// Returns: Array of players in that team
```

---

## 🏆 Categories Operations

### Get All Categories
```javascript
const categories = await CategoriesService.getAllCategories();
// Returns: Array of categories with icon, color, description
```

---

## 📝 Registrations Operations

### Add Registration
```javascript
const registrationId = await RegistrationsService.addRegistration({
  track_name: 'Rajgad',
  sticker_number: '15',
  driver_name: 'Rohan Jadhav',
  codriver_name: 'Pallavi Jadhav',
  category: 'THAR_SUV',
  bunting_count: 0,
  seatbelt_count: 1,
  ground_touch_count: 0,
  late_start_count: 0,
  attempt_count: 1,
  task_skipped_count: 0,
  wrong_course_count: 0,
  fourth_attempt_count: 0,
  total_penalties_time: 60,
  performance_time: '02:45:00',
  total_time: '03:45:00'
});
// Returns: Registration ID (number)
```

### Get All Registrations
```javascript
const registrations = await RegistrationsService.getAllRegistrations();
// Returns: Array of all registrations (newest first)
```

---

## 🌍 Offline Features

### Works Without Internet
```javascript
// When offline, this automatically uses local database
const teams = await TeamsService.getAllTeams();
// ✅ Works perfectly offline!
```

### Automatic Sync
```javascript
// When you add data offline
const teamId = await TeamsService.addTeam(teamData);
// 1. Saves to local DB ✅
// 2. Shows success to user ✅
// 3. Later syncs to API when online ✅
```

### Console Logging
```
🌐 = Fetched from API (online)
💾 = Fetched from local database (offline)
⚠️  = API unavailable, using fallback
❌ = Error occurred
✅ = Success
```

---

## 📱 In React Components

### Fetch Teams on Mount
```javascript
import { useEffect, useState } from 'react';
import { TeamsService } from './src/services/dataService';

export function TeamsList() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const teamsData = await TeamsService.getAllTeams();
        setTeams(teamsData);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, []);

  if (loading) return <Text>Loading...</Text>;
  
  return (
    <FlatList
      data={teams}
      renderItem={({ item }) => <Text>{item.team_name}</Text>}
      keyExtractor={(item) => item.id.toString()}
    />
  );
}
```

### Add Team Form
```javascript
import { TeamsService } from './src/services/dataService';

async function handleSubmit(formData) {
  try {
    const teamId = await TeamsService.addTeam(formData);
    Alert.alert('Success', `Team added! ID: ${teamId}`);
  } catch (error) {
    Alert.alert('Error', error.message);
  }
}
```

---

## 🔄 Online/Offline Flow

### What Happens When API is Unavailable
```
User Action → Check API (3 sec timeout)
             ↓
          API Down? 
             ↓
          YES → Use Local DB (works offline!)
          NO  → Fetch from API
             ↓
          Display data to user
```

### Syncing Strategy
```
User submits form (offline)
  ↓
Save to local DB ✅ (immediate)
  ↓
Show success ✅ (user sees result)
  ↓
Later when online:
  ↓
Sync to API (background)
  ↓
Mark as synced
```

---

## ⚡ Performance Tips

### 1. Cache Data
```javascript
// Instead of fetching every time
const [teams, setTeams] = useState([]);
const [cached, setCached] = useState(false);

useEffect(() => {
  if (!cached) {
    const loadTeams = async () => {
      const data = await TeamsService.getAllTeams();
      setTeams(data);
      setCached(true);
    };
    loadTeams();
  }
}, [cached]);
```

### 2. Filter Locally
```javascript
// Good: Fetch once, filter in memory
const teams = await TeamsService.getAllTeams();
const filtered = teams.filter(t => t.category === 'EXTREME');

// Avoid: Fetching for each filter
for (const team of teamList) {
  const t = await TeamsService.getTeamById(team.id); // Bad!
}
```

### 3. Batch Operations
```javascript
// Good: Fetch once
const allTeams = await TeamsService.getAllTeams();
const teamsByCategory = allTeams.reduce((acc, team) => {
  if (!acc[team.category]) acc[team.category] = [];
  acc[team.category].push(team);
  return acc;
}, {});

// Then use the grouped data
```

---

## 🐛 Debugging

### Check Console Logs
```javascript
// Enable detailed logging
TeamsService.getAllTeams(); // Check console for 🌐 or 💾
```

### Verify Data Exists
```javascript
const teams = await TeamsService.getAllTeams();
console.log('Teams count:', teams.length); // Should be 10+
console.log('First team:', teams[0]); // Check structure
```

### Test Offline Mode
```
1. Enable Airplane Mode
2. Use app
3. Should work with local DB
4. Check console: Should see "💾 Teams fetched from local database"
```

---

## 📋 Common Use Cases

### 1. Display Teams List
```javascript
const teams = await TeamsService.getAllTeams();
teams.forEach(team => {
  console.log(`${team.team_name} - ${team.driver_name}`);
});
```

### 2. Filter by Category
```javascript
const extremeTeams = await TeamsService.getTeamsByCategory('EXTREME');
console.log(`${extremeTeams.length} teams in Extreme category`);
```

### 3. Get Team Details
```javascript
const team = await TeamsService.getTeamById(1);
console.log(`Team: ${team.team_name}`);
console.log(`Driver: ${team.driver_name}`);
console.log(`Vehicle: ${team.vehicle_name} ${team.vehicle_model}`);
```

### 4. Register for Event
```javascript
const regId = await RegistrationsService.addRegistration({
  track_name: 'Rajgad',
  sticker_number: teamData.car_number,
  driver_name: teamData.driver_name,
  codriver_name: teamData.codriver_name,
  category: teamData.category,
  bunting_count: penalties.bunting,
  seatbelt_count: penalties.seatbelt,
  // ... other penalty counts
  total_time: calculatedTime
});
```

### 5. Get Event History
```javascript
const registrations = await RegistrationsService.getAllRegistrations();
registrations.forEach(reg => {
  console.log(`${reg.driver_name} - ${reg.category} - ${reg.total_time}`);
});
```

---

## 🔒 Data Types

### Team Object
```javascript
{
  id: 1,
  team_name: "Team Xtreme",
  driver_name: "Rohan Jadhav",
  driver_blood_group: "O+ve",
  codriver_name: "Pallavi Jadhav",
  codriver_blood_group: "B+ve",
  car_number: "15",
  category: "THAR_SUV",
  vehicle_name: "Mahindra",
  vehicle_model: "Thar",
  socials: "Instagram: @teamxtreme",
  status: "CONFIRMED",
  created_at: "2026-04-05...",
  updated_at: "2026-04-05..."
}
```

### Player Object
```javascript
{
  id: 1,
  name: "Rohan Jadhav",
  role: "driver",
  team: "Team Xtreme",
  blood_group: "O+ve",
  contact: "9876543210",
  created_at: "...",
  updated_at: "..."
}
```

### Category Object
```javascript
{
  id: 1,
  name: "Extreme",
  description: "Ultimate performance",
  icon: "⚡",
  color: "#ff4757",
  created_at: "..."
}
```

### Registration Object
```javascript
{
  id: 1,
  track_name: "Rajgad",
  sticker_number: "15",
  driver_name: "Rohan Jadhav",
  codriver_name: "Pallavi Jadhav",
  category: "THAR_SUV",
  bunting_count: 0,
  seatbelt_count: 1,
  ground_touch_count: 0,
  late_start_count: 0,
  attempt_count: 1,
  task_skipped_count: 0,
  wrong_course_count: 0,
  fourth_attempt_count: 0,
  total_penalties_time: 60,
  performance_time: "02:45:00",
  total_time: "03:45:00",
  created_at: "..."
}
```

---

## ✅ Checklist for Using Database

- [ ] Install expo-sqlite: `npm install expo-sqlite`
- [ ] App.js initialized database on startup
- [ ] Dummy data auto-seeded (10 teams, 10 players, 10 categories)
- [ ] Import TeamsService in your component
- [ ] Call TeamsService.getAllTeams() in useEffect
- [ ] Handle loading and error states
- [ ] Test offline mode (airplane mode)
- [ ] Check console for 🌐 or 💾 logs
- [ ] Add to FlatList or display component
- [ ] Deploy and monitor syncing

---

## 📞 Need Help?

1. Check `DATABASE_SETUP.md` for full documentation
2. Monitor console logs (🌐 🔌 ❌ ✅)
3. Enable airplane mode to test offline
4. Verify dummy data loaded (should be 10 teams)
5. Check error messages in console

---

**Database is ready! Start using it in your components!** 🚀
