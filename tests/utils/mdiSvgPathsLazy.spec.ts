import { describe, expect, it } from 'vitest';
import { h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { firstScreenMdiSvgPaths, loadLazyMdiSvgPaths, resolveMdiSvgPath } from '~/utils/mdiSvgPaths';
import { lazyMdiSvgPaths } from '~/utils/mdiSvgPathsLazy';

/** Как компонент набора mdi в plugins/vuetify.ts: функциональный, путь берёт из resolveMdiSvgPath */
const Icon = (props: { icon: string }) => h('svg', { viewBox: '0 0 24 24' }, [h('path', { d: resolveMdiSvgPath(props.icon) })]);
Icon.props = ['icon'];

describe('mdiSvgPaths: ленивый набор', () => {
  it('иконка диалога пустая до загрузки и дорисовывается после, первый экран — сразу', async () => {
    const lazyName = Object.keys(lazyMdiSvgPaths)[0];
    const eagerName = Object.keys(firstScreenMdiSvgPaths)[0];
    const lazy = mount(Icon, { props: { icon: lazyName } });
    const eager = mount(Icon, { props: { icon: eagerName } });
    expect(lazy.find('path').attributes('d')).toBe('');
    expect(eager.find('path').attributes('d')).toBe(firstScreenMdiSvgPaths[eagerName]);

    await Promise.all([loadLazyMdiSvgPaths(), loadLazyMdiSvgPaths()]);
    await nextTick();
    expect(lazy.find('path').attributes('d')).toBe(lazyMdiSvgPaths[lazyName]);
  });
});
