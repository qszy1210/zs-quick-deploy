# 配置结构重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 统一配置管理，实现 baseUrl + 相对路径机制，增强构建触发智能检测

**架构:**
- options.js 作为配置中心，提供 `resolveUrl()` 工具函数
- popup.js 和 background.js 从 chrome.storage.sync 读取完整 URL（已解析）
- background.js 根据路径特征智能选择构建按钮点击策略

**技术栈:** Chrome Extension Manifest V3, JavaScript (ES6+)

---

## 前置分析

**当前代码状态：**
- ✅ options.js: 已实现 baseUrl、resolveUrl()、visible、添加/删除功能
- ✅ options.html: UI 完整
- ❌ popup.js: 使用硬编码完整 URL，未使用 baseUrl 机制
- ❌ background.js: 使用硬编码完整 URL，未使用 baseUrl 机制，无智能按钮检测

**核心问题：**
1. popup.js 和 background.js 有独立的 `defaultEnvironments` 定义
2. 没有使用 options.js 中已实现的 `resolveUrl()` 机制
3. 构建触发逻辑只支持 `#yui-gen1-button` 选择器

---

## Task 1: 创建共享配置模块 (config.js)

**目标:** 提取配置和工具函数，供所有模块使用

**Files:**
- Create: `config.js`
- Modify: `options.html`, `popup.html` (引入 config.js)

**Step 1: 创建 config.js 文件**

```javascript
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
```

**保存到:** `/Users/qs/dev/github/personal/zs-quick-deploy/config.js`

---

## Task 2: 重构 options.js 使用共享配置

**Files:**
- Modify: `options.js:1-20` (删除重复的 defaultEnvironments 和 resolveUrl 定义)

**Step 1: 移除 options.js 中重复的配置定义**

替换 options.js 的第 1-26 行（defaultBaseUrl 和 resolveUrl 函数）：

```javascript
// 删除以下代码：
// const defaultBaseUrl = 'http://192.168.1.104:8080';
// const defaultEnvironments = { ... };
// function resolveUrl(url, baseUrl) { ... }

// 替换为注释说明：
// Configuration is now imported from config.js
```

**Step 2: 更新 save_options 函数以支持相对路径**

在 options.js 的 `save_options()` 函数中，保存相对路径而非完整 URL：

```javascript
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
```

**Step 3: 在 options.html 中引入 config.js**

在 options.html 的 `<script>` 标签前添加：

```html
<script src="config.js"></script>
<script src="options.js"></script>
```

---

## Task 3: 重构 popup.js 使用共享配置和 visible 过滤

**Files:**
- Modify: `popup.js:1-27` (替换 defaultEnvironments 定义和初始化逻辑)
- Modify: `popup.html` (引入 config.js)

**Step 1: 更新 popup.js 使用 loadConfig**

替换 popup.js 的第 1-27 行：

```javascript
// 删除以下代码：
// let environments = {};
// let statusCheckIntervals = {};
// const defaultEnvironments = { ... };

// document.addEventListener('DOMContentLoaded', () => {
//   chrome.storage.sync.get({ environments: defaultEnvironments }, (items) => {
//     environments = items.environments;
//     initializePopup();
//   });
// });

// 替换为：
let environments = {};
let statusCheckIntervals = {};

document.addEventListener('DOMContentLoaded', () => {
  loadConfig((config) => {
    // 过滤只显示 visible 为 true 的环境
    environments = {};
    for (const key in config.environments) {
      if (config.environments[key].visible !== false) {
        environments[key] = config.environments[key];
      }
    }
    initializePopup();
  });
});
```

**Step 2: 在 popup.html 中引入 config.js**

在 popup.html 的 `<script>` 标签前添加：

```html
<script src="config.js"></script>
<script src="popup.js"></script>
```

**Step 3: 测试 popup 过滤功能**

测试步骤：
1. 打开扩展设置页面，将某个环境的"在 Popup 中显示"取消勾选
2. 保存设置
3. 打开 popup，确认该环境不显示
4. 重新勾选，保存，确认环境重新显示

---

## Task 4: 增强 background.js 的构建触发逻辑

**Files:**
- Modify: `background.js:1-16` (使用共享配置)
- Modify: `background.js:45-83` (增强按钮检测逻辑)

**Step 1: 更新 background.js 使用 loadConfig**

替换 background.js 的第 1-28 行：

```javascript
// 删除以下代码：
// const defaultEnvironments = { ... };

// chrome.commands.onCommand.addListener((command) => {
//   if (command === 'trigger-build') {
//     chrome.storage.sync.get({ environments: defaultEnvironments }, (items) => {
//       const devConfig = items.environments.dev;
//       if (devConfig) {
//         handleBuildTrigger(devConfig);
//       }
//     });
//   }
// });

// 替换为：
chrome.commands.onCommand.addListener((command) => {
  if (command === 'trigger-build') {
    loadConfig((config) => {
      const devConfig = config.environments.dev;
      if (devConfig) {
        handleBuildTrigger(devConfig);
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'triggerBuild') {
    loadConfig((config) => {
      const envKey = message.environment || 'dev';
      const envConfig = config.environments[envKey];
      if (envConfig) {
        handleBuildTrigger(envConfig);
        sendResponse({ status: 'started' });
      } else {
        sendResponse({ status: 'error', message: 'Invalid environment configuration.' });
      }
    });
  }
  return true;
});
```

