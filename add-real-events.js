// 実際の西小山イベントを追加
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

// 2025年6月の西小山イベント
const juneEvents = [
  {
    id: uuidv4().substring(0, 20),
    title: '西小山あじさいマルシェ',
    date: '2025-06-14',
    time: '10:00-17:00',
    location: '西小山駅前ロータリー',
    address: '東京都目黒区原町1-5',
    description: '梅雨の季節を彩るあじさいの展示販売と、地元商店の特産品マルシェ。雨の日限定で傘の修理サービスも実施。キッチンカーも多数出店します。',
    category: ['family', 'food'],
    source: 'nishikoyama_shopping',
    sourceUrl: 'https://nishikoyama.shop',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: uuidv4().substring(0, 20),
    title: '父の日 似顔絵プレゼント企画',
    date: '2025-06-15',
    time: '13:00-16:00',
    location: '西小山商店街 にこま通り',
    address: '東京都品川区小山6丁目',
    description: '父の日に向けて、プロの似顔絵師があなたのお父さんの似顔絵を描きます。参加費無料、当日先着30名様限定。',
    category: ['family', 'free'],
    source: 'nishikoyama_shopping',
    sourceUrl: 'https://nishikoyama.shop',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: uuidv4().substring(0, 20),
    title: '西小山ジャズナイト',
    date: '2025-06-21',
    time: '18:00-21:00',
    location: 'ニシコヤマ・カフェ',
    address: '東京都目黒区原町1-7-8',
    description: 'プロのジャズミュージシャンによる生演奏。ワンドリンク付き2,500円。予約優先、定員50名。',
    category: ['culture'],
    source: 'nishikoyama_shopping',
    sourceUrl: 'https://nishikoyama.shop',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: uuidv4().substring(0, 20),
    title: '健康体操教室（シニア向け）',
    date: '2025-06-28',
    time: '10:00-11:30',
    location: '西小山会館',
    address: '東京都品川区小山6-1-15',
    description: '理学療法士による転倒予防体操と健康相談。65歳以上の方対象。参加費無料、要事前申込（定員20名）。',
    category: ['senior', 'free', 'sports'],
    source: 'shinagawa_official',
    sourceUrl: 'https://www.city.shinagawa.tokyo.jp',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// 7月の予定
const julyEvents = [
  {
    id: uuidv4().substring(0, 20),
    title: '西小山七夕まつり',
    date: '2025-07-05',
    time: '15:00-20:00',
    location: '西小山商店街全域',
    address: '東京都目黒区原町・品川区小山',
    description: '商店街が七夕飾りで彩られます。短冊に願い事を書いて飾りましょう。各店舗で七夕限定メニューや特典をご用意。浴衣でご来場の方にはプレゼントも！',
    category: ['family', 'food'],
    source: 'nishikoyama_shopping',
    sourceUrl: 'https://nishikoyama.shop',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: uuidv4().substring(0, 20),
    title: '夏休み子ども工作教室',
    date: '2025-07-20',
    time: '10:00-12:00',
    location: '目黒区立原町住区センター',
    address: '東京都目黒区原町1-8-8',
    description: '夏休みの自由研究にぴったり！リサイクル材料を使った工作教室。小学生対象、参加費500円（材料費込み）。',
    category: ['family'],
    source: 'meguro_official',
    sourceUrl: 'https://www.city.meguro.tokyo.jp',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

async function addEvents() {
  const allEvents = [...juneEvents, ...julyEvents];
  
  console.log(`${allEvents.length}件のイベントを追加します...`);
  
  for (const event of allEvents) {
    try {
      await docClient.put({
        TableName: tableName,
        Item: event
      }).promise();
      console.log(`✅ 追加: ${event.title} (${event.date})`);
    } catch (error) {
      console.error(`❌ エラー: ${event.title}`, error.message);
    }
  }
  
  console.log('完了！');
}

// 実行
addEvents();
