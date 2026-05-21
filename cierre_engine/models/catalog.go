package models

// Product — catálogo (ganancia por residual en Bs por unidad).
type Product struct {
	ID             string  `bson:"id" json:"id"`
	Code           string  `bson:"code" json:"code"`
	ResidualProfit float64 `bson:"residual_profit" json:"residual_profit"`
}

// ActivationLine — línea de producto en una activación aprobada.
type ActivationLine struct {
	ID             string  `bson:"id,omitempty" json:"id,omitempty"`
	Code           string  `bson:"code,omitempty" json:"code,omitempty"`
	Total          float64 `bson:"total" json:"total"`
	ResidualProfit float64 `bson:"residual_profit,omitempty" json:"residual_profit,omitempty"`
}

// Activation — compra / reconsumo aprobado.
type Activation struct {
	UserID   string           `bson:"userId" json:"userId"`
	Status   string           `bson:"status" json:"status"`
	Products []ActivationLine `bson:"products" json:"products"`
}
