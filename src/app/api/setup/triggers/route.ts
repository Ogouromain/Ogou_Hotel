import { NextRequest, NextResponse } from 'next/server'
import { validateSetupKey } from '@/lib/setup-auth'

/**
 * GET /api/setup/triggers
 *
 * Returns the SQL triggers that need to be applied to the Supabase database
 * for enforcing subscription limits at the database level.
 * These are safety nets — application-level validation is the primary enforcement.
 */
export async function GET(request: NextRequest) {
  const authError = validateSetupKey(request)
  if (authError) return authError
  const sql = `
-- =========================================================
-- OGOU_HÔTEL - Triggers de Validation des Limites d'Abonnement
-- Ces triggers sont un filet de sécurité au niveau base de données.
-- L'application valide aussi ces limites côté API (défense en profondeur).
-- =========================================================

-- Trigger 1: Limite des Employés (Réceptionnistes & Managers)
CREATE OR REPLACE FUNCTION public.check_employee_limits()
RETURNS TRIGGER AS $$
DECLARE
    v_receptionist_count INT;
    v_manager_count INT;
    v_max_receptionists INT;
    v_max_managers INT;
BEGIN
    -- Récupérer les limites autorisées par l'abonnement actif de l'hôtel
    SELECT sp.max_receptionists, sp.max_managers INTO v_max_receptionists, v_max_managers
    FROM public.subscriptions sub
    JOIN public.subscription_plans sp ON sub.plan_id = sp.id
    WHERE sub.hotel_id = NEW.hotel_id AND sub.status = 'active';

    -- Si aucun abonnement actif, on autorise uniquement la création initiale de l'owner
    IF v_max_receptionists IS NULL THEN
        IF NEW.role = 'owner' THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Abonnement actif introuvable pour cet hôtel.';
        END IF;
    END IF;

    -- Validation de la limite des Réceptionnistes
    IF NEW.role = 'receptionist' THEN
        SELECT COUNT(*) INTO v_receptionist_count 
        FROM public.profiles 
        WHERE hotel_id = NEW.hotel_id AND role = 'receptionist' AND id <> NEW.id;

        IF v_receptionist_count >= v_max_receptionists THEN
            RAISE EXCEPTION 'Limite de réceptionnistes atteinte (% max) pour votre plan actuel.', v_max_receptionists;
        END IF;
    END IF;

    -- Validation de la limite des Managers
    IF NEW.role = 'manager' THEN
        SELECT COUNT(*) INTO v_manager_count 
        FROM public.profiles 
        WHERE hotel_id = NEW.hotel_id AND role = 'manager' AND id <> NEW.id;

        IF v_manager_count >= v_max_managers THEN
            RAISE EXCEPTION 'Limite de managers atteinte (% max) pour votre plan actuel.', v_max_managers;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_employee_limits ON public.profiles;
CREATE TRIGGER trigger_check_employee_limits
BEFORE INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
WHEN (NEW.hotel_id IS NOT NULL)
EXECUTE FUNCTION public.check_employee_limits();


-- Trigger 2: Limite des Chambres
CREATE OR REPLACE FUNCTION public.check_room_limits()
RETURNS TRIGGER AS $$
DECLARE
    v_room_count INT;
    v_max_rooms INT;
BEGIN
    -- Récupérer la limite de chambres de l'abonnement actif
    SELECT sp.max_rooms INTO v_max_rooms
    FROM public.subscriptions sub
    JOIN public.subscription_plans sp ON sub.plan_id = sp.id
    WHERE sub.hotel_id = NEW.hotel_id AND sub.status = 'active';

    IF v_max_rooms IS NULL THEN
        RAISE EXCEPTION 'Abonnement actif introuvable pour cet hôtel.';
    END IF;

    -- Compter les chambres existantes (exclure la chambre en cours de modification)
    SELECT COUNT(*) INTO v_room_count 
    FROM public.rooms 
    WHERE hotel_id = NEW.hotel_id AND id <> NEW.id;

    IF v_room_count >= v_max_rooms THEN
        RAISE EXCEPTION 'Limite de chambres atteinte (% max) pour votre plan actuel.', v_max_rooms;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_room_limits ON public.rooms;
CREATE TRIGGER trigger_check_room_limits
BEFORE INSERT ON public.rooms
FOR EACH ROW
WHEN (NEW.hotel_id IS NOT NULL)
EXECUTE FUNCTION public.check_room_limits();
`.trim()

  return NextResponse.json({
    message: 'Exécutez ce SQL dans le Supabase SQL Editor (Dashboard > SQL Editor) pour activer les triggers de validation des limites.',
    sqlEditorUrl: 'https://supabase.com/dashboard/project/rjgiktswlgfokztwuqup/sql',
    sql,
  })
}
