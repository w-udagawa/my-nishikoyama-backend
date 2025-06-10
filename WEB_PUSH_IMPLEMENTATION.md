# Web Push通知実装ガイド

## 実装完了内容（2025/6/11）

### バックエンド
- ✅ Web Push通知サービス (`src/services/webPushService.js`)
- ✅ Push通知APIエンドポイント
  - `/api/push/vapid-public-key` - VAPID公開鍵取得
  - `/api/push/subscribe` - 購読登録
  - `/api/push/unsubscribe` - 購読解除
  - `/api/push/preferences` - 設定更新
  - `/api/push/test` - テスト通知送信
- ✅ 環境変数設定（`.env.example`更新済み）

### フロントエンド
- ✅ Service Worker (`public/sw.js`)
- ✅ PWAマニフェスト (`public/manifest.json`)
- ✅ Push通知ユーティリティ (`src/utils/pushNotification.js`)
- ✅ React Hook (`src/hooks/usePushNotification.js`)
- ✅ 通知設定コンポーネント (`src/components/NotificationSettings.jsx`)

## セットアップ手順

### 1. VAPID Keysの生成
```bash
npm install
node
> const webpush = require('web-push');
> const vapidKeys = webpush.generateVAPIDKeys();
> console.log('Public Key:', vapidKeys.publicKey);
> console.log('Private Key:', vapidKeys.privateKey);
```

### 2. 環境変数の設定
```env
# Web Push通知設定
VAPID_EMAIL=your_email@example.com
VAPID_PUBLIC_KEY=生成した公開鍵
VAPID_PRIVATE_KEY=生成した秘密鍵
PUSH_SUBSCRIPTIONS_TABLE=my-nishikoyama-push-subscriptions
```

### 3. DynamoDBテーブルの作成
```bash
aws dynamodb create-table \
  --table-name my-nishikoyama-push-subscriptions \
  --attribute-definitions \
    AttributeName=subscriptionId,AttributeType=S \
  --key-schema \
    AttributeName=subscriptionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-1
```

## 使用方法

### スクレイピング時の通知送信
```javascript
// src/scrapers/index.js に追加
const webPushService = require('../services/webPushService');

// 新規イベント保存後
await webPushService.notifyNewEvent(newEvent);
```

### テスト方法
1. バックエンド起動: `npm run dev`
2. フロントエンド起動: `npm run dev`
3. ブラウザで通知設定画面にアクセス
4. 「テスト通知を送信」ボタンをクリック

## トラブルシューティング

### 通知が届かない場合
1. ブラウザの通知設定を確認
2. OSの通知設定を確認
3. Service Workerの登録状態を確認

### 環境変数が反映されない場合
1. `.env`ファイルの記述を確認
2. サーバーを再起動
3. `VAPID_EMAIL`が実際のメールアドレスになっているか確認
