export default async function handler(req, res) {
  // 1. 获取客户端访问的真实原始路径（Vercel 重写后会存放在 x-forwarded-uri 中）
  let originalPath = req.headers['x-forwarded-uri'] || req.url;
  
  // 去除可能的 /api 前缀
  if (originalPath.startsWith('/api')) {
    originalPath = originalPath.replace(/^\/api/, '') || '/';
  }

  // 拼接真实的 Bangumi API 地址
  const targetUrl = `https://api.bgm.tv${originalPath}`;

  try {
    // 构造发往 Bangumi 的请求头
    const headers = { ...req.headers };
    delete headers['host'];
    headers['host'] = 'api.bgm.tv';
    headers['referer'] = 'https://api.bgm.tv';
    // Bangumi 强制要求必须有明确的 User-Agent
    headers['user-agent'] = req.headers['user-agent'] || 'BgmProxyClient/1.0';

    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    const response = await fetch(targetUrl, fetchOptions);

    // 设置跨域 CORS 头，方便后续前端脚本调用
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // 复制响应头（剔除 content-encoding，避免浏览器解压格式冲突导致空白）
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
        res.setHeader(key, value);
      }
    });

    const data = await response.arrayBuffer();
    return res.status(response.status).send(Buffer.from(data));
  } catch (error) {
    return res.status(500).json({ error: error.message, targetUrl });
  }
}
