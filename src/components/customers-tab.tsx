'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Users,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Upload,
  X,
  FileText,
  Eye,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CustomersTabProps {
  onRefresh?: () => void
}

interface CustomerInfo {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string
  identity_document_type: string | null
  identity_document_number: string | null
  identity_document_path: string | null
  signed_url?: string | null
  created_at: string
  updated_at: string
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getDocTypeBadge(type: string | null) {
  if (!type) return <span className="text-muted-foreground">—</span>
  switch (type) {
    case 'CNI':
      return <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100 text-[10px]">CNI</Badge>
    case 'Passeport':
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 text-[10px]">Passeport</Badge>
    case 'Attestation':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-[10px]">Attestation</Badge>
    default:
      return <Badge variant="secondary" className="text-[10px]">{type}</Badge>
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CustomersTab({ onRefresh }: CustomersTabProps) {
  const [customers, setCustomers] = useState<CustomerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerInfo | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [formFirstName, setFormFirstName] = useState('')
  const [formLastName, setFormLastName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formDocType, setFormDocType] = useState('')
  const [formDocNumber, setFormDocNumber] = useState('')
  const [formDocFile, setFormDocFile] = useState<File | null>(null)
  const [formDocPreview, setFormDocPreview] = useState<string | null>(null)
  const [existingDocUrl, setExistingDocUrl] = useState<string | null>(null)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CustomerInfo | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ─── Fetch customers ──────────────────────────────────────────────────
  const fetchCustomers = useCallback(async (search?: string) => {
    setLoading(true)
    try {
      const url = search
        ? `/api/owner/customers?search=${encodeURIComponent(search)}`
        : '/api/owner/customers'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || [])
      }
    } catch {
      toast.error('Erreur lors du chargement des clients')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  // ─── Debounced search ─────────────────────────────────────────────────
  function handleSearchChange(value: string) {
    setSearchQuery(value)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (!value.trim()) {
      fetchCustomers()
      return
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchCustomers(value.trim())
    }, 300)
  }

  // ─── Form helpers ─────────────────────────────────────────────────────
  function resetForm() {
    setFormFirstName('')
    setFormLastName('')
    setFormPhone('')
    setFormEmail('')
    setFormDocType('')
    setFormDocNumber('')
    setFormDocFile(null)
    setFormDocPreview(null)
    setExistingDocUrl(null)
  }

  function openCreateDialog() {
    resetForm()
    setEditMode(false)
    setSelectedCustomer(null)
    setDialogOpen(true)
  }

  function openEditDialog(customer: CustomerInfo) {
    setEditMode(true)
    setSelectedCustomer(customer)
    setFormFirstName(customer.first_name)
    setFormLastName(customer.last_name)
    setFormPhone(customer.phone)
    setFormEmail(customer.email || '')
    setFormDocType(customer.identity_document_type || '')
    setFormDocNumber(customer.identity_document_number || '')
    setFormDocFile(null)
    setFormDocPreview(null)
    setExistingDocUrl(customer.signed_url || null)
    setDialogOpen(true)
  }

  async function handleDocFileChange(file: File | null) {
    setFormDocFile(file)
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => setFormDocPreview(e.target?.result as string)
        reader.readAsDataURL(file)
      } else {
        setFormDocPreview(null)
      }
    } else {
      setFormDocPreview(null)
    }
  }

  // ─── View document ────────────────────────────────────────────────────
  async function viewDocument(customer: CustomerInfo) {
    if (!customer.identity_document_path) return
    try {
      const res = await fetch(
        `/api/owner/customers/signed-url?path=${encodeURIComponent(customer.identity_document_path)}`
      )
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          window.open(data.url, '_blank')
        }
      } else {
        toast.error('Impossible d\'accéder au document')
      }
    } catch {
      toast.error('Erreur lors de l\'accès au document')
    }
  }

  // ─── Submit (create or update) ────────────────────────────────────────
  async function handleSubmit() {
    if (!formFirstName.trim() || !formLastName.trim() || !formPhone.trim()) {
      toast.error('Prénom, nom et téléphone sont requis')
      return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        first_name: formFirstName.trim(),
        last_name: formLastName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || null,
        identity_document_type: formDocType || null,
        identity_document_number: formDocNumber.trim() || null,
      }

      if (formDocFile) {
        const base64 = await fileToBase64(formDocFile)
        payload.identity_document_file = base64
        payload.identity_document_mime_type = formDocFile.type
      }

      let res: Response

      if (editMode && selectedCustomer) {
        res = await fetch(`/api/owner/customers/${selectedCustomer.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/owner/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        toast.success(
          editMode
            ? `Client ${formFirstName} ${formLastName} modifié`
            : `Client ${formFirstName} ${formLastName} créé`
        )
        setDialogOpen(false)
        resetForm()
        fetchCustomers(searchQuery || undefined)
        onRefresh?.()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de l\'enregistrement')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/owner/customers/${deleteTarget.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success(`Client ${deleteTarget.first_name} ${deleteTarget.last_name} supprimé`)
        setDeleteDialogOpen(false)
        setDeleteTarget(null)
        fetchCustomers(searchQuery || undefined)
        onRefresh?.()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">👥 Gestion des Clients</h2>
          <p className="text-muted-foreground">
            {customers.length} client{customers.length !== 1 ? 's' : ''} enregistré{customers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCustomers(searchQuery || undefined)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
            onClick={openCreateDialog}
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Rechercher un client par nom, téléphone, email..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 mb-3">
                <Users className="h-7 w-7" />
              </div>
              <p className="text-muted-foreground">Aucun client enregistré</p>
              <p className="text-xs text-muted-foreground mt-1">Ajoutez votre premier client pour commencer</p>
              <Button
                className="mt-4 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={openCreateDialog}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un client
              </Button>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom Complet</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden lg:table-cell">Type Document</TableHead>
                    <TableHead className="hidden lg:table-cell">N° Document</TableHead>
                    <TableHead>Pièce</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.first_name} {customer.last_name}
                      </TableCell>
                      <TableCell>{customer.phone}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {customer.email || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {getDocTypeBadge(customer.identity_document_type)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {customer.identity_document_number || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {customer.identity_document_path ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-amber-600 hover:text-amber-800"
                            onClick={() => viewDocument(customer)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="text-[10px]">Voir</span>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(customer)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700"
                            onClick={() => {
                              setDeleteTarget(customer)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Create/Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editMode ? (
                <>
                  <Pencil className="h-5 w-5 text-amber-600" />
                  Modifier le Client
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5 text-amber-600" />
                  Nouveau Client
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {editMode
                ? 'Modifiez les informations du client'
                : 'Ajoutez un nouveau client à votre établissement'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cust-first-name">Prénom *</Label>
                <Input
                  id="cust-first-name"
                  placeholder="Prénom"
                  value={formFirstName}
                  onChange={(e) => setFormFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cust-last-name">Nom *</Label>
                <Input
                  id="cust-last-name"
                  placeholder="Nom"
                  value={formLastName}
                  onChange={(e) => setFormLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cust-phone">Téléphone *</Label>
                <Input
                  id="cust-phone"
                  placeholder="+225 XX XX XX XX"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cust-email">Email</Label>
                <Input
                  id="cust-email"
                  type="email"
                  placeholder="email@exemple.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cust-doc-type">Type de document</Label>
                <Select value={formDocType} onValueChange={setFormDocType}>
                  <SelectTrigger id="cust-doc-type">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CNI">CNI</SelectItem>
                    <SelectItem value="Passeport">Passeport</SelectItem>
                    <SelectItem value="Attestation">Attestation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cust-doc-number">N° Document</Label>
                <Input
                  id="cust-doc-number"
                  placeholder="Numéro du document"
                  value={formDocNumber}
                  onChange={(e) => setFormDocNumber(e.target.value)}
                />
              </div>
            </div>

            {/* Document upload */}
            <div className="space-y-2">
              <Label>Pièce d&apos;identité</Label>

              {/* Show existing document preview if editing */}
              {editMode && existingDocUrl && !formDocFile && (
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <FileText className="h-5 w-5 text-amber-600 shrink-0" />
                  <span className="text-sm text-gray-700 flex-1">Document existant</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => window.open(existingDocUrl, '_blank')}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Voir
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-white px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 transition-colors">
                    <Upload className="h-4 w-4" />
                    {formDocFile ? formDocFile.name : editMode ? 'Remplacer le document' : 'Télécharger un fichier'}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleDocFileChange(e.target.files?.[0] || null)}
                  />
                </label>
                {formDocFile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500"
                    onClick={() => handleDocFileChange(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {formDocPreview && (
                <div className="mt-2 inline-block">
                  <img
                    src={formDocPreview}
                    alt="Aperçu du document"
                    className="h-20 rounded border border-amber-200 object-cover"
                  />
                </div>
              )}
              {formDocFile && !formDocFile.type.startsWith('image/') && (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="h-4 w-4" />
                  {formDocFile.name}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : editMode ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Enregistrer
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer le Client
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirmer la suppression
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le client{' '}
              <strong>{deleteTarget?.first_name} {deleteTarget?.last_name}</strong> ?
              Cette action est irréversible. Les documents associés seront également supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
