package engine

import (
	"fmt"
	"math"
	"sort"
	"sifrah/cierre_engine/models"
)

type CierreEngine struct {
	Users        map[string]*models.User
	TreeNodes    map[string]*models.TreeNode
	MemoPoints   map[string]float64
	MemoProducts map[string]float64
	MemoRanks    map[string]string
	Logger       *CierreLogger
}

func NewCierreEngine(users []models.User, treeNodes []models.TreeNode, logger *CierreLogger) *CierreEngine {
	userMap := make(map[string]*models.User)
	for i := range users {
		// Copia del usuario para que los resets del loop principal en main.go
		// (user.Points=0, etc.) no corrompan los datos del engine durante el cálculo.
		u := users[i]
		userMap[u.ID] = &u
	}

	treeMap := make(map[string]*models.TreeNode)
	for i := range treeNodes {
		treeMap[treeNodes[i].ID] = &treeNodes[i]
	}

	return &CierreEngine{
		Users:        userMap,
		TreeNodes:    treeMap,
		MemoPoints:   make(map[string]float64),
		MemoProducts: make(map[string]float64),
		MemoRanks:    make(map[string]string),
		Logger:       logger,
	}
}

// CalculateTotalPoints calculates the raw points (personal + children) for a node
func (e *CierreEngine) CalculateTotalPoints(id string) float64 {
	if val, ok := e.MemoPoints[id]; ok {
		return val
	}

	user, ok := e.Users[id]
	if !ok {
		return 0
	}

	total := user.Points + user.AffiliationPoints

	treeNode, ok := e.TreeNodes[id]
	if ok {
		for _, childID := range treeNode.Childs {
			total += e.CalculateTotalPoints(childID)
		}
	}

	e.MemoPoints[id] = total
	return total
}

func (e *CierreEngine) GetActiveLines(id string) int {
	treeNode, ok := e.TreeNodes[id]
	if !ok {
		return 0
	}

	count := 0
	for _, childID := range treeNode.Childs {
		childPoints := e.CalculateTotalPoints(childID)
		if childPoints > 0 {
			count++
		}
	}
	return count
}

func (e *CierreEngine) CalculateTotalProducts(id string) float64 {
	if val, ok := e.MemoProducts[id]; ok {
		return val
	}

	user, ok := e.Users[id]
	if !ok {
		return 0
	}

	total := user.PersonalProductCount

	treeNode, ok := e.TreeNodes[id]
	if ok {
		for _, childID := range treeNode.Childs {
			total += e.CalculateTotalProducts(childID)
		}
	}

	e.MemoProducts[id] = total
	return total
}

func (e *CierreEngine) HasRankInDownline(nodeID string, rankTarget string) bool {
	nodeRank := e.MemoRanks[nodeID]
	if nodeRank == rankTarget {
		return true
	}
	
	targetPos := GetRankPos(rankTarget)
	if GetRankPos(nodeRank) >= targetPos {
		return true
	}

	treeNode, ok := e.TreeNodes[nodeID]
	if ok {
		for _, childID := range treeNode.Childs {
			if e.HasRankInDownline(childID, rankTarget) {
				return true
			}
		}
	}
	return false
}

func (e *CierreEngine) CheckDependencies(id string, deps []RankDependency) bool {
	if len(deps) == 0 {
		return true
	}
	
	treeNode, ok := e.TreeNodes[id]
	if !ok {
		return false
	}

	for _, dep := range deps {
		count := 0
		for _, childID := range treeNode.Childs {
			if e.HasRankInDownline(childID, dep.RankName) {
				count++
			}
		}
		if count < dep.Minimum {
			return false
		}
	}
	return true
}

func (e *CierreEngine) CalculateRank(id string) string {
	if rank, ok := e.MemoRanks[id]; ok {
		return rank
	}

	user, ok := e.Users[id]
	if !ok || !user.Activated {
		e.MemoRanks[id] = "none"
		return "none"
	}

	treeNode, ok := e.TreeNodes[id]
	if !ok {
		e.MemoRanks[id] = "ACTIVO"
		return "ACTIVO"
	}

	// Bottom-up recursion
	for _, childID := range treeNode.Childs {
		e.CalculateRank(childID)
	}

	var legs []float64
	for _, childID := range treeNode.Childs {
		p := e.CalculateTotalProducts(childID)
		if p > 0 {
			legs = append(legs, p)
		}
	}
	sort.Slice(legs, func(i, j int) bool {
		return legs[i] > legs[j]
	})

	if e.Logger != nil {
		e.Logger.LogRank("DEBUG PRODS - %s %s : total_prods (RAW)=%.2f, piernas=%v", user.Name, user.LastName, e.CalculateTotalProducts(id), legs)
	}

	activeLines := len(legs)
	reconsumo := math.Max(user.Points, user.AffiliationPoints)

	for _, r := range Ranks {
		if r.TypeCalculation != "simple" {
			continue
		}

		if reconsumo < r.ReconsumoRequired {
			continue
		}

		if activeLines < r.MinimumFrontals {
			continue
		}

		if !e.CheckDependencies(id, r.RankDependencies) {
			continue
		}

		totalWithVMP := 0.0
		puntosPersonales := user.PersonalProductCount

		calcLegs := make([]float64, len(legs))
		copy(calcLegs, legs)

		if len(calcLegs) > 0 {
			calcLegs[len(calcLegs)-1] += puntosPersonales
		} else {
			totalWithVMP = puntosPersonales
			if r.MaximumLargeLeg > 0 && totalWithVMP > r.MaximumLargeLeg {
				totalWithVMP = r.MaximumLargeLeg
			}
		}

		if len(calcLegs) > 0 {
			vmp := r.MaximumLargeLeg
			for _, legVal := range calcLegs {
				if vmp > 0 && legVal > vmp {
					totalWithVMP += vmp
				} else {
					totalWithVMP += legVal
				}
			}
		}

		if totalWithVMP >= r.ThresholdPoints {
			if e.Logger != nil {
				e.Logger.LogRank(" ✅ RANGO ALCANZADO: %s para %s %s (Productos con VMP: %.2f)", r.Rank, user.Name, user.LastName, totalWithVMP)
			}
			user.TotalProductCount = totalWithVMP
			e.MemoRanks[id] = r.Rank
			return r.Rank
		}
	}

	e.MemoRanks[id] = "ACTIVO"
	return "ACTIVO"
}

