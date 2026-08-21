import { supabase } from '../supabase';
import type { Call, CallType } from '../../../../src/shared/types';

// Starts a call row and records the initiator as the first participant. The
// actual media/WebRTC signalling happens peer-to-peer; this row only marks the
// call as discoverable to other conversation members (and for late-join).
export async function startCall(
  conversationId: string,
  type: CallType
): Promise<Call> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: call, error } = await supabase
    .from('calls')
    .insert({ conversation_id: conversationId, initiator_id: user.id, type })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const { error: partErr } = await supabase
    .from('call_participants')
    .upsert({ call_id: (call as Call).id, user_id: user.id }, {
      onConflict: 'call_id,user_id'
    });
  if (partErr) throw new Error(partErr.message);

  return call as Call;
}

// Records the current user as having joined an in-progress call.
export async function joinCall(callId: string): Promise<void> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('call_participants')
    .upsert({ call_id: callId, user_id: user.id, left_at: null }, {
      onConflict: 'call_id,user_id'
    });
  if (error) throw new Error(error.message);
}

// Marks the current user as having left the call (does not end it for others).
export async function leaveCall(callId: string): Promise<void> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('call_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('call_id', callId)
    .eq('user_id', user.id);
  if (error) throw new Error(error.message);
}

// Ends the call for everyone (initiator only, enforced by RLS).
export async function endCall(callId: string): Promise<void> {
  const { error } = await supabase
    .from('calls')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', callId);
  if (error) throw new Error(error.message);
}

// Returns the currently active call in a conversation, if any. Used to surface
// a "Join" affordance when opening a conversation that already has a live call.
export async function getActiveCall(conversationId: string): Promise<Call | null> {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as Call) ?? null;
}
