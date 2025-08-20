// Default settings, used if nothing is found in storage
const defaultEnvironments = {
  dev: {
    name: 'Dev',
    buildUrl: 'http://192.168.1.104:8080/view/%E6%99%BA%E8%83%BD%E8%AE%B0%E8%B4%A6/job/znjz-zssy-portal-web-vue3-dev/build?delay=0sec',
    jobUrl: 'http://192.168.1.104:8080/view/%E6%99%BA%E8%83%BD%E8%AE%B0%E8%B4%A6/job/znjz-zssy-portal-web-vue3-dev/',
    historyUrl: 'http://192.168.1.104:8080/view/%E6%99%BA%E8%83%BD%E8%AE%B0%E8%B4%A6/job/znjz-zssy-portal-web-vue3-dev/buildHistory/ajax'
  },
  test: {
    name: 'Test',
    buildUrl: 'http://192.168.1.104:8080/view/%E6%99%BA%E8%83%BD%E8%AE%B0%E8%B4%A6%E6%B5%8B%E8%AF%95%E7%8E%AF%E5%A2%83/job/zssy-bft-web-test/build?delay=0sec',
    jobUrl: 'http://192.168.1.104:8080/view/%E6%99%BA%E8%83%BD%E8%AE%B0%E8%B4%A6%E6%B5%8B%E8%AF%95%E7%8E%AF%E5%A2%83/job/zssy-bft-web-test/',
    historyUrl: 'http://192.168.1.104:8080/view/%E6%99%BA%E8%83%BD%E8%AE%B0%E8%B4%A6%E6%B5%8B%E8%AF%95%E7%8E%AF%E5%A2%83/job/zssy-bft-web-test/buildHistory/ajax'
  }
};

chrome.commands.onCommand.addListener((command) => {
  if (command === 'trigger-build') {
    // Load config from storage, then trigger build for 'dev' environment
    chrome.storage.sync.get({ environments: defaultEnvironments }, (items) => {
      const devConfig = items.environments.dev;
      if (devConfig) {
        handleBuildTrigger(devConfig);
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'triggerBuild') {
    const envKey = message.environment || 'dev';
    const environments = message.environments;
    const envConfig = environments[envKey];
    if (envConfig) {
      handleBuildTrigger(envConfig);
      sendResponse({ status: 'started' });
    } else {
      sendResponse({ status: 'error', message: 'Invalid environment configuration.' });
    }
  }
  return true; // Indicates an asynchronous response
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
      func: () => {
        return new Promise((resolve) => {
          console.log('页面加载完成，开始查找按钮...');
          const maxAttempts = 10;
          let attempts = 0;
          const findButton = setInterval(() => {
            const button = document.querySelector('#yui-gen1-button');
            attempts++;
            if (button) {
              console.log('找到按钮，准备点击...');
              button.click();
              console.log('按钮点击完成');
              clearInterval(findButton);
              resolve();
            } else if (attempts >= maxAttempts) {
              console.log('多次尝试后未找到按钮，放弃查找');
              clearInterval(findButton);
              resolve();
            } else {
              console.log(`第 ${attempts} 次尝试查找按钮...`);
            }
          }, 1000);
        });
      }
    });

    // Close the tab after a short delay
    setTimeout(() => {
        chrome.tabs.remove(tab.id);
    }, 3000);

  } catch (error) {
    console.error(`触发${envConfig.name}环境构建失败:`, error);
  }
}