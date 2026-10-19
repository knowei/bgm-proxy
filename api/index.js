export default async function handler(req, res) {
  // 1. 获取客户端访问的真实原始路径
  let originalPath = req.headers['x-forwarded-uri'] || req.url;
  
  if (originalPath.startsWith('/api')) {
    originalPath = originalPath.replace(/^\/api/, '') || '/';
  }

  // 2. 智能判断：是图片请求还是 API 请求？
  // lain.bgm.tv 的图片路径一般以 /r/、/pic/、/photo/ 开头
  const isImageRequest = originalPath.startsWith('/r/') || 
                         originalPath.startsWith('/pic/') || 
                         originalPath.startsWith('/photo/');

  const targetHost = isImageRequest ? 'lain.bgm.tv' : 'api.bgm.tv';
  const targetUrl = `https://${targetHost}${originalPath}`;

  try {
    const headers = { ...req.headers };
    delete headers['host'];
    delete headers['content-length'];
    
    // 伪装对应的 Host 和 Referer
    headers['host'] = targetHost;
    headers['referer'] = `https://${targetHost}`;
    headers['user-agent'] = req.headers['user-agent'] || 'BgmProxyClient/1.0';

    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        fetchOptions.body = JSON.stringify(req.body);
        headers['content-type'] = headers['content-type'] || 'application/json';
      } else {
        fetchOptions.body = req.body;
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // 设置跨域 CORS 头，方便前端直接展示 <img>
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // 图片增加长缓存，减少重复请求，速度起飞
    if (isImageRequest && response.status === 200) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, s-maxage=2592000'); // 缓存 30 天
    }

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // 复制响应头
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
