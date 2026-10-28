import { z } from 'zod';

export const ALLOW_LISTED_VARIABLES = [
  'comment.id',
  'comment.text',
  'comment.created_time',
  'post.id',
  'post.permalink',
  'asset.name',
  'workflow.name',
  'now.date',
  'commenter_name',
  'comment_text',
  'page_name',
  'current_date',
] as const;

export type AllowListedVariable = (typeof ALLOW_LISTED_VARIABLES)[number];

export const WORKFLOW_NODE_TYPES = [
  'trigger.comment',
  'condition.text',
  'condition.asset_post',
  'action.public_reply',
  'action.private_reply',
  'action.use_template',
  'action.stop',
] as const;

export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number];

export const MATCH_KINDS = [
  'text_contains',
  'text_exact',
  'text_excludes',
  'text_matches_phrase',
] as const;

export type MatchKind = (typeof MATCH_KINDS)[number];

export const LOGICAL_OPS = ['AND', 'OR'] as const;
export type LogicalOp = (typeof LOGICAL_OPS)[number];

export const TriggerDataSchema = z.object({
  platform: z.enum(['facebook', 'instagram', 'all']).default('all'),
  assetIds: z.array(z.string()).default([]),
  postScope: z
    .object({
      mode: z.enum(['all', 'posts', 'reels']).default('all'),
      postExternalIds: z.array(z.string()).default([]),
    })
    .default({ mode: 'all', postExternalIds: [] }),
  includeReplies: z.boolean().default(false),
});
export type TriggerData = z.infer<typeof TriggerDataSchema>;

export const TextRuleSchema = z.object({
  kind: z.enum(MATCH_KINDS),
  value: z.string().min(1, 'قيمة الشرط لا يمكن أن تكون فارغة'),
  caseSensitive: z.boolean().default(false),
});
export type TextRule = z.infer<typeof TextRuleSchema>;

export const ConditionTextDataSchema = z.object({
  op: z.enum(LOGICAL_OPS).default('OR'),
  rules: z.array(TextRuleSchema).min(1, 'يجب تحديد قاعدة نصية واحدة على الأقل'),
});
export type ConditionTextData = z.infer<typeof ConditionTextDataSchema>;

export const ConditionAssetPostDataSchema = z.object({
  assetIds: z.array(z.string()).default([]),
  postIds: z.array(z.string()).default([]),
});
export type ConditionAssetPostData = z.infer<typeof ConditionAssetPostDataSchema>;

export const ActionPublicReplyDataSchema = z.object({
  message: z.string().min(1, 'نص الرد العام مطلوب'),
  imageUrl: z.string().optional(),
});
export type ActionPublicReplyData = z.infer<typeof ActionPublicReplyDataSchema>;

export const ActionPrivateReplyDataSchema = z.object({
  message: z.string().optional(),
  templateId: z.string().optional(),
  imageUrl: z.string().optional(),
});
export type ActionPrivateReplyData = z.infer<typeof ActionPrivateReplyDataSchema>;

export const ActionUseTemplateDataSchema = z.object({
  templateId: z.string().min(1, 'معرّف القالب مطلوب'),
  templateName: z.string().optional(),
});
export type ActionUseTemplateData = z.infer<typeof ActionUseTemplateDataSchema>;

export const ActionStopDataSchema = z.object({
  reason: z.string().default('تم الإيقاف بواسطة العقدة'),
});
export type ActionStopData = z.infer<typeof ActionStopDataSchema>;

export const WorkflowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(WORKFLOW_NODE_TYPES),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.record(z.string(), z.unknown()),
});
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;

export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

export const WorkflowSettingsSchema = z.object({
  stopOnError: z.boolean().default(true),
  privateReplyWindowMinutes: z.number().default(10080),
  dedupeTtlHours: z.number().default(168),
});
export type WorkflowSettings = z.infer<typeof WorkflowSettingsSchema>;

export const WorkflowDefinitionSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
  settings: WorkflowSettingsSchema.default({
    stopOnError: true,
    privateReplyWindowMinutes: 10080,
    dedupeTtlHours: 168,
  }),
});
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
