# マイ西小山・武蔵小山 バックエンドAPI

品川区（西小山・武蔵小山エリア）の地域イベント情報を配信するバックエンドAPIです。

## 機能

- イベント情報の取得（一覧・詳細）
- エリア別フィルタリング（西小山・武蔵小山・品川区全体）
- カテゴリー別フィルタリング
- 日付範囲指定
- ユーザーの興味に基づくスコアリング
- ダミーイベントの自動フィルタリング
- イベント情報の自動スクレイピング

## 技術スタック

- Node.js + Express
- AWS DynamoDB
- Vercel (デプロイ先)
- Cheerio (スクレイピング)

## API エンドポイント

- `GET /health` - ヘルスチェック
- `GET /api/events` - イベント一覧取得
  - クエリパラメータ:
    - `area` (optional): エリアフィルター（`nishikoyama`, `musashikoyama`, `all`）
    - `includeDemo` (optional): `true`を指定するとダミーイベントも含めて取得（デフォルト: `false`）
    - `categories` (optional): カテゴリーフィルター（カンマ区切り）
    - `startDate` (optional): 開始日（YYYY-MM-DD）
    - `endDate` (optional): 終了日（YYYY-MM-DD）
    - `limit` (optional): 取得件数（デフォルト: 50）
- `GET /api/events/:id` - イベント詳細取得
- `GET /api/categories` - カテゴリー一覧取得
- `GET /api/areas` - エリア一覧取得
- `GET /api/stats` - 統計情報取得

## エリア

- `all` - 品川区（全エリア）
- `nishikoyama` - 西小山
- `musashikoyama` - 武蔵小山

## スクレイピング情報源

現在、以下の情報源から自動的にイベント情報を収集しています：

### 正常動作中 ✅
- **品川観光協会**: https://shinagawa-kanko.or.jp/event/
  - 西小山・武蔵小山の両エリアのイベントを取得
  - エリアは内容から自動判定
- **武蔵小山パルム商店街**: https://musashikoyama-palm.jp/news/event
  - 武蔵小山エリアのイベントを取得

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

# スクレイピング間隔（cron形式）
SCRAPING_INTERVAL=0 9 * * *  # 毎日朝9時
```

## ローカル開発

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# スクレイピング実行
node src/scrapers/index.js

# 武蔵小山パルムのみテスト
node test-musashikoyama.js

# データベース内容確認
node check-db-events.js

# ダミーイベントのフラグ更新
node update-demo-events-v2.js

# エリア情報の更新
node update-event-areas.js
```

## ダミーイベントの管理

本番環境では、デフォルトでダミーイベントは表示されません。

- イベントデータの`isDemo`フィールドが`true`のものがダミーイベントとして扱われます
- `update-demo-events-v2.js`スクリプトを実行すると、既存のイベントに`isDemo`フラグが設定されます

## エリア対応

- `area`フィールドで西小山（`nishikoyama`）と武蔵小山（`musashikoyama`）を区別
- APIでエリア別にイベントを取得可能
- スクレイパーが自動的にエリアを判定

## デプロイ

Vercelにデプロイされます。

```bash
vercel
```

## 本番URL

- API: https://my-nishikoyama-backend.vercel.app
- Frontend: https://my-nishikoyama-frontend.vercel.app
- LIFF: https://liff.line.me/2007527599-XzGDNEMm
