# Between Bodies

[Open the artwork](https://littleffww.github.io/between-bodies/) — no sign-in required.

An interactive sculpture with a shared skin, captured facial reliefs and participant voices. Move the pointer or drag to rotate, tap to press, and use the existing shape controls. Capture inputs stay on the visitor’s device.

- **Transparent PNG** exports the sculpture without the scene background or interface.
- **Recording background** offers **Transparent** (WebM with alpha) and **Keep background** (MP4). Both record the sculpture with its audible voices. Pause or resume, then choose **Preview & save**. The preview checkerboard is never baked into the transparent video.
- **Voice moves the body** toggles whole-body sound motion independently of speaking lips.
- Camera and microphone access are requested only through their controls. Browser audio starts after an intentional interaction.
- Simplified Chinese, Traditional Chinese, Japanese and English; day and night views.

## Version index

| Version | Saved source | Description |
| --- | --- | --- |
| v18.0 · 2026-11-07 | [Complete project archive](https://github.com/littleffww/desktop-tutorial/tree/codex/between-bodies-v18.0-2026-11-07/2026-11-07_Between-Bodies_v18.0) | Transparent WebM or scene-background MP4 recording, voices, pause/resume and local save. Full source archives are owner-accessible; the artwork itself is public. |
| v17.0 · 2026-11-07 | [Complete project archive](https://github.com/littleffww/desktop-tutorial/tree/codex/between-bodies-v17.0-2026-11-07/2026-11-07_Between-Bodies_v17.0) | Floating rotation, transparent PNG, MP4 recording and optional body audio motion. Full source archives are owner-accessible; the artwork itself is public. |

This repository contains the standalone browser artwork, published from `codex/between-bodies-development`. The original Gyri artwork remains separate. No captured participant photographs, landmarks or recordings are included.

## Third-party components

Three.js, MediaPipe, Mediabunny and font notices are included alongside their local assets. Skin detail maps and the skin color texture were authored for this artwork; the original human voice recording was supplied for the project. Video export runs locally. Transparent video uses VP9/VP8 WebM with an alpha channel and Opus audio; scene-background video uses AVC/AAC MP4. Unsupported transparency encoders produce a recoverable message and leave background MP4 recording available.
