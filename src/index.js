const express = require('express');
const AWS = require('aws-sdk');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const Event = require('./models/Event');
const webPushService = require('./services/webPushService');
require('dotenv').config();

dayjs.extend(utc);
dayjs.extend(timezone);

// Express アプリケーションの初期化
const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア設定
app.use(express.json());

// CORS設定 - LIFFアプリからのアクセスを許可
app.use((req, res, next) => {
  // LINE LIFFアプリのドメインを許可
  const allowedOrigins = [
    'https://liff.line.me',
    'http://localhost:5173', // 開発環境
    'http://localhost:3001',
    'https://my-nishikoyama-frontend.vercel.app', // 本番フロントエンド
    process.env.FRONTEND_URL
  ].filter(Boolean);
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Line-UserId');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// AWS DynamoDB設定
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamoDB = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

// Web Push初期化
webPushService.initializeWebPush();

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'my-nishikoyama-backend'
  });
});

// VAPID公開鍵取得エンドポイント
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({
    success: true,
    data: {
      publicKey: process.env.VAPID_PUBLIC_KEY
    }
  });
});

// Push通知購読エンドポイント
app.post('/api/push/subscribe', async (req, res) => {
  try {
    const { subscription, preferences } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({
        success: false,
        error: '購読情報が不正です'
      });
    }

    const result = await webPushService.saveSubscription(subscription, preferences);
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('購読エラー:', error);
    res.status(500).json({
      success: false,
      error: '購読の登録に失敗しました'
    });
  }
});

// Push通知購読解除エンドポイント
app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'エンドポイントが指定されていません'
      });
    }

    await webPushService.removeSubscription(endpoint);
    
    res.json({
      success: true,
      message: '購読を解除しました'
    });

  } catch (error) {
    console.error('購読解除エラー:', error);
    res.status(500).json({
      success: false,
      error: '購読の解除に失敗しました'
    });
  }
});

// Push通知設定更新エンドポイント
app.put('/api/push/preferences', async (req, res) => {
  try {
    const { endpoint, preferences } = req.body;

    if (!endpoint || !preferences) {
      return res.status(400).json({
        success: false,
        error: 'エンドポイントまたは設定が指定されていません'
      });
    }

    await webPushService.updateSubscriptionPreferences(endpoint, preferences);
    
    res.json({
      success: true,
      message: '通知設定を更新しました'
    });

  } catch (error) {
    console.error('設定更新エラー:', error);
    res.status(500).json({
      success: false,
      error: '設定の更新に失敗しました'
    });
  }
});

// テスト通知送信エンドポイント（開発用）
app.post('/api/push/test', async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'エンドポイントが指定されていません'
      });
    }

    const testEvent = {
      id: 'test-' + Date.now(),
      title: 'テスト通知',
      date: dayjs().format('YYYY-MM-DD'),
      time: dayjs().format('HH:mm'),
      location: 'テスト会場',
      area: 'nishikoyama'
    };

    const result = await webPushService.notifyNewEvent(testEvent);
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('テスト通知エラー:', error);
    res.status(500).json({
      success: false,
      error: 'テスト通知の送信に失敗しました'
    });
  }
});

// イベント一覧取得エンドポイント
app.get('/api/events', async (req, res) => {
  try {
    const { 
      categories,      // カテゴリーフィルター（カンマ区切り）
      interests,       // ユーザーの興味（カンマ区切り）
      area,           // エリアフィルター（nishikoyama, musashikoyama, shinagawa_other, all）
      startDate,       // 開始日（YYYY-MM-DD）
      endDate,         // 終了日（YYYY-MM-DD）
      limit = 50,      // 取得件数
      lastKey,         // ページネーション用
      includeDemo = false  // デモデータを含めるかどうか（デフォルトはfalse）
    } = req.query;

    // 現在日時を日本時間で取得
    const now = dayjs().tz('Asia/Tokyo');
    // 過去1週間からのイベントも含める
    const fromDate = startDate || now.subtract(7, 'day').format('YYYY-MM-DD');
    const toDate = endDate || now.add(3, 'month').format('YYYY-MM-DD');

    // DynamoDBクエリパラメータ
    const params = {
      TableName: tableName,
      FilterExpression: '#date BETWEEN :fromDate AND :toDate',
      ExpressionAttributeNames: {
        '#date': 'date'
      },
      ExpressionAttributeValues: {
        ':fromDate': fromDate,
        ':toDate': toDate
      }
      // Limitをここでは適用しない（フィルタリング後に適用）
    };

    // ページネーション
    if (lastKey) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(lastKey, 'base64').toString());
    }

    // DynamoDBスキャン実行
    const result = await docClient.scan(params).promise();
    
    // Event モデルに変換
    let events = result.Items.map(item => {
      // DocumentClient を使用しているので、型情報なしで直接値を取得
      return new Event({
        id: item.id,
        title: item.title,
        date: item.date,
        time: item.time,
        location: item.location,
        address: item.address || '',
        description: item.description,
        category: item.category || [],
        source: item.source,
        sourceUrl: item.sourceUrl,
        imageUrl: item.imageUrl || null,
        coordinates: item.coordinates || null,
        isDemo: item.isDemo || false,
        area: item.area || 'nishikoyama',
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      });
    });

    // デモデータのフィルタリング
    if (includeDemo !== 'true') {
      events = events.filter(event => !event.isDemo);
    }

    // エリアフィルタリング
    if (area && area !== 'all') {
      events = events.filter(event => event.area === area);
    }

    // カテゴリーフィルタリング
    if (categories) {
      const categoryList = categories.split(',');
      events = events.filter(event => 
        event.category.some(cat => categoryList.includes(cat))
      );
    }

    // ユーザーの興味に基づくスコアリング
    if (interests) {
      const interestList = interests.split(',');
      events = events.map(event => {
        const score = event.category.filter(cat => 
          interestList.includes(cat)
        ).length;
        return { ...event, relevanceScore: score };
      });
      
      // スコアの高い順にソート
      events.sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        // スコアが同じ場合は日付順
        return dayjs(a.date).unix() - dayjs(b.date).unix();
      });
    } else {
      // 興味が指定されていない場合は日付順
      events.sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix());
    }

    // limitを適用
    const limitedEvents = events.slice(0, parseInt(limit));

    // ページネーショントークン
    let nextPageToken = null;
    if (result.LastEvaluatedKey) {
      nextPageToken = Buffer.from(
        JSON.stringify(result.LastEvaluatedKey)
      ).toString('base64');
    }

    res.json({
      success: true,
      data: {
        events: limitedEvents,
        nextPageToken: nextPageToken,
        total: limitedEvents.length
      }
    });

  } catch (error) {
    console.error('イベント取得エラー:', error);
    res.status(500).json({
      success: false,
      error: 'イベントの取得に失敗しました'
    });
  }
});

