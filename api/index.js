export default async function handler(req, res) {
  // 获取客户端请求过来的路径和参数（例如 /v0/subjects/12345?foo=bar）
  const queryIndex = req.url.indexOf('?');
  const path = queryIndex !== -1 ? req.url.substring(0, queryIndex) : req.url;
  const search = queryIndex !== -1 ? req.url.substring(queryIndex) : '';

  // 拼接真实的 Bangumi API 目标地址
  const targetUrl = `https://api.bgm.tv${path}${search}`;

  try {
    // 构造发往 Bangumi 的请求头
    const headers = { ...req.headers };
    delete headers['host']; // 必须删除原来的 Host，否则会被目标服务器拒绝
    headers['host'] = 'api.bgm.tv';
    headers['referer'] = 'https://api.bgm.tv';
    // 建议加上一个你的专属 User-Agent，Bangumi 要求所有 API 请求必须带有明确的 User-Agent
    headers['user-agent'] = req.headers['user-agent'] || 'MyBgmProxy/1.0';

    // 发起请求
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    });

    // 复制目标服务器返回的 Headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // 允许跨域（方便前端网页/脚本直接调用）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // 如果是预检请求 OPTIONS，直接返回成功
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // 设置状态码并输出数据
    const data = await response.arrayBuffer();
    res.status(response.status).send(Buffer.from(data));
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Proxy Request Failed', details: error.message });
  }
}
