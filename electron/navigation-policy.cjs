'use strict';

function classifyNavigation(input, port) {
  let target;
  try {
    target = new URL(input);
  } catch {
    return { action: 'block', reason: 'malformed URL' };
  }

  const isLocalApp = target.protocol === 'http:' &&
    (target.hostname === '127.0.0.1' || target.hostname === 'localhost') &&
    target.port === String(port);

  if (isLocalApp) return { action: 'allow' };
  if (target.protocol === 'https:' || target.protocol === 'http:') {
    return { action: 'external', url: target.toString() };
  }
  return { action: 'block', reason: 'unsupported protocol ' + target.protocol };
}

module.exports = { classifyNavigation };
