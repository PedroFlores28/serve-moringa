package engine

import (
	"sifrah/cierre_engine/models"
)

// ApplyResidualVolumes agrega por usuario la base en Bs para residuales:
// Σ (cantidad × ganancia_residual del producto) en activaciones aprobadas.
func (e *CierreEngine) ApplyResidualVolumes(products []models.Product, activations []models.Activation) {
	byID := make(map[string]float64)
	byCode := make(map[string]float64)
	for _, p := range products {
		if p.ID != "" {
			byID[p.ID] = p.ResidualProfit
		}
		if p.Code != "" {
			byCode[p.Code] = p.ResidualProfit
		}
	}

	lineProfit := func(line models.ActivationLine) float64 {
		if line.ResidualProfit > 0 {
			return line.ResidualProfit
		}
		if line.ID != "" {
			if v, ok := byID[line.ID]; ok {
				return v
			}
		}
		if line.Code != "" {
			if v, ok := byCode[line.Code]; ok {
				return v
			}
		}
		return 0
	}

	for _, act := range activations {
		if act.Status != "" && act.Status != "approved" {
			continue
		}
		u, ok := e.Users[act.UserID]
		if !ok {
			continue
		}
		for _, line := range act.Products {
			qty := line.Total
			if qty <= 0 {
				continue
			}
			profit := lineProfit(line)
			if profit <= 0 {
				continue
			}
			u.ResidualVolume += qty * profit
		}
	}
}

// EffectiveResidualBase — volumen en Bs para residual; si no hay ganancias configuradas, usa PR (puntos).
func EffectiveResidualBase(user *models.User) float64 {
	if user == nil {
		return 0
	}
	if user.ResidualVolume > 0 {
		return user.ResidualVolume
	}
	return user.Points
}
