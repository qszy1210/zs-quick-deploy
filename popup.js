let statusCheckIntervals = {};

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

let environments = {};

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
      let hour24 = parseInt(hour);
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
        return adjustedDate.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).replace(/\//g, '-');
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
    console.error('时间解析错误:', error);
    return timeString;
  }
}

function initializePopup() {
  const environmentsContainer = document.getElementById('environments');
  if (!environmentsContainer) return;

  environmentsContainer.innerHTML = ''; // Clear any previous content

  Object.keys(environments).forEach(envKey => {
    const env = environments[envKey];
    const envContainer = document.createElement('div');
    envContainer.className = 'environment-container';

    const title = document.createElement('h3');
    title.textContent = `${env.name} 环境`;
    envContainer.appendChild(title);

    const triggerButton = document.createElement('button');
    triggerButton.id = `triggerBuild-${envKey}`;
    triggerButton.className = 'trigger-build-button';
    triggerButton.textContent = `触发${env.name}环境构建`;
    envContainer.appendChild(triggerButton);

    const deployLinkButton = document.createElement('button');
    deployLinkButton.id = `deployLink-${envKey}`;
    deployLinkButton.textContent = `跳转到${env.name}部署页面`;
    envContainer.appendChild(deployLinkButton);

    const buildStatus = document.createElement('div');
    buildStatus.id = `buildStatus-${envKey}`;
    buildStatus.className = 'status';
    envContainer.appendChild(buildStatus);

    const buildLinks = document.createElement('div');
    buildLinks.id = `buildLinks-${envKey}`;
    buildLinks.className = 'links';
    envContainer.appendChild(buildLinks);

    environmentsContainer.appendChild(envContainer);

    triggerButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'triggerBuild', environment: envKey, environments: environments });
      startStatusCheck(envKey);
    });

    deployLinkButton.addEventListener('click', () => {
      chrome.tabs.create({ url: env.jobUrl });
    });
  });

  Object.keys(environments).forEach(envKey => {
    startStatusCheck(envKey);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get({ environments: defaultEnvironments }, (items) => {
    environments = items.environments;
    initializePopup();
  });
});

function startStatusCheck(env) {
  if (statusCheckIntervals[env]) {
    clearInterval(statusCheckIntervals[env]);
  }
  checkBuildStatus(env);
  statusCheckIntervals[env] = setInterval(() => checkBuildStatus(env), 5000);
}

async function checkBuildStatus(env) {
  const buildStatus = document.getElementById(`buildStatus-${env}`);
  const buildLinks = document.getElementById(`buildLinks-${env}`);
  const envConfig = environments[env];

  try {
    const response = await fetch(envConfig.historyUrl);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const buildingRows = doc.querySelectorAll('tr.build-row');
    let activeBuild = null;

    for (const row of buildingRows) {
      const progressIcon = row.querySelector('use[href*="build-status-in-progress"]');
      const animatedIcon = row.querySelector('.icon-aborted-anime');
      if (progressIcon || animatedIcon) {
        const buildLink = row.querySelector('a.build-link.display-name');
        if (buildLink) {
          const buildNumber = buildLink.textContent.trim();
          const buildUrl = buildLink.getAttribute('href');
          const consoleLink = row.querySelector('a.build-status-link');
          const consoleUrl = consoleLink ? consoleLink.getAttribute('href') : null;
          const timeElement = row.querySelector('.pane.build-details a');
          const buildTime = timeElement ? adjustTimeBy8Hours(timeElement.textContent.trim().split('\n')[0]) : '';
          activeBuild = { number: buildNumber, buildUrl, consoleUrl, buildTime };
          break;
        }
      }
    }

    if (activeBuild) {
      const buildTimeText = activeBuild.buildTime ? ` (${activeBuild.buildTime})` : '';
      buildStatus.textContent = `正在构建中... ${activeBuild.number}${buildTimeText}`;
      buildStatus.className = 'status building';
      const baseUrl = new URL(envConfig.historyUrl).origin;
      let linksHtml = `
        <a href="${baseUrl}${activeBuild.consoleUrl}" target="_blank">查看控制台输出</a>
        <a href="${baseUrl}${activeBuild.buildUrl}" target="_blank">查看构建详情</a>
      `;
      if (activeBuild.buildTime) {
        linksHtml += `<div class="build-time">开始时间: ${activeBuild.buildTime}</div>`;
      }
      buildLinks.innerHTML = linksHtml;
      buildLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          chrome.tabs.create({ url: link.href });
        });
      });
    } else {
      showLatestBuildStatus(buildingRows, env);
      if (statusCheckIntervals[env]) {
        clearInterval(statusCheckIntervals[env]);
      }
    }
  } catch (error) {
    console.error(`检查${env}构建状态失败:`, error);
    buildStatus.textContent = '检查状态失败';
    buildLinks.innerHTML = '';
    if (statusCheckIntervals[env]) {
      clearInterval(statusCheckIntervals[env]);
    }
  }
}

function showLatestBuildStatus(buildRows, env) {
  const buildStatus = document.getElementById(`buildStatus-${env}`);
  const buildLinks = document.getElementById(`buildLinks-${env}`);
  const envConfig = environments[env];
  if (!buildRows || buildRows.length === 0) {
    buildStatus.textContent = '没有找到构建记录';
    buildStatus.className = 'status';
    buildLinks.innerHTML = '';
    return;
  }

  const latestRow = buildRows[0];
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
  const buildTime = timeElement ? adjustTimeBy8Hours(timeElement.textContent.trim().split('\n')[0]) : '';
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
    }
  } else {
    statusText = `最新部署记录 ${buildNumber}`;
  }

  buildStatus.textContent = statusText;
  buildStatus.className = statusClass;
  const baseUrl = new URL(envConfig.historyUrl).origin;
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
  buildLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: link.href });
    });
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    Object.keys(environments).forEach(envKey => {
      startStatusCheck(envKey);
    });
  } else {
    Object.keys(statusCheckIntervals).forEach(envKey => {
      clearInterval(statusCheckIntervals[envKey]);
    });
  }
});