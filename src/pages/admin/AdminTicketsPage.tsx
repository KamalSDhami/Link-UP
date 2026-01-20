import { useEffect, useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  Loader2,
  Search,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Send,
  ChevronDown,
  User,
  ArrowLeft,
  RefreshCcw,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { TableRow } from '@/types/database'

type TicketRow = TableRow<'support_tickets'>
type TicketMessageRow = TableRow<'ticket_messages'>

interface TicketWithUser extends TicketRow {
  user: {
    id: string
    name: string | null
    email: string
    profile_picture_url: string | null
  } | null
  message_count: number
}

interface TicketMessage extends TicketMessageRow {
  sender: {
    id: string
    name: string | null
    email: string
    profile_picture_url: string | null
  } | null
}

const STATUS_OPTIONS: TicketRow['status'][] = ['open', 'in_progress', 'resolved', 'closed']
const PRIORITY_OPTIONS: TicketRow['priority'][] = ['low', 'medium', 'high', 'urgent']

const STATUS_CONFIG: Record<TicketRow['status'], { label: string; color: string; icon: typeof Clock }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: AlertCircle },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  closed: { label: 'Closed', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: XCircle },
}

const PRIORITY_CONFIG: Record<TicketRow['priority'], { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
}

export default function AdminTicketsPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<TicketWithUser[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | TicketRow['status']>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | TicketRow['priority']>('all')
  
  // Selected ticket for detail view
  const [selectedTicket, setSelectedTicket] = useState<TicketWithUser | null>(null)
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadTickets = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          user:user_id (
            id,
            name,
            email,
            profile_picture_url
          ),
          ticket_messages (count)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const ticketsWithCount = (data || []).map((ticket: any) => ({
        ...ticket,
        user: ticket.user,
        message_count: ticket.ticket_messages?.[0]?.count ?? 0,
      }))

      setTickets(ticketsWithCount)
    } catch (error: any) {
      console.error('Failed to load tickets:', error)
      toast.error(error?.message || 'Unable to load tickets')
    } finally {
      setLoading(false)
    }
  }, [user])

  const loadTicketMessages = useCallback(async (ticketId: string) => {
    setLoadingMessages(true)
    try {
      const { data, error } = await supabase
        .from('ticket_messages')
        .select(`
          *,
          sender:sender_id (
            id,
            name,
            email,
            profile_picture_url
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setTicketMessages((data || []) as TicketMessage[])
      
      // Scroll to bottom after loading
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (error: any) {
      console.error('Failed to load messages:', error)
      toast.error('Failed to load ticket messages')
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  useEffect(() => {
    if (selectedTicket) {
      loadTicketMessages(selectedTicket.id)
      
      // Set up realtime subscription for new messages
      const channel = supabase
        .channel(`ticket-messages-${selectedTicket.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'ticket_messages',
            filter: `ticket_id=eq.${selectedTicket.id}`,
          },
          async (payload) => {
            const newMsg = payload.new as TicketMessageRow
            
            // Fetch sender info
            const { data: senderData } = await supabase
              .from('users')
              .select('id, name, email, profile_picture_url')
              .eq('id', newMsg.sender_id)
              .single()
            
            const messageWithSender: TicketMessage = {
              ...newMsg,
              sender: senderData,
            }
            
            setTicketMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev
              return [...prev, messageWithSender]
            })
            
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }, 100)
          }
        )
        .subscribe()
      
      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [selectedTicket, loadTicketMessages])

  const handleSendMessage = async () => {
    if (!user || !selectedTicket || !newMessage.trim()) return

    setSendingMessage(true)
    try {
      const { error } = await supabase.from('ticket_messages').insert([
        {
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          content: newMessage.trim(),
          is_admin_reply: true,
        },
      ] as never)

      if (error) throw error

      setNewMessage('')
      
      // Update ticket status to in_progress if it was open
      if (selectedTicket.status === 'open') {
        await handleUpdateStatus('in_progress')
      }
    } catch (error: any) {
      console.error('Failed to send message:', error)
      toast.error(error?.message || 'Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleUpdateStatus = async (newStatus: TicketRow['status']) => {
    if (!selectedTicket) return

    setUpdatingStatus(true)
    try {
      const updates: Partial<TicketRow> = {
        status: newStatus,
        ...(newStatus === 'resolved' || newStatus === 'closed'
          ? { resolved_at: new Date().toISOString() }
          : {}),
        ...(newStatus === 'in_progress' && !selectedTicket.assigned_admin_id
          ? { assigned_admin_id: user?.id }
          : {}),
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updates as never)
        .eq('id', selectedTicket.id)

      if (error) throw error

      // Update local state
      setSelectedTicket((prev) => (prev ? { ...prev, ...updates } : null))
      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? { ...t, ...updates } : t))
      )
      
      toast.success(`Ticket marked as ${STATUS_CONFIG[newStatus].label}`)
    } catch (error: any) {
      console.error('Failed to update status:', error)
      toast.error('Failed to update ticket status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleUpdatePriority = async (newPriority: TicketRow['priority']) => {
    if (!selectedTicket) return

    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ priority: newPriority } as never)
        .eq('id', selectedTicket.id)

      if (error) throw error

      setSelectedTicket((prev) => (prev ? { ...prev, priority: newPriority } : null))
      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? { ...t, priority: newPriority } : t))
      )
      
      toast.success('Priority updated')
    } catch (error: any) {
      console.error('Failed to update priority:', error)
      toast.error('Failed to update priority')
    }
  }

  const filteredTickets = tickets.filter((ticket) => {
    if (statusFilter !== 'all' && ticket.status !== statusFilter) return false
    if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false
    
    if (search.trim()) {
      const query = search.toLowerCase()
      return (
        ticket.subject.toLowerCase().includes(query) ||
        ticket.user?.name?.toLowerCase().includes(query) ||
        ticket.user?.email.toLowerCase().includes(query)
      )
    }
    
    return true
  })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Mobile: Show detail view when ticket is selected
  if (selectedTicket) {
    const StatusIcon = STATUS_CONFIG[selectedTicket.status].icon

    return (
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => setSelectedTicket(null)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline">Back to tickets</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ticket Info & Actions */}
          <div className="lg:col-span-1 space-y-4">
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Ticket Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</label>
                  <p className="mt-1 text-slate-900">{selectedTicket.subject}</p>
                </div>
                
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Submitted By</label>
                  <div className="mt-1 flex items-center gap-2">
                    {selectedTicket.user?.profile_picture_url ? (
                      <img
                        src={selectedTicket.user.profile_picture_url}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-600">
                        {(selectedTicket.user?.name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-900">{selectedTicket.user?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">{selectedTicket.user?.email}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
                  <div className="mt-1 relative">
                    <select
                      value={selectedTicket.status}
                      onChange={(e) => handleUpdateStatus(e.target.value as TicketRow['status'])}
                      disabled={updatingStatus}
                      className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-10 text-sm shadow-sm focus:border-primary-300 focus:outline-none disabled:opacity-60"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_CONFIG[status].label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</label>
                  <div className="mt-1 relative">
                    <select
                      value={selectedTicket.priority}
                      onChange={(e) => handleUpdatePriority(e.target.value as TicketRow['priority'])}
                      className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-10 text-sm shadow-sm focus:border-primary-300 focus:outline-none"
                    >
                      {PRIORITY_OPTIONS.map((priority) => (
                        <option key={priority} value={priority}>
                          {PRIORITY_CONFIG[priority].label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <p className="text-xs text-slate-500">
                    Created {formatDate(selectedTicket.created_at)}
                  </p>
                  {selectedTicket.resolved_at && (
                    <p className="text-xs text-slate-500">
                      Resolved {formatDate(selectedTicket.resolved_at)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="lg:col-span-2">
            <div className="card flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary-600" />
                  Conversation
                </h2>
                <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${STATUS_CONFIG[selectedTicket.status].color}`}>
                  <StatusIcon className="h-3 w-3" />
                  {STATUS_CONFIG[selectedTicket.status].label}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : ticketMessages.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  ticketMessages.map((message) => {
                    const isAdmin = message.is_admin_reply
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] ${isAdmin ? 'order-2' : ''}`}>
                          <div
                            className={`rounded-2xl px-4 py-2 ${
                              isAdmin
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-100 text-slate-900'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>
                          <p className={`mt-1 text-xs text-slate-500 ${isAdmin ? 'text-right' : ''}`}>
                            {message.sender?.name || 'Unknown'} · {formatDate(message.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {selectedTicket.status !== 'closed' && (
                <div className="border-t border-slate-200 pt-4">
                  <div className="flex gap-2">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your reply..."
                      rows={2}
                      className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sendingMessage}
                      className="self-end rounded-xl bg-primary-600 px-4 py-2 text-white transition hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {sendingMessage ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {selectedTicket.status === 'closed' && (
                <div className="border-t border-slate-200 pt-4 text-center text-sm text-slate-500">
                  This ticket is closed. Reopen to continue the conversation.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Support Tickets</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage and respond to user support requests
          </p>
        </div>
        <button
          onClick={() => loadTickets()}
          disabled={loading}
          className="btn-outline flex items-center gap-2 self-start"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by subject, user name, or email..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-10 text-sm shadow-sm focus:border-primary-300 focus:outline-none"
              >
                <option value="all">All Status</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_CONFIG[status].label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
            
            <div className="relative">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
                className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-10 text-sm shadow-sm focus:border-primary-300 focus:outline-none"
              >
                <option value="all">All Priority</option>
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_CONFIG[priority].label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center px-6 py-16 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              {tickets.length === 0 ? 'No support tickets yet.' : 'No tickets match your filters.'}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 min-w-[200px]">Subject</th>
                  <th className="px-4 py-3 min-w-[150px]">User</th>
                  <th className="px-4 py-3 min-w-[100px]">Status</th>
                  <th className="px-4 py-3 min-w-[100px]">Priority</th>
                  <th className="px-4 py-3 min-w-[100px]">Messages</th>
                  <th className="px-4 py-3 min-w-[120px]">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTickets.map((ticket) => {
                  const StatusIcon = STATUS_CONFIG[ticket.status].icon
                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className="hover:bg-slate-50 cursor-pointer transition"
                    >
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 min-w-[200px]">
                        <p className="font-medium text-slate-900 truncate max-w-[200px]">
                          {ticket.subject}
                        </p>
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">
                          {ticket.description.slice(0, 60)}...
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {ticket.user?.profile_picture_url ? (
                            <img
                              src={ticket.user.profile_picture_url}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                              <User className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {ticket.user?.name || 'Unknown'}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {ticket.user?.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${STATUS_CONFIG[ticket.status].color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {STATUS_CONFIG[ticket.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${PRIORITY_CONFIG[ticket.priority].color}`}>
                          {PRIORITY_CONFIG[ticket.priority].label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <MessageSquare className="h-4 w-4" />
                          {ticket.message_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(ticket.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
