export const ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
  CSRF_INVALID: 'CSRF_INVALID',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PASSWORD_TOO_WEAK: 'PASSWORD_TOO_WEAK',
  RECOVERY_CODE_INVALID: 'RECOVERY_CODE_INVALID',
  RECOVERY_CODE_USED: 'RECOVERY_CODE_USED',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  META_NOT_CONFIGURED: 'META_NOT_CONFIGURED',
  ENCRYPTION_KEY_MISSING: 'ENCRYPTION_KEY_MISSING',
  OAUTH_STATE_INVALID: 'OAUTH_STATE_INVALID',
  WEBHOOK_SIGNATURE_INVALID: 'WEBHOOK_SIGNATURE_INVALID',
  WEBHOOK_VERIFY_FAILED: 'WEBHOOK_VERIFY_FAILED',
  WEBHOOK_RATE_LIMITED: 'WEBHOOK_RATE_LIMITED',
  GRAPH_API_ERROR: 'GRAPH_API_ERROR',
  ASSET_NOT_FOUND: 'ASSET_NOT_FOUND',
  SYNC_FAILED: 'SYNC_FAILED',
  CONFLICT: 'CONFLICT',
  RUN_NOT_FOUND: 'RUN_NOT_FOUND',
  RUN_NOT_RETRYABLE: 'RUN_NOT_RETRYABLE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const AR: Record<ErrorCode, string> = {
  INVALID_CREDENTIALS: 'بيانات الدخول غير صحيحة.',
  ACCOUNT_LOCKED: 'تم قفل الحساب مؤقتاً بعد محاولات دخول فاشلة متكررة.',
  RATE_LIMITED: 'عدد كبير من المحاولات. انتظر قليلاً ثم أعد المحاولة.',
  CSRF_INVALID: 'طلب غير صالح (تحقّق أمني فشل). أعد تحميل الصفحة وحاول مجدداً.',
  SESSION_EXPIRED: 'انتهت الجلسة. سجّل الدخول مرة أخرى.',
  UNAUTHORIZED: 'هذه الصفحة تتطلب تسجيل الدخول.',
  VALIDATION_ERROR: 'بيانات الإدخال غير صحيحة.',
  PASSWORD_TOO_WEAK: 'كلمة المرور ضعيفة. استخدم 12 حرفاً على الأقل وغيرتكرارية.',
  RECOVERY_CODE_INVALID: 'رمز الاسترجاع غير صحيح.',
  RECOVERY_CODE_USED: 'تم استخدام رمز الاسترجاع مسبقاً. استخدم الرمز الجديد.',
  NOT_FOUND: 'المورد غير موجود.',
  INTERNAL_ERROR: 'حدث خطأ غير متوقع في الخادم.',
  META_NOT_CONFIGURED: 'إعداد تطبيق ميتا غير مكتمل. أدخل المعرّف والسر في صفحة الاتصالات.',
  ENCRYPTION_KEY_MISSING: 'مفتاح تشفير الرموز غير مضبوط في البيئة (APP_ENCRYPTION_KEY).',
  OAUTH_STATE_INVALID: 'حالة ربط ميتا غير صالحة أو منتهية. أعد المحاولة من صفحة الاتصالات.',
  WEBHOOK_SIGNATURE_INVALID: 'توقيع الويب هوك غير صالح.',
  WEBHOOK_VERIFY_FAILED: 'رمز التحقق غير صحيح.',
  WEBHOOK_RATE_LIMITED: 'كثافة رسائل الويب هوك أعلى من الحد المسموح. أُعيد المحاولة لاحقاً.',
  GRAPH_API_ERROR: 'تعذّر الاتصال بواجهة Meta. حاول مرة أخرى لاحقاً.',
  ASSET_NOT_FOUND: 'الأصل المطلوب غير موجود.',
  SYNC_FAILED: 'فشلت عملية المزامنة من خوادم ميتا.',
  CONFLICT: 'تعارض في حفظ التعديل: تم تعديل السجل من جلسة أخرى، يرجى إعادة تحميل الصفحة.',
  RUN_NOT_FOUND: 'عملية التنفيذ غير موجودة.',
  RUN_NOT_RETRYABLE: 'لا يمكن إعادة محاولة هذه العملية.',
};

export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode | string;
  message: string;
  details?: unknown;
}

export function arabicErrorMessage(code: ErrorCode | string): string {
  return AR[code as ErrorCode] ?? AR.INTERNAL_ERROR;
}

export function apiError(statusCode: number, code: ErrorCode | string, details?: unknown): ApiErrorBody {
  return details === undefined
    ? { statusCode, code, message: arabicErrorMessage(code) }
    : { statusCode, code, message: arabicErrorMessage(code), details };
}
