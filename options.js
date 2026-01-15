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
      visible: envElement.querySelector('#visible-' + key).checked,
      sort: parseInt(envElement.dataset.sort) || 99
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

  // 将对象转换为数组并按 sort 值排序
  const sortedEnvs = Object.entries(environments)
    .map(([key, env]) => ({ key, ...env }))
    .sort((a, b) => (a.sort || 99) - (b.sort || 99));

  sortedEnvs.forEach(({ key, ...env }) => {
    const envContainer = createEnvironmentElement(key, env, baseUrl);
    container.appendChild(envContainer);
  });
}

function createEnvironmentElement(key, env, baseUrl) {
  const envContainer = document.createElement('div');
  envContainer.className = 'environment';
  envContainer.dataset.key = key;
  envContainer.dataset.sort = env.sort || 99;

  envContainer.innerHTML = `
    <div class="environment-header">
      <h3>${env.name} Environment</h3>
      <div class="header-actions">
        <button class="move-up-btn" data-key="${key}" title="上移">↑</button>
        <button class="move-down-btn" data-key="${key}" title="下移">↓</button>
        <button class="delete-btn" data-key="${key}">删除</button>
      </div>
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

  envContainer.querySelector('.move-up-btn').addEventListener('click', () => {
    moveEnvironment(key, 'up');
  });

  envContainer.querySelector('.move-down-btn').addEventListener('click', () => {
    moveEnvironment(key, 'down');
  });

  envContainer.querySelector('.delete-btn').addEventListener('click', () => {
    deleteEnvironment(key);
  });

  return envContainer;
}

function addEnvironment() {
  const container = document.getElementById('environments-config');
  const baseUrl = document.getElementById('baseUrl').value.trim();
  const newKey = 'env_' + Date.now();

  // 计算当前最大的 sort 值
  const envElements = document.querySelectorAll('.environment');
  let maxSort = 0;
  envElements.forEach(el => {
    const sort = parseInt(el.dataset.sort) || 0;
    if (sort > maxSort) maxSort = sort;
  });

  const newEnv = {
    name: 'New Environment',
    buildUrl: '',
    jobUrl: '',
    historyUrl: '',
    visible: true,
    sort: maxSort + 1
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

function moveEnvironment(key, direction) {
  const envElements = Array.from(document.querySelectorAll('.environment'));
  const currentIndex = envElements.findIndex(el => el.dataset.key === key);

  if (currentIndex === -1) return;

  let targetIndex;
  if (direction === 'up') {
    targetIndex = currentIndex - 1;
    if (targetIndex < 0) return; // 已经是第一个
  } else {
    targetIndex = currentIndex + 1;
    if (targetIndex >= envElements.length) return; // 已经是最后一个
  }

  // 交换 sort 值
  const currentSort = parseInt(envElements[currentIndex].dataset.sort) || 99;
  const targetSort = parseInt(envElements[targetIndex].dataset.sort) || 99;

  envElements[currentIndex].dataset.sort = targetSort;
  envElements[targetIndex].dataset.sort = currentSort;

  // 收集所有环境数据并重新渲染
  const container = document.getElementById('environments-config');
  const baseUrl = document.getElementById('baseUrl').value.trim();
  const environments = {};

  envElements.forEach(el => {
    const elKey = el.dataset.key;
    environments[elKey] = {
      name: el.querySelector(`#name-${elKey}`).value,
      buildUrl: extractRelativePath(el.querySelector(`#buildUrl-${elKey}`).value, baseUrl),
      jobUrl: extractRelativePath(el.querySelector(`#jobUrl-${elKey}`).value, baseUrl),
      historyUrl: extractRelativePath(el.querySelector(`#historyUrl-${elKey}`).value, baseUrl),
      visible: el.querySelector(`#visible-${elKey}`).checked,
      sort: parseInt(el.dataset.sort) || 99
    };
  });

  renderEnvironments(environments, baseUrl);
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
document.getElementById('addEnv').addEventListener('click', addEnvironment);
