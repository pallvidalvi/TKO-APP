# 🎉 Getting Started - Complete Setup Guide

Welcome! This guide will walk you through everything needed to run and build your React Native Expo app.

---

## ✨ What You're Getting

A production-ready React Native app featuring:
- 📱 Beautiful home screen with 3 vehicle category cards
- ✨ Smooth animations on card press
- 📱 Responsive design for all screen sizes
- ⚡ Optimized performance with FlatList
- 🎯 Clean, modern UI with professional styling
- 📦 Ready to build APK for Android devices

---

## 🚀 5-Minute Quick Start

### Step 1: Install Dependencies (2 min)
```bash
npm install
```

### Step 2: Start Development Server (1 min)
```bash
npm start
```

### Step 3: Choose Your Platform (2 min)
- **Android Emulator**: Press `a`
- **Web Browser**: Press `w`  
- **Physical Device**: Scan QR code with Expo Go app

**Done!** 🎉 Your app is running!

---

## 📋 Prerequisites Check

Before starting, ensure you have:

✅ **Node.js** (v18+)
```bash
node --version  # Should show v18.0.0 or higher
```

✅ **npm** (v9+)
```bash
npm --version   # Should show v9.0.0 or higher
```

✅ **Expo CLI** (Optional, but recommended)
```bash
npm install -g expo-cli  # Install globally
```

✅ **Android Emulator** OR **Expo Go App** on physical phone
- Android Studio Emulator (recommended for development)
- OR: Install "Expo Go" from Google Play Store

❓ **Not sure if everything is installed?**
```bash
bash setup-check.sh  # Run environment verification
```

---

## 🏗️ Project Setup Details

### What Gets Installed?

When you run `npm install`, these packages are installed:

```
expo ~50.0.0           # Build tool and APIs
react 18.2.0           # UI framework  
react-native 0.73.0    # Mobile framework
expo-status-bar        # Status bar management
```

**Total size**: ~800 MB (mostly node_modules)
**Time**: 2-5 minutes depending on internet speed

### Files You Get

```
TKO APP/
├── App.js                    ← Main app code (280 lines)
├── app.json                  ← App configuration
├── eas.json                  ← Build configuration for APK
├── package.json              ← Dependencies list
├── babel.config.js           ← Code compilation config
│
├── README.md                 ← Full documentation (400+ lines)
├── QUICKSTART.md             ← Quick reference
├── BUILD_GUIDE.md            ← APK building guide
├── COMMANDS.md               ← All commands reference
├── ARCHITECTURE.md           ← Code architecture explanation
├── GETTING_STARTED.md        ← This file
│
├── setup-check.sh            ← Environment verification script
│
└── node_modules/             ← Installed packages (created after npm install)
```

---

## 🎮 Running the App

### Option A: Android Emulator (Easiest)

**Prerequisite**: Android Studio with emulator installed

```bash
npm run android
```

This will:
1. Start the development server
2. Open the Android emulator automatically
3. Install and run your app
4. Show your app in the emulator

**Time**: 30 seconds - 2 minutes (first run slower)

### Option B: Physical Android Phone

**Prerequisite**: "Expo Go" app installed from Play Store

```bash
npm start
```

Then:
1. Look for QR code in terminal
2. Open "Expo Go" app on your phone
3. Tap "Scan QR code"
4. Point phone camera at the QR code
5. App loads on your phone

**Time**: 10-15 seconds

### Option C: Web Browser

**Prerequisite**: None (uses local web runtime)

```bash
npm run web
```

Opens the app at `http://localhost:19006`

**Note**: Not all mobile features work in web version

### Option D: Manual Control

```bash
npm start
```

Then in the terminal, press:
- `a` - Android emulator
- `i` - iOS simulator (macOS only)
- `w` - Web browser
- `r` - Reload app
- `m` - Toggle Android menu
- `j` - Open debugger
- `q` - Quit

---

## 🛑 Troubleshooting First Run

### Problem: "Command not found: npm"
**Solution**: Install Node.js from https://nodejs.org

### Problem: "Port 8081 already in use"
**Solution**:
```bash
expo start -p 8082  # Use different port
```

