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
 * 获取微博热搜数据
 */
async function fetchWeiboHotSearch() {
  console.log('🔍 开始抓取微博热搜...');
  
  try {
    // 使用微博移动端API（更容易获取数据）
    const response = await axios.get(
      'https://m.weibo.cn/api/container/getIndex',
      {
        params: {
          containerid: '106003type=1',
          page_type: 'searchall',
          page: 1
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
          'Referer': 'https://m.weibo.cn/p/index?containerid=106003type%3D1',
          'Accept': 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest',
          'MWeibo-Pwa': '1'
        },
        timeout: 10000
      }
    );

    if (response.data && response.data.ok === 1) {
      return parseHotSearchData(response.data);
    }
    
    throw new Error('API返回数据格式异常');
  } catch (error) {
    console.error('❌ 抓取失败:', error.message);
    
    // 备用方案：直接爬取网页
    return await fetchFromWebpage();
  }
}

/**
 * 备用方案：直接爬取网页
 */
async function fetchFromWebpage() {
  console.log('📄 尝试从网页抓取...');
  
  try {
    const response = await axios.get(
      'https://s.weibo.com/top/summary',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': 'SUB=_2A25KJJQeDeRhGeNN6VQS8yrKwz2IHXVqMKM4rDV8PUNbmtAGLRXSkjNUFtCyU_3qU7tbkGeqcU7xNDbYq2qDpCk; SUBP=0033WrSXqPxfM725Ws9jqgMF55529P9D9WhQ-N-hviLMi-zzOo5MhF45NHDpA50Ws4Djmgi-zE9B0qpeo.0Ws4Djm-zdcttfi--ciKnRi-z8; _ga=GA1.2.1234567890.1234567890',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        },
        timeout: 15000
      }
    );

    return parseWebpageData(response.data);
  } catch (error) {
    console.error('❌ 网页抓取也失败了:', error.message);
    return null;
  }
}

/**
 * 解析API返回的热搜数据
 */
function parseHotSearchData(data) {
  const hotList = [];
  
  try {
    // 尝试从多种数据结构中提取热搜
    const cards = data.data?.cards || [];
    
    for (const card of cards) {
      if (card.card_group) {
        for (const item of card.card_group) {
          if (item.desc && item.desc_extr) {
            const parts = item.desc_extr.split(',');
            hotList.push({
              id: hotList.length + 1,
              title: `#${item.desc}#`,
              heat: parts[0] || '0',
              isHot: parseInt(parts[0]) > 500000,
              trend: 'up',
              source: '微博',
              fetchTime: new Date().toISOString()
            });
          }
        }
      }
    }

    // 如果上面没找到，尝试其他数据结构
    if (hotList.length === 0 && data.data?.realtime) {
      for (const item of data.data.realtime) {
        hotList.push({
          id: hotList.length + 1,
          title: `#${item.word || item.topic_name}#`,
          heat: item.raw_hot || item.hot || '0',
          isHot: item.is_hot === 1,
          trend: item.is_new ? 'new' : 'up',
          source: '微博',
          fetchTime: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error('解析数据出错:', error.message);
  }

  return hotList.length > 0 ? hotList : null;
}

/**
 * 解析网页数据
 */
function parseWebpageData(html) {
  const hotList = [];
  
  try {
    // 简单的正则匹配（微博网页结构可能变化）
    const regex = /<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/g;
    let match;
    let index = 1;
    
    while ((match = regex.exec(html)) !== null && index <= 50) {
      hotList.push({
        id: index,
        title: `#${match[2].trim()}#`,
        heat: parseInt(match[1]) * 10000,
        isHot: index <= 10,
        trend: 'up',
        source: '微博',
        fetchTime: new Date().toISOString()
      });
      index++;
    }
  } catch (error) {
    console.error('解析网页出错:', error.message);
  }

  return hotList.length > 0 ? hotList : null;
}

/**
 * 保存数据到文件
 */
function saveData(data) {
  const saveData = {
    updateTime: new Date().toISOString(),
    expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30分钟后过期
    count: data.length,
    list: data
  };

  fs.writeFileSync(HOTSEARCH_FILE, JSON.stringify(saveData, null, 2), 'utf-8');
  console.log(`✅ 数据已保存: ${data.length} 条热搜`);
  
  return saveData;
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
    console.log('📊 热搜榜单预览:');
    data.slice(0, 10).forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.title} (${item.heat})`);
    });
    return result;
  } else {
    console.log('⚠️ 未能获取到热搜数据');
    return null;
  }
}

// 如果直接运行此脚本
main().catch(console.error);

// 导出供其他模块使用
export { main, fetchWeiboHotSearch, saveData };
