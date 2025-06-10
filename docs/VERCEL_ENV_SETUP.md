# Vercel 環境変数設定ガイド

## 本番環境デプロイ前に必要な環境変数設定

Vercelダッシュボード（https://vercel.com）で以下の環境変数を設定してください。

### 1. プロジェクトの環境変数ページにアクセス
1. Vercelダッシュボードにログイン
2. `my-nishikoyama-backend` プロジェクトを選択
3. Settings → Environment Variables に移動

### 2. 設定が必要な環境変数

#### AWS関連
```
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=[実際のアクセスキー]
AWS_SECRET_ACCESS_KEY=[実際のシークレットキー]
```

#### DynamoDB関連
```
DYNAMODB_TABLE_NAME=my-nishikoyama-events
PUSH_SUBSCRIPTIONS_TABLE=my-nishikoyama-push-subscriptions
```

#### Web Push通知関連
```
VAPID_EMAIL=[運営者のメールアドレス]
VAPID_PUBLIC_KEY=BHtkuGe1h_etz56gVNiU4_C2CgiHDaFpWiY7Lqs06PDZM72ZrCN9t2sACUVXPTBAZcF0sqQbjYQU_PedY3Y-jmM
VAPID_PRIVATE_KEY=zfPitE9ugKel-2R08Tn8qDjgw6-gg9F1hl4xrB8z7yg
```

#### その他
```
FRONTEND_URL=https://my-nishikoyama-frontend.vercel.app
NODE_ENV=production
```

### 3. 環境変数の適用範囲
- Production: ✅ 必須
- Preview: ✅ 推奨
- Development: ローカル開発用（.envファイルを使用）

### 4. 重要な注意事項

#### VAPID_EMAIL について
- 実際の連絡可能なメールアドレスを設定してください
- このメールアドレスは、プッシュサービスプロバイダーが問題があった際の連絡先として使用されます
- 例: `admin@your-domain.com` または `your-email@gmail.com`

#### セキュリティに関する注意
- AWS認証情報は絶対に公開しないでください
- VAPID_PRIVATE_KEYは秘密情報として扱ってください
- 環境変数は暗号化されて保存されます

### 5. 設定後の確認手順

1. 環境変数を設定後、「Save」をクリック
2. 新しいデプロイをトリガー（git pushまたはVercelダッシュボードから）
3. デプロイ完了後、以下のエンドポイントで動作確認：
   - `https://my-nishikoyama-backend.vercel.app/health`
   - `https://my-nishikoyama-backend.vercel.app/api/events`

### 6. トラブルシューティング

#### 環境変数が反映されない場合
- デプロイを再実行
- Functions タブでログを確認
- 環境変数名のスペルミスをチェック

#### DynamoDBアクセスエラーの場合
- AWS認証情報が正しいか確認
- IAMポリシーでDynamoDBへのアクセス権限があるか確認
- リージョンが`ap-northeast-1`になっているか確認

## 関連ドキュメント
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Web Push Protocol](https://developers.google.com/web/fundamentals/push-notifications)
