// APIテストスクリプト
const axios = require('axios');

async function testAPI() {
  const baseURL = 'http://localhost:3000';
  
  try {
    // ヘルスチェック
    console.log('=== ヘルスチェック ===');
    const health = await axios.get(`${baseURL}/health`);
    console.log('ヘルスチェック:', health.data);
    
    // イベント一覧取得
    console.log('\n=== イベント一覧取得 ===');
    const events = await axios.get(`${baseURL}/api/events?limit=10`);
    console.log(`取得件数: ${events.data.data.events.length}件`);
    
    // 最初の3件を表示
    console.log('\n最初の3件のイベント:');
    events.data.data.events.slice(0, 3).forEach((event, index) => {
      console.log(`\n[${index + 1}] ${event.title}`);
      console.log(`  日付: ${event.date}`);
      console.log(`  場所: ${event.location}`);
      console.log(`  カテゴリー: ${event.category.join(', ')}`);
      console.log(`  説明: ${event.description.substring(0, 50)}...`);
    });
    
    // カテゴリー取得
    console.log('\n=== カテゴリー一覧 ===');
    const categories = await axios.get(`${baseURL}/api/categories`);
    console.log('カテゴリー:', categories.data.data.map(c => c.name).join(', '));
    
    // 統計情報
    console.log('\n=== 統計情報 ===');
    const stats = await axios.get(`${baseURL}/api/stats`);
    console.log('総イベント数:', stats.data.data.totalEvents);
    
  } catch (error) {
    console.error('APIエラー:', error.response ? error.response.data : error.message);
  }
}

testAPI();
