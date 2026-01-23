import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  HelpCircle,
  MessageSquare,
  FileText,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { TableRow } from '@/types/database'

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

type SupportTicket = TableRow<'support_tickets'> & {
  message_count?: number
  last_message_at?: string
}

type TicketMessage = TableRow<'ticket_messages'>

const faqs = [
  {
    question: 'How do I join a team?',
    answer: 'Browse available teams on the Teams page, find one that interests you, and click "Apply to Join". The team leader will review your application and respond.',
  },
  {
    question: 'How do I create a recruitment post?',
    answer: 'Navigate to the Recruitment page and click "Create Post". Fill in the details about what you\'re looking for and publish it. Other users can then apply to your post.',
  },
  {
    question: 'How do I verify my GEHU email?',
    answer: 'Go to Settings > Account and click "Verify GEHU Email". Enter your @gehu.ac.in email address and we\'ll send you a verification code.',
  },
  {
    question: 'How do I change my password?',
    answer: 'Go to Settings > Security and click "Change Password". You\'ll need to enter your current password and then your new password twice.',
  },
  {
    question: 'How do I report inappropriate content?',
    answer: 'Click the three-dot menu on any message or post and select "Report". Describe the issue and our moderation team will review it.',
  },
  {
    question: 'How do I delete my account?',
    answer: 'Go to Settings > Account and scroll to the bottom. Click "Delete Account" and follow the confirmation steps. This action is irreversible.',
  },
]

