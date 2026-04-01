# Vehicle Categories - React Native Expo App

A production-ready Android mobile application built with React Native and Expo, showcasing vehicle categories with a beautiful, modern UI.

## 📱 Features

- **Home Screen**: Displays 3 vehicle categories (Diesel, Petrol, SUV)
- **Beautiful Cards**: Each category shown as an interactive card with:
  - Rounded corners (16px border radius)
  - Elevation shadow for depth (Android elevation + iOS shadow)
  - Smooth press animations using Animated API
  - Emoji icons for visual appeal
- **Responsive Design**: Layout adapts to different screen sizes
- **Performance Optimized**: Uses FlatList for efficient list rendering
- **Clean Architecture**: Functional components with React Hooks
- **Professional Styling**: Modern, minimal design using StyleSheet

## 🛠️ Technical Stack

- **Framework**: React Native
- **Build Tool**: Expo CLI
- **Build Service**: Expo EAS (for APK generation)
- **State Management**: React Hooks (useState)
- **Animation**: React Native Animated API
- **Styling**: StyleSheet for optimized performance
- **Target**: Android (APK)

## 📋 Prerequisites

Before you begin, ensure you have:

1. **Node.js** (v18 or higher)
   ```bash
   node --version
   ```

2. **npm** or **yarn** package manager
   ```bash
   npm --version
   ```

3. **Expo CLI** (install globally)
   ```bash
   npm install -g expo-cli
   ```

4. **Expo Account** (optional, required for EAS builds)
   - Sign up at: https://expo.dev
   - Login using: `expo login`

5. **Android Device/Emulator** (for testing)
   - Use Android Studio emulator, or
   - Use a physical Android phone with Expo Go app installed

## 🚀 Installation & Setup

### Step 1: Initialize Dependencies

Navigate to the project directory and install dependencies:

```bash
cd "TKO APP"
npm install
```

Or with yarn:

```bash
yarn install
```

### Step 2: Configure Expo Project ID (Optional, for EAS builds)

If you plan to use Expo EAS for building APKs:

```bash
expo login
```

Then initialize the EAS project:

```bash
eas init
```

This will generate a unique `projectId` in your `app.json` file.

## 📱 Running the App

### Option 1: Run on Android Emulator (Recommended for Development)

```bash
npm run android
```

This starts the development server and automatically opens the app in the Android emulator.

### Option 2: Run on Physical Android Device

1. Install the **Expo Go** app from Google Play Store on your Android phone
2. Make sure your phone and computer are on the same WiFi network
3. Run the development server:

```bash
npm start
```

4. Scan the QR code displayed in the terminal with Expo Go
5. The app will load on your device

### Option 3: Run Web Version (for preview)

```bash
npm run web
```

This opens the app in your browser at `http://localhost:19006`

### Option 4: Start Development Server (Manual Mode)

```bash
expo start
```

After starting, press:
- `a` to open on Android emulator
- `i` to open on iOS simulator (requires macOS)
- `w` to open in web browser
- `r` to reload the app
- `q` to quit

## 📦 Building APK for Production

### Method 1: Using Expo EAS (Recommended - Cloud Build)

This method builds the APK on Expo servers (no local Android SDK required).

