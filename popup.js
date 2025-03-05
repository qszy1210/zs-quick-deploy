document.getElementById('triggerBuild').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'triggerBuild' }, (response) => {
    if (response && response.status === 'started') {
      console.log('构建触发请求已发送');
    }
  });
});