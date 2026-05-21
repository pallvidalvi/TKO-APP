# APK Password Protection

Android cannot run app code before APK installation, so an APK file itself cannot show an app-defined password prompt before install.

For password-controlled distribution, share the APK inside an encrypted archive and do not share the raw `.apk` file.

## Create a Password-Protected APK Archive

Install 7-Zip first and make sure `7z.exe` is available in `PATH`.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/protect-apk.ps1 -ApkPath "path\to\app-release.apk"
```

The script creates:

```text
app-release.protected.7z
```

Users must enter the archive password before they can extract the APK and start installation.

## With Explicit Output Path

```powershell
powershell -ExecutionPolicy Bypass -File scripts/protect-apk.ps1 `
  -ApkPath "path\to\app-release.apk" `
  -OutputPath "dist\TKO-Ground-Zero.protected.7z"
```

## Important

- Share only the `.protected.7z` file.
- Do not share the raw `.apk`.
- This protects distribution access, not Android Package Installer itself.
- Once someone extracts the APK with the correct password, Android can install that APK normally.
