#!/bin/bash

# DynamoDB テーブル作成スクリプト
# Web Push通知購読情報を保存するためのテーブル

echo "Creating DynamoDB table for push subscriptions..."

aws dynamodb create-table \
  --table-name my-nishikoyama-push-subscriptions \
  --attribute-definitions \
    AttributeName=subscriptionId,AttributeType=S \
  --key-schema \
    AttributeName=subscriptionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-1

if [ $? -eq 0 ]; then
  echo "✅ Table 'my-nishikoyama-push-subscriptions' created successfully!"
  
  # テーブルが作成されるまで待機
  echo "Waiting for table to be active..."
  aws dynamodb wait table-exists \
    --table-name my-nishikoyama-push-subscriptions \
    --region ap-northeast-1
  
  if [ $? -eq 0 ]; then
    echo "✅ Table is now active and ready to use!"
    
    # テーブルの詳細を表示
    echo "Table details:"
    aws dynamodb describe-table \
      --table-name my-nishikoyama-push-subscriptions \
      --region ap-northeast-1 \
      --query 'Table.{TableName:TableName,TableStatus:TableStatus,ItemCount:ItemCount}'
  fi
else
  echo "❌ Failed to create table. Please check your AWS credentials and permissions."
  exit 1
fi
