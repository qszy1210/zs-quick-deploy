// 监听快捷键命令
chrome.commands.onCommand.addListener((command) => {
  if (command === 'trigger-build') {
    handleBuildTrigger();
  }
});

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'triggerBuild') {
    handleBuildTrigger();
    sendResponse({ status: 'started' });
  }
  return true;
});

// 处理构建触发逻辑
async function handleBuildTrigger() {
  try {
    const tab = await chrome.tabs.create({
      url: 'http://192.168.1.104:8080/view/%E6%99%BA%E8%83%BD%E8%AE%B0%E8%B4%A6/job/znjz-zssy-portal-web-vue3-dev/build?delay=0sec',
      active: false
    });

    // 监听页面加载状态
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

          // 使用轮询机制查找按钮
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
  } catch (error) {
    console.error('触发构建失败:', error);
  }
}