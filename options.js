// Configuration is now imported from config.js
// 依赖 config.js 提供的以下全局变量:
// - defaultBaseUrl
// - defaultEnvironments
// - resolveUrl()

/**
 * 提取相对路径 - 如果 URL 以 baseUrl 开头，返回相对部分
 */
function extractRelativePath(url, baseUrl) {
  if (!url) return '';
  if (url.startsWith(baseUrl)) {
    return url.substring(baseUrl.length);
  }
  return url;
}

function save_options() {
  const baseUrl = document.getElementById('baseUrl').value.trim();
  const environments = {};
  const envElements = document.querySelectorAll('.environment');

  envElements.forEach(envElement => {
    const key = envElement.dataset.key;
    const buildUrlInput = envElement.querySelector('#buildUrl-' + key);
    const jobUrlInput = envElement.querySelector('#jobUrl-' + key);
    const historyUrlInput = envElement.querySelector('#historyUrl-' + key);

    // 保存相对路径（如果 URL 包含 baseUrl，则提取相对部分）
    environments[key] = {
      name: envElement.querySelector('#name-' + key).value,
      buildUrl: extractRelativePath(buildUrlInput.value, baseUrl),
      jobUrl: extractRelativePath(jobUrlInput.value, baseUrl),
      historyUrl: extractRelativePath(historyUrlInput.value, baseUrl),
      visible: envElement.querySelector('#visible-' + key).checked
    };
  });

  chrome.storage.sync.set({ baseUrl, environments }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(() => {
      status.textContent = '';
    }, 1500);
  });
}

function restore_options() {
  chrome.storage.sync.get({
    baseUrl: defaultBaseUrl,
    environments: defaultEnvironments
  }, (items) => {
    document.getElementById('baseUrl').value = items.baseUrl;
    renderEnvironments(items.environments, items.baseUrl); // 传入 baseUrl
  });
}

function renderEnvironments(environments, baseUrl) {
  const container = document.getElementById('environments-config');
  container.innerHTML = '';

  for (const key in environments) {
    const env = environments[key];
    const envContainer = createEnvironmentElement(key, env, baseUrl); // 传入 baseUrl
    container.appendChild(envContainer);
  }
}

function createEnvironmentElement(key, env, baseUrl) {
  const envContainer = document.createElement('div');
  envContainer.className = 'environment';
  envContainer.dataset.key = key;

  envContainer.innerHTML = `
    <div class="environment-header">
      <h3>${env.name} Environment</h3>
      <button class="delete-btn" data-key="${key}">删除</button>
    </div>
    <label for="name-${key}">Name:</label>
    <input type="text" id="name-${key}" value="${env.name}">
    <label for="buildUrl-${key}">Build URL:</label>
    <input type="text" id="buildUrl-${key}" value="${resolveUrl(env.buildUrl, baseUrl)}">
    <label for="jobUrl-${key}">Job URL:</label>
    <input type="text" id="jobUrl-${key}" value="${resolveUrl(env.jobUrl, baseUrl)}">
    <label for="historyUrl-${key}">History URL:</label>
    <input type="text" id="historyUrl-${key}" value="${resolveUrl(env.historyUrl, baseUrl)}">
    <label class="checkbox-label">
      <input type="checkbox" id="visible-${key}" ${env.visible ? 'checked' : ''}>
      在 Popup 中显示
    </label>
  `;

  envContainer.querySelector('.delete-btn').addEventListener('click', () => {
    deleteEnvironment(key);
  });

  return envContainer;
}

function addEnvironment() {
  const container = document.getElementById('environments-config');
  const baseUrl = document.getElementById('baseUrl').value.trim();
  const newKey = 'env_' + Date.now();

  const newEnv = {
    name: 'New Environment',
    buildUrl: '',
    jobUrl: '',
    historyUrl: '',
    visible: true
  };

  const envContainer = createEnvironmentElement(newKey, newEnv, baseUrl);
  container.appendChild(envContainer);
}

function deleteEnvironment(key) {
  const envElement = document.querySelector(`.environment[data-key="${key}"]`);
  if (envElement) {
    envElement.remove();
  }
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
document.getElementById('addEnv').addEventListener('click', addEnvironment);
