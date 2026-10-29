import type { Node, Edge } from "@xyflow/react";

export interface FlowTemplate {
  id: string;
  title: string;
  category: string;
  badge: string;
  icon: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
}

export const MANYCHAT_FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "price-inquiry",
    title: "استفسارات الأسعار والطلب المباشر",
    category: "مبيعات وتجارة إلكترونية",
    badge: "الأكثر استخداماً ⭐",
    icon: "💰",
    description: "فحص كلمات الأسعار (بكام، سعر، price) والرد على التعليق بصيغ متنوعة وإرسال تفاصيل السعر في الخاص مع زر الطلب وزر واتساب.",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger.comment",
        position: { x: 300, y: 30 },
        data: {
          platform: "all",
          matchType: "keywords",
          postScope: { mode: "all", postExternalIds: [] },
          includeReplies: false,
          excludeKeywords: [],
        },
      },
      {
        id: "condition-1",
        type: "condition.text",
        position: { x: 300, y: 190 },
        data: {
          op: "OR",
          rules: [
            { kind: "text_contains", value: "سعر", caseSensitive: false },
            { kind: "text_contains", value: "بكام", caseSensitive: false },
            { kind: "text_contains", value: "تكلفة", caseSensitive: false },
            { kind: "text_contains", value: "price", caseSensitive: false },
          ],
        },
      },
      {
        id: "action-public-1",
        type: "action.public_reply",
        position: { x: 150, y: 360 },
        data: {
          message: "أهلاً بك {{commenter_name}}، بعتنالك كل التفاصيل والأسعار في رسالة خاصة 📩",
          messages: [
            "أهلاً بك {{commenter_name}}، تفاصيل الأسعار وصلتك في الخاص يا فندم 📩",
            "تم التواصل معك بالخاص بكل الأسعار والمقاسات المتاحة يا {{commenter_name}} 📬",
            "يا هلا بك! راجع صندوق الرسائل وصلك كشف الأسعار كامل الآن ✨",
          ],
          autoLike: true,
        },
      },
      {
        id: "action-private-1",
        type: "action.private_reply",
        position: { x: 150, y: 550 },
        data: {
          message: "أهلاً بك يا {{commenter_name}} في {{page_name}}!\n\nيسعدنا اهتمامك بمنتجاتنا. السعر الحالي يبدأ من 250 جنيهاً مع شحن سريع لجميع المحافظات 🚚.\n\nيمكنك تصفح العروض وإتمام طلبك مباشرة من الروابط أدناه:",
          buttons: [
            { id: "b1", label: "🛒 اطلب الآن من الموقع", type: "url", url: "https://example.com/shop" },
            { id: "b2", label: "💬 محادثة واتساب مباشر", type: "whatsapp", url: "https://wa.me/201000000000" },
          ],
        },
      },
      {
        id: "stop-1",
        type: "action.stop",
        position: { x: 150, y: 770 },
        data: { reason: "اكتمال الرد على استفسار السعر بنجاح" },
      },
      {
        id: "stop-2",
        type: "action.stop",
        position: { x: 500, y: 360 },
        data: { reason: "التعليق لا يحتوي على كلمات الأسعار" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "condition-1" },
      { id: "e2", source: "condition-1", target: "action-public-1", sourceHandle: "true" },
      { id: "e3", source: "condition-1", target: "stop-2", sourceHandle: "false" },
      { id: "e4", source: "action-public-1", target: "action-private-1" },
      { id: "e5", source: "action-private-1", target: "stop-1" },
    ],
  },
  {
    id: "promo-discount",
    title: "حملة كود الخصم والكوبونات",
    category: "تسويق وترويج",
    badge: "زيادة المبيعات 🔥",
    icon: "🎁",
    description: "اطلب من المتابعين التعليق بكلمة (خصم أو كوبون) ليحصلوا فوراً على كود التخفيض في الخاص مع رابط التفعيل.",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger.comment",
        position: { x: 300, y: 30 },
        data: {
          platform: "all",
          matchType: "keywords",
          postScope: { mode: "all", postExternalIds: [] },
          includeReplies: false,
        },
      },
      {
        id: "condition-1",
        type: "condition.text",
        position: { x: 300, y: 190 },
        data: {
          op: "OR",
          rules: [
            { kind: "text_contains", value: "خصم", caseSensitive: false },
            { kind: "text_contains", value: "كوبون", caseSensitive: false },
            { kind: "text_contains", value: "عرض", caseSensitive: false },
            { kind: "text_contains", value: "discount", caseSensitive: false },
          ],
        },
      },
      {
        id: "action-public-1",
        type: "action.public_reply",
        position: { x: 150, y: 360 },
        data: {
          message: "أهلاً بك {{commenter_name}}، كود الخصم الحصري وصلك في الخاص الآن 🎉",
          messages: [
            "كود الخصم في انتظارك في الرسائل الخاصة يا {{commenter_name}} 🎁",
            "تم إرسال كود التخفيض في الخاص، استمتع بالتسوق! ✨",
          ],
          autoLike: true,
        },
      },
      {
        id: "action-private-1",
        type: "action.private_reply",
        position: { x: 150, y: 550 },
        data: {
          message: "أهلاً بك يا {{commenter_name}}! 🎁\n\nإليك كود الخصم الحصري لمتابعينا: PROMO20\nيعطيك خصم 20% على إجمالي فاتورتك اليوم فقط.\nاضغط على الزر أدناه لتفعيل الخصم وبدء التسوق:",
          buttons: [
            { id: "b1", label: "🛍️ تفعيل الخصم والشراء", type: "url", url: "https://example.com/checkout?coupon=PROMO20" },
          ],
        },
      },
      {
        id: "stop-1",
        type: "action.stop",
        position: { x: 150, y: 760 },
        data: { reason: "اكتمال إرسال كود الخصم" },
      },
      {
        id: "stop-2",
        type: "action.stop",
        position: { x: 500, y: 360 },
        data: { reason: "لم يطلب خصماً" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "condition-1" },
      { id: "e2", source: "condition-1", target: "action-public-1", sourceHandle: "true" },
      { id: "e3", source: "condition-1", target: "stop-2", sourceHandle: "false" },
      { id: "e4", source: "action-public-1", target: "action-private-1" },
      { id: "e5", source: "action-private-1", target: "stop-1" },
    ],
  },
  {
    id: "auto-reply-all",
    title: "الرد الشامل الذكي على جميع التعليقات",
    category: "تفاعل عام وخدمة عملاء",
    badge: "أتمتة شاملة ⚡",
    icon: "🚀",
    description: "الرد على أي تعليق يرد على أي منشور دون شروط كلمات، مع تنويع عشوائي بين الردود لحماية الحساب من قيود ميتا.",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger.comment",
        position: { x: 300, y: 30 },
        data: {
          platform: "all",
          matchType: "all_comments",
          postScope: { mode: "all", postExternalIds: [] },
          includeReplies: false,
        },
      },
      {
        id: "action-public-1",
        type: "action.public_reply",
        position: { x: 300, y: 200 },
        data: {
          message: "أهلاً بك {{commenter_name}}، شرفتنا بتعليقك وسعداء بخدمتك دائماً ✨",
          messages: [
            "أهلاً بك {{commenter_name}}، شرفتنا بتعليقك وسعداء بخدمتك دائماً ✨",
            "يا هلا بك يا {{commenter_name}}، تواصلنا معك في الخاص للمساعدة 📩",
            "منورنا يا فندم! أرسلنا لك كل التفاصيل في رسالة خاصة 📬",
            "سعداء بتواجدك معنا يا {{commenter_name}}، راجع صندوق الرسائل ✨",
          ],
          autoLike: true,
        },
      },
      {
        id: "action-private-1",
        type: "action.private_reply",
        position: { x: 300, y: 400 },
        data: {
          message: "أهلاً بك يا {{commenter_name}} في {{page_name}}!\n\nسعداء بتعليقك الكريم. يسعدنا جداً الإجابة على أي استفسار أو تقديم المساعدة في أي وقت.",
          buttons: [
            { id: "b1", label: "💬 محادثة واتساب سريعة", type: "whatsapp", url: "https://wa.me/201000000000" },
            { id: "b2", label: "🌐 زيارة موقعنا الرسمي", type: "url", url: "https://example.com" },
          ],
        },
      },
      {
        id: "stop-1",
        type: "action.stop",
        position: { x: 300, y: 610 },
        data: { reason: "اكتمال الرد الشامل على التعليق" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "action-public-1" },
      { id: "e2", source: "action-public-1", target: "action-private-1" },
      { id: "e3", source: "action-private-1", target: "stop-1" },
    ],
  },
  {
    id: "whatsapp-direct",
    title: "تحويل المتابعين إلى محادثة واتساب",
    category: "خدمة عملاء ومبيعات",
    badge: "أعلى تحويل 📲",
    icon: "💬",
    description: "توجيه العملاء المهتمين من تعليقات فيسبوك وإنستغرام مباشرة إلى محادثة واتساب مع فريق المبيعات بنقرة واحدة.",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger.comment",
        position: { x: 300, y: 30 },
        data: {
          platform: "all",
          matchType: "keywords",
          postScope: { mode: "all", postExternalIds: [] },
          includeReplies: false,
        },
      },
      {
        id: "condition-1",
        type: "condition.text",
        position: { x: 300, y: 190 },
        data: {
          op: "OR",
          rules: [
            { kind: "text_contains", value: "واتساب", caseSensitive: false },
            { kind: "text_contains", value: "تواصل", caseSensitive: false },
            { kind: "text_contains", value: "رقم", caseSensitive: false },
            { kind: "text_contains", value: "ارقام", caseSensitive: false },
            { kind: "text_contains", value: "whatsapp", caseSensitive: false },
          ],
        },
      },
      {
        id: "action-public-1",
        type: "action.public_reply",
        position: { x: 150, y: 360 },
        data: {
          message: "أهلاً {{commenter_name}}، رابط محادثة واتساب المباشرة وصلك في الخاص 📲",
          autoLike: true,
        },
      },
      {
        id: "action-private-1",
        type: "action.private_reply",
        position: { x: 150, y: 530 },
        data: {
          message: "أهلاً بك يا {{commenter_name}}!\n\nفريق خدمة العملاء جاهز للرد على استفساراتك الآن عبر واتساب.\nاضغط على الزر أدناه لبدء المحادثة فوراً:",
          buttons: [
            { id: "b1", label: "💬 فتح محادثة واتساب الآن", type: "whatsapp", url: "https://wa.me/201000000000?text=مرحبا_أريد_الاستفسار" },
          ],
        },
      },
      {
        id: "stop-1",
        type: "action.stop",
        position: { x: 150, y: 730 },
        data: { reason: "اكتمال التحويل لواتساب" },
      },
      {
        id: "stop-2",
        type: "action.stop",
        position: { x: 500, y: 360 },
        data: { reason: "لم يطلب التواصل" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "condition-1" },
      { id: "e2", source: "condition-1", target: "action-public-1", sourceHandle: "true" },
      { id: "e3", source: "condition-1", target: "stop-2", sourceHandle: "false" },
      { id: "e4", source: "action-public-1", target: "action-private-1" },
      { id: "e5", source: "action-private-1", target: "stop-1" },
    ],
  },
  {
    id: "product-catalog",
    title: "إرسال كتالوج المنتجات وقائمة الأسعار",
    category: "كتالوج ومنتجات",
    badge: "مريح للمشتري 📖",
    icon: "📦",
    description: "إرسال رابط تصفح كتالوج المنتجات أو ملف الأسعار فور كتابة المتابع كلمة (كتالوج، قائمة، تفاصيل).",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger.comment",
        position: { x: 300, y: 30 },
        data: {
          platform: "all",
          matchType: "keywords",
          postScope: { mode: "all", postExternalIds: [] },
          includeReplies: false,
        },
      },
      {
        id: "condition-1",
        type: "condition.text",
        position: { x: 300, y: 190 },
        data: {
          op: "OR",
          rules: [
            { kind: "text_contains", value: "كتالوج", caseSensitive: false },
            { kind: "text_contains", value: "قائمة", caseSensitive: false },
            { kind: "text_contains", value: "المنيو", caseSensitive: false },
            { kind: "text_contains", value: "catalog", caseSensitive: false },
          ],
        },
      },
      {
        id: "action-public-1",
        type: "action.public_reply",
        position: { x: 150, y: 360 },
        data: {
          message: "أهلاً بك {{commenter_name}}، رابط الكتالوج وصلك في الخاص لتصفح جميع المنتجات والأسعار 📖",
          autoLike: true,
        },
      },
      {
        id: "action-private-1",
        type: "action.private_reply",
        position: { x: 150, y: 530 },
        data: {
          message: "أهلاً بك يا {{commenter_name}} في {{page_name}}! 📖\n\nتفضل رابط تصفح كتالوج منتجاتنا الجديد وقائمة الأسعار لعام 2026.\nيمكنك فتح الكتالوج أو زيارة المتجر مباشرة:",
          buttons: [
            { id: "b1", label: "📖 تصفح الكتالوج أونلاين", type: "url", url: "https://example.com/catalog.pdf" },
            { id: "b2", label: "🛒 التسوق من المتجر", type: "url", url: "https://example.com/shop" },
          ],
        },
      },
      {
        id: "stop-1",
        type: "action.stop",
        position: { x: 150, y: 730 },
        data: { reason: "اكتمال إرسال الكتالوج" },
      },
      {
        id: "stop-2",
        type: "action.stop",
        position: { x: 500, y: 360 },
        data: { reason: "لا يطلب الكتالوج" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "condition-1" },
      { id: "e2", source: "condition-1", target: "action-public-1", sourceHandle: "true" },
      { id: "e3", source: "condition-1", target: "stop-2", sourceHandle: "false" },
      { id: "e4", source: "action-public-1", target: "action-private-1" },
      { id: "e5", source: "action-private-1", target: "stop-1" },
    ],
  },
];
