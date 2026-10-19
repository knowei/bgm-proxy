export default async function handler(req, res) {
  // 1. 获取客户端访问的真实原始路径
  let originalPath = req.headers['x-forwarded-uri'] || req.url;
  
  if (originalPath.startsWith('/api')) {
    originalPath = originalPath.replace(/^\/api/, '') || '/';
  }

  // 拼接真实的 Bangumi API 地址
  const targetUrl = `https://api.bgm.tv${originalPath}`;

  try {
    // 构造发往 Bangumi 的请求头
    const headers = { ...req.headers };
    
    // 必须删除 Host 和可能会引起长度不匹配的头
    delete headers['host'];
    delete headers['content-length']; // 极其关键！删除后让 fetch 自动计算正确的 Body 长度
    
    headers['host'] = 'api.bgm.tv';
    headers['referer'] = 'https://api.bgm.tv';
    headers['user-agent'] = req.headers['user-agent'] || 'BgmProxyClient/1.0';

    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    // 正确处理 POST / PUT 等请求体
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        fetchOptions.body = JSON.stringify(req.body);
        headers['content-type'] = headers['content-type'] || 'application/json';
      } else {
        fetchOptions.body = req.body;
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // 设置跨域 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // 复制响应头（剔除可能会导致客户端解压失败的头）
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
