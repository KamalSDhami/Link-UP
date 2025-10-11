import { Database } from './database'

export type User = Database['public']['Tables']['users']['Row']
export type Team = Database['public']['Tables']['teams']['Row']
export type TeamMember = Database['public']['Tables']['team_members']['Row']
export type RecruitmentPost = Database['public']['Tables']['recruitment_posts']['Row']
export type Application = Database['public']['Tables']['applications']['Row']
export type Chatroom = Database['public']['Tables']['chatrooms']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']

// Extended types with relations
export type TeamWithMembers = Team & {
  leader: User
  members: (TeamMember & { user: User })[]
}

export type RecruitmentPostWithDetails = RecruitmentPost & {
  team: Team
  posted_by_user: User
}

export type ApplicationWithDetails = Application & {
  applicant: User
  recruitment_post: RecruitmentPost & { team: Team }
}

export type ChatroomWithMembers = Chatroom & {
  members: (Database['public']['Tables']['chatroom_members']['Row'] & { user: User })[]
  last_message?: Message
}