// closedRank es el rango calculado en ESTE cierre (CalculateRank). El residual debe usar ese rango,
// no user.Rank de la BD: si alguien cierra BRONCE pero en BD seguía PLATA, antes se pagaban 5 niveles por error.
func (e *CierreEngine) CalculateResidualBonus(id string, closedRank string) ([]models.Transaction, float64) {
	user, ok := e.Users[id]
	if !ok {
		return nil, 0
	}
	if closedRank == "none" || closedRank == "" {
		return nil, 0
	}

	normRank := NormalizeRankKeyForResidual(closedRank)
	if e.Logger != nil {
		e.Logger.LogResidual("📊 %s %s (rango cierre=%q → residual %q; rank BD=%q)", user.Name, user.LastName, closedRank, normRank, user.Rank)
	}

	maxDepth := ResidualMaxDepth(normRank)
	percentages := ResidualPercentagesByRank[normRank]

	if maxDepth == 0 || len(percentages) == 0 {
		return nil, 0
	}

	var results []models.Transaction
	var total float64

	// Recursive helper: nivel comprimido dinámicamente.
	// Si un nodo intermedio tiene PR=0, se salta (no cuenta como nivel).
	// Esto permite que un afiliado a nivel 5 del árbol sea nivel 3 efectivo
	// si hay 2 nodos intermedios con PR=0.
	var collect func(nodeID string, currentLevel int)
	collect = func(nodeID string, currentLevel int) {
		if currentLevel >= maxDepth {
			return
		}

		node, ok := e.TreeNodes[nodeID]
		if !ok {
			return
		}

		for _, childID := range node.Childs {
			child, childOk := e.Users[childID]
			if !childOk {
				continue
			}

			pr := EffectiveResidualBase(child)

			// Sin compresión dinámica: se incrementa el nivel en cada salto del árbol
			// independientemente de si el usuario compró o no (profundidad real estricta).
			nextLevel := currentLevel + 1

			// Respetar tope del rango (p. ej. BRONCE = 4 niveles).
			if nextLevel > maxDepth {
				continue
			}

			if pr > 0 && nextLevel <= len(percentages) {
				pct := percentages[nextLevel-1]
				if pct > 0 {
					bonus := 0.0
					if pr <= TopePuntos {
						bonus = pr * pct
					} else {
						bonus = (TopePuntos * pct) + ((pr - TopePuntos) * (pct * ReduccionExceso))
					}

					if bonus > 0 {
						if e.Logger != nil {
							if child.ResidualVolume > 0 {
								e.Logger.LogResidual("   Nivel %d: %s %s (Vol. residual: %.2f Bs) → %.2f", nextLevel, child.Name, child.LastName, pr, bonus)
							} else {
								e.Logger.LogResidual("   Nivel %d: %s %s (PR: %.2f) → %.2f", nextLevel, child.Name, child.LastName, pr, bonus)
							}
						}
						total += bonus
						results = append(results, models.Transaction{
							Type:          "in",
							Value:         bonus,
							Name:          "residual bonus",
							Desc:          fmt.Sprintf("Bono residual nivel %d - %s %s", nextLevel, child.Name, child.LastName),
							FromUserID:    child.ID,
							Level:         nextLevel,
							AffiliateName: child.Name + " " + child.LastName,
							AffiliateDNI:  child.DNI,
							PR:            pr,
							Percentage:    pct,
						})
					}
				}
			}

			collect(childID, nextLevel)
		}
	}

	collect(id, 0)
	if e.Logger != nil && total > 0 {
		e.Logger.LogResidual("   💰 Total bono residual: %.2f", total)
	}
	return results, total
}

