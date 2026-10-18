import { describe, expect, it } from 'vitest';
import { nodeTypeLosses, nodeTypeTitle } from '~/utils/nodeTypes';
import { chainRequestPoints } from '~/utils/cadChain';

describe('nodeTypes', () => {
  it('подписи типов и того, что удалит смена типа', () => {
    expect(nodeTypeTitle('PR')).toBe('Потребитель');
    expect(nodeTypeTitle('XX')).toBe('XX');
    expect(nodeTypeLosses({
      node_id: 1, old_type: 'PR', new_type: 'US', old_label: '', new_label: '',
      removed_cards: [{ table: 'realconsumers', type: 'PR', id: 7, name: 'Дом 1' }],
      created_card: null, removed_scheme: { nodes: 3, lines: 4 },
    })).toEqual([
      'карточка «Потребитель» «Дом 1» (№7) со всеми её значениями',
      'внутренняя схема: узлов 3, участков 4',
    ]);
  });

  it('тип нового узла уходит в цепочку только у новой точки и не для «Узла»', () => {
    expect(chainRequestPoints([
      { kind: 'node', coord: [1, 2], nodeId: 5, nodeType: 'PR' },
      { kind: 'vertex', coord: [1, 3] },
      { kind: 'new', coord: [1, 4], nodeType: 'PR' },
    ])).toEqual([
      { kind: 'node', node_id: 5 },
      { kind: 'vertex', lng: 1, lat: 3 },
      { kind: 'new', lng: 1, lat: 4, node_type: 'PR' },
    ]);
    expect(chainRequestPoints([{ kind: 'new', coord: [1, 4], nodeType: 'US' }])).toEqual([{ kind: 'new', lng: 1, lat: 4 }]);
  });
});
