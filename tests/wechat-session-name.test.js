import test from 'node:test';
import assert from 'node:assert/strict';

import { getWechatSessionName } from '../src/utils/wechatSessions.js';

test('uses chat field from wechat-cli session payloads', () => {
  const session = {
    chat: '拒绝内耗，享受缺德人生',
    username: '53151026357@chatroom',
    is_group: true,
  };

  assert.equal(getWechatSessionName(session), '拒绝内耗，享受缺德人生');
});

test('falls back to existing name field when present', () => {
  const session = { name: '已有群名', chat: '备用群名' };

  assert.equal(getWechatSessionName(session), '已有群名');
});
