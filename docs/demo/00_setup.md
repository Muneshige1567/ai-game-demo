# 00. デモ事前準備

## 環境セットアップ

### 必要なもの
- Node.js (v18以上)
- Claude Code CLI
- GitHub アカウント
- Vercel アカウント（GitHubと連携済み）

### 事前準備手順

1. **リポジトリを空の状態にリセット**
   ```bash
   cd C:\Users\shibu\dev\ai-game-demo
   # 全ファイルを削除し、GAME_SPEC.md だけの状態にする
   git checkout master
   # src/, index.html, package.json 等を全て削除
   # GAME_SPEC.md のみ残す
   git add -A && git commit -m "reset: empty project with spec only"
   git push --force
   ```

   最終的なリポジトリの状態:
   ```
   ai-game-demo/
   └── GAME_SPEC.md    ← これだけ！
   ```

2. **Vercelプロジェクトを作成**
   - Vercelにログイン → "Add New Project"
   - GitHubリポジトリ `ai-game-demo` をインポート
   - Framework Preset: `Vite` を選択
   - Deploy（この時点では中身がないのでエラーでもOK）

3. **画面レイアウトの準備**
   ```
   ┌─────────────────┬─────────────────┐
   │                 │                 │
   │   Claude Code   │   ブラウザ       │
   │   (ターミナル)    │   (Vercel URL)  │
   │                 │                 │
   └─────────────────┴─────────────────┘
   ```
   - 左: ターミナル（Claude Code実行画面）
   - 右: ブラウザ（VercelデプロイURL）

4. **フォントサイズの調整**
   - ターミナル: フォントサイズ 16px 以上
   - ブラウザ: 100%ズーム

5. **プロンプト準備**
   - ワンショットプロンプト（`02_prompt.md` 参照）をコピペ準備しておく

## デモ開始時の画面イメージ
ターミナルで `ls` すると GAME_SPEC.md だけがある状態。
ここから全てが生まれる、という演出。
