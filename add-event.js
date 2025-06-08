// イベントを手動で登録するスクリプト
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// AWS設定
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

// 新しいイベントの例
const newEvent = {
  id: uuidv4().substring(0, 20),
  title: '西小山商店街 七夕まつり',
  date: '2025-07-07',
  time: '15:00-20:00',
  location: '西小山商店街全域',
  address: '東京都目黒区原町1丁目',
  description: '短冊に願い事を書いて飾りましょう。商店街各店舗で七夕限定メニューも提供。浴衣でご来場の方には特典あり！',
  category: ['family', 'food'],
  source: 'nishikoyama_shopping',
  sourceUrl: 'https://example.com/tanabata',
  imageUrl: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

async function addEvent(event) {
  try {
    await docClient.put({
      TableName: tableName,
      Item: event
    }).promise();
    
    console.log('イベントを追加しました:', event.title);
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 実行
addEvent(newEvent);
