# المعمارية التقنية

## الهيكل الحالي

```text
football_future_game_code/
  index.html
  manifest.webmanifest
  service-worker.js
  run_local.py
  smoke_test.py
  package.json
  src/
    assets/
      logo.svg
      icon.svg
      field.svg
    css/
      tokens.css
      styles.css
    js/
      data.js
      ui.js
      game-engine.js
      main.js
  docs/
  tools/
  visual_boards/
```

## الطبقات

### 1. Data Layer

الملف: `src/js/data.js`

يحتوي على:

- اسم اللعبة.
- نظام الألوان.
- عناصر التنقل.
- أوضاع اللعب.
- اللاعبين.
- المهام.
- المتجر.
- الإعدادات.
- نصوص تعليمية.

### 2. UI Layer

الملف: `src/js/ui.js`

مسؤول عن توليد HTML للشاشات:

- Home
- Modes
- Team
- Missions
- Tournaments
- Shop
- Profile
- Settings
- PreMatch
- LiveMatch
- MatchSummary

### 3. Game Engine Layer

الملف: `src/js/game-engine.js`

يشمل:

- Canvas rendering.
- Pitch drawing.
- Player movement.
- Ball physics.
- AI movement.
- Passing.
- Shooting.
- Skill move.
- Tackling.
- Goal detection.
- Match timer.
- Match summary callback.

### 4. App Controller

الملف: `src/js/main.js`

يشمل:

- Routing داخلي.
- LocalStorage state.
- حفظ التقدم.
- ربط الأزرار.
- تهيئة محرك المباراة.
- ربط joystick/action buttons.
- PWA install prompt.
- Service worker registration.

## لماذا هذه المعمارية؟

لأنها:

- تعمل بدون تثبيت.
- سهلة الفحص والتعديل.
- قابلة للتحويل لاحقًا إلى React أو Unity.
- تفصل الواجهة عن محرك اللعب.
- تقلل احتمالات الأخطاء في التسليم الأول.

## مسار الترقية المقترح

### المرحلة 1 — النموذج الحالي

Static PWA + Canvas.

### المرحلة 2 — Production Web

React + TypeScript + Vite + Zustand + Canvas/Phaser.

### المرحلة 3 — Mobile Game

Unity/Godot مع نفس Design Tokens وشاشات UI.

### المرحلة 4 — Online Services

Backend:

- Auth.
- Player profile.
- Inventory.
- Missions.
- Store.
- Leaderboard.
- Safe friends/club system.
