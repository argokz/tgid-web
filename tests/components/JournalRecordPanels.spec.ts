import { describe, it, expect, vi, beforeEach } from 'vitest';
import JournalRecordPanels from '~/components/JournalRecordPanels.vue';
import { useAuthStore } from '~/stores/authStore';
import type { ApprovalInfo, JournalSchema } from '~/services/journalWriteService';
import { mountWithVuetify, findButton, flushPromises, createTestPinia } from './mountHelper';

const svc = vi.hoisted(() => ({
  getSchema: vi.fn(), getApproval: vi.fn(), approve: vi.fn(), unapprove: vi.fn(),
  getContour: vi.fn(), listDocuments: vi.fn(),
}));
vi.mock('~/services/journalWriteService', async (orig) => ({
  ...(await orig<typeof import('~/services/journalWriteService')>()),
  journalWriteService: svc,
}));

const schema = {
  key: 'repair', title: 'Ремонты', required_on_create: [], unique_fields: [], create_modes: [],
  fields: { plan_date: { kind: 'date', label: 'Дата плана', ref: null }, executor: { kind: 'str', label: 'Исполнитель', ref: null } },
  has_contour: false, has_documents: false, has_point_geometry: false,
  approval: { signers: { signer_name: { kind: 'str', label: 'Утвердил', ref: null } }, required_fields: ['executor'], require_contour: false, sets_state: 2 },
} as unknown as JournalSchema;

const approvalInfo = (over: Partial<ApprovalInfo> = {}): ApprovalInfo => ({
  id: 15, approved: false, approval_flag: 0, not_applicable: false, approved_on: null,
  signers: {}, last_action: null, missing_fields: [], contour_size: null, ...over,
});

async function mountPanels(canEdit = true) {
  const pinia = createTestPinia();
  const auth = useAuthStore();
  auth.authDisabled = true;
  auth.mutationsEnabledServer = canEdit;
  const w = mountWithVuetify(JournalRecordPanels, { pinia, props: { journal: 'repair' as any, recordId: 15, recordLabel: 'Ремонт №15' } });
  await flushPromises();
  return w;
}

describe('JournalRecordPanels: утверждение плана', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.getSchema.mockResolvedValue(schema);
    svc.getApproval.mockResolvedValue(approvalInfo());
    svc.approve.mockResolvedValue({});
  });

  it('незаполненные обязательные поля выводятся подсказкой', async () => {
    svc.getApproval.mockResolvedValue(approvalInfo({ missing_fields: ['executor'] }));
    const w = await mountPanels();
    expect(svc.getApproval).toHaveBeenCalledWith('repair', 15);
    expect(w.text()).toContain('Не утверждено');
    expect(w.text()).toContain('Для утверждения заполните: Исполнитель');
    w.unmount();
  });

  it('форма → подтверждение → approve с датой и подписантом, затем перечитать и emit changed', async () => {
    const w = await mountPanels();
    await findButton(w, 'Утвердить…').trigger('click');
    const setup = (w.vm as any).$.setupState;
    setup.approveForm.approved_on = '2026-09-20';
    setup.approveForm.signers.signer_name = 'Иванов';
    await flushPromises();
    svc.getApproval.mockResolvedValue(approvalInfo({ approved: true, approved_on: '2026-09-20', approval_flag: 1 }));
    await findButton(w, 'Утвердить план').trigger('click');
    expect(w.text()).toContain('Утвердить «Ремонт №15» датой 20.09.2026?');
    await findButton(w, /^Утвердить$/).trigger('click');
    await flushPromises();
    expect(svc.approve).toHaveBeenCalledWith('repair', 15, '2026-09-20', { signer_name: 'Иванов' });
    expect(w.emitted('changed')).toHaveLength(1);
    expect(w.text()).toContain('Утверждено 20.09.2026');
    expect(findButton(w, 'Снять утверждение')).toBeTruthy();
    w.unmount();
  });

  it('без права записи кнопок утверждения нет', async () => {
    const w = await mountPanels(false);
    expect(w.text()).toContain('Не утверждено');
    expect(w.findAll('button').some((b) => b.text().includes('Утвердить'))).toBe(false);
    w.unmount();
  });
});
