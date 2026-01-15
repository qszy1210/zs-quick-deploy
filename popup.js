

let environments = {};
let statusCheckIntervals = {};

// Configuration is loaded from config.js via loadConfig()

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

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    Object.keys(environments).forEach(startStatusCheck);
  } else {
    Object.keys(statusCheckIntervals).forEach(stopStatusCheck);
  }
});

function initializePopup() {
  const environmentsContainer = document.getElementById('environments');
  environmentsContainer.innerHTML = ''; // Clear previous content

  Object.keys(environments).forEach(envKey => {
    const env = environments[envKey];
    const envContainer = document.createElement('div');
    envContainer.className = 'environment-container';

    envContainer.innerHTML = '<h3>' + env.name + ' 环境</h3>' +
      '<button id="triggerBuild-' + envKey + '" class="trigger-build-button">触发' + env.name + '环境构建</button>' +
      '<button id="deployLink-' + envKey + '">跳转到' + env.name + '部署页面</button>' +
      '<div id="buildStatus-' + envKey + '" class="status"></div>' +
      '<div id="buildLinks-' + envKey + '" class="links"></div>';

    environmentsContainer.appendChild(envContainer);

    document.getElementById(`triggerBuild-${envKey}`).addEventListener('click', () => {
      // Send message to background to trigger the build
      chrome.runtime.sendMessage({
        action: 'triggerBuild',
        environment: envKey,
        environments: environments
      });
      // Immediately start checking status after triggering
      startStatusCheck(envKey);
    });

    document.getElementById(`deployLink-${envKey}`).addEventListener('click', () => {
      chrome.tabs.create({ url: env.jobUrl });
    });

    // Start checking status when popup opens
    startStatusCheck(envKey);
  });
}

function startStatusCheck(envKey) {
  stopStatusCheck(envKey); // Clear any existing interval
  
  const check = async () => {
    const envConfig = environments[envKey];
    if (!envConfig) return;

    try {
      const response = await fetch(envConfig.historyUrl, { cache: 'no-cache' });
      if (!response.ok) {
        updateDisplay(envKey, { status: 'error', text: `网络错误: ${response.statusText}` });
        return;
      }
      const html = await response.text();
      const status = parseHtml(html, envConfig.historyUrl);
      updateDisplay(envKey, status);

      if (status.status === 'success' || status.status === 'failed' || status.status === 'error') {
        stopStatusCheck(envKey);
      }
    } catch (error) {
      updateDisplay(envKey, { status: 'error', text: '检查状态时出错' });
      stopStatusCheck(envKey);
    }
  };

  check(); // Initial check
  statusCheckIntervals[envKey] = setInterval(check, 5000); // Poll every 5 seconds
}

function stopStatusCheck(envKey) {
  if (statusCheckIntervals[envKey]) {
    clearInterval(statusCheckIntervals[envKey]);
    delete statusCheckIntervals[envKey];
  }
}

function updateDisplay(envKey, status) {
  const statusDiv = document.getElementById(`buildStatus-${envKey}`);
  const linksDiv = document.getElementById(`buildLinks-${envKey}`);
  const triggerButton = document.getElementById(`triggerBuild-${envKey}`);

  if (!statusDiv || !linksDiv || !triggerButton) return;

  statusDiv.textContent = status.text || '正在获取状态...';
  statusDiv.className = `status ${status.status || 'idle'}`;

  if (status.status === 'building') {
    triggerButton.disabled = true;
    triggerButton.textContent = '部署中,请稍后...';
  } else {
    triggerButton.disabled = false;
    triggerButton.textContent = `触发${environments[envKey].name}环境构建`;
  }

  let linksHtml = '';
  if (status.links) {
    if (status.links.console) {
      linksHtml += `<a href="${status.links.console}" target="_blank">查看控制台输出</a>`;
    }
    if (status.links.details) {
      linksHtml += `<a href="${status.links.details}" target="_blank">查看构建详情</a>`;
    }
  }
  if (status.time) {
      linksHtml += `<div class="build-time">开始时间: ${status.time}</div>`;
  }
  linksDiv.innerHTML = linksHtml;

  linksDiv.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: link.href });
    });
  });
}

// --- Parsing logic moved from offscreen.js ---

