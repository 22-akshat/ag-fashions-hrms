# Enterprise face pipeline — audit, migration, and operations

This document satisfies the structured migration review for the React Native CLI attendance app (`apps/native-attendance`).

## 1. Current face pipeline audit (pre-migration)

**Dependency graph (high level)**  
`FaceCamera` / `VisionFaceCamera` → still image URI → `extractRegistrationEmbedding` / `verifyScanAgainstEmbedding` → **(removed)** `mobileFaceNet` + `react-native-fast-tflite` + ML Kit `FaceGeometry` → `compareFaceEmbeddings` → Supabase RPCs + offline queue.

| Area | Location | Notes |
|------|----------|--------|
| Camera | `src/components/FaceCamera.tsx`, `VisionFaceCamera.tsx` | Vision Camera; lazy import guard |
| ML Kit (removed) | Was `android/.../mlkit/FaceGeometryModule.kt` | Box detection for JS crop |
| TFLite / MobileFaceNet (removed) | Was `src/lib/mobileFaceNet.ts`, `src/assets/models/mobilefacenet.tflite` | 192-D embedding |
| Similarity | `src/modules/face/lib/faceMatcher.ts` | Was L2-mapped score; now **cosine** |
| Registration (HR) | `RegisterScreen.tsx`, `useFaceRegistration`, `deviceBinding` | 4-angle average |
| Verify / scan | `ScanScreen`, `VerifyFaceScreen`, `EmployeeLoginScreen` | Liveness + compare |
| Embedding version | `embeddingVersion.ts` | **v3** = SCRFD + ArcFace ONNX |
| Liveness (motion) | `useLivenessCheck`, `livenessValidator` | Temporal + optional native silent FAS |
| **Removed bypasses** | `faceRecognition.ts` | `__DEV__` deterministic vectors, `devTemplateSeed` stubs **removed** |

## 2. Files removed

- `android/.../mlkit/FaceGeometryModule.kt`, `FaceGeometryPackage.kt`
- `src/lib/mobileFaceNet.ts`
- `src/assets/models/mobilefacenet.tflite`
- npm: `react-native-fast-tflite`, `react-native-nitro-modules`

## 3. Files added

- `android/.../biometrics/FaceBiometricsModule.kt`, `FaceBiometricsPackage.kt`, `FaceBiometricsPipeline.kt`
- `android/.../ml/onnx/ScrfdDetector.kt`, `ArcFaceOnnx.kt`, `AntiSpoofOnnx.kt`
- `android/.../ml/align/FaceAlign.kt`
- `android/.../util/BitmapLoader.kt`
- `android/app/src/main/assets/models/README.md`
- `src/lib/enterpriseFacePipeline.ts`
- `docs/FACE_PIPELINE_ENTERPRISE.md` (this file)

## 4. New AI architecture

1. **SCRFD** (ONNX Runtime Mobile) — detection + 5 keypoints.  
2. **Silent anti-spoof** (ONNX) — on expanded square crop; threshold gate.  
3. **5-point similarity warp** to 112×112 (`FaceAlign`).  
4. **ArcFace** (ONNX) — L2-normalized embedding (default **512-D** for `w600k_r50` class exports).  
5. **JS**: cosine similarity vs `faceCosineThreshold` / `EXPO_PUBLIC_FACE_COSINE_THRESHOLD`.

## 5. SCRFD integration

- Implementation: `ScrfdDetector.kt` (InsightFace `scrfd.py` port for **9-output BNKPS** models).  
- Asset: `assets/models/scrfd_500m_bnkps.onnx` (name configurable in `FaceBiometricsPipeline`).

**Risk:** ONNX tensor layout / batching must match the export. If detections are nonsense, confirm output count (6 vs 9) and that the model is **BNKPS** with strides 8/16/32.

## 6. ArcFace integration

- Implementation: `ArcFaceOnnx.kt` — NCHW RGB, `(x-127.5)/128`, L2 normalize output.  
- Asset: `arcface_w600k_r50.onnx` (typical 512-D; dim read from first output when static).

**Risk:** Some ArcFace ONNX exports use BGR or different mean/std — calibrate against your file.

## 7. Liveness integration

