// src/services/lineNotifyService.js
// LINE Notifyを使った自動通知サービス

const axios = require('axios');

class LineNotifyService {
  constructor() {
    // LINE NotifyトークンはLINE Notifyのサイトから取得
    this.token = process.env.LINE_NOTIFY_TOKEN;
  }

  /**
   * 新しいイベントが追加されたときに通知を送信
   * @param {Object} event - イベント情報
   */
  async notifyNewEvent(event) {
    if (!this.token) {
      console.log('LINE Notifyトークンが設定されていません');
      return;
    }

    try {
      // メッセージを作成
      const message = this.formatEventMessage(event);
      
      // LINE Notifyに送信
      const response = await axios.post(
        'https://notify-api.line.me/api/notify',
        new URLSearchParams({
          message: message
        }),
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      if (response.status === 200) {
        console.log('✅ LINE Notify送信成功:', event.title);
      }
    } catch (error) {
      console.error('❌ LINE Notify送信エラー:', error.message);
    }
  }

  /**
   * イベント情報をメッセージフォーマットに変換
   * @param {Object} event - イベント情報
   * @returns {string} フォーマット済みメッセージ
   */
  formatEventMessage(event) {
    const area = {
      'nishikoyama': '西小山',
      'musashikoyama': '武蔵小山',
      'shinagawa_other': '品川区'
    };

    const category = {
      'family': '👨‍👩‍👧‍👦 親子向け',
      'free': '🎫 無料',
      'food': '🍽️ グルメ',
      'sports': '🏃 スポーツ',
      'culture': '🎨 文化',
      'senior': '👴 シニア'
    };

    const categories = event.category
      .map(cat => category[cat] || cat)
      .join(' ');

    const message = `
🆕 新しいイベントが追加されました！

📍 ${area[event.area] || event.area}エリア
📌 ${event.title}
📅 ${event.date} ${event.time}
📍 ${event.location}
🏷️ ${categories}

${event.description}

詳細はこちら：
https://my-nishikoyama-frontend.vercel.app/event/${event.id}
`;

    return message.trim();
  }
}

module.exports = LineNotifyService;