#### Prerequisites:
- Expo account (sign up at https://expo.dev)
- Logged in: `expo login`
- Project initialized with EAS: `eas init`

#### Build APK:

```bash
eas build --platform android
```

When prompted, choose:
- Build type: **APK** (for direct installation on devices)
- Release channel: **default**

The build will start and you'll get a URL to monitor progress. Once complete, you'll receive a download link for the APK file.

**Estimated time**: 10-15 minutes

### Method 2: Preview Build (Faster, for testing)

```bash
eas build --platform android --profile preview
```

This is faster than production build and suitable for testing.

### Method 3: Local Build (Advanced)

Requires Android SDK, JDK, and Gradle installed locally.

```bash
eas build --platform android --local
```

## 📥 Installing the APK on Device

### After downloading the APK from EAS:

**Option A: Direct Installation on Device**

1. Download APK to your computer
2. Connect Android phone via USB
3. Transfer APK to phone
4. On phone, open file manager → find APK → tap to install
5. Allow installation from unknown sources if prompted

**Option B: Using ADB (Android Debug Bridge)**

```bash
adb install path/to/app-release.apk
```

**Option C: Share via Email/Cloud**

1. Upload APK to cloud storage (Google Drive, Dropbox, etc.)
2. Share the link with the phone
3. Download and install on the device

## 🏗️ Project Structure

```
TKO APP/
├── App.js              # Main application component
├── app.json            # Expo configuration
├── eas.json            # EAS build configuration
├── package.json        # Project dependencies and scripts
├── babel.config.js     # Babel configuration
├── assets/
│   ├── icon.png       # App icon
│   ├── splash.png     # Splash screen image
│   └── adaptive-icon.png # Android adaptive icon
└── README.md          # This file
```

## 📝 Code Overview

### App.js Components

#### 1. **CategoryCard Component**
- Reusable card component for displaying individual categories
- Implements press animation using Animated API
- Returns to original scale after press

#### 2. **Main App Component**
- Displays header with title
- Uses FlatList to render categories efficiently
- Handles category press events (ready for navigation)
- Contains all category data

#### 3. **Styles**
- `StyleSheet.create()` for optimized performance
- Uses Dimensions API for responsive design
- Proper shadow implementation for both Android and iOS
- Clean color scheme (#212529, #f8f9fa, #ffffff)

## 🎨 UI Features

### Card Design
- **Rounded Corners**: 16px border radius
- **Shadow**: Elevation 4 on Android, custom shadow on iOS
- **Spacing**: Adequate padding and margins
- **Colors**: Clean white cards on light gray background

### Header
- Fixed at top with title and subtitle
- Subtle bottom border for separation
- Responsive typography

### Animations
- **Press Animation**: Cards scale to 0.95 on press, back to 1 on release
- **Smooth Transitions**: Using Spring animation for natural feel

## 🔧 Customization

### Changing Colors

Edit the styles in `App.js`:

```javascript
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa', // Change background color
  },
  card: {
    backgroundColor: '#ffffff', // Change card color
  },
  // ... other styles
});
```

### Adding More Categories

Edit the `categories` array in the `App` component:

```javascript
const categories = [
  {
    id: '1',
    name: 'Diesel',
    description: 'Efficient fuel option',
    icon: '⛽',
  },
  // Add more categories here
];
```

### Implementing Navigation

Currently, `handleCategoryPress` just logs the selection. To add navigation:

1. Install React Navigation:
   ```bash
   npm install @react-navigation/native @react-navigation/bottom-tabs
   npm install react-native-screens react-native-safe-area-context
   ```

2. Wrap App with NavigationContainer and set up navigation stack

3. Uncomment the navigation line in `handleCategoryPress`

### Connecting to APIs

To fetch categories from a backend:

```javascript
const [categories, setCategories] = useState([]);

useEffect(() => {
  fetch('https://your-api.com/categories')
    .then(res => res.json())
    .then(data => setCategories(data))
    .catch(err => console.error(err));
}, []);
```

## 📚 File Descriptions

| File | Purpose |
|------|---------|
| `App.js` | Main application component with UI and logic |
| `app.json` | Expo configuration (app name, version, icons, permissions) |
| `eas.json` | Expo EAS build configuration for APK generation |
| `package.json` | Project metadata and npm scripts |
| `babel.config.js` | Babel transpiler configuration for React Native |

## ⚙️ npm Scripts

```bash
npm run start       # Start development server
npm run android     # Run on Android emulator
npm run ios        # Run on iOS simulator
npm run web        # Run on web browser
npm run build:android-apk  # Build APK using EAS
npm run build:android-aab  # Build AAB for Play Store
npm run preview    # Build preview APK
```

## 🐛 Troubleshooting

### Issue: Emulator not showing up

**Solution**:
```bash
# Start Android emulator manually
emulator -list-avds  # List available emulators
emulator -avd <emulator_name>  # Start specific emulator
```

### Issue: "Port already in use" error

**Solution**:
```bash
# Change port
expo start --localhost -p 8081
```

### Issue: Dependencies not installed properly

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: EAS build fails

**Solution**:
- Make sure you're logged in: `expo login`
- Update Expo: `npm install -g expo-cli@latest`
- Check `app.json` for missing `projectId`

### Issue: APK installation fails on device

**Solution**:
- Enable "Install from unknown sources" in device settings
- Check if device has enough storage
- Ensure Android version is compatible (min Android 5.0)

## 📈 Future Enhancement Ideas

### 1. **Navigation System**
   - Implement React Navigation
   - Add category detail screens
   - Create a bottom tab navigator

### 2. **Backend Integration**
   - Fetch categories from REST API
   - Add database connectivity
   - Implement user authentication

### 3. **Advanced Features**
   - Add filters and search
   - Implement favorites/wishlist
   - Add product comparison feature
   - User reviews and ratings

### 4. **Performance Optimization**
   - Add image lazy loading
   - Implement pagination
   - Cache API responses

### 5. **User Experience**
   - Add loading states and spinners
   - Error handling with retry logic
   - Toast notifications for user feedback
   - Empty state screens

### 6. **Monetization**
   - Ad integration (Google Ads)
   - In-app purchases
   - Premium features

### 7. **Analytics & Monitoring**
   - Crash reporting (Sentry)
   - User analytics (Amplitude)
   - Performance monitoring

### 8. **Accessibility**
   - Add proper accessibility labels
   - Implement text scaling
   - High contrast mode support

## 🔐 Security Considerations

- Validate all API responses
- Use HTTPS for all network requests
- Store sensitive data securely
- Implement proper authentication
- Keep dependencies updated: `npm audit`

## 📄 License

This project is open source and available under the MIT License.

## 👨‍💻 Support

For issues with:
- **Expo**: https://expo.dev/help
- **React Native**: https://reactnative.dev/docs
- **EAS Build**: https://docs.expo.dev/build/setup/

## 📞 Additional Resources

- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)
- [React Native StyleSheet](https://reactnative.dev/docs/stylesheet)
- [FlatList Optimization](https://reactnative.dev/docs/optimizing-flatlist-configuration)
- [Animated API](https://reactnative.dev/docs/animated)
- [EAS Build Documentation](https://docs.expo.dev/build/setup/)

---

**Happy coding! 🚀**
