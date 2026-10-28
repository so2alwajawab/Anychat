import {
  ALLOW_LISTED_VARIABLES,
  type WorkflowDefinition,
  type WorkflowNode,
  type WorkflowEdge,
} from './types.js';

export interface ValidationError {
  nodeId?: string;
  field?: string;
  message: string;
}

export interface ValidationOptions {
  availableAssetIds?: string[];
  availableTemplateIds?: string[];
}

const VARIABLE_REGEX = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function extractTemplateVariables(text: string): string[] {
  const vars: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(VARIABLE_REGEX);
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      vars.push(match[1]);
    }
  }
  return vars;
}

export function validateTemplateVariables(text: string, nodeId?: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const found = extractTemplateVariables(text);
  const allowListSet = new Set<string>(ALLOW_LISTED_VARIABLES);

  for (const v of found) {
    if (!allowListSet.has(v)) {
      errors.push({
        nodeId,
        field: 'message',
        message: `المتغير '{{${v}}}' في العقدة (${nodeId ?? 'غير محدد'}) غير مصرح به. المتغيرات المتاحة هي: ${ALLOW_LISTED_VARIABLES.map((item) => `{{${item}}}`).join('، ')}`,
      });
    }
  }

  return errors;
}

export function validateWorkflowDefinition(
  input: unknown,
  options?: ValidationOptions,
): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!input || typeof input !== 'object') {
    return {
      valid: false,
      errors: [{ message: 'مخطط الأتمتة غير صالح: يجب أن يكون كائناً برمجياً' }],
    };
  }

  const def = input as Partial<WorkflowDefinition>;
  const nodes: WorkflowNode[] = Array.isArray(def.nodes) ? def.nodes : [];
  const edges: WorkflowEdge[] = Array.isArray(def.edges) ? def.edges : [];

  if (nodes.length === 0) {
    return {
      valid: false,
      errors: [{ message: 'المخطط فارغ: يجب إضافة مشغل وعقد أتمتة' }],
    };
  }

  const nodeMap = new Map<string, WorkflowNode>();
  const incomingMap = new Map<string, WorkflowEdge[]>();
  const outgoingMap = new Map<string, WorkflowEdge[]>();

  for (const node of nodes) {
    if (!node.id || typeof node.id !== 'string') {
      errors.push({ message: 'توجد عقدة بدون معرّف صالح (ID)' });
      continue;
    }
    if (nodeMap.has(node.id)) {
      errors.push({ nodeId: node.id, message: `تكرار معرّف العقدة (${node.id})` });
    }
    nodeMap.set(node.id, node);
    incomingMap.set(node.id, []);
    outgoingMap.set(node.id, []);
  }

  // 1. Trigger node checks
  const triggers = nodes.filter((n) => n.type === 'trigger.comment');
  if (triggers.length === 0) {
    errors.push({ message: 'يجب أن يحتوي المخطط على عقدة مشغل البداية (trigger.comment)' });
  } else if (triggers.length > 1) {
    errors.push({ message: 'لا يمكن أن يحتوي المخطط على أكثر من مشغل بداية واحد' });
  }

  // 2. Edge validation
  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (!edge.id || typeof edge.id !== 'string') {
      errors.push({ message: 'توجد حافة بدون معرّف صالح' });
      continue;
    }
    if (edgeIds.has(edge.id)) {
      errors.push({ message: `تكرار معرّف الحافة (${edge.id})` });
    }
    edgeIds.add(edge.id);

    if (!nodeMap.has(edge.source)) {
      errors.push({
        message: `الحافة (${edge.id}) تنطلق من عقدة غير موجودة (${edge.source})`,
      });
      continue;
    }
    if (!nodeMap.has(edge.target)) {
      errors.push({
        message: `الحافة (${edge.id}) تتصل بعقدة وجهة غير موجودة (${edge.target})`,
      });
      continue;
    }

    if (edge.source === edge.target) {
      errors.push({
        nodeId: edge.source,
        message: `لا يمكن للعقدة (${edge.source}) أن ترتبط بنفسها بحلقة ذاتية`,
      });
    }

    outgoingMap.get(edge.source)!.push(edge);
    incomingMap.get(edge.target)!.push(edge);
  }

  // 3. Trigger cannot have incoming edges
  for (const trigger of triggers) {
    const inc = incomingMap.get(trigger.id) ?? [];
    if (inc.length > 0) {
      errors.push({
        nodeId: trigger.id,
        message: `عقدة البداية المشغل (${trigger.id}) لا يمكن أن تتلقى روابط واردة`,
      });
    }
  }

  // 4. Reachability from trigger
  if (triggers.length === 1) {
    const startNode = triggers[0]!;
    const visited = new Set<string>();
    const queue = [startNode.id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const outEdges = outgoingMap.get(current) ?? [];
      for (const e of outEdges) {
        if (!visited.has(e.target) && nodeMap.has(e.target)) {
          queue.push(e.target);
        }
      }
    }

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        errors.push({
          nodeId: node.id,
          message: `العقدة (${node.id}) معزولة ولا يمكن الوصول إليها من مشغل البداية`,
        });
      }
    }
  }

  // 5. Cycle Detection (DFS)
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function checkCycle(nodeId: string, path: string[]): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const outEdges = outgoingMap.get(nodeId) ?? [];
    for (const edge of outEdges) {
      const target = edge.target;
      if (!visited.has(target)) {
        if (checkCycle(target, [...path, target])) return true;
      } else if (recursionStack.has(target)) {
        errors.push({
          nodeId,
          message: `تم اكتشاف تكرار حلقي (Cycle) في المسار يمر بالعقدة (${target})`,
        });
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      checkCycle(node.id, [node.id]);
    }
  }

  // 6. Node-specific rules
  for (const node of nodes) {
    const data = (node.data ?? {}) as Record<string, unknown>;
    const outEdges = outgoingMap.get(node.id) ?? [];

    switch (node.type) {
      case 'condition.text': {
        const rules = data.rules;
        if (!Array.isArray(rules) || rules.length === 0) {
          errors.push({
            nodeId: node.id,
            field: 'rules',
            message: `عقدة فحص النص (${node.id}) يجب أن تحتوي على قاعدة واحدة على الأقل`,
          });
        } else {
          for (const rule of rules as Array<Record<string, unknown>>) {
            if (!rule.value || typeof rule.value !== 'string' || rule.value.trim().length === 0) {
              errors.push({
                nodeId: node.id,
                field: 'rules',
                message: `قيمة الكلمة المفتاحية في عقدة الشرط (${node.id}) لا يمكن أن تكون فارغة`,
              });
            }
          }
        }
        if (outEdges.length === 0) {
          errors.push({
            nodeId: node.id,
            message: `عقدة الشرط (${node.id}) تتطلب مساراً متفرعاً خارجاً واحداً على الأقل`,
          });
        }
        break;
      }

      case 'action.public_reply': {
        const message = data.message;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
          errors.push({
            nodeId: node.id,
            field: 'message',
            message: `نص الرد العام مطلوب في العقدة (${node.id})`,
          });
        } else {
          errors.push(...validateTemplateVariables(message, node.id));
        }
        break;
      }

      case 'action.private_reply': {
        const message = data.message;
        const templateId = data.templateId;
        if (templateId && typeof templateId === 'string') {
          if (options?.availableTemplateIds && !options.availableTemplateIds.includes(templateId)) {
            errors.push({
              nodeId: node.id,
              field: 'templateId',
              message: `القالب المحدد في العقدة (${node.id}) غير موجود في قائمة القوالب`,
            });
          }
        } else if (!message || typeof message !== 'string' || message.trim().length === 0) {
          errors.push({
            nodeId: node.id,
            field: 'message',
            message: `نص الرد الخاص مطلوب في العقدة (${node.id})`,
          });
        } else {
          errors.push(...validateTemplateVariables(message, node.id));
        }
        break;
      }

      case 'action.use_template': {
        const templateId = data.templateId;
        if (!templateId || typeof templateId !== 'string') {
          errors.push({
            nodeId: node.id,
            field: 'templateId',
            message: `يجب تحديد القالب المراد استخدامه في العقدة (${node.id})`,
          });
        } else if (options?.availableTemplateIds && !options.availableTemplateIds.includes(templateId)) {
          errors.push({
            nodeId: node.id,
            field: 'templateId',
            message: `القالب المحدد في العقدة (${node.id}) غير موجود في قائمة القوالب`,
          });
        }
        break;
      }

      case 'action.stop': {
        if (outEdges.length > 0) {
          errors.push({
            nodeId: node.id,
            message: `عقدة الإيقاف (${node.id}) هي عقدة نهائية ولا يمكن أن ترتبط بمسارات تالية`,
          });
        }
        break;
      }

      case 'trigger.comment': {
        if (options?.availableAssetIds && options.availableAssetIds.length > 0) {
          const assetIds = Array.isArray(data.assetIds) ? (data.assetIds as string[]) : [];
          for (const aid of assetIds) {
            if (!options.availableAssetIds.includes(aid)) {
              errors.push({
                nodeId: node.id,
                field: 'assetIds',
                message: `الصفحة أو الحساب المحدد (${aid}) في المشغل غير متصل بالنظام`,
              });
            }
          }
        }
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
