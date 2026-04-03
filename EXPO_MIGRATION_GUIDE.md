# Expo Migration Guide - Complete Step-by-Step

## ✅ Pre-Migration Checklist
- [x] Backup project (Git commit current state)
- [ ] Note any custom native modules you've added
- [ ] Export current data/assets
- [ ] Test current build to document baseline

## 🔍 Current Project Analysis

### Dependencies Analysis
**✅ Already Expo Compatible:**
- expo ~54.0.0
- expo-file-system ^55.0.12
- expo-sharing ^55.0.14
- expo-status-bar ~3.0.0
- react-native-web ~0.21.0
- @expo/metro-runtime ~6.1.0

**⚠️ Problematic Items:**
- react-native ^0.72.0 (conflicts with Expo managed workflow)
- Custom android/ folder with Gradle files
- react-native gradle-plugin references

### Custom Code Assessment
**From App.js Analysis:**
- ✅ Uses only Expo-compatible APIs
- ✅ expo-file-system for file operations
- ✅ expo-sharing for sharing files
- ✅ No native modules detected
- ✅ Platform-aware code structure already implemented

---

## 🎯 Phase 1: Save Your Current Code

### Step 1.1: Commit Current State
```bash
cd c:\Users\1040162\TKO_APP\TKO-APP
git add .
git commit -m "Backup: Before Expo full migration"
```

### Step 1.2: Backup Files (Keep for reference)
```bash
# Create backup folder
mkdir backup
cp -r android backup/android-original
cp -r ios backup/ios-original
cp package.json backup/package.json.bak
cp app.json backup/app.json.bak
```

---

## 🔄 Phase 2: Remove Conflicting Files

### Step 2.1: Remove Android Gradle Folder
Since Expo will regenerate this via `expo prebuild`, removing the old one is safe:

```bash
# Navigate to project root
cd c:\Users\1040162\TKO_APP\TKO-APP

# Remove the custom android folder (Expo will regenerate it)
rm -r android -Force
rm -r .gradle -Force -ErrorAction SilentlyContinue
rm -r android.iml -Force -ErrorAction SilentlyContinue
```

### Step 2.2: Remove iOS Folder (Optional)
```bash
# Only if you're not developing for iOS
rm -r ios -Force
```

### Step 2.3: Clear Cache & Node Modules
```bash
# Clear Expo/Gradle cache
rm -r node_modules -Force
rm -r .gradle -Force
rm -r .expo -Force
rm package-lock.json -Force
rm -r .expo-cache -Force
```

---

## 📦 Phase 3: Update Package.json

### Step 3.1: Clean package.json
Remove direct react-native dependency since Expo manages it.

**Current problematic version:**
```json
"react-native": "^0.72.0",
```

**Updated package.json (EXACT):**
```json
{
  "name": "vehicle-categories",
  "version": "1.0.0",
  "description": "A React Native app showcasing vehicle categories using Expo",
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "build": "eas build --platform android",
    "build-local": "eas build --platform android --local",
    "preview": "eas build --platform android --profile preview"
  },
  "dependencies": {
    "@expo/metro-runtime": "~6.1.0",
    "expo": "~54.0.0",
    "expo-file-system": "^15.0.0",
    "expo-sharing": "^15.0.0",
    "expo-status-bar": "~3.0.0",
    "react": "18.2.0",
    "react-dom": "19.1.0",
    "react-native-web": "~0.21.0"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@types/react": "~19.1.0"
  },
  "private": true
}
```

---

## 🛠️ Phase 4: Update Configuration Files

### Step 4.1: Update app.json (Android Config)
```json
{
  "expo": {
    "name": "Vehicle Categories",
    "slug": "vehicle-categories",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.vehiclecategories.app",
      "versionCode": 1,
      "permissions": [],
      "targetSdkVersion": 34,
      "minSdkVersion": 21
    },
    "web": {},
    "plugins": [],
    "extra": {
      "eas": {
        "projectId": "aae93d20-1e10-46f1-b02b-3948be623f75"
      }
    },
    "owner": "pallvi.dalvi"
  }
}
```

### Step 4.2: Update eas.json
```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    },
    "local": {
      "android": {
        "buildType": "apk"
      }
    }
  },
  "cli": {
    "version": ">= 18.0.0"
  }
}
```

---

## 💾 Phase 5: Install Clean Dependencies

### Step 5.1: Install from Fresh
```bash
# Clean install
npm install

# Alternative if there are peer dependency issues
npm install --legacy-peer-deps
```

### Step 5.2: Install Expo CLI (Global)
```bash
npm install -g eas-cli@latest
npm install -g expo-cli@latest
```

---

## 🏗️ Phase 6: Prebuild Android (Generate Gradle Files)

