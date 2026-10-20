import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';

// Public signup is turned off in Supabase, so Settings → Users must create
// accounts through the invite-user edge function, never auth.signUp() or a
// browser-side profiles insert.
globalThis.window = globalThis.window || globalThis;
globalThis.Logger = window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
window.state = { users: [] };
window.saveData = () => { };
window.closeModal = () => { };
window.UTILS = { escapeHtml: s => String(s ?? '') };
loadScript('./settings-users.js', { params: { module: undefined } });

function httpError(status, body) {
    // Shape of supabase-js FunctionsHttpError: generic message, Response on context
    return {
        message: 'Edge Function returned a non-2xx status code',
        context: new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    };
}

describe('creating users through the invite-user edge function', () => {
    let client, notes;

    beforeEach(() => {
        notes = [];
        window.showNotification = (msg, type) => notes.push({ msg, type });
        window.state.users = [];
        client = {
            functions: { invoke: vi.fn() },
            auth: { signUp: vi.fn() },
            from: vi.fn(() => ({ upsert: vi.fn(async () => ({ error: null })) }))
        };
        window.SupabaseClient = { isInitialized: true, client, signUp: vi.fn() };
        document.body.innerHTML = `
            <input id="user-name" value="Jane Auditor">
            <input id="user-email" value="Jane@Example.com">
            <input id="user-role" value="Auditor">
            <input id="user-password" value="Temp-Pass-1!">
            <input id="invite-email" value="new@example.com">
            <input id="invite-role" value="Lead Auditor">
            <div id="users-list-container"></div>`;
    });

    it('sends email, full_name and role to invite-user', async () => {
        client.functions.invoke.mockResolvedValue({ data: { success: true, user: { id: 'u-1' } }, error: null });
        const user = await window.callInviteUserFunction('a@b.com', 'A B', 'Auditor');
        expect(user.id).toBe('u-1');
        expect(client.functions.invoke).toHaveBeenCalledWith('invite-user', {
            body: { email: 'a@b.com', full_name: 'A B', role: 'Auditor' }
        });
    });

    it('surfaces the function error message, flagging a 403 as not-admin', async () => {
        client.functions.invoke.mockResolvedValue({
            data: null, error: httpError(403, { error: 'Only an administrator can invite users' })
        });
        await expect(window.callInviteUserFunction('a@b.com', 'A B', 'Auditor'))
            .rejects.toThrow(/Only an administrator can invite users.*Admin role/);
    });

    it('Add User: stores the invited user locally under the auth id', async () => {
        client.functions.invoke.mockResolvedValue({ data: { success: true, user: { id: 'auth-42' } }, error: null });
        await window.saveUser(null);

        expect(client.functions.invoke).toHaveBeenCalledWith('invite-user', {
            body: { email: 'jane@example.com', full_name: 'Jane Auditor', role: 'Auditor' }
        });
        expect(window.state.users).toHaveLength(1);
        expect(window.state.users[0]).toMatchObject({ id: 'auth-42', supabaseId: 'auth-42', isLocal: false, role: 'Auditor' });
        expect(client.auth.signUp).not.toHaveBeenCalled();
        expect(window.SupabaseClient.signUp).not.toHaveBeenCalled();
        expect(client.from).not.toHaveBeenCalledWith('profiles');
        expect(notes.at(-1).type).toBe('success');
    });

    it('Add User: a failed invite adds nothing and shows the function message', async () => {
        client.functions.invoke.mockResolvedValue({
            data: null, error: httpError(400, { error: 'Could not create the invitation' })
        });
        await window.saveUser(null);

        expect(window.state.users).toHaveLength(0);
        expect(notes.at(-1)).toEqual({ msg: 'Failed to create user: Could not create the invitation', type: 'error' });
    });

    it('Invite User: stores a Pending user after the function succeeds', async () => {
        client.functions.invoke.mockResolvedValue({ data: { success: true, user: { id: 'auth-7' } }, error: null });
        await window.inviteUser();

        expect(client.functions.invoke).toHaveBeenCalledWith('invite-user', {
            body: { email: 'new@example.com', full_name: 'new', role: 'Lead Auditor' }
        });
        expect(window.state.users).toEqual([expect.objectContaining({ id: 'auth-7', status: 'Pending', role: 'Lead Auditor' })]);
        expect(client.auth.signUp).not.toHaveBeenCalled();
        expect(client.from).not.toHaveBeenCalled();
    });

    it('Invite User: a 403 adds nothing and says the caller is not an admin', async () => {
        client.functions.invoke.mockResolvedValue({
            data: null, error: httpError(403, { error: 'Only an administrator can invite users' })
        });
        await window.inviteUser();

        expect(window.state.users).toHaveLength(0);
        expect(notes.at(-1).type).toBe('error');
        expect(notes.at(-1).msg).toMatch(/Only an administrator can invite users/);
    });
});
