// config.js - 共享配置和工具函数

const defaultBaseUrl = 'http://192.168.1.104:8080';

const defaultEnvironments = {
  dev: {
    name: 'Dev',
    buildUrl: '/view/%E6%99%BA%E8%83%BD%E8%AE%B0%E8%B4%A6/job/znjz-zssy-portal-web-vue3-dev/build?delay=0sec',
    jobUrl: '/view/%E6%99%BA%E8%83%BD%E8%AE%B0%E8%B4%A6/job/znjz-zssy-portal-web-vue3-dev/',
    historyUrl: '/view/%E6%99%BA%E8%83%BD%E8%AE%B0%E8%B4%A6/job/znjz-zssy-portal-web-vue3-dev/buildHistory/ajax',
    visible: true
  },
  test: {
    name: 'Test',
    buildUrl: '/view/%E6%99%BA%E8%83%BD%E8%AE%B0%E8%B4%A6%E6%B5%8B%E8%AF%95%E7%8E%AF%E5%A2%83/job/zssy-bft-web-test/build?delay=0sec',
    jobUrl: '/view/%E6%99%BA%E8%83%BD%E8%AE%B0%E8%B4%A6%E6%B5%8B%E8%AF%95%E7%8E%AF%E5%A2%83/job/zssy-bft-web-test/',
    historyUrl: '/view/%E6%99%BA%E8%83%BD%E8%AE%B0%E8%B4%A6%E6%B5%8B%E8%AF%95%E7%8E%AF%E5%A2%83/job/zssy-bft-web-test/buildHistory/ajax',
    visible: true
  }
};

/**
 * 解析 URL - 支持绝对路径和相对路径
 * @param {string} url - 要解析的 URL（可以是完整 URL 或相对路径）
 * @param {string} baseUrl - 基础 URL
 * @returns {string} 完整的 URL
 */
function resolveUrl(url, baseUrl) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return baseUrl + url;
}

/**
 * 加载配置并解析所有 URL
 * @param {Function} callback - 回调函数，接收完整的配置对象
 */
function loadConfig(callback) {
  chrome.storage.sync.get({
    baseUrl: defaultBaseUrl,
    environments: defaultEnvironments
  }, (items) => {
    // 解析所有环境中的 URL
    const resolvedEnvironments = {};
    for (const key in items.environments) {
      const env = items.environments[key];
      resolvedEnvironments[key] = {
        ...env,
        buildUrl: resolveUrl(env.buildUrl, items.baseUrl),
        jobUrl: resolveUrl(env.jobUrl, items.baseUrl),
        historyUrl: resolveUrl(env.historyUrl, items.baseUrl)
      };
    }

    callback({
      baseUrl: items.baseUrl,
      environments: resolvedEnvironments
    });
  });
}
