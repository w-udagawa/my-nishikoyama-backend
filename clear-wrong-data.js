// DynamoDBのデータを削除するスクリプト
const AWS = require('aws-sdk');
require('dotenv').config();

// AWS設定
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

async function clearWrongData() {
  try {
    console.log('間違ったデータの削除を開始します...');
    
    // すべてのイベントを取得
    const scanParams = {
      TableName: tableName
    };
    
    const result = await docClient.scan(scanParams).promise();
    console.log(`${result.Items.length}件のイベントが見つかりました`);
    
    // 間違ったデータを削除（場所が「目黒区内」のもの）
    const deletePromises = result.Items
      .filter(item => item.location === '目黒区内')
      .map(item => {
        console.log(`削除: ${item.title}`);
        return docClient.delete({
          TableName: tableName,
          Key: { id: item.id }
        }).promise();
      });
    
    await Promise.all(deletePromises);
    console.log(`${deletePromises.length}件のイベントを削除しました`);
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 実行確認
console.log('このスクリプトは間違ったデータを削除します。');
console.log('続行しますか？ (Ctrl+Cで中止)');

setTimeout(() => {
  clearWrongData();
}, 3000);
