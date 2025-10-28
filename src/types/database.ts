export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          profile_picture_url: string | null
          section: string
          year: number
          skills: string[]
          github_url: string | null
          linkedin_url: string | null
          social_visibility: 'always' | 'on_application' | 'hidden'
          gehu_verified: boolean
          gehu_email: string | null
          gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | 'other' | null
          role: 'student' | 'moderator' | 'super_admin' | 'event_manager'
          is_banned: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          profile_picture_url?: string | null
          section: string
          year: number
          skills?: string[]
          github_url?: string | null
          linkedin_url?: string | null
          social_visibility?: 'always' | 'on_application' | 'hidden'
          gehu_verified?: boolean
          gehu_email?: string | null
          gender?: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | 'other' | null
          role?: 'student' | 'moderator' | 'super_admin' | 'event_manager'
          is_banned?: boolean
        }
        Update: {
          id?: string
          email?: string
          name?: string
          profile_picture_url?: string | null
          section?: string
          year?: number
          skills?: string[]
          github_url?: string | null
          linkedin_url?: string | null
          social_visibility?: 'always' | 'on_application' | 'hidden'
          gehu_verified?: boolean
          gehu_email?: string | null
          gender?: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | 'other' | null
          role?: 'student' | 'moderator' | 'super_admin' | 'event_manager'
          is_banned?: boolean
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          description: string | null
          year: number
          leader_id: string
      purpose: 'hackathon' | 'college_event' | 'pbl' | 'other'
      max_size: number
          is_full: boolean
          member_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          year: number
          leader_id: string
          purpose?: 'hackathon' | 'college_event' | 'pbl' | 'other'
          max_size?: number
          is_full?: boolean
          member_count?: number
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          year?: number
          leader_id?: string
          purpose?: 'hackathon' | 'college_event' | 'pbl' | 'other'
          max_size?: number
          is_full?: boolean
          member_count?: number
        }
      }
      team_members: {
        Row: {
          id: string
          team_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string
        }
      }
      team_join_requests: {
        Row: {
          id: string
          team_id: string
          requester_id: string
          status: 'pending' | 'approved' | 'rejected'
          message: string | null
          created_at: string
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          team_id: string
          requester_id: string
          status?: 'pending' | 'approved' | 'rejected'
          message?: string | null
        }
        Update: {
          id?: string
          team_id?: string
          requester_id?: string
          status?: 'pending' | 'approved' | 'rejected'
          message?: string | null
          reviewed_at?: string | null
        }
      }
      recruitment_posts: {
        Row: {
          id: string
          team_id: string
          posted_by: string
          title: string
          description: string
          required_skills: string[]
          positions_available: number
          preferred_gender: 'male' | 'female' | 'any'
          expires_at: string
          status: 'open' | 'closed' | 'archived'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          posted_by: string
          title: string
          description: string
          required_skills?: string[]
          positions_available?: number
          preferred_gender?: 'male' | 'female' | 'any'
          expires_at?: string
          status?: 'open' | 'closed' | 'archived'
        }
        Update: {
          id?: string
          team_id?: string
          posted_by?: string
          title?: string
          description?: string
          required_skills?: string[]
          positions_available?: number
          preferred_gender?: 'male' | 'female' | 'any'
          expires_at?: string
          status?: 'open' | 'closed' | 'archived'
        }
      }
      applications: {
        Row: {
          id: string
          recruitment_post_id: string
          applicant_id: string
          message: string | null
          status: 'pending' | 'accepted' | 'rejected'
          applied_at: string
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          recruitment_post_id: string
          applicant_id: string
          message?: string | null
          status?: 'pending' | 'accepted' | 'rejected'
        }
        Update: {
          id?: string
          recruitment_post_id?: string
          applicant_id?: string
          message?: string | null
          status?: 'pending' | 'accepted' | 'rejected'
          reviewed_at?: string | null
        }
      }
      chatrooms: {
        Row: {
          id: string
          type: 'dm' | 'team' | 'recruitment'
          team_id: string | null
          recruitment_post_id: string | null
          name: string | null
          created_at: string
          archived: boolean
        }
        Insert: {
          id?: string
          type: 'dm' | 'team' | 'recruitment'
          team_id?: string | null
          recruitment_post_id?: string | null
          name?: string | null
          archived?: boolean
        }
        Update: {
          id?: string
          type?: 'dm' | 'team' | 'recruitment'
          team_id?: string | null
          recruitment_post_id?: string | null
          name?: string | null
          archived?: boolean
        }
      }
      chatroom_members: {
        Row: {
          id: string
          chatroom_id: string
          user_id: string
          joined_at: string
          last_read_at: string
        }
        Insert: {
          id?: string
          chatroom_id: string
          user_id: string
          last_read_at?: string
        }
        Update: {
          id?: string
          chatroom_id?: string
          user_id?: string
          last_read_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          chatroom_id: string
          sender_id: string
          content: string
          created_at: string
          edited_at: string | null
          deleted: boolean
        }
        Insert: {
          id?: string
          chatroom_id: string
          sender_id: string
          content: string
          deleted?: boolean
        }
        Update: {
          id?: string
          chatroom_id?: string
          sender_id?: string
          content?: string
          edited_at?: string | null
          deleted?: boolean
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'application' | 'team_invite' | 'message' | 'system' | 'event'
          title: string
          message: string
          link: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'application' | 'team_invite' | 'message' | 'system' | 'event'
          title: string
          message: string
          link?: string | null
          read?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'application' | 'team_invite' | 'message' | 'system' | 'event'
          title?: string
          message?: string
          link?: string | null
          read?: boolean
        }
      }
      verification_otps: {
        Row: {
          id: string
          user_id: string
          email: string
          otp: string
          expires_at: string
          verified: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          otp: string
          expires_at: string
          verified?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          otp?: string
          expires_at?: string
          verified?: boolean
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      create_notification: {
        Args: Record<string, unknown>
        Returns: null
      }
      delete_user_account: {
        Args: Record<string, never>
        Returns: null
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type TablesName = keyof Database['public']['Tables']
export type TableRow<T extends TablesName> = Database['public']['Tables'][T]['Row']
export type TableInsert<T extends TablesName> = Database['public']['Tables'][T]['Insert']
export type TableUpdate<T extends TablesName> = Database['public']['Tables'][T]['Update']
