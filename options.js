// Default settings
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

// Saves options to chrome.storage
function save_options() {
  const environments = {};
  const envElements = document.querySelectorAll('.environment');
  
  envElements.forEach(envElement => {
    const key = envElement.dataset.key;
    environments[key] = {
      name: envElement.querySelector('#name-' + key).value,
      buildUrl: envElement.querySelector('#buildUrl-' + key).value,
      jobUrl: envElement.querySelector('#jobUrl-' + key).value,
      historyUrl: envElement.querySelector('#historyUrl-' + key).value,
    };
  });

  chrome.storage.sync.set({ environments: environments }, () => {
    // Update status to let user know options were saved.
    const status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(() => {
      status.textContent = '';
    }, 1500);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  chrome.storage.sync.get({ environments: defaultEnvironments }, (items) => {
    const container = document.getElementById('environments-config');
    container.innerHTML = ''; // Clear previous entries
    const environments = items.environments;

    for (const key in environments) {
      const env = environments[key];
      const envContainer = document.createElement('div');
      envContainer.className = 'environment';
      envContainer.dataset.key = key;

      envContainer.innerHTML = `
        <h3>${env.name} Environment</h3>
        <label for="name-${key}">Name:</label>
        <input type="text" id="name-${key}" value="${env.name}">
        <label for="buildUrl-${key}">Build URL:</label>
        <input type="text" id="buildUrl-${key}" value="${env.buildUrl}">
        <label for="jobUrl-${key}">Job URL:</label>
        <input type="text" id="jobUrl-${key}" value="${env.jobUrl}">
        <label for="historyUrl-${key}">History URL:</label>
        <input type="text" id="historyUrl-${key}" value="${env.historyUrl}">
      `;
      container.appendChild(envContainer);
    }
  });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
