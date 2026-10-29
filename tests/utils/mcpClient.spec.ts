import { describe, expect, it } from 'vitest';
import { claudeCodeCommand, mcpEndpointUrl, mcpJsonConfig, mcpServerName } from '~/utils/mcpClient';

describe('mcpClient: подключение ИИ-клиента', () => {
  it('адрес /mcp из абсолютной и относительной базы API', () => {
    expect(mcpEndpointUrl('http://127.0.0.1:8049/', 'http://localhost:3077')).toBe('http://127.0.0.1:8049/mcp');
    expect(mcpEndpointUrl('/tgid/almaty/map-api', 'https://itwin.kz/')).toBe('https://itwin.kz/tgid/almaty/map-api/mcp');
    expect(mcpEndpointUrl('map-api', 'https://itwin.kz', 'mcp')).toBe('https://itwin.kz/map-api/mcp');
  });

  it('имя сервера и фрагменты настройки', () => {
    expect(mcpServerName('Almaty')).toBe('tgid-almaty');
    expect(mcpServerName('Алматы')).toBe('tgid');
    expect(mcpServerName(null)).toBe('tgid');
    expect(claudeCodeCommand('tgid', 'https://x/mcp', 'T')).toBe(
      'claude mcp add --transport http tgid https://x/mcp --header "Authorization: Bearer T"');
    expect(JSON.parse(mcpJsonConfig('tgid', 'https://x/mcp', 'T'))).toEqual({
      mcpServers: { tgid: { type: 'http', url: 'https://x/mcp', headers: { Authorization: 'Bearer T' } } },
    });
  });
});
