'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, User, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

type User = {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'staff'
  is_active: boolean
  last_login: string | null
  created_at: string
}

export default function UsersPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'staff' as 'admin' | 'staff',
    password: '',
    is_active: true
  })

  // Redirect se non è admin
  useEffect(() => {
    if (!isAdmin) {
      router.push('/')
    }
  }, [isAdmin, router])

  useEffect(() => {
    if (isAdmin) {
      loadUsers()
    }
  }, [isAdmin])

  async function loadUsers() {
    try {
      setLoading(true)
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Errore caricamento utenti')
      const data = await res.json()
      setUsers(data)
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('Errore caricamento utenti')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormData({
      email: '',
      full_name: '',
      role: 'staff',
      password: '',
      is_active: true
    })
    setEditingUser(null)
  }

  function handleNew() {
    resetForm()
    setDialogOpen(true)
  }

  function handleEdit(user: User) {
    setEditingUser(user)
    setFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      password: '', // Non mostriamo la password
      is_active: user.is_active
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    try {
      // Validazione
      if (!formData.email || !formData.full_name) {
        toast.error('Email e Nome sono obbligatori')
        return
      }

      if (!editingUser && !formData.password) {
        toast.error('Password obbligatoria per nuovo utente')
        return
      }

      const payload = {
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
        is_active: formData.is_active,
        ...(formData.password && { password: formData.password })
      }

      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Errore salvataggio')
      }

      toast.success(editingUser ? 'Utente aggiornato!' : 'Utente creato!')
      setDialogOpen(false)
      resetForm()
      loadUsers()
    } catch (error: any) {
      console.error('Error saving user:', error)
      toast.error(error.message)
    }
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Sei sicuro di voler eliminare l'utente ${email}?`)) return

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Errore eliminazione')

      toast.success('Utente eliminato!')
      loadUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Errore eliminazione utente')
    }
  }

  async function handleToggleActive(user: User) {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...user,
          is_active: !user.is_active
        })
      })

      if (!res.ok) throw new Error('Errore aggiornamento')

      toast.success(user.is_active ? 'Utente disattivato' : 'Utente attivato')
      loadUsers()
    } catch (error) {
      console.error('Error toggling user:', error)
      toast.error('Errore aggiornamento stato')
    }
  }

  if (!isAdmin) {
    return null // Verrà fatto redirect
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-600">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestione Utenti</h1>
          <p className="text-gray-600 mt-1">Gestisci accessi e permessi</p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Utente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-sm text-gray-600">Totale Utenti</div>
          <div className="text-2xl font-bold text-gray-900">{users.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-sm text-gray-600">Admin</div>
          <div className="text-2xl font-bold text-blue-600">
            {users.filter(u => u.role === 'admin').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-sm text-gray-600">Staff</div>
          <div className="text-2xl font-bold text-green-600">
            {users.filter(u => u.role === 'staff').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-sm text-gray-600">Attivi</div>
          <div className="text-2xl font-bold text-emerald-600">
            {users.filter(u => u.is_active).length}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utente</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ruolo</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Ultimo Accesso</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {user.role === 'admin' ? (
                      <Shield className="h-4 w-4 text-blue-600" />
                    ) : (
                      <User className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="font-medium">{user.full_name}</span>
                  </div>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                    {user.role === 'admin' ? 'Admin' : 'Staff'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.is_active ? 'default' : 'destructive'}>
                    {user.is_active ? 'Attivo' : 'Disattivato'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {user.last_login 
                    ? new Date(user.last_login).toLocaleString('it-IT')
                    : 'Mai'
                  }
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(user)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(user)}
                    >
                      {user.is_active ? '🔒' : '🔓'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(user.id, user.email)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Modifica Utente' : 'Nuovo Utente'}
            </DialogTitle>
            <DialogDescription>
              {editingUser 
                ? 'Aggiorna i dati dell\'utente'
                : 'Crea un nuovo utente del sistema'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="utente@esempio.it"
                disabled={!!editingUser}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Nome Completo *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Mario Rossi"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password {editingUser && '(lascia vuoto per non cambiarla)'}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
              {!editingUser && (
                <p className="text-xs text-gray-500">
                  Password minimo 6 caratteri
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Ruolo</Label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'staff' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="staff">Staff (Solo Visualizzazione)</option>
                <option value="admin">Admin (Accesso Completo)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="is_active">Utente attivo</Label>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave}>
              {editingUser ? 'Aggiorna' : 'Crea'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
