# マイ西小山 バックエンドAPI

西小山エリアの地域イベント情報を配信するバックエンドAPIです。

## 機能

- イベント情報の取得（一覧・詳細）
- カテゴリー別フィルタリング
- 日付範囲指定
- ユーザーの興味に基づくスコアリング

## 技術スタック

- Node.js + Express
- AWS DynamoDB
- Vercel (デプロイ先)

## API エンドポイント

- `GET /health` - ヘルスチェック
- `GET /api/events` - イベント一覧取得
- `GET /api/events/:id` - イベント詳細取得
- `GET /api/categories` - カテゴリー一覧取得
- `GET /api/stats` - 統計情報取得

## 環境変数

```
# AWS設定
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# DynamoDB設定
DYNAMODB_TABLE_NAME=my-nishikoyama-events

# フロントエンドURL（CORS設定用）
FRONTEND_URL=https://your-frontend-url.vercel.app
```

## ローカル開発

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# スクレイピング実行
npm run scrape
```

## デプロイ

Vercelにデプロイされます。

```bash
vercel
```
