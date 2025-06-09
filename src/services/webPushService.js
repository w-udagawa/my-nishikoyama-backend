const webpush = require('web-push');
const dayjs = require('dayjs');
const AWS = require('aws-sdk');

// DynamoDBの設定
const dynamoDB = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

const SUBSCRIPTIONS_TABLE = process.env.PUSH_SUBSCRIPTIONS_TABLE || 'my-nishikoyama-push-subscriptions';

// Web Pushの設定
const initializeWebPush = () => {
  // VAPID keysの生成方法:
  // const vapidKeys = webpush.generateVAPIDKeys();
  // console.log('Public Key:', vapidKeys.publicKey);
  // console.log('Private Key:', vapidKeys.privateKey);
  
  webpush.setVapidDetails(
    'mailto:' + process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
};

// 購読情報の保存
const saveSubscription = async (subscription, preferences = {}) => {
  const subscriptionId = Buffer.from(subscription.endpoint).toString('base64').slice(-20);
  
  const params = {
    TableName: SUBSCRIPTIONS_TABLE,
    Item: {
      subscriptionId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      preferences: {
        areas: preferences.areas || ['西小山', '武蔵小山', '品川区その他'],
        notificationTiming: preferences.notificationTiming || 'immediate',
        ...preferences
      },
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
      active: true
    }
  };

  try {
    await dynamoDB.put(params).promise();
    return { success: true, subscriptionId };
  } catch (error) {
    console.error('Error saving subscription:', error);
    throw error;
  }
};

// 購読情報の削除
const removeSubscription = async (endpoint) => {
  const subscriptionId = Buffer.from(endpoint).toString('base64').slice(-20);
  
  const params = {
    TableName: SUBSCRIPTIONS_TABLE,
    Key: { subscriptionId },
    UpdateExpression: 'SET active = :active, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':active': false,
      ':updatedAt': dayjs().toISOString()
    }
  };

  try {
    await dynamoDB.update(params).promise();
    return { success: true };
  } catch (error) {
    console.error('Error removing subscription:', error);
    throw error;
  }
};

// 購読設定の更新
const updateSubscriptionPreferences = async (endpoint, preferences) => {
  const subscriptionId = Buffer.from(endpoint).toString('base64').slice(-20);
  
  const params = {
    TableName: SUBSCRIPTIONS_TABLE,
    Key: { subscriptionId },
    UpdateExpression: 'SET preferences = :preferences, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':preferences': preferences,
      ':updatedAt': dayjs().toISOString()
    }
  };

  try {
    await dynamoDB.update(params).promise();
    return { success: true };
  } catch (error) {
    console.error('Error updating preferences:', error);
    throw error;
  }
};

// アクティブな購読情報の取得
const getActiveSubscriptions = async (area = null) => {
  const params = {
    TableName: SUBSCRIPTIONS_TABLE,
    FilterExpression: 'active = :active',
    ExpressionAttributeValues: {
      ':active': true
    }
  };

  try {
    const result = await dynamoDB.scan(params).promise();
    let subscriptions = result.Items;

    // エリアでフィルタリング
    if (area) {
      subscriptions = subscriptions.filter(sub => 
        sub.preferences.areas && sub.preferences.areas.includes(area)
      );
    }

    return subscriptions;
  } catch (error) {
    console.error('Error getting subscriptions:', error);
    return [];
  }
};

// 通知の送信
const sendNotification = async (subscription, payload) => {
  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: subscription.keys
  };

  try {
    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    return { success: true };
  } catch (error) {
    // 410 Goneエラーの場合は購読情報を削除
    if (error.statusCode === 410) {
      await removeSubscription(subscription.endpoint);
    }
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
};

// 新着イベント通知の送信
const notifyNewEvent = async (event) => {
  // イベントのエリアに基づいて購読者を取得
  const subscribers = await getActiveSubscriptions(event.area);
  
  const payload = {
    type: 'new-event',
    title: `新着イベント: ${event.title}`,
    body: `📅 ${dayjs(event.date).format('M/D(ddd)')} 📍 ${event.location}`,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    image: event.imageUrl,
    data: {
      eventId: event.id,
      url: `/events/${event.id}`
    }
  };

  const results = await Promise.all(
    subscribers.map(sub => sendNotification(sub, payload))
  );

  const successCount = results.filter(r => r.success).length;
  console.log(`Sent ${successCount}/${subscribers.length} notifications for event: ${event.title}`);
  
  return { successCount, totalSubscribers: subscribers.length };
};

// 一括通知の送信（管理者用）
const sendBulkNotification = async (title, body, area = null) => {
  const subscribers = await getActiveSubscriptions(area);
  
  const payload = {
    type: 'announcement',
    title,
    body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: {
      url: '/'
    }
  };

  const results = await Promise.all(
    subscribers.map(sub => sendNotification(sub, payload))
  );

  const successCount = results.filter(r => r.success).length;
  return { successCount, totalSubscribers: subscribers.length };
};

module.exports = {
  initializeWebPush,
  saveSubscription,
  removeSubscription,
  updateSubscriptionPreferences,
  sendNotification,
  notifyNewEvent,
  sendBulkNotification
};
