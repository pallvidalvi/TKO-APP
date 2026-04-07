# 🎯 Get Your FREE APK in 2 Minutes

## Step 1: Initialize Git (if not done)
```bash
cd c:\Users\1040162\TKO_APP\TKO-APP
git init
```

## Step 2: Add & Commit Your Code
```bash
git add .
git commit -m "TKO app ready for building"
```

## Step 3: Create GitHub Repository
1. Go to https://github.com/new
2. Create new repository named `TKO-APP`
3. **DO NOT** initialize with README

## Step 4: Push Your Code
```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/TKO-APP.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

## ⏱️ What Happens Next (Automatic)

✅ GitHub Actions starts building your APK  
⏳ Takes ~5-10 minutes  
✅ Creates APK file  
📦 Stores in Artifacts section  

---

## 📥 Download Your APK

1. Go to: https://github.com/YOUR_USERNAME/TKO-APP/actions
2. Click the latest workflow run
3. Scroll down to **Artifacts**
4. Click **TKO-Ground-Zero** to download

---

## 📱 Install on Phone

### Using USB Cable:
```bash
# Enable USB Debugging: Settings → Developer Options → USB Debugging
adb install app.apk
```

### Without Cable:
- Email APK to yourself
- Open email on phone
- Tap APK
- Install

---

## ✅ Done!

Your APK is built and ready to install. **Completely FREE. No credit card needed.**

---

**Tip:** Next time you update your code, just push again:
```bash
git add .
git commit -m "Your update message"
git push origin main
```

GitHub will automatically build a new APK!