**Step 2: 增强构建触发逻辑，支持智能按钮检测**

替换 `handleBuildTrigger` 函数中的脚本执行部分（第 66-73 行）：

```javascript
async function handleBuildTrigger(envConfig) {
  if (!envConfig || !envConfig.buildUrl) {
    console.error('Invalid environment config passed to handleBuildTrigger:', envConfig);
    return;
  }

  try {
    const tab = await chrome.tabs.create({
      url: envConfig.buildUrl,
      active: false
    });

    await new Promise((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (buildUrl) => {
        // 智能检测构建按钮
        let button = null;

        // 策略1: 如果 URL 包含 /build，尝试查找特定的按钮 ID
        if (buildUrl && buildUrl.includes('/build')) {
          button = document.querySelector('#yui-gen1-button');
        }

        // 策略2: 如果找不到，查找包含"立即构建"文本的链接
        if (!button) {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            if (link.textContent.trim() === '立即构建') {
              button = link;
              break;
            }
          }
        }

        // 策略3: 查找通用的构建按钮选择器
        if (!button) {
          button = document.querySelector('a[href*="build"]') ||
                   document.querySelector('button[type="submit"]') ||
                   document.querySelector('.build-button');
        }

        if (button) {
          button.click();
          console.log('Build button clicked successfully');
        } else {
          console.error('No build button found on page');
        }
      },
      args: [envConfig.buildUrl]
    });

    // Close the tab after a short delay
    setTimeout(() => {
      chrome.tabs.remove(tab.id);
    }, 3000);

  } catch (error) {
    console.error(`触发${envConfig.name}环境构建失败:`, error);
  }
}
```

**Step 3: 测试构建触发逻辑**

测试步骤：
1. 使用快捷键 (Cmd+U) 触发 dev 环境构建
2. 观察后台日志，确认按钮被正确点击
3. 检查构建是否成功启动

---

## Task 5: 更新 manifest.json

**Files:**
- Modify: `manifest.json` (添加 config.js 引用说明)

**Step 1: 添加配置文件说明**

在 manifest.json 中确保 host_permissions 支持 baseUrl 配置：

```json
{
  "manifest_version": 3,
  "name": "Jenkins Build Trigger",
  "version": "1.1",
  "permissions": ["activeTab", "scripting", "tabs", "storage"],
  "host_permissions": ["http://*/*", "https://*/*"],
  "commands": {
    "trigger-build": {
      "suggested_key": {"default": "Ctrl+U", "mac": "Command+U"}
    }
  }
}
```

注意：将 `host_permissions` 从固定地址改为通配符，以支持可配置的 baseUrl。

---

## Task 6: 验证和测试

**Step 1: 完整功能测试**

测试清单：
- [ ] 设置页面可以保存 baseUrl
- [ ] 设置页面可以添加/删除环境
- [ ] 设置页面可以设置环境可见性
- [ ] Popup 只显示 visible=true 的环境
- [ ] Popup 可以触发构建
- [ ] 快捷键可以触发 dev 环境构建
- [ ] 构建状态正确显示
- [ ] 部署链接正确跳转

**Step 2: 边界情况测试**

- [ ] baseUrl 为空时的行为
- [ ] 相对路径和绝对路径混合使用
- [ ] 所有环境都设置为不可见
- [ ] 网络错误处理

---

## 提交计划

每个 Task 完成后提交：

```bash
# Task 1
git add config.js
git commit -m "feat: 创建共享配置模块 config.js

- 提取 defaultBaseUrl 和 defaultEnvironments
- 实现 resolveUrl() 工具函数
- 实现 loadConfig() 统一配置加载接口
"

# Task 2
git add options.js options.html
git commit -m "refactor: options.js 使用共享配置模块

- 移除重复的配置定义
- 实现 extractRelativePath() 保存相对路径
- 更新 HTML 引入 config.js
"

# Task 3
git add popup.js popup.html
git commit -m "refactor: popup.js 使用共享配置并支持可见性过滤

- 使用 loadConfig() 加载配置
- 实现 visible 属性过滤逻辑
- 更新 HTML 引入 config.js
"

# Task 4
git add background.js
git commit -m "feat: 增强 background.js 构建触发逻辑

- 使用 loadConfig() 加载配置
- 实现智能按钮检测（/build 路径/文本/通用选择器）
- 支持多种 Jenkins 页面布局
"

# Task 5
git add manifest.json
git commit -m "chore: 更新 manifest.json 版本和权限

- 版本号升级到 1.1
- host_permissions 支持动态 baseUrl
"

# Task 6
git add docs/plans/2025-01-15-config-refactoring.md
git commit -m "docs: 添加配置重构实施计划文档"
```

---

## 完成标准

- [ ] 所有文件使用共享 config.js
- [ ] 无代码重复 (DRY 原则)
- [ ] 配置存储为相对路径，使用时动态解析
- [ ] visible 属性正常工作
- [ ] 构建触发支持多种按钮类型
- [ ] 所有测试通过