### Problem: Emulator not opening
**Solution**: Start emulator manually
```bash
emulator -list-avds          # List available emulators
emulator -avd Pixel_4_API_30 # Start specific emulator
npm run android              # Then run your app
```

### Problem: Dependencies installation fails
**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Problem: "Cannot find module 'react'"
**Solution**: Re-install dependencies
```bash
npm install
```

### Problem: Nothing happens when pressing 'a'
**Solution**: Make sure emulator is fully loaded, then try:
```bash
expo start --clear   # Clear cache and try again
```

---

## 📝 Development Workflow

### Normal Development Loop

```
1. Make code changes in App.js
   ↓
2. Save file (Ctrl+S or Cmd+S)
   ↓
3. App auto-reloads (in 1-2 seconds)
   ↓
4. See changes on screen
   ↓
5. Repeat!
```

**Hot Reload**: App reloads without losing state
**Full Reload**: Press `r` in terminal to reload all

### Making Your First Change

Let's change the title text:

1. Open `App.js` in your code editor
2. Find the line: `<Text style={styles.headerTitle}>Vehicle Categories</Text>`
3. Change to: `<Text style={styles.headerTitle}>My Vehicles</Text>`
4. Save the file
5. Watch the app update instantly!

---

## 🎨 Customizing the App

### Change Colors

Edit `App.js`, find the `styles` section:

```javascript
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',  // ← Change this
  },
  card: {
    backgroundColor: '#ffffff',  // ← Or this
  },
  // ... more styles
});
```

### Add More Categories

Find the `categories` array in the `App` function:

```javascript
const categories = [
  {
    id: '1',
    name: 'Diesel',
    description: 'Efficient fuel option',
    icon: '⛽',
  },
  // Add a new category here
  {
    id: '4',
    name: 'Electric',
    description: 'Eco-friendly',
    icon: '⚡',
  },
];
```

### Change Styling

Look for any style constant and modify it:

```javascript
const styles = StyleSheet.create({
  headerTitle: {
    fontSize: 28,        // ← Change this
    fontWeight: '700',   // ← Or this
    color: '#212529',    // ← Or this
  },
});
```

---

## 📦 Building APK (Production)

When you're ready to distribute, build an APK:

### Quick Build (Easiest - 3 minutes)

```bash
# Step 1: Login to Expo (one-time)
expo login
# Enter your credentials (create free account if needed at https://expo.dev)

# Step 2: Initialize project (one-time)
eas init
# This generates a project ID

# Step 3: Build
eas build --platform android
# Choose "apk" when prompted
# Wait 10-15 minutes

# Step 4: Download
# Copy the download link from terminal output
# Paste in browser to download APK
```

**That's it!** You now have an APK to install on any Android phone.

### Install APK on Device

#### Method 1: USB Cable (Easiest)
```bash
adb install path/to/app.apk
```

#### Method 2: Email/Share
1. Download APK to computer
2. Email yourself the file
3. Open email on phone
4. Tap APK to install

#### Method 3: Cloud Storage
1. Upload APK to Google Drive/Dropbox
2. Share link with phone
3. Download and install

### Detailed Build Guide

For more details, see **BUILD_GUIDE.md** in the project folder.

---

## 📚 Documentation Files

This project includes comprehensive documentation:

| File | Purpose | Read Time |
|------|---------|-----------|
| **README.md** | Full project documentation | 15 min |
| **QUICKSTART.md** | Quick reference guide | 3 min |
| **BUILD_GUIDE.md** | Complete APK building guide | 10 min |
| **COMMANDS.md** | All commands reference | 5 min |
| **ARCHITECTURE.md** | Code structure explanation | 10 min |
| **GETTING_STARTED.md** | This file | 5 min |

---

## 🔧 Common Tasks

### Task: Run on Different Port
```bash
expo start -p 8082
```

### Task: Clear Cache
```bash
expo start --clear
```

### Task: Check Dependencies
```bash
npm list
```

### Task: Update Packages
```bash
npm update
```

### Task: Check for Vulnerabilities
```bash
npm audit
```

### Task: See Project Info
```bash
cat app.json
```

