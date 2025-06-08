// 正しいサンプルデータを投入するスクリプト
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
require('dotenv').config();

// AWS設定
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

// 西小山の正しいサンプルイベント
const sampleEvents = [
  {
    title: '西小山あじさい祭り',
    date: dayjs().add(3, 'day').format('YYYY-MM-DD'),
    time: '10:00-16:00',
    location: '西小山駅前広場',
    address: '東京都目黒区原町1-1',
    description: '梅雨を彩る紫陽花の展示即売会。地域の飲食店による屋台、傘のペイントワークショップなど、雨の日も楽しめるイベントが盛りだくさん！',
    category: ['family', 'free', 'food'],
    source: 'nishikoyama_shopping',
    sourceUrl: 'https://example.com/ajisai-festival'
  },
  {
    title: '親子でヨガ体験教室',
    date: dayjs().add(5, 'day').format('YYYY-MM-DD'),
    time: '14:00-15:00',
    location: '西小山区民センター',
    address: '東京都品川区小山6-1-1',
    description: '初心者歓迎！親子で楽しめるヨガ教室です。運動不足解消にもぴったり。参加費無料、要事前申込。',
    category: ['family', 'free', 'sports'],
    source: 'shinagawa_official',
    sourceUrl: 'https://example.com/yoga-class'
  },
  {
    title: '西小山夏祭り前夜祭',
    date: dayjs().add(7, 'day').format('YYYY-MM-DD'),
    time: '11:00-17:00',
    location: '西小山商店街',
    address: '東京都目黒区原町',
    description: '夏本番に向けて商店街が盛り上がる！かき氷、冷やし中華など夏メニューの食べ歩き。浴衣で来場すると特典あり！',
    category: ['food', 'family'],
    source: 'nishikoyama_shopping',
    sourceUrl: 'https://example.com/summer-festival'
  },
  {
    title: 'シニア向け スマホ講座',
    date: dayjs().add(10, 'day').format('YYYY-MM-DD'),
    time: '10:00-12:00',
    location: '目黒区立原町住区センター',
    address: '東京都目黒区原町1-8-8',
    description: 'LINEの使い方から写真の撮り方まで、基礎から丁寧に教えます。参加無料、定員20名。',
    category: ['senior', 'free'],
    source: 'meguro_official',
    sourceUrl: 'https://example.com/smartphone-class'
  },
  {
    title: '地域清掃ボランティア',
    date: dayjs().add(14, 'day').format('YYYY-MM-DD'),
    time: '9:00-11:00',
    location: '西小山駅周辺',
    address: '東京都目黒区原町',
    description: '月に一度の地域清掃活動。みんなで西小山をきれいにしましょう！軍手・ゴミ袋は用意します。',
    category: ['free'],
    source: 'nishikoyama_community',
    sourceUrl: 'https://example.com/cleaning-volunteer'
  }
];

async function insertSampleData() {
  try {
    console.log('正しいサンプルデータの投入を開始します...');
    
    const putPromises = sampleEvents.map(event => {
      const item = {
        id: uuidv4().substring(0, 20),
        ...event,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      console.log(`追加: ${item.title}`);
      
      return docClient.put({
        TableName: tableName,
        Item: item
      }).promise();
    });
    
    await Promise.all(putPromises);
    console.log(`${sampleEvents.length}件のサンプルイベントを追加しました`);
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 実行
insertSampleData();
