# Robot Factory - AI Game Demo

## Overview
Claude Codeのデモ動画用プロジェクト。
ロボットが工場内のプラットフォームを移動してギアを集める2Dプラットフォーマーゲーム。

## ブランチ運用
- **master**: デモ準備一式（docs, GAME_SPEC.md, CLAUDE.md）
- **demo/xxx**: デモ実行用ブランチ（masterから切って使う）

### デモの始め方
```bash
git checkout master
git checkout -b demo/run-YYYYMMDD   # デモ用ブランチを切る
# この時点で GAME_SPEC.md + docs/ + CLAUDE.md がある状態
# docs/ は .gitignore 済みなのでデモ時は見えない（※要設定）
```

## Demo Script (ワンショット)

### プロンプト
```
@GAME_SPEC.md この仕様書に従って、プロジェクトのセットアップからゲームの実装まで全て行ってください。
タイトル画面、ゲームプレイ、クリア画面、ゲームオーバー画面まで全て実装してください。
実装が完了したら、AIが自動でゲームをプレイするデモモードも追加してください。
ゲームが正しく動作することを確認してください。
```

### 用途
- Webinar広告用デモ動画（約1分、倍速編集あり）
- 詳細フローは `docs/demo/03_flow.md` 参照
