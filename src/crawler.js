/**
 * 微博热搜爬虫
 * 定时抓取微博热搜榜单数据
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据存储路径
const DATA_DIR = path.join(__dirname, '../data');
const HOTSEARCH_FILE = path.join(DATA_DIR, 'hotsearch.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * 主接口：weibo.com/ajax/side/hotSearch（最稳定）
 */
async function fetchFromAjaxAPI() {
  console.log('🔍 尝试主接口 weibo.com/ajax/side/hotSearch ...');
  const response = await axios.get(
    'https://weibo.com/ajax/side/hotSearch',
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://weibo.com/',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      },
      timeout: 12000
    }
  );

  const realtime = response.data?.data?.realtime;
  if (!realtime || realtime.length === 0) throw new Error('主接口：数据为空');

  return realtime.map((item, index) => ({
    id: index + 1,
    title: `#${item.word}#`,
    heat: formatHeat(item.raw_hot || item.hot || 0),
    rawHeat: item.raw_hot || item.hot || 0,
    isHot: item.is_hot === 1 || index < 3,
    trend: item.is_new === 1 ? 'new' : (item.flag === 1 ? 'up' : 'up'),
    source: '微博',
    fetchTime: new Date().toISOString()
  }));
}

/**
 * 备用接口：s.weibo.com/top/summary（网页抓取）
 */
async function fetchFromSummaryPage() {
  console.log('📄 尝试备用接口 s.weibo.com/top/summary ...');
  const response = await axios.get(
    'https://s.weibo.com/top/summary',
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://weibo.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      },
      timeout: 15000
    }
  );

  const hotList = [];
  // 匹配热搜条目
  const regex = /<td class="td-02"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<\/td>[\s\S]*?<td class="td-03">(\d*)<\/td>/g;
  let match;
  while ((match = regex.exec(response.data)) !== null && hotList.length < 50) {
    hotList.push({
      id: hotList.length + 1,
      title: `#${match[1].trim()}#`,
      heat: formatHeat(parseInt(match[2]) || 0),
      rawHeat: parseInt(match[2]) || 0,
      isHot: hotList.length < 3,
      trend: 'up',
      source: '微博',
      fetchTime: new Date().toISOString()
    });
  }
  if (hotList.length === 0) throw new Error('备用接口：网页解析失败，结构可能已变化');
  return hotList;
}

/**
 * 格式化热度数字
 */
function formatHeat(num) {
  if (!num || num === 0) return '热';
  if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿';
  if (num >= 10000) return Math.round(num / 10000) + '万';
  return String(num);
}

/**
 * 获取微博热搜（自动降级）
 */
async function fetchWeiboHotSearch() {
  // 依次尝试接口，成功即返回
  const fetchers = [fetchFromAjaxAPI, fetchFromSummaryPage];
  for (const fetcher of fetchers) {
    try {
      const data = await fetcher();
      if (data && data.length > 0) {
        console.log(`✅ 抓取成功，共 ${data.length} 条`);
        return data;
      }
    } catch (err) {
      console.error(`❌ 接口失败: ${err.message}`);
    }
  }
  console.error('❌ 所有接口均失败');
  return null;
}

/**
 * 保存数据到文件
 */
function saveData(data) {
  const result = {
    updateTime: new Date().toISOString(),
    expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    count: data.length,
    list: data
  };
  fs.writeFileSync(HOTSEARCH_FILE, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`💾 数据已保存: ${data.length} 条热搜`);
  return result;
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('📅 微博热搜爬虫 -', new Date().toLocaleString('zh-CN'));
  console.log('========================================');

  const data = await fetchWeiboHotSearch();

  if (data && data.length > 0) {
    const result = saveData(data);
    console.log('📊 热搜榜单预览（前10）:');
    data.slice(0, 10).forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.title}  ${item.heat}`);
    });
    return result;
  } else {
    console.error('⚠️ 未能获取到热搜数据，保留上次缓存');
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

export { main, fetchWeiboHotSearch, saveData };
