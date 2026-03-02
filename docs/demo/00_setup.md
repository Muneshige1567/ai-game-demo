# 00. デモ事前準備

## 環境セットアップ

### 必要なもの
- Node.js (v18以上)
- Claude Code CLI
- GitHub アカウント

### 事前準備手順

1. **masterからデモ用ブランチを切る**
   ```bash
   cd C:\Users\shibu\dev\ai-game-demo
   git checkout master
   git checkout -b demo/run-YYYYMMDD
   ```

2. **ブランチをGAME_SPEC.mdだけの状態にする**
   ```bash
   # docs/, CLAUDE.md 等を削除し、GAME_SPEC.md のみ残す
   git rm -r docs/ CLAUDE.md
   git commit -m "demo: clean slate with spec only"
   ```

   デモブランチの状態:
   ```
   ai-game-demo/
   ├── .gitignore
   └── GAME_SPEC.md    ← これだけ！
   ```

3. **画面レイアウトの準備**
   ```
   ┌─────────────────┬─────────────────┐
   │                 │                 │
   │   Claude Code   │   ブラウザ       │
   │   (ターミナル)    │  (localhost)    │
   │                 │                 │
   └─────────────────┴─────────────────┘
   ```
   - 左: ターミナル（Claude Code実行画面）
   - 右: ブラウザ（localhost:5173 — Vite dev server）

4. **フォントサイズの調整**
   - ターミナル: フォントサイズ 16px 以上
   - ブラウザ: 100%ズーム

5. **プロンプト準備**
   - ワンショットプロンプト（`02_prompt.md` 参照）をコピペ準備しておく

## デモ開始時の画面イメージ
ターミナルで `ls` すると GAME_SPEC.md だけがある状態。
ここから全てが生まれる、という演出。

## masterに戻すとき
デモ終了後、masterはそのまま。ブランチは記録として残してもOK。
次回デモ時はまた新しいブランチを切る。