function parseHtml(html, historyUrl) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const buildRows = doc.querySelectorAll('tr.build-row');

    for (const row of buildRows) {
      const isInProgress = row.querySelector('use[href*="build-status-in-progress"]') || row.querySelector('.icon-blue-anime');
      if (isInProgress) {
        const buildLink = row.querySelector('a.build-link.display-name');
        const timeElement = row.querySelector('.pane.build-details a');
        const buildNumber = buildLink ? buildLink.textContent.trim() : '';
        const rawTime = timeElement ? timeElement.textContent.trim().split('\n')[0] : '';
        return {
          status: 'building',
          text: `正在构建中... ${buildNumber}`,
          time: adjustTimeBy8Hours(rawTime),
          links: getLinksFromRow(row, historyUrl)
        };
      }
    }

    const latestRow = buildRows[0];
    if (!latestRow) {
      return { status: 'idle', text: '没有找到构建记录' };
    }

    const buildLink = latestRow.querySelector('a.build-link.display-name');
    const timeElement = latestRow.querySelector('.pane.build-details a');

    if (!buildLink) {
      return { status: 'error', text: '无法解析构建行 (缺少链接)' };
    }

    const buildNumber = buildLink.textContent.trim();
    const rawTime = timeElement ? timeElement.textContent.trim().split('\n')[0] : '';
    const links = getLinksFromRow(latestRow, historyUrl);
    const time = adjustTimeBy8Hours(rawTime);

    if (latestRow.querySelector('use[href*="last-successful"]')) {
      return { status: 'success', text: `最新部署成功 ${buildNumber}`, time, links };
    }
    if (latestRow.querySelector('use[href*="last-failed"]')) {
      return { status: 'failed', text: `最新部署失败 ${buildNumber}`, time, links };
    }
    if (latestRow.querySelector('use[href*="last-aborted"]')) {
        return { status: 'idle', text: `最新部署已终止 ${buildNumber}`, time, links };
    }
    
    return { status: 'idle', text: `最新部署记录 ${buildNumber}`, time, links };

  } catch (error) {
    return { status: 'error', text: '解析HTML时发生脚本错误' };
  }
}

function getLinksFromRow(row, historyUrl) {
    try {
        const baseUrl = new URL(historyUrl).origin;
        const consoleLink = row.querySelector('a.build-status-link');
        const buildDetailsLink = row.querySelector('a.build-link.display-name');
        
        let links = {};
        if(consoleLink) {
            const href = consoleLink.getAttribute('href');
            if(href) links.console = baseUrl + href;
        }
        if(buildDetailsLink) {
            const href = buildDetailsLink.getAttribute('href');
            if(href) links.details = baseUrl + href;
        }
        return links;
    } catch (e) {
        return {};
    }
}

function adjustTimeBy8Hours(timeString) {
  if (!timeString) return timeString;
  try {
    const relativeTimeMatch = timeString.match(/^(\d+)\s*(min|hr|day|month|year)s?\s*前$/);
    if (relativeTimeMatch) {
      return timeString;
    }

    const chineseTimeMatch = timeString.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(上午|下午)(\d{1,2}):(\d{2})$/);
    if (chineseTimeMatch) {
      const [, year, month, day, period, hour, minute] = chineseTimeMatch;
      let hour24 = parseInt(hour, 10);
      if (period === '下午' && hour24 !== 12) {
        hour24 += 12;
      } else if (period === '上午' && hour24 === 12) {
        hour24 = 0;
      }
      const originalDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour24, parseInt(minute));
      const adjustedDate = new Date(originalDate.getTime() + 8 * 60 * 60 * 1000);
      const adjustedHour = adjustedDate.getHours();
      const adjustedMinute = adjustedDate.getMinutes();
      const adjustedPeriod = adjustedHour < 12 ? '上午' : '下午';
      const displayHour = adjustedHour === 0 ? 12 : (adjustedHour > 12 ? adjustedHour - 12 : adjustedHour);
      return `${adjustedDate.getFullYear()}年${adjustedDate.getMonth() + 1}月${adjustedDate.getDate()}日 ${adjustedPeriod}${displayHour}:${adjustedMinute.toString().padStart(2, '0')}`;
    }

    const absoluteTimeMatch = timeString.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})$/);
    if (absoluteTimeMatch) {
      const originalDate = new Date(absoluteTimeMatch[1]);
      if (!isNaN(originalDate.getTime())) {
        const adjustedDate = new Date(originalDate.getTime() + 8 * 60 * 60 * 1000);
        return adjustedDate.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\//g, '-') ;
      }
    }

    const parsedDate = new Date(timeString);
    if (!isNaN(parsedDate.getTime())) {
      const adjustedDate = new Date(parsedDate.getTime() + 8 * 60 * 60 * 1000);
      const hour = adjustedDate.getHours();
      const period = hour < 12 ? '上午' : '下午';
      const displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
      return `${adjustedDate.getFullYear()}年${adjustedDate.getMonth() + 1}月${adjustedDate.getDate()}日 ${period}${displayHour}:${adjustedDate.getMinutes().toString().padStart(2, '0')}`;
    }

    return timeString;
  } catch (error) {
    return timeString;
  }
}
