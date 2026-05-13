# ONNX models (required for face attendance)

Place these files **exactly** under `android/app/src/main/assets/models/`:

| File | Purpose |
|------|---------|
| `scrfd_500m_bnkps.onnx` | SCRFD face detector + 5 landmarks (InsightFace Zoo export, 640×640 input) |
| `arcface_w600k_r50.onnx` | ArcFace recognition (512-D L2-normalized embedding; InsightFace `w600k_r50` ONNX) |
| `silent_fas_mini.onnx` | Silent anti-spoof (MiniFASNet-style 2-class or 1-logit; input 80×80 RGB) |

## Acquisition notes

- **InsightFace** publishes SCRFD and ArcFace ONNX checkpoints under permissive academic/commercial terms depending on variant — verify license for your jurisdiction before production.
- **Silent Face Anti-Spoofing** MiniFASNet ONNX exports exist in community repos; validate numerical ranges (sigmoid vs softmax) against `AntiSpoofOnnx.kt`.

## Filename overrides

To use alternate exports, rename files to match the table or change constants in `FaceBiometricsPipeline.kt` (`FILE_SCRFD`, `FILE_ARC`, `FILE_SPOOF`).

## Verification

After adding models, run a clean Android build (`./gradlew clean assembleDebug`). Without these files, `FaceBiometrics.extractEmbedding` rejects with `IOException` listing the missing asset.