- **Silent FAS** runs **before** ArcFace in `FaceBiometricsPipeline.extractFromBitmap` (order: detect → anti-spoof → align → embed).  
- **Motion liveness** (`useLivenessCheck`) unchanged; `livenessValidator` can call `FaceBiometrics.silentLivenessScore(uri)` on Android to boost `liveFrames`.

## 8. ONNX Runtime integration

- Gradle: `com.microsoft.onnxruntime:onnxruntime-android:1.19.2`  
- Inference off the React thread via `FaceBiometricsModule` executor.  
- **iOS:** not implemented; `enterpriseFacePipeline` throws — use Android for biometrics.

## 9. Performance optimizations (implemented / recommended)

- **Implemented:** single-thread executor for native calls; model session singletons; `ScrfdDetector` / ArcFace session reuse; duplicate bitmap recycle paths.  
- **Recommended:** throttle preview inference if you add future frame processors; lower `setIntraOpNumThreads` on low-end devices; NNAPI EP only after validation (`OrtSession.SessionOptions`).

## 10. Security hardening

- Removed deterministic dev embeddings and mock sinusoid vectors.  
- **Recommendation:** store embeddings with `react-native-encrypted-storage` (already a dependency) — migration not applied in this pass to limit scope.  
- Server-side verification hooks unchanged — keep issuing session tokens only after RPC success.

## 11. Android native changes

- `MainApplication.kt`: `FaceBiometricsPackage` replaces ML Kit package.  
- `app/build.gradle`: ONNX Runtime dependency; ML Kit face-detection removed.  
- Models must exist under `android/app/src/main/assets/models/`.

## 12. Remaining risks

| Risk | Mitigation |
|------|------------|
| Missing / wrong ONNX files | Clear `IOException` from native; README lists filenames |
| SCRFD score-map flatten order | Validate against your exact `.onnx`; adjust `ScrfdDetector` if needed |
| Anti-spoof calibration | Tune `AntiSpoofOnnx` normalization if model differs from MiniFASNet |
| Thermal / FPS | Avoid running full pipeline on every preview frame |
| Legacy 192-D templates in DB | **v3** embeddings incompatible — force re-enrollment or server migration |

## 13. Final production readiness

- [ ] Drop all three ONNX models into `assets/models/` and ship release APK.  
- [ ] Field-tune `EXPO_PUBLIC_FACE_COSINE_THRESHOLD` (see below).  
- [ ] Tune `antiSpoofThreshold` / expose via remote config.  
- [ ] Re-register all employees after dim change (192 → 512).  
- [ ] Optional: migrate `AppContext` embedding storage to EncryptedStorage.

---

### Recommended thresholds (starting points)

| Setting | Start | Notes |
|---------|-------|--------|
| `EXPO_PUBLIC_FACE_COSINE_THRESHOLD` | **0.38–0.45** | Indoor retail lighting; raise if FAR too high |
| Pipeline `antiSpoofThreshold` (native options) | **0.40–0.55** | Raise if customers fail FAS; lower if spoof FAR |
| `EXPO_PUBLIC_SILENT_LIVENESS_MIN` | **0.35** | Used only in motion flow native hook |
| SCRFD `detThresh` / `nmsThresh` | **0.5 / 0.4** | InsightFace defaults |

### Exact deliverables inventory

**Modified (major):** `MainApplication.kt`, `android/app/build.gradle`, `package.json`, `faceRecognition.ts`, `faceMatcher.ts`, `faceEmbedding.ts`, `faceEnv.ts`, `embeddingVersion.ts`, `RegisterScreen.tsx`, `ScanScreen.tsx`, `EmployeeLoginScreen.tsx`, `VerifyFaceScreen.tsx`, `useFaceRegistration.ts`, `livenessValidator.ts`.

**Runtime:** ONNX Runtime Mobile **1.19.2** (Android).  
**Models (by filename):** `scrfd_500m_bnkps.onnx`, `arcface_w600k_r50.onnx`, `silent_fas_mini.onnx` — **not committed** (license/size).

**Weak points:** ONNX export variance; SCRFD post-processing sensitivity; anti-spoof domain gap (print/screen) without continuous calibration data.
