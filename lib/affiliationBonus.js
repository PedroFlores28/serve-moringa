/**
 * Bono de afiliación Class Moringa:
 * - 120 Bs al patrocinador directo (1 nivel)
 * - Aplica a cualquier paquete de afiliación
 * - Solo si el patrocinador está activo (afiliación del mes o reconsumo activo)
 */

const DIRECT_AFFILIATION_BONUS = 120;
const BONUS_TX_NAME = "affiliation bonus";

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function isDateInMonth(value, referenceDate) {
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return false;
  return d >= startOfMonth(referenceDate) && d <= endOfMonth(referenceDate);
}

/**
 * Reconsumo activo: flag persistente al alcanzar 120 pts en activaciones.
 */
function hasActiveReconsumo(user) {
  return !!user?.activated;
}

/**
 * Afiliación reciente del mes (fecha de afiliación del usuario en el mes de referencia).
 */
function hasAffiliationThisMonth(user, referenceDate) {
  return isDateInMonth(user?.affiliation_date, referenceDate);
}

/**
 * Otra afiliación aprobada del mismo usuario en el mes (reingreso / cambio de paquete).
 */
async function hasApprovedAffiliationInMonth(Affiliation, userId, referenceDate, excludeAffiliationId) {
  if (!Affiliation || !userId) return false;

  const approved = await Affiliation.find({ userId, status: "approved" });
  if (!approved?.length) return false;

  return approved.some((aff) => {
    if (excludeAffiliationId && aff.id === excludeAffiliationId) return false;
    const when = aff.approved_at || aff.date;
    return isDateInMonth(when, referenceDate);
  });
}

/**
 * Usuario activo para cobrar bono de afiliación.
 */
async function isUserActiveForAffiliationBonus(
  user,
  { Affiliation, referenceDate = new Date(), excludeAffiliationId } = {}
) {
  if (!user) return { active: false, reason: "no_user" };

  if (hasActiveReconsumo(user)) {
    return { active: true, reason: "reconsumo" };
  }

  if (hasAffiliationThisMonth(user, referenceDate)) {
    return { active: true, reason: "affiliation_month" };
  }

  if (Affiliation) {
    const inMonth = await hasApprovedAffiliationInMonth(
      Affiliation,
      user.id,
      referenceDate,
      excludeAffiliationId
    );
    if (inMonth) {
      return { active: true, reason: "affiliation_approved_month" };
    }
  }

  return { active: false, reason: "inactive" };
}

/**
 * Paga 120 Bs al patrocinador directo si está activo.
 * @returns {Promise<string|null>} id de transacción creada o null si no aplica
 */
async function payDirectAffiliationBonus({
  sponsor,
  affiliationId,
  newMemberId,
  Transaction,
  Affiliation,
  rand,
  referenceDate = new Date(),
}) {
  if (!sponsor?.id) {
    console.log(
      `[Affiliation Bonus] Sin patrocinador directo para afiliación ${affiliationId}`
    );
    return null;
  }

  const { active, reason } = await isUserActiveForAffiliationBonus(sponsor, {
    Affiliation,
    referenceDate,
    excludeAffiliationId: affiliationId,
  });

  if (!active) {
    console.log(
      `[Affiliation Bonus] Patrocinador ${sponsor.id} inactivo (${reason}), no se paga bono por afiliación ${affiliationId}`
    );
    return null;
  }

  const transactionId = rand();
  await Transaction.insert({
    id: transactionId,
    date: new Date(),
    user_id: sponsor.id,
    type: "in",
    value: DIRECT_AFFILIATION_BONUS,
    name: BONUS_TX_NAME,
    affiliation_id: affiliationId,
    virtual: false,
    _user_id: newMemberId,
  });

  console.log(
    `[Affiliation Bonus] Bs ${DIRECT_AFFILIATION_BONUS} → patrocinador ${sponsor.id} (${reason}) por afiliación ${affiliationId}`
  );

  return transactionId;
}

module.exports = {
  DIRECT_AFFILIATION_BONUS,
  BONUS_TX_NAME,
  isUserActiveForAffiliationBonus,
  payDirectAffiliationBonus,
  hasActiveReconsumo,
  hasAffiliationThisMonth,
};
