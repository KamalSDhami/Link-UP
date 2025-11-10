import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  Edit2,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { TableRow } from '@/types/database'

const ROLE_OPTIONS: Array<TableRow<'users'>['role']> = ['student', 'moderator', 'event_manager', 'super_admin']

interface ManagedUser extends Pick<
  TableRow<'users'>,
  | 'id'
  | 'name'
  | 'email'
  | 'role'
  | 'gehu_verified'
  | 'gehu_email'
  | 'is_banned'
  | 'section'
  | 'year'
  | 'created_at'
  | 'updated_at'
> {}

interface CreateUserForm {
  email: string
  name: string
  role: TableRow<'users'>['role']
  section: string
  year: number
  temporaryPassword: string
}

interface EditUserForm {
  name: string
  section: string
  year: number
}

const DEFAULT_CREATE_FORM: CreateUserForm = {
  email: '',
  name: '',
  role: 'student',
  section: '',
  year: 1,
  temporaryPassword: '',
}

export default function AdminUsersPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | TableRow<'users'>['role']>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<CreateUserForm>(DEFAULT_CREATE_FORM)
  const [creatingUser, setCreatingUser] = useState(false)
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
  const [editForm, setEditForm] = useState<EditUserForm>({ name: '', section: '', year: 1 })
  const [savingEdit, setSavingEdit] = useState(false)
  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [settingVerification, setSettingVerification] = useState(false)

  useEffect(() => {
    if (!user) return
    loadUsers()
  }, [user])

  const loadUsers = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select(
          'id, name, email, role, gehu_verified, gehu_email, is_banned, section, year, created_at, updated_at'
        )
        .order('created_at', { ascending: false })

      if (error) throw error

      setUsers(((data as ManagedUser[]) ?? []).map((entry) => ({
        ...entry,
        name: entry.name ?? '',
        section: entry.section ?? '',
        year: entry.year ?? 1,
      })))
    } catch (error: any) {
      console.error('Failed to load users:', error)
      toast.error(error?.message || 'Unable to load users')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return users.filter((entry) => {
      if (roleFilter !== 'all' && entry.role !== roleFilter) return false
      if (statusFilter === 'active' && entry.is_banned) return false
      if (statusFilter === 'disabled' && !entry.is_banned) return false

      if (!query) return true
      return (
        entry.name.toLowerCase().includes(query) ||
        entry.email.toLowerCase().includes(query) ||
        entry.section.toLowerCase().includes(query)
      )
    })
  }, [users, search, roleFilter, statusFilter])

  const resetCreateModal = () => {
    setCreateForm(DEFAULT_CREATE_FORM)
    setShowCreateModal(false)
    setCreatingUser(false)
  }

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!createForm.email.trim()) {
      toast.error('Email is required')
      return
    }
    if (!createForm.section.trim()) {
      toast.error('Section is required')
      return
    }

    setCreatingUser(true)
    try {
      const payload = {
        p_email: createForm.email.trim().toLowerCase(),
        p_name: createForm.name.trim() || null,
        p_role: createForm.role,
        p_section: createForm.section.trim().toUpperCase(),
        p_year: createForm.year,
        p_temporary_password: createForm.temporaryPassword.trim() || null,
      }

      const { data, error } = await supabase.rpc<ManagedUser['id']>('admin_create_user', payload as never)

      if (error) throw error

      toast.success('User created and invited successfully')
      resetCreateModal()
      await loadUsers()
      return data
    } catch (error: any) {
      console.error('Failed to create user:', error)
      toast.error(error?.message || 'Unable to create user')
    } finally {
      setCreatingUser(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!userId) return
    if (user?.id === userId) {
      toast.error('You cannot delete your own account')
      return
    }
    const confirmed = window.confirm('This will permanently remove the user. Continue?')
    if (!confirmed) return

    try {
      const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId } as never)
      if (error) throw error
      toast.success('User removed')
      setUsers((prev) => prev.filter((entry) => entry.id !== userId))
    } catch (error: any) {
      console.error('Failed to remove user:', error)
      toast.error(error?.message || 'Unable to remove user')
    }
  }

  const handleRoleChange = async (userId: string, nextRole: TableRow<'users'>['role']) => {
    if (user?.id === userId && nextRole !== 'super_admin') {
      toast.error('You cannot change your own role')
      return
    }

    try {
      const { error } = await supabase.rpc('admin_set_user_role', {
        p_user_id: userId,
        p_role: nextRole,
      } as never)

      if (error) throw error

      setUsers((prev) =>
        prev.map((entry) => (entry.id === userId ? { ...entry, role: nextRole, updated_at: new Date().toISOString() } : entry))
      )
      toast.success('Role updated')
    } catch (error: any) {
      console.error('Failed to update role:', error)
      toast.error(error?.message || 'Unable to update role')
    }
  }

  const handleToggleBan = async (userId: string, shouldBan: boolean) => {
    if (user?.id === userId) {
      toast.error('You cannot disable your own account')
      return
    }

    try {
      const { error } = await supabase.rpc('admin_set_user_ban', {
        p_user_id: userId,
        p_is_banned: shouldBan,
      } as never)

      if (error) throw error

      setUsers((prev) =>
        prev.map((entry) => (entry.id === userId ? { ...entry, is_banned: shouldBan, updated_at: new Date().toISOString() } : entry))
      )
      toast.success(shouldBan ? 'User disabled' : 'User enabled')
    } catch (error: any) {
      console.error('Failed to update user status:', error)
      toast.error(error?.message || 'Unable to update user status')
    }
  }

  const openVerificationModal = (entry: ManagedUser) => {
    setVerifyingUserId(entry.id)
    setVerificationEmail(entry.gehu_email ?? entry.email)
  }

  const closeVerificationModal = () => {
    setVerifyingUserId(null)
    setVerificationEmail('')
    setSettingVerification(false)
  }

  const handleVerificationChange = async (shouldVerify: boolean) => {
    if (!verifyingUserId) return

    setSettingVerification(true)
    try {
      const payload = {
        p_user_id: verifyingUserId,
        p_verified: shouldVerify,
        p_gehu_email: shouldVerify ? verificationEmail.trim().toLowerCase() || null : null,
      }

      const { error } = await supabase.rpc('admin_set_user_verification', payload as never)
      if (error) throw error

      setUsers((prev) =>
        prev.map((entry) =>
          entry.id === verifyingUserId
            ? {
                ...entry,
                gehu_verified: shouldVerify,
                gehu_email: shouldVerify ? payload.p_gehu_email : null,
                updated_at: new Date().toISOString(),
              }
            : entry
        )
      )

      toast.success(shouldVerify ? 'User verified' : 'Verification revoked')
      closeVerificationModal()
    } catch (error: any) {
      console.error('Failed to update verification:', error)
      toast.error(error?.message || 'Unable to update verification')
    } finally {
      setSettingVerification(false)
    }
  }

  const openEditModal = (entry: ManagedUser) => {
    setEditingUser(entry)
    setEditForm({
      name: entry.name ?? '',
      section: entry.section ?? '',
      year: entry.year ?? 1,
    })
  }

  const closeEditModal = () => {
    setEditingUser(null)
    setSavingEdit(false)
  }

  const handleSaveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingUser) return

    if (!editForm.name.trim()) {
      toast.error('Name cannot be empty')
      return
    }
    if (!editForm.section.trim()) {
      toast.error('Section is required')
      return
    }

    setSavingEdit(true)
    try {
      const updates = {
        name: editForm.name.trim(),
        section: editForm.section.trim().toUpperCase(),
        year: editForm.year,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('users').update(updates as never).eq('id', editingUser.id)
      if (error) throw error

      setUsers((prev) =>
        prev.map((entry) => (entry.id === editingUser.id ? { ...entry, ...updates } : entry))
      )
      toast.success('Profile updated')
      closeEditModal()
    } catch (error: any) {
      console.error('Failed to update user:', error)
      toast.error(error?.message || 'Unable to update user')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadUsers()
    setRefreshing(false)
  }

  if (!user) {
    return null
  }

  const isSuperAdmin = user.role === 'super_admin'

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 py-10 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Insufficient permissions</h1>
        <p className="text-slate-600">You need super admin permissions to manage users.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-primary-600">Administration</p>
          <h1 className="text-3xl font-display font-bold text-slate-900">User management</h1>
          <p className="text-slate-600">Add, verify, suspend, or update roles for members across the platform.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
            disabled={refreshing || loading}
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
          >
            <Plus className="h-4 w-4" />
            Add user
          </button>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, or section"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill
              label="Role"
              value={roleFilter}
              options={[{ value: 'all', label: 'All roles' }, ...ROLE_OPTIONS.map((role) => ({ value: role, label: role.replace(/_/g, ' ') }))]}
              onChange={(value) => setRoleFilter(value as typeof roleFilter)}
            />
            <FilterPill
              label="Status"
              value={statusFilter}
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'disabled', label: 'Disabled' },
              ]}
              onChange={(value) => setStatusFilter(value as typeof statusFilter)}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          {loading ? (
            <div className="flex items-center justify-center px-6 py-16 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              No users match your filters.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">User</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Verification</th>
                  <th className="px-4 py-2">Section</th>
                  <th className="px-4 py-2">Joined</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((entry) => {
                  const joinedAt = new Date(entry.created_at)
                  const joinedLabel = joinedAt.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                  const isDisabled = entry.is_banned

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{entry.name || 'Unnamed user'}</div>
                        <div className="text-xs text-slate-500">{entry.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative inline-flex items-center">
                          <select
                            value={entry.role}
                            onChange={(event) => handleRoleChange(entry.id, event.target.value as ManagedUser['role'])}
                            className="appearance-none rounded-lg border border-slate-200 bg-white py-1 pl-3 pr-8 text-sm font-medium capitalize text-slate-700 shadow-sm focus:border-primary-300 focus:outline-none"
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role} className="capitalize">
                                {role.replace(/_/g, ' ')}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-slate-400" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {entry.gehu_verified ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                            <CheckCircle2 className="h-3 w-3" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                            <Shield className="h-3 w-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          {entry.section || '—'} · Year {entry.year || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-sm">{joinedLabel}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(entry)}
                            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                            title="Edit profile"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openVerificationModal(entry)}
                            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                            title={entry.gehu_verified ? 'Revoke verification' : 'Verify user'}
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleBan(entry.id, !isDisabled)}
                            className={`rounded-lg border p-2 transition ${
                              isDisabled
                                ? 'border-green-200 text-green-600 hover:border-green-300 hover:bg-green-50'
                                : 'border-amber-200 text-amber-600 hover:border-amber-300 hover:bg-amber-50'
                            }`}
                            title={isDisabled ? 'Enable user' : 'Disable user'}
                          >
                            {isDisabled ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(entry.id)}
                            className="rounded-lg border border-red-200 p-2 text-red-600 transition hover:border-red-300 hover:bg-red-50"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreateModal && (
        <Modal title="Add new user" onClose={resetCreateModal}>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</label>
              <input
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Full name"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</label>
              <input
                value={createForm.email}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="student@example.edu"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Section</label>
                <input
                  value={createForm.section}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, section: event.target.value }))}
                  placeholder="A1"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Year</label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={createForm.year}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, year: Number(event.target.value) || 1 }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</label>
              <select
                value={createForm.role}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, role: event.target.value as ManagedUser['role'] }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Temporary password</label>
              <input
                value={createForm.temporaryPassword}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))
                }
                placeholder="Leave blank to auto-generate"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetCreateModal}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                disabled={creatingUser}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:opacity-60"
                disabled={creatingUser}
              >
                {creatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create user
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingUser && (
        <Modal title="Edit user details" onClose={closeEditModal}>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</label>
              <input
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Section</label>
              <input
                value={editForm.section}
                onChange={(event) => setEditForm((prev) => ({ ...prev, section: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Year</label>
              <input
                type="number"
                min={1}
                max={4}
                value={editForm.year}
                onChange={(event) => setEditForm((prev) => ({ ...prev, year: Number(event.target.value) || 1 }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                disabled={savingEdit}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:opacity-60"
                disabled={savingEdit}
              >
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {verifyingUserId && (
        <Modal title="Adjust verification" onClose={closeVerificationModal}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Set the GEHU email this user verified with or revoke their verification flag.
            </p>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">GEHU email</label>
              <input
                value={verificationEmail}
                onChange={(event) => setVerificationEmail(event.target.value)}
                placeholder="name@gehu.ac.in"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => handleVerificationChange(false)}
                className="rounded-lg border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-50"
                disabled={settingVerification}
              >
                Revoke
              </button>
              <button
                onClick={() => handleVerificationChange(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:opacity-60"
                disabled={settingVerification}
              >
                {settingVerification ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Mark verified
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

interface FilterPillProps {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}

function FilterPill({ label, value, options, onChange }: FilterPillProps) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">Administrative action</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}
