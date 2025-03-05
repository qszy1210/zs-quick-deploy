let statusCheckInterval;

// 页面加载完成时立即开始检查状态
document.addEventListener('DOMContentLoaded', () => {
  startStatusCheck();
});

document.getElementById('triggerBuild').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'triggerBuild' }, (response) => {
    if (response && response.status === 'started') {
      console.log('构建触发请求已发送');
    }
  });
});

function startStatusCheck() {
  const buildStatus = document.getElementById('buildStatus');

  // 清除之前的定时器
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }

  // 立即执行第一次状态检查
  checkBuildStatus();

  // 每5秒检查一次构建状态
  statusCheckInterval = setInterval(checkBuildStatus, 5000);
}

async function checkBuildStatus() {
  const buildStatus = document.getElementById('buildStatus');
  try {
    const response = await fetch('http://192.168.1.104:8080/view/%E6%99%BA%E8%83%BD%E8%AE%B0%E8%B4%A6/job/znjz-zssy-portal-web-vue3-dev/buildHistory/ajax');
    const html = await response.text();

    if (html.includes('执行中')) {
      buildStatus.textContent = '正在构建中...';
      buildStatus.className = 'status building';
    } else {
      buildStatus.textContent = '没有进行中的任务';
      buildStatus.className = 'status completed';
      clearInterval(statusCheckInterval);
    }
  } catch (error) {
    console.error('检查构建状态失败:', error);
    buildStatus.textContent = '检查状态失败';
    clearInterval(statusCheckInterval);
  }
}