export default function HelpPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'faq' | 'tickets' | 'new'>('faq')
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)

  // New ticket form
  const [newTicketSubject, setNewTicketSubject] = useState('')
  const [newTicketDescription, setNewTicketDescription] = useState('')
  const [newTicketPriority, setNewTicketPriority] = useState<TicketPriority>('medium')
  const [submitting, setSubmitting] = useState(false)

  // Reply form
  const [replyContent, setReplyContent] = useState('')
  const [replying, setReplying] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    if (ticketMessages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [ticketMessages])

  useEffect(() => {
    if (user && activeTab === 'tickets') {
      loadTickets()
    }
  }, [user, activeTab])

  // Realtime subscription for ticket messages
  useEffect(() => {
    if (!selectedTicket) return

    const channel = supabase
      .channel(`user-ticket-messages-${selectedTicket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${selectedTicket.id}`,
        },
        (payload) => {
          const newMsg = payload.new as TicketMessage
          // Avoid duplicates
          setTicketMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedTicket])

  const loadTickets = async () => {
    if (!user) return
    setTicketsLoading(true)
    try {
      // Try RPC first, fallback to direct query
      const { data, error } = await (supabase.rpc as any)('get_user_tickets', { p_user_id: user.id })
      if (error) throw error
      setTickets((data as SupportTicket[]) || [])
    } catch (error: any) {
      console.error('Failed to load tickets via RPC:', error)
      // Fallback to direct query if RPC doesn't exist
      try {
        const { data, error: fallbackError } = await (supabase
          .from('support_tickets' as any)
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false }) as any)
        if (fallbackError) throw fallbackError
        setTickets((data as SupportTicket[]) || [])
      } catch {
        toast.error('Unable to load support tickets')
      }
    } finally {
      setTicketsLoading(false)
    }
  }

  const loadTicketMessages = async (ticketId: string) => {
    setMessagesLoading(true)
    try {
      const { data, error } = await (supabase
        .from('ticket_messages' as any)
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true }) as any)
      if (error) throw error
      setTicketMessages((data as TicketMessage[]) || [])
    } catch (error: any) {
      console.error('Failed to load messages:', error)
      toast.error('Unable to load ticket messages')
    } finally {
      setMessagesLoading(false)
    }
  }

  const handleSelectTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket)
    loadTicketMessages(ticket.id)
  }

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newTicketSubject.trim() || !newTicketDescription.trim()) return

    setSubmitting(true)
    try {
      const ticketData = {
        user_id: user.id,
        subject: newTicketSubject.trim(),
        description: newTicketDescription.trim(),
        priority: newTicketPriority,
      }
      const { error } = await (supabase.from('support_tickets' as any) as any).insert(ticketData)
      if (error) throw error

      toast.success('Support ticket created successfully!')
      setNewTicketSubject('')
      setNewTicketDescription('')
      setNewTicketPriority('medium')
      setActiveTab('tickets')
      loadTickets()
    } catch (error: any) {
      console.error('Failed to create ticket:', error)
      toast.error(error?.message || 'Failed to create ticket')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedTicket || !replyContent.trim()) return

    setReplying(true)
    try {
      const messageData = {
        ticket_id: selectedTicket.id,
        sender_id: user.id,
        content: replyContent.trim(),
        is_admin_reply: false,
      }
      const { error } = await (supabase.from('ticket_messages' as any) as any).insert(messageData)
      if (error) throw error

      setReplyContent('')
      loadTicketMessages(selectedTicket.id)
      toast.success('Reply sent!')
    } catch (error: any) {
      console.error('Failed to send reply:', error)
      toast.error(error?.message || 'Failed to send reply')
    } finally {
      setReplying(false)
    }
  }

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      case 'in_progress':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
      case 'resolved':
        return 'bg-green-500/10 text-green-400 border-green-500/30'
      case 'closed':
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30'
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30'
    }
  }

  const getStatusIcon = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="h-4 w-4" />
      case 'in_progress':
        return <Clock className="h-4 w-4" />
      case 'resolved':
        return <CheckCircle2 className="h-4 w-4" />
      case 'closed':
        return <CheckCircle2 className="h-4 w-4" />
      default:
        return <HelpCircle className="h-4 w-4" />
    }
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
          Support
        </p>
        <h1 className="text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          Help Center
        </h1>
        <p className="max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
          Find answers to common questions or reach out to our support team for assistance.
        </p>
      </header>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-[color:var(--color-border)] pb-2">
        <button
          onClick={() => setActiveTab('faq')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'faq'
              ? 'bg-[var(--accent)] text-white'
              : 'text-[color:var(--text-secondary)] hover:bg-[var(--accent-hover)]'
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          FAQs
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'tickets'
              ? 'bg-[var(--accent)] text-white'
              : 'text-[color:var(--text-secondary)] hover:bg-[var(--accent-hover)]'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          My Tickets
          {tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length > 0 && (
            <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
              {tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('new')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'new'
              ? 'bg-[var(--accent)] text-white'
              : 'text-[color:var(--text-secondary)] hover:bg-[var(--accent-hover)]'
          }`}
        >
          <FileText className="h-4 w-4" />
          New Ticket
        </button>
      </div>

      {/* FAQ Tab */}
      {activeTab === 'faq' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] divide-y divide-[color:var(--color-border)]">
            {faqs.map((faq, index) => (
              <div key={index} className="p-4">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {faq.question}
                  </span>
                  {expandedFaq === index ? (
                    <ChevronUp className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                  ) : (
                    <ChevronDown className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                  )}
                </button>
                {expandedFaq === index && (
                  <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {faq.answer}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6">
            <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Still need help?
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Can't find what you're looking for? Create a support ticket and our team will get back to you.
            </p>
            <button
              onClick={() => setActiveTab('new')}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
            >
              <FileText className="h-4 w-4" />
              Create Support Ticket
            </button>
          </div>

          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6">
            <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Contact Us Directly
            </h3>
            <div className="flex flex-col gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <a
                href="mailto:support@linkup.gehu.ac.in"
                className="inline-flex items-center gap-2 hover:text-[var(--accent)] transition"
              >
                <Mail className="h-4 w-4" />
                support@linkup.gehu.ac.in
              </a>
              <a
                href="https://github.com/your-repo/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-[var(--accent)] transition"
              >
                <ExternalLink className="h-4 w-4" />
                Report a Bug on GitHub
              </a>
            </div>
          </div>
        </div>
      )}

      {/* My Tickets Tab */}
      {activeTab === 'tickets' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          {/* Ticket List */}
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <div className="p-4 border-b border-[color:var(--color-border)]">
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Your Tickets
              </h3>
            </div>
            {ticketsLoading ? (
              <div className="flex items-center justify-center p-10">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--accent)' }} />
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                No tickets yet. Create one if you need help!
              </div>
            ) : (
              <div className="divide-y divide-[color:var(--color-border)] max-h-[500px] overflow-y-auto">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className={`w-full p-4 text-left transition hover:bg-[var(--accent-hover)] ${
                      selectedTicket?.id === ticket.id ? 'bg-[var(--accent-hover)]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-medium truncate"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {ticket.subject}
                        </p>
                        <p
                          className="text-xs mt-1"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {formatDate(ticket.updated_at)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColor(
                          ticket.status
                        )}`}
                      >
                        {getStatusIcon(ticket.status)}
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ticket Detail / Messages */}
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] overflow-hidden flex flex-col">
            {selectedTicket ? (
              <>
                <div className="p-4 border-b border-[color:var(--color-border)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {selectedTicket.subject}
                      </h3>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Created {formatDate(selectedTicket.created_at)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${getStatusColor(
                        selectedTicket.status
                      )}`}
                    >
                      {getStatusIcon(selectedTicket.status)}
                      {selectedTicket.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {selectedTicket.description}
                  </p>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--accent)' }} />
                    </div>
                  ) : ticketMessages.length === 0 ? (
                    <p className="text-center text-sm py-10" style={{ color: 'var(--text-secondary)' }}>
                      No messages yet. Send a reply below.
                    </p>
                  ) : (
                    ticketMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.is_admin_reply ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            msg.is_admin_reply
                              ? 'bg-blue-500/10 border border-blue-500/30 text-[color:var(--text-primary)]'
                              : 'bg-[var(--accent)] text-white'
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p
                            className={`text-xs mt-1 ${
                              msg.is_admin_reply ? 'text-blue-400' : 'text-white/70'
                            }`}
                          >
                            {msg.is_admin_reply ? '🛡️ Support Team' : 'You'} •{' '}
                            {formatDate(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Input */}
                {(selectedTicket.status === 'open' || selectedTicket.status === 'in_progress') && (
                  <form onSubmit={handleSendReply} className="p-4 border-t border-[color:var(--color-border)]">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Type your reply..."
                        className="flex-1 rounded-xl border border-[color:var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm outline-none focus:border-[var(--accent)]"
                        style={{ color: 'var(--text-primary)' }}
                        disabled={replying}
                      />
                      <button
                        type="submit"
                        disabled={!replyContent.trim() || replying}
                        className="rounded-xl bg-[var(--accent)] px-4 py-2 text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        {replying ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-10">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Select a ticket to view details
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Ticket Tab */}
      {activeTab === 'new' && (
        <div className="max-w-2xl">
          <form
            onSubmit={handleCreateTicket}
            className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6 space-y-6"
          >
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                Subject
              </label>
              <input
                type="text"
                value={newTicketSubject}
                onChange={(e) => setNewTicketSubject(e.target.value)}
                placeholder="Brief description of your issue"
                required
                maxLength={255}
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                Priority
              </label>
              <select
                value={newTicketPriority}
                onChange={(e) => setNewTicketPriority(e.target.value as TicketPriority)}
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                style={{ color: 'var(--text-primary)' }}
              >
                <option value="low">Low - General question</option>
                <option value="medium">Medium - Need help soon</option>
                <option value="high">High - Blocking issue</option>
                <option value="urgent">Urgent - Critical problem</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                Description
              </label>
              <textarea
                value={newTicketDescription}
                onChange={(e) => setNewTicketDescription(e.target.value)}
                placeholder="Please describe your issue in detail. Include any steps to reproduce the problem if applicable."
                required
                rows={6}
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)] resize-none"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !newTicketSubject.trim() || !newTicketDescription.trim()}
              className="w-full rounded-xl bg-[var(--accent)] py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Submit Ticket
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
