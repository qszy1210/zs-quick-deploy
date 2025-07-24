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

document.getElementById('deployLink').addEventListener('click', () => {
  chrome.tabs.create({
    url: 'http://192.168.1.104:8080/view/%E6%99%BA%E8%83%BD%E8%AE%B0%E8%B4%A6/job/znjz-zssy-portal-web-vue3-dev/'
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
  const buildLinks = document.getElementById('buildLinks');
  
  try {
    const response = await fetch('http://192.168.1.104:8080/view/%E6%99%BA%E8%83%BD%E8%AE%B0%E8%B4%A6/job/znjz-zssy-portal-web-vue3-dev/buildHistory/ajax');
    const html = await response.text();

    // 解析HTML查找正在构建的任务
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // 查找包含正在构建状态的行
    const buildingRows = doc.querySelectorAll('tr.build-row');
    let activeBuild = null;
    
    for (const row of buildingRows) {
      // 检查是否包含正在构建的图标
      const progressIcon = row.querySelector('use[href*="build-status-in-progress"]');
      const animatedIcon = row.querySelector('.icon-aborted-anime');
      
      if (progressIcon || animatedIcon) {
        // 提取构建编号
        const buildLink = row.querySelector('a.build-link.display-name');
        if (buildLink) {
          const buildNumber = buildLink.textContent.trim();
          const buildUrl = buildLink.getAttribute('href');
          
          // 提取控制台链接
          const consoleLink = row.querySelector('a.build-status-link');
          const consoleUrl = consoleLink ? consoleLink.getAttribute('href') : null;
          
          activeBuild = {
            number: buildNumber,
            buildUrl: buildUrl,
            consoleUrl: consoleUrl
          };
          break;
        }
      }
    }

    if (activeBuild) {
      buildStatus.textContent = `正在构建中... ${activeBuild.number}`;
      buildStatus.className = 'status building';
      
      // 生成跳转链接
      const baseUrl = 'http://192.168.1.104:8080';
      buildLinks.innerHTML = `
        <a href="${baseUrl}${activeBuild.consoleUrl}" target="_blank">查看控制台输出</a>
        <a href="${baseUrl}${activeBuild.buildUrl}" target="_blank">查看构建详情</a>
      `;
      
      // 为链接添加点击事件
      buildLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          chrome.tabs.create({ url: link.href });
        });
      });
      
    } else {
      // 没有进行中的任务，显示最新的部署状态
      showLatestBuildStatus(buildingRows);
      clearInterval(statusCheckInterval);
    }
  } catch (error) {
    console.error('检查构建状态失败:', error);
    buildStatus.textContent = '检查状态失败';
    buildLinks.innerHTML = '';
    clearInterval(statusCheckInterval);
  }
}

function showLatestBuildStatus(buildRows) {
  const buildStatus = document.getElementById('buildStatus');
  const buildLinks = document.getElementById('buildLinks');
  
  if (!buildRows || buildRows.length === 0) {
    buildStatus.textContent = '没有找到构建记录';
    buildStatus.className = 'status';
    buildLinks.innerHTML = '';
    return;
  }

  // 获取第一行（最新的构建记录）
  const latestRow = buildRows[0];
  
  // 提取构建状态
  const statusIcon = latestRow.querySelector('.build-status-icon__wrapper svg:last-child use');
  const buildLink = latestRow.querySelector('a.build-link.display-name');
  const consoleLink = latestRow.querySelector('a.build-status-link');
  const timeElement = latestRow.querySelector('.pane.build-details a');
  
  if (!buildLink) {
    buildStatus.textContent = '无法解析构建信息';
    buildStatus.className = 'status';
    buildLinks.innerHTML = '';
    return;
  }
  
  const buildNumber = buildLink.textContent.trim();
  const buildUrl = buildLink.getAttribute('href');
  const consoleUrl = consoleLink ? consoleLink.getAttribute('href') : null;
  const buildTime = timeElement ? timeElement.textContent.trim().split('\n')[0] : '';
  
  // 判断构建状态
  let statusText = '';
  let statusClass = 'status';
  
  if (statusIcon) {
    const href = statusIcon.getAttribute('href');
    if (href && href.includes('last-successful')) {
      statusText = `最新部署成功 ${buildNumber}`;
      statusClass = 'status success';
    } else if (href && href.includes('last-failed')) {
      statusText = `最新部署失败 ${buildNumber}`;
      statusClass = 'status failed';
    } else {
      statusText = `最新部署状态 ${buildNumber}`;
      statusClass = 'status';
    }
  } else {
    statusText = `最新部署记录 ${buildNumber}`;
    statusClass = 'status';
  }
  
  buildStatus.textContent = statusText;
  buildStatus.className = statusClass;
  
  // 生成跳转链接
  const baseUrl = 'http://192.168.1.104:8080';
  let linksHtml = '';
  
  if (consoleUrl) {
    linksHtml += `<a href="${baseUrl}${consoleUrl}" target="_blank">查看控制台输出</a>`;
  }
  
  if (buildUrl) {
    linksHtml += `<a href="${baseUrl}${buildUrl}" target="_blank">查看构建详情</a>`;
  }
  
  if (buildTime) {
    linksHtml += `<div class="build-time">${buildTime}</div>`;
  }
  
  buildLinks.innerHTML = linksHtml;
  
  // 为链接添加点击事件
  buildLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: link.href });
    });
  });
}