// イベント詳細取得エンドポイント
app.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const params = {
      TableName: tableName,
      Key: {
        id: id
      }
    };

    const result = await docClient.get(params).promise();

    if (!result.Item) {
      return res.status(404).json({
        success: false,
        error: 'イベントが見つかりません'
      });
    }

    const event = new Event({
      id: result.Item.id,
      title: result.Item.title,
      date: result.Item.date,
      time: result.Item.time,
      location: result.Item.location,
      address: result.Item.address || '',
      description: result.Item.description,
      category: result.Item.category || [],
      source: result.Item.source,
      sourceUrl: result.Item.sourceUrl,
      imageUrl: result.Item.imageUrl || null,
      coordinates: result.Item.coordinates || null,
      isDemo: result.Item.isDemo || false,
      area: result.Item.area || 'nishikoyama',
      createdAt: result.Item.createdAt,
      updatedAt: result.Item.updatedAt
    });

    res.json({
      success: true,
      data: event
    });

  } catch (error) {
    console.error('イベント詳細取得エラー:', error);
    res.status(500).json({
      success: false,
      error: 'イベントの取得に失敗しました'
    });
  }
});

// カテゴリー一覧取得エンドポイント
app.get('/api/categories', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'family', name: '親子向け', icon: '👨‍👩‍👧‍👦' },
      { id: 'free', name: '無料', icon: '🆓' },
      { id: 'food', name: 'グルメ・食べ歩き', icon: '🍽️' },
      { id: 'sports', name: 'スポーツ・健康', icon: '🏃' },
      { id: 'culture', name: '文化・アート', icon: '🎨' },
      { id: 'senior', name: 'シニア向け', icon: '👴' },
      { id: 'sale', name: 'セール・特売', icon: '🏷️' },
      { id: 'workshop', name: 'ワークショップ', icon: '🛠️' },
      { id: 'festival', name: 'お祭り', icon: '🎪' },
      { id: 'local', name: '地域イベント', icon: '📍' }
    ]
  });
});

// エリア一覧取得エンドポイント
app.get('/api/areas', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'all', name: '品川区', description: '品川区全体のイベント' },
      { id: 'nishikoyama', name: '西小山', description: '西小山エリアのイベント' },
      { id: 'musashikoyama', name: '武蔵小山', description: '武蔵小山エリアのイベント' },
      { id: 'shinagawa_other', name: '品川区その他', description: '品川駅・大井町駅など他エリアのイベント' }
    ]
  });
});

// 統計情報取得エンドポイント（管理用）
app.get('/api/stats', async (req, res) => {
  try {
    const params = {
      TableName: tableName,
      Select: 'COUNT'
    };

    const result = await docClient.scan(params).promise();

    res.json({
      success: true,
      data: {
        totalEvents: result.Count,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('統計情報取得エラー:', error);
    res.status(500).json({
      success: false,
      error: '統計情報の取得に失敗しました'
    });
  }
});

// 404エラーハンドリング
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'エンドポイントが見つかりません'
  });
});

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error('サーバーエラー:', err);
  res.status(500).json({
    success: false,
    error: 'サーバーエラーが発生しました'
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 サーバーが起動しました: http://localhost:${PORT}`);
  console.log(`環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`DynamoDBテーブル: ${tableName}`);
});

// スクレイピングスケジューラー（本番環境のみ）
if (process.env.NODE_ENV === 'production') {
  const cron = require('node-cron');
  const EventCollector = require('./scrapers');
  
  const collector = new EventCollector();
  
  // 毎日朝9時にスクレイピング実行
  cron.schedule(process.env.SCRAPING_INTERVAL || '0 9 * * *', async () => {
    console.log('定期スクレイピング開始...');
    try {
      await collector.collectAllEvents();
    } catch (error) {
      console.error('定期スクレイピングエラー:', error);
    }
  });
  
  console.log('スクレイピングスケジューラーを開始しました');
}

module.exports = app;