func (e *CierreEngine) CalculateGenerationalBonus(id string, closedRank string, closedRanksMap map[string]string) ([]models.Transaction, float64) {
	_, ok := e.Users[id]
	if !ok || closedRank == "none" || closedRank == "" {
		return nil, 0
	}

	normRank := NormalizeRankKeyForResidual(closedRank)
	config, hasConfig := GenerationalBonusByRank[normRank]
	if !hasConfig {
		return nil, 0
	}

	var results []models.Transaction
	var total float64

	var collect func(nodeID string, currentGen int)
	collect = func(nodeID string, currentGen int) {
		if currentGen > config.MaxGenerations {
			return
		}

		node, ok := e.TreeNodes[nodeID]
		if !ok {
			return
		}

		for _, childID := range node.Childs {
			child, childOk := e.Users[childID]
			if !childOk {
				continue
			}

			childRank := closedRanksMap[childID]
			childRankPos := GetRankPos(childRank)

			// El hijo pertenece a la generación actual
			genToPay := currentGen
			if genToPay > 0 && genToPay <= config.MaxGenerations && genToPay <= len(config.Percentages) {
				pr := child.Points
				if pr > 0 {
					pct := config.Percentages[genToPay-1]
					bonus := 0.0
					if pr <= TopePuntos {
						bonus = pr * pct
					} else {
						bonus = (TopePuntos * pct) + ((pr - TopePuntos) * (pct * ReduccionExceso))
					}

					if bonus > 0 {
						if e.Logger != nil {
							e.Logger.LogResidual("   Gen VIP %d: %s %s (PR: %.2f) → %.2f", genToPay, child.Name, child.LastName, pr, bonus)
						}
						total += bonus
						results = append(results, models.Transaction{
							Type:          "in",
							Value:         bonus,
							Name:          "generational bonus vip",
							Desc:          fmt.Sprintf("Bono generacional VIP G%d - %s %s", genToPay, child.Name, child.LastName),
							FromUserID:    child.ID,
							Level:         genToPay, // Guardamos la generación en Level
							AffiliateName: child.Name + " " + child.LastName,
							AffiliateDNI:  child.DNI,
							PR:            pr,
							Percentage:    pct,
						})
					}
				}
			}

			// Regla de corte: si el hijo tiene rango >= al de corte, sus hijos inician la siguiente generación
			nextGen := currentGen
			if childRankPos >= config.CutOffRankPos {
				nextGen = currentGen + 1
			}

			collect(childID, nextGen)
		}
	}

	collect(id, 1)

	if e.Logger != nil && total > 0 {
		e.Logger.LogResidual("   💎 Total bono generacional VIP: %.2f", total)
	}
	return results, total
}

func (e *CierreEngine) CalculateExcedentBonus(id string) []models.Transaction {
	user, ok := e.Users[id]
	if !ok {
		return nil
	}

	var txs []models.Transaction

	// Excedent bonus logic: 10% to sponsor, 20% to self if > 150 points
	// Node.js logic:
	// const excedent = node.points - 150
	// if(excedent > 0) { ... }
	
	excedent := user.Points - 150
	if excedent <= 0 {
		return nil
	}

	// 20% to self
	if user.Activated {
		val := excedent * 0.20
		txs = append(txs, models.Transaction{
			UserID: user.ID,
			Type:   "in",
			Value:  val,
			Name:   "excedent bonus",
			Desc:   "Bono excedente personal",
		})
	}

	// 10% to sponsor
	if user.ParentID != "" {
		parent, ok := e.Users[user.ParentID]
		if ok && parent.Activated {
			val := excedent * 0.10
			txs = append(txs, models.Transaction{
				UserID:     parent.ID,
				FromUserID: user.ID,
				Type:       "in",
				Value:      val,
				Name:       "excedent bonus",
				Desc:       fmt.Sprintf("Bono excedente de %s %s", user.Name, user.LastName),
			})
		}
	}

	return txs
}

func (e *CierreEngine) CalculateSavingsBonus(id string) ([]models.Transaction, float64) {
	user, ok := e.Users[id]
	if !ok {
		return nil, 0
	}
	
	pct := 0.0
	switch user.Plan {
	case "basic": // Ejecutivo
		pct = 0.21
	case "standard": // Distribuidor
		pct = 0.30
	case "master": // Empresario
		pct = 0.40
	default:
		return nil, 0
	}

	adicionales := 0.0
	if user.AffiliationPoints > 0 {
		adicionales = user.Points
	} else {
		adicionales = user.Points - 160
	}

	if adicionales <= 0 {
		return nil, 0
	}

	bonus := adicionales * pct
	if bonus <= 0 {
		return nil, 0
	}

	if e.Logger != nil {
		e.Logger.LogResidual("   Ahorro: %s %s (Pts Extras: %.2f) → %.2f", user.Name, user.LastName, adicionales, bonus)
	}

	tx := models.Transaction{
		Type:       "in",
		Value:      bonus,
		Name:       "bono ahorro sifrah",
		Desc:       fmt.Sprintf("Bono ahorro Sifrah (%.2f pts extra al %.0f%%)", adicionales, pct*100),
		FromUserID: user.ID,
		WalletType: "BONO_AHORRO",
		Virtual:    false,
	}

	return []models.Transaction{tx}, bonus
}
