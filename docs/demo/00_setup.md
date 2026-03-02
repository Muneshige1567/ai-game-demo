# 00. デモ事前準備

## 環境セットアップ

### 必要なもの
- Node.js (v18以上)
- Claude Code CLI
- GitHub アカウント
- Vercel アカウント（GitHubと連携済み）

### 事前準備手順

1. **リポジトリをクリーンな状態にリセット**
   ```bash
   cd C:\Users\shibu\dev\ai-game-demo
   git stash  # 現在の変更を退避（必要なら）
   git checkout master
   git reset --hard <初期コミットハッシュ>
   git push --force
   ```

2. **Vercelプロジェクトを作成**
   - Vercelにログイン → "Add New Project"
   - GitHubリポジトリ `ai-game-demo` をインポート
   - Framework Preset: `Vite` を選択
   - Deploy

3. **画面レイアウトの準備**
   ```
   ┌─────────────────┬─────────────────┐
   │                 │                 │
   │   Claude Code   │   Vercel        │
   │   (ターミナル)    │   (ブラウザ)      │
   │                 │                 │
   ├─────────────────┴─────────────────┤
   │      プロンプト入力エリア（拡大）      │
   └───────────────────────────────────┘
   ```
   - 左: ターミナル（Claude Code実行画面）
   - 右: ブラウザ（VercelデプロイURL）
   - 中央下: プロンプト入力部分をズーム表示

4. **フォントサイズの調整**
   - ターミナル: フォントサイズ 16px 以上
   - ブラウザ: 100%ズーム

5. **動作確認**
   ```bash
   npm run dev
   ```
   → ブラウザで "Robot Factory / Coming soon..." が表示されればOK
