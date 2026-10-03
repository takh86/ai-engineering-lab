import { object, fail, validatePassword, SECURITY_LIMITS } from './security.js';

// One costly PBKDF2 block feeds domain-separated HKDF wrapping and verifier keys.
// Only the explicitly versioned, current credential format is accepted.
// The random vault key is wrapped separately for the password and the one-time recovery code.
// Neither wrapping key nor the clear vault key is persisted. Recovery therefore retains the records.
export const PBKDF2_ITERATIONS = 600000;
const CREDENTIAL_VERSION = 2;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const cryptoApi = () => {
    if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) fail('security_unavailable');
    return globalThis.crypto;
};
export const encode = bytes => {
    let value = '';
    for (const byte of bytes) value += String.fromCharCode(byte);
    return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};
export function decode(value, length = null, max = SECURITY_LIMITS.bytes + 64) {
    if (typeof value !== 'string' || value.length > Math.ceil(max * 4 / 3) || !/^[A-Za-z0-9_-]+$/u.test(value)) fail('security_corrupt');
    let bytes;
    try { bytes = Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0)); }
    catch { fail('security_corrupt'); }
    if (encode(bytes) !== value || bytes.length > max || (length !== null && bytes.length !== length)) fail('security_corrupt');
    return bytes;
}
const random = length => cryptoApi().getRandomValues(new Uint8Array(length));
const importAes = bytes => cryptoApi().subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
async function derive(secret, salt) {
    const material = await cryptoApi().subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await cryptoApi().subtle.deriveBits({
        name: 'PBKDF2', hash: 'SHA-256', salt,
        iterations: PBKDF2_ITERATIONS
    }, material, 256));
    try {
        const seed = await cryptoApi().subtle.importKey('raw', bits, 'HKDF', false, ['deriveBits']);
        const expand = info => cryptoApi().subtle.deriveBits({
            name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode(info)
        }, seed, 256);
        const [wrapping, verifier] = await Promise.all([
            expand('tabsira-credential-v2-wrapping'), expand('tabsira-credential-v2-verifier')
        ]);
        return { key: await importAes(wrapping), verifier: encode(new Uint8Array(verifier)) };
    } finally { bits.fill(0); }
}
const wrappingLabel = (version, recovery) => `tabsira-${recovery ? 'recovery' : 'password'}-key-v${version}`;

function equal(left, right) {
    let difference = left.length ^ right.length;
    for (let index = 0; index < Math.max(left.length, right.length); index++) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
    return difference === 0;
}
async function encryptBytes(key, bytes, label) {
    const iv = random(12);
    const ciphertext = new Uint8Array(await cryptoApi().subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(label), tagLength: 128 }, key, bytes));
    return { iv: encode(iv), ciphertext: encode(ciphertext) };
}
async function decryptBytes(key, record, label) {
    try {
        return new Uint8Array(await cryptoApi().subtle.decrypt({ name: 'AES-GCM', iv: decode(record.iv, 12), additionalData: encoder.encode(label), tagLength: 128 }, key, decode(record.ciphertext)));
    } catch { fail('security_corrupt'); }
}
export function validateEncrypted(record, bytes = null) {
    object(record, ['iv', 'ciphertext'], ['iv', 'ciphertext']);
    decode(record.iv, 12);
    const cipher = decode(record.ciphertext, bytes === null ? null : bytes + 16);
    if (cipher.length < 16) fail('security_corrupt');
    return record;
}
function validateCredential(value) {
    object(value, ['salt', 'verifier', 'wrappedKey'], ['salt', 'verifier', 'wrappedKey']);
    decode(value.salt, 16); decode(value.verifier, 32); validateEncrypted(value.wrappedKey, 32);
}
export function validateCredentials(value) {
    object(value, ['version', 'iterations', 'password', 'recovery'], ['iterations', 'password', 'recovery']);
    if (value.version !== CREDENTIAL_VERSION || value.iterations !== PBKDF2_ITERATIONS) fail('security_corrupt');
    validateCredential(value.password); validateCredential(value.recovery);
    return value;
}
export const credentialIdentity = security => security ? `${security.version}:${security.iterations}:${security.password.salt}:${security.password.verifier}` : '';
export async function checkPassword(security, password) {
    validateCredentials(security);
    validatePassword(password);
    const result = await derive(password, decode(security.password.salt, 16));
    return equal(result.verifier, security.password.verifier);
}
export async function unlockKey(security, secret, recovery = false) {
    validateCredentials(security);
    if (!recovery) validatePassword(secret);
    else if (typeof secret !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(secret)) fail('invalid_recovery');
    const credential = recovery ? security.recovery : security.password;
    const result = await derive(secret, decode(credential.salt, 16));
    if (!equal(result.verifier, credential.verifier)) fail(recovery ? 'invalid_recovery' : 'invalid_password');
    const bytes = await decryptBytes(result.key, credential.wrappedKey, wrappingLabel(CREDENTIAL_VERSION, recovery));
    if (bytes.length !== 32) fail('security_corrupt');
    return { bytes, key: await importAes(bytes) };
}
export async function createCredentials(password, vaultBytes = random(32)) {
    validatePassword(password);
    const recoveryCode = encode(random(32));
    async function credential(secret, label) {
        const salt = random(16);
        const result = await derive(secret, salt);
        return { salt: encode(salt), verifier: result.verifier, wrappedKey: await encryptBytes(result.key, vaultBytes, label) };
    }
    const [passwordCredential, recovery] = await Promise.all([
        credential(password, wrappingLabel(CREDENTIAL_VERSION, false)), credential(recoveryCode, wrappingLabel(CREDENTIAL_VERSION, true))
    ]);
    return { security: { version: CREDENTIAL_VERSION, iterations: PBKDF2_ITERATIONS, password: passwordCredential, recovery }, recoveryCode, bytes: vaultBytes, key: await importAes(vaultBytes) };
}
export const encryptVault = (key, data) => encryptBytes(key, encoder.encode(JSON.stringify(data)), 'tabsira-private-vault-v1');
export async function decryptVault(key, vault) {
    try { return JSON.parse(decoder.decode(await decryptBytes(key, vault, 'tabsira-private-vault-v1'))); }
    catch { fail('security_corrupt'); }
}
