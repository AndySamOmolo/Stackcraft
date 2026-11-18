# StackCraft — AI-Proof CS & IT Android Learning Platform

StackCraft is an offline-first Android application built with **Expo SDK 54 + React Native 0.81 + TypeScript** and compiled automatically into a signed `.apk` and `.aab` via **GitHub Actions**.

Instead of passive syntax drills that LLMs have made obsolete, StackCraft trains deep engineering intuition through four touch-native visual simulation engines:

1. **The Human Debugger (`MemoryTracerEngine.tsx`)**: Step through TypeScript, Python, and C code line-by-line while inspecting real-time mutations on the **Call Stack** and **Heap** (stack frames, reference aliasing, and lexical closures).
2. **Spot the AI Hallucination (`AiAuditorEngine.tsx`)**: Audit realistic AI-generated pull requests to uncover hidden `O(N × M)` quadratic loops, `TOCTOU` async race conditions, and indirect Prompt-to-SQL injection vulnerabilities.
3. **Chaos Architect (`ChaosArchitectEngine.tsx`)**: Wire load balancers, Redis read-through caches, Kafka write queues, batch workers, and PostgreSQL read replicas to survive 12,000–15,000 RPS flash-crowd spikes.
4. **Incident Commander (`IncidentCommanderEngine.tsx`)**: Run realistic Linux kernel and socket diagnostic probes (`journalctl`, `/proc/<pid>/limits`, `ss -tanp`, `dmesg -T`) to diagnose live `502 Bad Gateway` and `504 Gateway Timeout` outages.
5. **FSRS Spaced-Repetition Vault (`fsrs.ts` + `vault.tsx`)**: Local Free Spaced Repetition Scheduler tracking memory stability ($S$), difficulty ($D$), and real-time recall probability ($R$) across all 6 tracks, with Unlocked / Due Now filtering, next-interval previews, and local JSON backup/restore.

## Zero-Touch GitHub Actions Android Build & Rolling Release Replacement

Push this repository to GitHub. The workflow at `.github/workflows/android-build.yml` runs automatically on every push to `main`/`master`, version tag (`v*.*.*`), pull request, or manual `workflow_dispatch`:

1. **Stage 1 (`verify-and-audit`)**: Runs `npm run audit:curriculum` (validating curriculum schema, multi-language line bounds, Chaos Architect topology physics, FSRS unit tests, and storage/timezone unit tests), `npm run typecheck`, and production dependency security checks.
2. **Stage 2 (`build-android-apk`)**:
   - Sets up Node 20, Eclipse Temurin JDK 17, and Android SDK 35 with Gradle caching.
   - Runs `npx expo prebuild --platform android --clean` to generate the native Android project.
   - Wires `android/app/build.gradle` `signingConfigs.release` to sign the release APK with your `ANDROID_KEYSTORE_BASE64` secret (or a cached persistent repository release keystore so consecutive APK builds upgrade seamlessly without signature mismatches).
   - Enables R8 minification and resource shrinking, and verifies the APK signature with `apksigner`.
   - Uploads `stackcraft-latest.apk`, `stackcraft-v1.0.0-<sha>.apk`, and `stackcraft-latest.aab` to **GitHub Actions Artifacts** (`overwrite: true`).
   - Publishes the APK directly to **GitHub Releases** under the rolling `latest` tag using atomic `gh release upload --clobber` replacement so `/releases/tag/latest` never experiences downtime.

### Production Keystore Secrets (Recommended)

To sign with your own production keystore, add these four secrets under **Settings → Secrets and variables → Actions**:

- `ANDROID_KEYSTORE_BASE64` (`base64 -w 0 your-release-key.keystore`)
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
