
// Import shared configuration
importScripts('config.js');

chrome.commands.onCommand.addListener((command) => {
  if (command === 'trigger-build') {
    loadConfig((config) => {
      const devConfig = config.environments.dev;
      if (devConfig) {
        handleBuildTrigger(devConfig);
        console.log('Dev environment build triggered via shortcut');
      } else {
        console.error('Dev environment configuration not found');
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'triggerBuild') {
    loadConfig((config) => {
      try {
        // 添加 config 空值检查
        if (!config || !config.environments) {
          console.error('Failed to load configuration');
          sendResponse({ status: 'error', message: 'Failed to load configuration' });
          return;
        }

        const envKey = message.environment || 'dev';
        const envConfig = config.environments[envKey];
        if (envConfig) {
          handleBuildTrigger(envConfig);
          sendResponse({ status: 'started' });
        } else {
          sendResponse({ status: 'error', message: 'Invalid environment configuration.' });
        }
      } catch (error) {
        sendResponse({ status: 'error', message: error.message });
      }
    });
    return true;
  }
});

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
