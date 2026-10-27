export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

const COMMON_PASSWORDS = new Set([
  '123456', '123456789', '12345678', '1234567890', 'password', 'password1',
  'password123', 'qwerty123', 'qwertyuiop', 'iloveyou', 'admin123', 'administrator',
  'welcome1', 'welcome123', 'letmein123', 'monkey123', 'dragon123', 'football123',
  'baseball123', 'superman123', 'trustno1', 'starwars', 'whatever1', 'zaq12wsx',
  'passw0rd', 'p@ssw0rd', 'p@ssword', 'abc123456', 'abcd1234', 'qazwsxedc',
  'qwer1234', '1q2w3e4r', '1qaz2wsx', 'zxcvbnm123', 'asdfghjkl', '11111111',
  '00000000', 'aaaaaaaa', 'asdf1234', 'test1234', 'temp1234', 'root1234',
  'anychat123', 'facebook123', 'instagram123', 'meta1234', 'owner1234',
  'changeme123', 'default123', 'secret1234', 'letmein1', 'trustno1234',
  'iloveyou123', 'sunshine123', 'princess123', 'football1', 'michael123',
  'shadow1234', 'master1234', 'jennifer123', 'jordan1234', 'hunter1234',
  'harley1234', 'ranger1234', 'buster1234', 'thomas1234', 'robert1234',
  'daniel1234', 'charlie1234', 'summer1234', 'winter1234', 'spring1234',
  'autumn1234', 'computer123', 'internet123', 'samsung123', 'google1234',
  'facebook1234', 'whatsapp123', 'snapchat123', 'twitter1234', 'linkedin123',
  '0123456789', '987654321', '147258369', '159753456', 'q1w2e3r4',
  'a1b2c3d4', 'abcd123456', 'password1234', 'password@123', 'welcome@123',
  'admin@1234', 'root@1234', 'user@1234', 'guest1234', 'demo1234',
  'example123', 'sample1234', 'testing1234', 'dev123456', 'local12345',
]);

export interface PasswordCheck {
  ok: boolean;
  reason?: string;
}

export function validatePassword(password: string, username?: string): PasswordCheck {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, reason: `PASSWORD_SHORTER_THAN_${PASSWORD_MIN_LENGTH}` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, reason: 'PASSWORD_TOO_LONG' };
  }
  const lowered = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowered)) {
    return { ok: false, reason: 'PASSWORD_COMMON' };
  }
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, reason: 'PASSWORD_REPEATED' };
  }
  if (username && lowered.includes(username.toLowerCase())) {
    return { ok: false, reason: 'PASSWORD_CONTAINS_USERNAME' };
  }
  return { ok: true };
}
