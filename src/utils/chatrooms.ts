import { supabase } from '@/lib/supabase'
import type { TableInsert, TableRow } from '@/types/database'

export const generateUuid = () => {
  const globalCrypto =
    typeof crypto !== 'undefined' ? (crypto as Crypto & { randomUUID?: () => string }) : undefined

  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8
    return value.toString(16)
  })
}

export const ensureTeamChatroom = async (options: {
  teamId: string
  teamName: string | null
  leaderId: string
  memberIds: string[]
}) => {
  const { teamId, teamName, leaderId } = options
  const memberIds = Array.from(new Set(options.memberIds))

  const { data: chatroomRecord, error: fetchError } = await supabase
    .from('chatrooms')
    .select('id')
    .eq('team_id', teamId)
    .maybeSingle<TableRow<'chatrooms'>>()

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError
  }

  const chatroomId = chatroomRecord?.id ?? generateUuid()

  if (!chatroomRecord) {
    const chatroomInsert: TableInsert<'chatrooms'> = {
      id: chatroomId,
      type: 'team',
      team_id: teamId,
      name: teamName,
      recruitment_post_id: null,
    }

    const { error: createError } = await supabase
      .from('chatrooms')
      .insert([chatroomInsert] as never, { returning: 'minimal' } as any)

    if (createError) throw createError

    const leaderMembership: TableInsert<'chatroom_members'> = {
      chatroom_id: chatroomId,
      user_id: leaderId,
    }

    const { error: leaderMembershipError } = await supabase
      .from('chatroom_members')
      .insert([leaderMembership] as never, { returning: 'minimal' } as any)

    if (leaderMembershipError && leaderMembershipError.code !== '23505') {
      throw leaderMembershipError
    }

    const leaderRole: TableInsert<'chatroom_roles'> = {
      chatroom_id: chatroomId,
      user_id: leaderId,
      role: 'owner',
      can_post: true,
      can_manage_members: true,
      can_manage_messages: true,
    }

    const { error: leaderRoleError } = await supabase
      .from('chatroom_roles')
      .upsert(leaderRole as never)

    if (leaderRoleError) throw leaderRoleError
  }

  if (!memberIds.length) {
    return chatroomId
  }

  const { data: existingMemberRows, error: memberQueryError } = await supabase
    .from('chatroom_members')
    .select('user_id')
    .eq('chatroom_id', chatroomId)

  if (memberQueryError) throw memberQueryError

  const existingMembers = (existingMemberRows || []) as Pick<TableRow<'chatroom_members'>, 'user_id'>[]
  const presentMembers = new Set(existingMembers.map((row) => row.user_id))
  const missingMembers = memberIds.filter((memberId) => !presentMembers.has(memberId))

  if (missingMembers.length) {
    const memberPayload: TableInsert<'chatroom_members'>[] = missingMembers.map((memberId) => ({
      chatroom_id: chatroomId,
      user_id: memberId,
    }))

    const { error: insertMembersError } = await supabase
      .from('chatroom_members')
      .insert(memberPayload as never)

    if (insertMembersError && insertMembersError.code !== '23505') {
      throw insertMembersError
    }

    const rolePayload: TableInsert<'chatroom_roles'>[] = missingMembers.map((memberId) => ({
      chatroom_id: chatroomId,
      user_id: memberId,
      role: memberId === leaderId ? 'owner' : 'member',
      can_post: true,
      can_manage_members: memberId === leaderId,
      can_manage_messages: memberId === leaderId,
    }))

    const { error: roleError } = await supabase
      .from('chatroom_roles')
      .upsert(rolePayload as never, { onConflict: 'chatroom_id,user_id' })

    if (roleError) throw roleError
  }

  return chatroomId
}

export const removeMemberFromTeamChat = async (teamId: string, memberId: string) => {
  const { data: chatroomRecord, error: fetchError } = await supabase
    .from('chatrooms')
    .select('id')
    .eq('team_id', teamId)
    .maybeSingle<TableRow<'chatrooms'>>()

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError
  }

  const chatroomId = chatroomRecord?.id
  if (!chatroomId) {
    return
  }

  const { error: membershipError } = await supabase
    .from('chatroom_members')
    .delete()
    .eq('chatroom_id', chatroomId)
    .eq('user_id', memberId)

  if (membershipError && membershipError.code !== 'PGRST116') {
    throw membershipError
  }

  const { error: roleError } = await supabase
    .from('chatroom_roles')
    .delete()
    .eq('chatroom_id', chatroomId)
    .eq('user_id', memberId)

  if (roleError && roleError.code !== 'PGRST116') {
    throw roleError
  }
}