### Step 6.1: Generate Android Folder via Expo
```bash
# This regenerates android folder with proper Expo configuration
npx expo prebuild --platform android --clean
```

**What this does:**
- ✅ Generates android/ folder with proper Expo gradle config
- ✅ Configures AndroidManifest.xml correctly
- ✅ Sets up Kotlin properly
- ✅ Creates build.gradle with correct versions

### Step 6.2: Verify Generated Files
After prebuild, check:
```bash
# Should exist now:
ls -la android/
ls -la android/app/src/main/AndroidManifest.xml
```

---

## 🧪 Phase 7: Test Development Build

### Step 7.1: Start Expo Development Server
```bash
npm start
# Or: npx expo start
```

**Expected output:**
```
Expo Dev Client running on port 8081
Press 'a' for Android
Press 'w' for web
Press 'i' for iOS
```

### Step 7.2: Test Android Build
```bash
# Option A: Build APK locally (requires Android SDK)
npm run android
# Command: expo run:android

# Option B: Test web first (fastest)
npm run web
# Command: expo start --web
```

---

## 🚀 Phase 8: Configure EAS Build

### Step 8.1: Authenticate with EAS
```bash
npx eas-cli login
# - Enter your Expo account credentials
# - Confirm when logged in
```

### Step 8.2: Build Test APK (Cloud Build)
```bash
# Build with preview profile
npm run build

# This command:
# - Uploads your code to Expo servers
# - Builds on their infrastructure
# - Generates APK on cloud (no local Android SDK needed)
# - Returns download link
```

### Step 8.3: Monitor Build Progress
```bash
# Check build status
npx eas-cli build:list

# Get details of specific build
npx eas-cli build:view <build-id>
```

---

## ✅ Phase 9: Verification Checklist

### Local Development
- [ ] `npm start` works without errors
- [ ] Web build starts: `npm run web`
- [ ] Can navigate categories and see form
- [ ] CSV export works in browser
- [ ] No console errors about native modules

### Android Development
- [ ] `npm run android` builds successfully (if Android SDK available)
- [ ] App runs on emulator/device
- [ ] All form fields work
- [ ] Track name dropdown functions
- [ ] Vehicle details accordion works
- [ ] Stopwatch timer works
- [ ] CSV export works on Android

### EAS Cloud Build
- [ ] `npm run build` completes successfully
- [ ] APK downloads without errors
- [ ] APK installs on Android device
- [ ] App functions identically to local build

### Excel/CSV Export
- [ ] File names correct: "Diesel Modified - Rajgad.csv"
- [ ] All fields exported properly
- [ ] Date/time stamps work

---

## 🆘 Troubleshooting

### Issue: "Cannot find module 'react-native'"
**Solution:** Expo manages react-native internally. Delete node_modules and reinstall:
```bash
rm -r node_modules
npm install
```

### Issue: Android SDK not found
**Solution:** This is okay! EAS Cloud Build doesn't require local Android SDK:
```bash
npm run build  # Uses Expo cloud infrastructure instead
```

### Issue: "Module not found: expo-file-system"
**Solution:** Versions might have changed. Install latest compatible:
```bash
npm install expo-file-system@latest
npm install expo-sharing@latest
```

### Issue: Build fails with Gradle error
**Solution:** Regenerate Android folder:
```bash
rm -r android
npx expo prebuild --platform android --clean
```

### Issue: "Plugin not found"
**Solution:** Clear Expo cache:
```bash
rm -r .expo
npm install
npx expo start
```

---

## 📝 What Changed & Why

| Item | Old (CLI) | New (Expo) | Why |
|------|-----------|-----------|-----|
| Build tool | Gradle+Android Studio | Expo+EAS | Simpler, cloud-based |
| Dependencies | react-native ^0.72.0 | Managed by Expo | Version alignment |
| Android SDK | Required locally | Optional (cloud build) | Fewer setup hassles |
| Rebuilds | `./gradlew assembleRelease` | `eas build` | Single command |
| File System | Direct Android API | expo-file-system | Abstracted cross-platform |

---

## 🎉 Success Indicators

When migration is complete:
1. ✅ `npm start` shows Expo DevClient
2. ✅ `npm run web` opens app in browser
3. ✅ `npm run build` generates APK in cloud
4. ✅ Device/emulator runs latest version
5. ✅ All form functionality works
6. ✅ No native build errors

---

## 📞 Support

If you encounter issues:
1. Check Expo docs: https://docs.expo.dev
2. Check EAS Build docs: https://docs.expo.dev/build/introduction/
3. Check error logs: `npx expo start --verbose`
4. Reset everything: Delete node_modules, .expo, android, ios, reinstall

---

**Last Updated:** 2026-04-02
**Status:** Ready for Execution
