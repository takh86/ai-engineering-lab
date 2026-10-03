import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCredentials, validateCredentials, checkPassword, unlockKey, encode, decode } from '../../src/core/security-crypto.js';

const corrupt = error => error.code === 'security_corrupt';

test('new credentials use a single 600000-iteration PBKDF2 block with domain-separated HKDF outputs', async () => {
    const password = 'new-credential-password';
    const derivations = [];
    const originalDeriveBits = crypto.subtle.deriveBits;
    crypto.subtle.deriveBits = function (algorithm, material, length) {
        derivations.push({ name: algorithm.name, iterations: algorithm.iterations, length });
        return originalDeriveBits.call(this, algorithm, material, length);
    };
    let result;
    try { result = await createCredentials(password); }
    finally { crypto.subtle.deriveBits = originalDeriveBits; }
    assert.deepEqual(derivations.filter(item => item.name === 'PBKDF2'), [
        { name: 'PBKDF2', iterations: 600000, length: 256 },
        { name: 'PBKDF2', iterations: 600000, length: 256 }
    ]);
    assert.equal(result.security.version, 2);
    assert.equal(result.security.iterations, 600000);
    // Independently reconstruct the format, rather than relying on the production unlock helper.
    const salt = decode(result.security.password.salt);
    const input = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const seed = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 }, input, 256);
    const hkdf = await crypto.subtle.importKey('raw', seed, 'HKDF', false, ['deriveBits']);
    const expand = info => crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode(info) }, hkdf, 256);
    const verifier = new Uint8Array(await expand('tabsira-credential-v2-verifier'));
    const wrapping = new Uint8Array(await expand('tabsira-credential-v2-wrapping'));
    assert.equal(result.security.password.verifier, encode(verifier));
    assert.notEqual(encode(wrapping), encode(verifier));
    const key = await crypto.subtle.importKey('raw', wrapping, 'AES-GCM', false, ['decrypt']);
    const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(result.security.password.wrappedKey.iv), additionalData: new TextEncoder().encode('tabsira-password-key-v2'), tagLength: 128 }, key, decode(result.security.password.wrappedKey.ciphertext));
    assert.deepEqual(new Uint8Array(clear), result.bytes);
    assert.equal(await checkPassword(result.security, password), true);
    assert.equal(await checkPassword(result.security, 'incorrect-password'), false);
    assert.deepEqual((await unlockKey(result.security, result.recoveryCode, true)).bytes, result.bytes);
});

test('unknown versions and mismatched iteration/version combinations are rejected before authentication', async () => {
    const modern = (await createCredentials('validation-password')).security;
    const versionless = structuredClone(modern);
    delete versionless.version;
    const variants = [
        versionless, { ...versionless, iterations: 310000 },
        { ...modern, version: 1 }, { ...modern, version: 3 }, { ...modern, version: null },
        { ...modern, iterations: 310000 }, { ...modern, version: undefined },
        { ...modern, iterations: Number.MAX_SAFE_INTEGER }
    ];
    for (const value of variants) {
        assert.throws(() => validateCredentials(value), corrupt);
        await assert.rejects(checkPassword(value, 'validation-password'), corrupt);
        await assert.rejects(unlockKey(value, 'validation-password'), corrupt);
    }
});

test('credential downgrade and authenticated wrapping-label substitution cannot unlock the vault', async () => {
    const password = 'adversarial-credential-password';
    const modern = await createCredentials(password);
    const disguised = structuredClone(modern.security);
    delete disguised.version;
    disguised.iterations = 310000;
    // Versionless envelopes are rejected before any authentication or KDF work.
    assert.throws(() => validateCredentials(disguised), corrupt);
    await assert.rejects(checkPassword(disguised, password), corrupt);
    await assert.rejects(unlockKey(disguised, password), corrupt);

    const swapped = structuredClone(modern.security);
    swapped.password.wrappedKey = swapped.recovery.wrappedKey;
    assert.equal(await checkPassword(swapped, password), true);
    await assert.rejects(unlockKey(swapped, password), corrupt);

    // Isolate AAD protection: encrypt the correct vault bytes using the correct password wrapping
    // key, but authenticate the recovery label. Failure must therefore come from the label binding.
    const salt = decode(modern.security.password.salt);
    const input = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const seed = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 }, input, 256);
    const hkdf = await crypto.subtle.importKey('raw', seed, 'HKDF', false, ['deriveBits']);
    const wrapping = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('tabsira-credential-v2-wrapping') }, hkdf, 256);
    const key = await crypto.subtle.importKey('raw', wrapping, 'AES-GCM', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('tabsira-recovery-key-v2'), tagLength: 128 }, key, modern.bytes);
    const relabeled = structuredClone(modern.security);
    relabeled.password.wrappedKey = { iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) };
    validateCredentials(relabeled);
    assert.equal(await checkPassword(relabeled, password), true);
    await assert.rejects(unlockKey(relabeled, password), corrupt);
});
