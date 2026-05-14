/**
 * 简单的 API 服务器
 * 提供热搜数据 API + 自动抓取功能
 */

import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '../data');
const HOTSEARCH_FILE = path.join(DATA_DIR, 'hotsearch.json');

const app = express();

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// CORS 头（允许小程序访问）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

/**
 * API: 获取热搜数据
 * GET /api/hotsearch
 */
app.get('/api/hotsearch', async (req, res) => {
  try {
    // 检查缓存是否存在且未过期
    if (fs.existsSync(HOTSEARCH_FILE)) {
      const data = JSON.parse(fs.readFileSync(HOTSEARCH_FILE, 'utf-8'));
      const now = new Date();
      const expireTime = new Date(data.expireTime);
      
      if (now < expireTime) {
        console.log(`📦 返回缓存数据 (${data.count} 条, 更新时间: ${data.updateTime})`);
        return res.json({
          success: true,
          source: 'cache',
          data: data
        });
      }
      
      console.log('⏰ 缓存已过期，需要刷新');
    }
    
    // 触发爬虫抓取
    await triggerCrawler();
    
    // 重新读取数据
    if (fs.existsSync(HOTSEARCH_FILE)) {
      const data = JSON.parse(fs.readFileSync(HOTSEARCH_FILE, 'utf-8'));
      return res.json({
        success: true,
        source: 'fresh',
        data: data
      });
    }
    
    res.status(500).json({
      success: false,
      message: '获取数据失败'
    });
  } catch (error) {
    console.error('API错误:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * API: 手动触发抓取
 * POST /api/crawl
 */
app.post('/api/crawl', async (req, res) => {
  try {
    console.log('🔄 收到手动抓取请求...');
    await triggerCrawler();
    
    const data = JSON.parse(fs.readFileSync(HOTSEARCH_FILE, 'utf-8'));
    
    res.json({
      success: true,
      message: '抓取成功',
      data: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * API: 获取统计信息
 * GET /api/stats
 */
app.get('/api/stats', (req, res) => {
  try {
    let stats = {
      lastUpdate: null,
      totalCount: 0,
      cacheStatus: 'empty'
    };
    
    if (fs.existsSync(HOTSEARCH_FILE)) {
      const data = JSON.parse(fs.readFileSync(HOTSEARCH_FILE, 'utf-8'));
      stats = {
        lastUpdate: data.updateTime,
        totalCount: data.count,
        cacheStatus: new Date() < new Date(data.expireTime) ? 'valid' : 'expired'
      };
    }
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 触发爬虫抓取
 */
async function triggerCrawler() {
  return new Promise((resolve, reject) => {
    const crawlerPath = path.join(__dirname, 'crawler.js');
    
    // 确保数据目录存在
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    const crawler = spawn('node', [crawlerPath], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    crawler.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`爬虫退出，代码: ${code}`));
      }
    });
    
    crawler.on('error', reject);
    
    // 超时保护（60秒）
    setTimeout(() => {
      crawler.kill();
      reject(new Error('爬虫执行超时'));
    }, 60000);
  });
}

/**
 * 启动服务器
 */
app.listen(PORT, () => {
  console.log('========================================');
  console.log('🌸 微博热搜 API 服务器已启动');
  console.log(`📡 端口: http://localhost:${PORT}`);
  console.log('========================================');
  console.log('可用接口:');
  console.log('  GET  /api/hotsearch  - 获取热搜数据');
  console.log('  POST /api/crawl      - 手动触发抓取');
  console.log('  GET  /api/stats      - 获取统计信息');
  console.log('========================================');
  
  // 启动时自动抓取一次
  triggerCrawler().catch(console.error);
});
