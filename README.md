# 🏨 HôtelCI - SaaS de Gestion Hôtelière

Application SaaS multi-tenant de gestion hôtelière conçue pour la Côte d'Ivoire.

## 🌟 Fonctionnalités

- **Multi-tenant** - Chaque hôtel est isolé avec ses propres données
- **Tableau de bord Super Admin** - Gestion des hôtels, abonnements, codes d'activation
- **Tableau de bord Propriétaire** - Vue complète de son hôtel (réservations, chambres, clients, équipe)
- **Tableau de bord Réceptionniste** - Interface mobile-first pour le check-in/check-out
- **Gestion des réservations** - Planning, calendrier, statuts en temps réel
- **Facturation** - Génération de factures PDF A4 et tickets thermiques 80mm
- **Gestion des stocks** - Suivi des articles, transactions, alertes
- **Restaurant** - Menu, commandes, gestion des plats
- **Salles de conférence** - Réservation et gestion
- **Paiements locaux** - Orange Money, MTN Mobile Money, Wave
- **TVA 18%** - Conformité fiscale ivoirienne
- **Support WhatsApp** - Contact direct via WhatsApp

## 🛠️ Stack Technique

- **Framework** : Next.js 16 (App Router)
- **Langage** : TypeScript 5
- **Styling** : Tailwind CSS 4 + shadcn/ui
- **Base de données** : Supabase (PostgreSQL) + Prisma ORM (SQLite local)
- **Authentification** : Supabase Auth avec JWT custom claims
- **Sécurité** : Row Level Security (RLS) sur toutes les tables
- **Devise** : FCFA (Franc CFA)

## 📋 Prérequis

- Node.js 18+
- Bun (recommandé) ou npm
- Compte Supabase

## 🚀 Installation

```bash
# Cloner le dépôt
git clone https://github.com/Ogouromain/Ogou_Hotel.git
cd Ogou_Hotel

# Installer les dépendances
bun install

# Copier les variables d'environnement
cp .env.example .env
# Remplir les valeurs Supabase dans .env

# Lancer le serveur de développement
bun run dev
```

## 🔐 Variables d'Environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL de connexion Prisma (SQLite) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé de service Supabase (admin) |

## 👥 Rôles Utilisateurs

| Rôle | Accès |
|------|-------|
| `super_admin` | Gestion de tous les hôtels, abonnements, codes d'activation |
| `owner` | Gestion complète de son hôtel |
| `manager` | Opérations de son hôtel (interface staff) |
| `receptionist` | Check-in/check-out, réservations (interface staff mobile) |

## 📱 Contact Support

- **Email** : omouitsi@gmail.com
- **WhatsApp** : +225 05 76 10 32 77

## 📄 Licence

Propriétaire - Tous droits réservés