### Task: View Build Config
```bash
cat eas.json
```

---

## 🎯 Next Steps

After running the app successfully:

### 1. Explore the Code ⭐
- Open `App.js`
- Read the comments
- Understand the structure
- See **ARCHITECTURE.md** for detailed explanation

### 2. Make Changes 🎨
- Customize colors and text
- Add more categories
- Change animations
- See **Customizing the App** section above

### 3. Build for Android 📱
- Build an APK following instructions in BUILD_GUIDE.md
- Test on real Android device
- Share with friends!

### 4. Add Features 🚀
- See **Future Enhancement Ideas** in README.md
- Add navigation
- Connect to APIs
- Add user authentication

### 5. Deploy to Play Store 🌍
- Create Play Store Developer account ($25)
- Upload your APK
- Make it available worldwide!

---

## 💡 Tips & Tricks

### Tip 1: Use Expo Go for Quick Testing
Instead of emulator, install "Expo Go" app on phone. Much faster!

### Tip 2: Keep Development Server Running
Keep `npm start` running while developing. Just save files, they auto-reload!

### Tip 3: Use Chrome DevTools
Press `j` while app is running to open Chrome DevTools for debugging.

### Tip 4: Test on Real Device
Emulator is good, but test on real device before release (different performance characteristics).

### Tip 5: Keep Dependencies Updated
```bash
npm outdated  # See outdated packages
npm update    # Update minor/patch versions
```

---

## 🐛 Need Help?

### Check These Resources First
1. See **COMMANDS.md** for command reference
2. See **BUILD_GUIDE.md** for build issues
3. Check terminal output for error messages
4. Run `setup-check.sh` to verify environment

### Still Stuck?

1. **Expo Documentation**: https://docs.expo.dev
2. **React Native Docs**: https://reactnative.dev
3. **Expo Forums**: https://forums.expo.dev
4. **Stack Overflow**: Tag with `expo` and `react-native`

---

## 📊 System Requirements

### Minimum

- macOS 10.13+ / Windows 10+ / Linux
- Node.js 18+
- 2GB RAM
- 5GB free disk space

### Recommended

- macOS 12+ / Windows 11 / Ubuntu 20+
- Node.js 20+
- 8GB RAM
- 20GB free disk space (for Android SDK)

### For Android Testing

- Android Studio + Emulator (easiest)
- OR: Physical Android 5.0+ phone
- OR: Expo Go app on phone (easiest!)

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] `npm install` completed without errors
- [ ] `npm start` runs without errors
- [ ] App opens on emulator/phone/web
- [ ] Cards are visible with proper styling
- [ ] Tapping card produces animation
- [ ] App reloads when you save code changes

---

## 🎓 Learning Resources

### React Native Basics
- [React Native Getting Started](https://reactnative.dev/docs/getting-started)
- [React Hooks Guide](https://react.dev/reference/react/hooks)
- [StyleSheet Documentation](https://reactnative.dev/docs/stylesheet)

### Expo Specific
- [Expo Documentation](https://docs.expo.dev)
- [Expo CLI Reference](https://docs.expo.dev/more/expo-cli/)
- [EAS Build Guide](https://docs.expo.dev/build/setup/)

### Advanced Topics
- [FlatList Optimization](https://reactnative.dev/docs/optimizing-flatlist-configuration)
- [Animated API](https://reactnative.dev/docs/animated)
- [React Navigation](https://reactnavigation.org/)

---

## 🎉 You're Ready!

You now have everything you need to:
- ✅ Run the app on Android/web/phone
- ✅ Understand the code structure
- ✅ Customize the app
- ✅ Build APK for distribution
- ✅ Continue learning and building

### Start Now

```bash
npm install
npm start
```

Press `a` for Android, `w` for web, or scan QR code with Expo Go!

---

## 📞 Quick Reference

```bash
npm install              # Install dependencies (one-time)
npm start                # Start development server
npm run android          # Run on Android emulator
npm run web             # Run in web browser

eas build --platform android  # Build APK
eas login               # Login to Expo
expo --version          # Check version
```

---

**Happy coding! 🚀**

Questions? See README.md for full documentation.
