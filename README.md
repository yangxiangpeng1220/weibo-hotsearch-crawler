# 微博热搜爬虫服务

定时抓取微博热搜数据，提供 API 接口供小程序调用。

## 功能特性

- 🔍 自动抓取微博热搜榜单
- ⏰ 每 30 分钟自动更新（通过 GitHub Actions）
- 📡 提供 RESTful API 接口
- 🌐 网页端数据预览
- 📦 数据缓存，避免重复请求

## 快速开始

### 本地运行

```bash
# 克隆项目
git clone <your-repo>
cd crawler

# 安装依赖
npm install

# 运行爬虫（一次性）
npm run crawl

# 启动 API 服务器
npm start

# 服务器地址: http://localhost:3000
```

### 部署到云平台

#### 方式一：Railway（推荐，免费）

1. 登录 [Railway](https://railway.app)
2. 点击 "New Project" → "Deploy from GitHub"
3. 选择本项目仓库
4. Railway 会自动检测 Node.js 项目并部署

#### 方式二：Vercel

```bash
npm install -g vercel
vercel
```

#### 方式三：自建服务器

将项目部署到有公网 IP 的服务器：

```bash
# 使用 PM2 管理进程
npm install -g pm2
pm2 start src/server.js --name weibo-crawler

# 设置开机自启
pm2 save
pm2 startup
```

## API 接口

### 获取热搜数据

```
GET /api/hotsearch
```

**响应示例：**

```json
{
  "success": true,
  "source": "cache",
  "data": {
    "updateTime": "2024-01-01T12:00:00.000Z",
    "expireTime": "2024-01-01T12:30:00.000Z",
    "count": 50,
    "list": [
      {
        "id": 1,
        "title": "#热搜话题#",
        "heat": "9852000",
        "isHot": true,
        "trend": "up",
        "source": "微博",
        "fetchTime": "2024-01-01T12:00:00.000Z"
      }
    ]
  }
}
```

### 手动触发抓取

```
POST /api/crawl
```

### 获取统计信息

```
GET /api/stats
```

## 小程序接入

### 修改 API 地址

在微信小程序中修改 `app.js` 的数据获取逻辑：

```javascript
// 替换原来的模拟数据为真实 API 调用
async function fetchHotSearch() {
  try {
    // 替换为你部署的 API 地址
    const response = await wx.request({
      url: 'https://你的API域名.com/api/hotsearch',
      method: 'GET'
    });
    
    if (response.data.success) {
      return response.data.data.list;
    }
  } catch (error) {
    console.error('获取热搜失败:', error);
    // 失败时返回缓存的模拟数据
    return getMockData();
  }
}
```

### 白名单配置

如果使用微信云开发或后端代理，需要在微信公众平台配置：
- 登录微信公众平台
- 开发 → 开发管理 → 服务器域名
- 添加 request 合法域名：你的 API 地址

## GitHub Actions 定时任务

本项目使用 GitHub Actions 实现定时抓取：

- **执行频率**：每 30 分钟
- **触发方式**：push 到 main 分支自动部署
- **手动触发**：在 GitHub Actions 页面点击 "Run workflow"

### 启用定时任务

1. 将代码推送到 GitHub 仓库
2. 在仓库 Settings → Pages 中启用 GitHub Pages
3. Source 选择 `gh-pages` 分支
4. Actions 会自动执行定时任务

## 数据格式说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 热搜排名 |
| title | string | 热搜话题（包含 #） |
| heat | string/number | 热度值 |
| isHot | boolean | 是否为爆款热搜 |
| trend | string | 趋势：up/down/new |
| source | string | 数据来源 |
| fetchTime | string | 抓取时间 |

## 注意事项

1. **请求频率**：微博可能有反爬机制，请勿过于频繁请求
2. **数据合规**：请确保数据使用符合微博的服务条款
3. **缓存策略**：API 会缓存 30 分钟，减少重复请求
4. **备份数据**：`data/hotsearch.json` 是本地缓存文件

## 扩展功能

### 添加更多数据源

在 `src/crawler.js` 中添加新的抓取函数：

```javascript
async function fetchDouyinHot() {
  // 抖音热搜抓取逻辑
}

async function fetchBilibiliHot() {
  // B站热搜抓取逻辑
}
```

### 数据存储

当前使用 JSON 文件存储，可扩展为：

- MySQL/MongoDB 数据库
- Redis 缓存
- 云存储（如七牛云 OSS）

## License

MIT
