const assert = require("assert");
const affiliationBonus = require("../lib/affiliationBonus");

async function runTests() {
  console.log("=== Testing Sponsor Bonus Logic ===");

  let insertedTransactions = [];
  const mockTransaction = {
    insert: async (tx) => {
      insertedTransactions.push(tx);
      return tx;
    },
  };
  const mockAffiliation = {
    find: async () => [],
  };

  const activeSponsor = {
    id: "sponsor123",
    name: "Juan",
    activated: true,
  };

  const rand = () => "tx_" + Math.random().toString(36).substring(2, 9);

  // Test Case 1: Package with Bs 120
  console.log("\nTest 1: Afiliación con paquete configurado a Bs 120");
  insertedTransactions = [];
  const tx1 = await affiliationBonus.payDirectAffiliationBonus({
    sponsor: activeSponsor,
    affiliationId: "aff_1",
    newMemberId: "user_pedro",
    bonusAmount: 120,
    Transaction: mockTransaction,
    Affiliation: mockAffiliation,
    rand,
  });
  assert(tx1 !== null, "Debe retornar un id de transacción");
  assert.strictEqual(insertedTransactions.length, 1, "Debe registrar 1 transacción");
  assert.strictEqual(insertedTransactions[0].value, 120, "El monto debe ser Bs 120");
  assert.strictEqual(insertedTransactions[0].user_id, "sponsor123", "Debe ir al patrocinador");
  assert.strictEqual(insertedTransactions[0].name, "affiliation bonus");
  console.log("✓ Test 1 PASÓ: Patrocinador recibe Bs 120");

  // Test Case 2: Package with Bs 60
  console.log("\nTest 2: Afiliación con paquete configurado a Bs 60");
  insertedTransactions = [];
  const tx2 = await affiliationBonus.payDirectAffiliationBonus({
    sponsor: activeSponsor,
    affiliationId: "aff_2",
    newMemberId: "user_maria",
    bonusAmount: 60,
    Transaction: mockTransaction,
    Affiliation: mockAffiliation,
    rand,
  });
  assert(tx2 !== null, "Debe retornar un id de transacción");
  assert.strictEqual(insertedTransactions.length, 1, "Debe registrar 1 transacción");
  assert.strictEqual(insertedTransactions[0].value, 60, "El monto debe ser Bs 60");
  console.log("✓ Test 2 PASÓ: Patrocinador recibe Bs 60");

  // Test Case 3: Package with Bs 0
  console.log("\nTest 3: Afiliación con paquete configurado a Bs 0");
  insertedTransactions = [];
  const tx3 = await affiliationBonus.payDirectAffiliationBonus({
    sponsor: activeSponsor,
    affiliationId: "aff_3",
    newMemberId: "user_carlos",
    bonusAmount: 0,
    Transaction: mockTransaction,
    Affiliation: mockAffiliation,
    rand,
  });
  assert.strictEqual(tx3, null, "No debe generar transacción con Bs 0");
  assert.strictEqual(insertedTransactions.length, 0, "No debe insertar transacciones");
  console.log("✓ Test 3 PASÓ: Bs 0 no genera bono directo");

  // Test Case 4: Negative value protection (< 0)
  console.log("\nTest 4: Protección contra importes negativos");
  insertedTransactions = [];
  const tx4 = await affiliationBonus.payDirectAffiliationBonus({
    sponsor: activeSponsor,
    affiliationId: "aff_4",
    newMemberId: "user_ana",
    bonusAmount: -50,
    Transaction: mockTransaction,
    Affiliation: mockAffiliation,
    rand,
  });
  assert.strictEqual(tx4, null, "No debe generar transacción con monto negativo");
  assert.strictEqual(insertedTransactions.length, 0, "No debe insertar transacciones");
  console.log("✓ Test 4 PASÓ: Monto negativo protegido");

  // Test Case 5: Default fallback to 120 when undefined
  console.log("\nTest 5: Fallback por defecto a 120 Bs si no está definido");
  insertedTransactions = [];
  const tx5 = await affiliationBonus.payDirectAffiliationBonus({
    sponsor: activeSponsor,
    affiliationId: "aff_5",
    newMemberId: "user_luis",
    bonusAmount: undefined,
    Transaction: mockTransaction,
    Affiliation: mockAffiliation,
    rand,
  });
  assert(tx5 !== null, "Debe retornar id de transacción");
  assert.strictEqual(insertedTransactions[0].value, 120, "Debe aplicar valor por defecto de 120");
  console.log("✓ Test 5 PASÓ: Fallback a 120 Bs correcto");

  console.log("\n=== TODOS LOS TESTS PASARON EXITOSAMENTE ===");
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
