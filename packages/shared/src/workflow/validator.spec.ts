import { describe, it, expect } from 'vitest';
import { validateWorkflowDefinition } from './validator.js';
import type { WorkflowDefinition } from './types.js';

describe('Workflow Validator (Gate G4 Requirements - 15+ Negative Cases)', () => {
  const validWorkflow: WorkflowDefinition = {
    schemaVersion: 1,
    nodes: [
      {
        id: 'node-trigger',
        type: 'trigger.comment',
        position: { x: 0, y: 0 },
        data: { platform: 'facebook', assetIds: ['asset-1'] },
      },
      {
        id: 'node-condition',
        type: 'condition.text',
        position: { x: 0, y: 100 },
        data: {
          op: 'OR',
          rules: [{ kind: 'text_contains', value: 'سعر', caseSensitive: false }],
        },
      },
      {
        id: 'node-public-reply',
        type: 'action.public_reply',
        position: { x: 0, y: 200 },
        data: { message: 'أهلاً بك، تفضل الرابط {{post.permalink}}' },
      },
      {
        id: 'node-stop',
        type: 'action.stop',
        position: { x: 0, y: 300 },
        data: { reason: 'انتهاء الرد' },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'node-trigger', target: 'node-condition' },
      { id: 'edge-2', source: 'node-condition', target: 'node-public-reply', sourceHandle: 'true' },
      { id: 'edge-3', source: 'node-public-reply', target: 'node-stop' },
    ],
    settings: {
      stopOnError: true,
      privateReplyWindowMinutes: 10080,
      dedupeTtlHours: 168,
    },
  };

  it('passes on a valid 4-node workflow', () => {
    const result = validateWorkflowDefinition(validWorkflow, { availableAssetIds: ['asset-1'] });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Negative Case 1: Empty workflow object
  it('1. rejects empty input', () => {
    const res = validateWorkflowDefinition({});
    expect(res.valid).toBe(false);
    expect(res.errors[0]?.message).toContain('المخطط فارغ');
  });

  // Negative Case 2: Null / invalid object
  it('2. rejects null input', () => {
    const res = validateWorkflowDefinition(null);
    expect(res.valid).toBe(false);
    expect(res.errors[0]?.message).toContain('غير صالح');
  });

  // Negative Case 3: Missing trigger node
  it('3. rejects workflow with zero triggers', () => {
    const res = validateWorkflowDefinition({
      nodes: [
        {
          id: 'n1',
          type: 'action.public_reply',
          position: { x: 0, y: 0 },
          data: { message: 'مرحبا' },
        },
      ],
      edges: [],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('مشغل البداية'))).toBe(true);
  });

  // Negative Case 4: Multiple trigger nodes
  it('4. rejects workflow with multiple triggers', () => {
    const res = validateWorkflowDefinition({
      nodes: [
        { id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        { id: 't2', type: 'trigger.comment', position: { x: 100, y: 0 }, data: {} },
      ],
      edges: [],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('أكثر من مشغل بداية واحد'))).toBe(true);
  });

  // Negative Case 5: Incoming edge to trigger node
  it('5. rejects incoming edge to trigger node', () => {
    const res = validateWorkflowDefinition({
      nodes: [
        { id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        { id: 'a1', type: 'action.stop', position: { x: 0, y: 100 }, data: {} },
      ],
      edges: [{ id: 'e1', source: 'a1', target: 't1' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('لا يمكن أن تتلقى روابط واردة'))).toBe(true);
  });

  // Negative Case 6: Self-loop edge
  it('6. rejects self-loop edge (node connects to itself)', () => {
    const res = validateWorkflowDefinition({
      nodes: [
        { id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        { id: 'c1', type: 'condition.text', position: { x: 0, y: 100 }, data: { rules: [{ kind: 'text_contains', value: 'س' }] } },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'c1' },
        { id: 'e2', source: 'c1', target: 'c1' },
      ],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('بحلقة ذاتية'))).toBe(true);
  });

  // Negative Case 7: Cycle detection (multi-node loop)
  it('7. detects circular cycle between nodes', () => {
    const res = validateWorkflowDefinition({
      nodes: [
        { id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        { id: 'n1', type: 'condition.text', position: { x: 0, y: 100 }, data: { rules: [{ kind: 'text_contains', value: 'س' }] } },
        { id: 'n2', type: 'action.public_reply', position: { x: 0, y: 200 }, data: { message: 'رد' } },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'n1' },
        { id: 'e2', source: 'n1', target: 'n2' },
        { id: 'e3', source: 'n2', target: 'n1' },
      ],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('تكرار حلقي'))).toBe(true);
  });

  // Negative Case 8: Dangling edge source
  it('8. rejects edge with non-existent source', () => {
    const res = validateWorkflowDefinition({
      nodes: [{ id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} }],
      edges: [{ id: 'e1', source: 'phantom-node', target: 't1' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('تنطلق من عقدة غير موجودة'))).toBe(true);
  });

  // Negative Case 9: Dangling edge target
  it('9. rejects edge with non-existent target', () => {
    const res = validateWorkflowDefinition({
      nodes: [{ id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} }],
      edges: [{ id: 'e1', source: 't1', target: 'ghost-target' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('تتصل بعقدة وجهة غير موجودة'))).toBe(true);
  });

  // Negative Case 10: Unreachable/isolated node
  it('10. rejects unreachable node disconnected from trigger', () => {
    const res = validateWorkflowDefinition({
      nodes: [
        { id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        { id: 'isolated', type: 'action.stop', position: { x: 200, y: 200 }, data: {} },
      ],
      edges: [],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('معزولة ولا يمكن الوصول إليها'))).toBe(true);
  });

  // Negative Case 11: Condition node with zero outgoing edges
  it('11. rejects condition node without outgoing branches', () => {
    const res = validateWorkflowDefinition({
      nodes: [
        { id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        { id: 'c1', type: 'condition.text', position: { x: 0, y: 100 }, data: { rules: [{ kind: 'text_contains', value: 'س' }] } },
      ],
      edges: [{ id: 'e1', source: 't1', target: 'c1' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('تتطلب مساراً متفرعاً'))).toBe(true);
  });

  // Negative Case 12: Stop node with outgoing edges
  it('12. rejects stop node that has outgoing edges', () => {
    const res = validateWorkflowDefinition({
      nodes: [
        { id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        { id: 's1', type: 'action.stop', position: { x: 0, y: 100 }, data: {} },
        { id: 'a1', type: 'action.public_reply', position: { x: 0, y: 200 }, data: { message: 'مرحبا' } },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 's1' },
        { id: 'e2', source: 's1', target: 'a1' },
      ],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('عقدة نهائية ولا يمكن أن ترتبط'))).toBe(true);
  });

  // Negative Case 13: Empty text condition rules
  it('13. rejects text condition with empty rules', () => {
    const res = validateWorkflowDefinition({
      nodes: [
        { id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        { id: 'c1', type: 'condition.text', position: { x: 0, y: 100 }, data: { rules: [] } },
        { id: 's1', type: 'action.stop', position: { x: 0, y: 200 }, data: {} },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'c1' },
        { id: 'e2', source: 'c1', target: 's1' },
      ],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('يجب أن تحتوي على قاعدة واحدة على الأقل'))).toBe(true);
  });

  // Negative Case 14: Text rule with empty string value
  it('14. rejects text rule with blank value', () => {
    const res = validateWorkflowDefinition({
      nodes: [
        { id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        { id: 'c1', type: 'condition.text', position: { x: 0, y: 100 }, data: { rules: [{ kind: 'text_contains', value: '   ' }] } },
        { id: 's1', type: 'action.stop', position: { x: 0, y: 200 }, data: {} },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'c1' },
        { id: 'e2', source: 'c1', target: 's1' },
      ],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('لا يمكن أن تكون فارغة'))).toBe(true);
  });

  // Negative Case 15: Public reply with missing message
  it('15. rejects public reply with empty message', () => {
    const res = validateWorkflowDefinition({
      nodes: [
        { id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        { id: 'a1', type: 'action.public_reply', position: { x: 0, y: 100 }, data: { message: '' } },
      ],
      edges: [{ id: 'e1', source: 't1', target: 'a1' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('نص الرد العام مطلوب'))).toBe(true);
  });

  // Negative Case 16: Disallowed dynamic variable in public reply
  it('16. rejects disallowed dynamic variable', () => {
    const res = validateWorkflowDefinition({
      nodes: [
        { id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        {
          id: 'a1',
          type: 'action.public_reply',
          position: { x: 0, y: 100 },
          data: { message: 'أهلاً بك يا {{user.secret_token}}' },
        },
      ],
      edges: [{ id: 'e1', source: 't1', target: 'a1' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes("المتغير '{{user.secret_token}}'"))).toBe(true);
  });

  // Negative Case 17: Disallowed dynamic variable in private reply
  it('17. rejects disallowed dynamic variable in private reply', () => {
    const res = validateWorkflowDefinition({
      nodes: [
        { id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        {
          id: 'a1',
          type: 'action.private_reply',
          position: { x: 0, y: 100 },
          data: { message: 'مرحباً {{customer.phone_number}}' },
        },
      ],
      edges: [{ id: 'e1', source: 't1', target: 'a1' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes("المتغير '{{customer.phone_number}}'"))).toBe(true);
  });

  // Negative Case 18: Use template action with non-existent template ID
  it('18. rejects use_template action with missing template', () => {
    const res = validateWorkflowDefinition(
      {
        nodes: [
          { id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
          { id: 'tpl', type: 'action.use_template', position: { x: 0, y: 100 }, data: { templateId: 'tpl-999' } },
        ],
        edges: [{ id: 'e1', source: 't1', target: 'tpl' }],
      },
      { availableTemplateIds: ['tpl-1', 'tpl-2'] },
    );
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('غير موجود في قائمة القوالب'))).toBe(true);
  });

  // Negative Case 19: Unresolvable asset ID in trigger
  it('19. rejects unresolvable asset ID in trigger scope', () => {
    const res = validateWorkflowDefinition(
      {
        nodes: [
          { id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: { assetIds: ['unconnected-page-99'] } },
          { id: 's1', type: 'action.stop', position: { x: 0, y: 100 }, data: {} },
        ],
        edges: [{ id: 'e1', source: 't1', target: 's1' }],
      },
      { availableAssetIds: ['page-1', 'page-2'] },
    );
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('غير متصل بالنظام'))).toBe(true);
  });

  // Negative Case 20: Duplicate node ID
  it('20. rejects duplicate node IDs', () => {
    const res = validateWorkflowDefinition({
      nodes: [
        { id: 'dup-id', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        { id: 'dup-id', type: 'action.stop', position: { x: 0, y: 100 }, data: {} },
      ],
      edges: [],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('تكرار معرّف العقدة'))).toBe(true);
  });

  // Gate G6: Accepts valid allowed variables in private reply and public reply
  it('21. accepts allow-listed variables and aliases (Gate G6)', () => {
    const res = validateWorkflowDefinition({
      nodes: [
        { id: 't1', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        {
          id: 'a1',
          type: 'action.private_reply',
          position: { x: 0, y: 100 },
          data: { message: 'مرحباً {{commenter_name}} بخصوص {{comment_text}} في {{page_name}} بتاريخ {{current_date}}' },
        },
      ],
      edges: [{ id: 'e1', source: 't1', target: 'a1' }],
    });
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });
});
