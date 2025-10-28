import { supabase } from '@/lib/supabase'

interface NotificationPayload {
  userId: string
  type: 'application' | 'team_invite' | 'message' | 'system' | 'event'
  title: string
  message: string
  link?: string | null
}

export async function sendNotification({ userId, type, title, message, link = null }: NotificationPayload) {
  if (!userId) return

  try {
    // @ts-expect-error - Supabase types need regeneration for create_notification RPC
    const { error } = await supabase.rpc('create_notification', {
      target_user: userId,
      notif_type: type,
      notif_title: title,
      notif_message: message,
      notif_link: link,
    })

    if (error) {
      console.error('Failed to send notification', error)
    }
  } catch (error) {
    console.error('Failed to send notification', error)
  }
}
