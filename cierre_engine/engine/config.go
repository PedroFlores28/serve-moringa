package engine

import (
	"strings"

	"sifrah/cierre_engine/models"
)

type RankDependency struct {
	Minimum    int    `json:"minimum"`
	DiffBranch bool   `json:"diff_branch"`
	RankName   string `json:"rank_name"`
}

type Rank struct {
	Pos               int              `json:"pos"`
	Rank              string           `json:"rank"`
	TypeCalculation   string           `json:"type_calculation"`
	MinimumFrontals   int              `json:"minimum_frontals"`
	ThresholdPoints   float64          `json:"threshold_points"` // Usado ahora para CANTIDAD DE PRODUCTOS
	MaximumLargeLeg   float64          `json:"maximum_large_leg"`
	MaximumOthersLeg  float64          `json:"maximum_others_leg"`
	ReconsumoRequired float64          `json:"reconsumo_required"`
	RankDependencies  []RankDependency `json:"rank_dependencies"`
}

var Ranks = []Rank{
	{
		Pos:               10,
		Rank:              "EMBAJADOR CLASS",
		TypeCalculation:   "simple",
		MinimumFrontals:   3,
		ThresholdPoints:   35000,
		MaximumLargeLeg:   0,
		MaximumOthersLeg:  0,
		ReconsumoRequired: 160,
		RankDependencies: []RankDependency{
			{Minimum: 3, DiffBranch: true, RankName: "DIAMANTE CORONA"},
		},
	},
	{
		Pos:               9,
		Rank:              "DIAMANTE CORONA",
		TypeCalculation:   "simple",
		MinimumFrontals:   3,
		ThresholdPoints:   30000,
		MaximumLargeLeg:   0,
		MaximumOthersLeg:  0,
		ReconsumoRequired: 160,
		RankDependencies: []RankDependency{
			{Minimum: 3, DiffBranch: true, RankName: "DOBLE DIAMANTE"},
		},
	},
	{
		Pos:               8,
		Rank:              "DOBLE DIAMANTE",
		TypeCalculation:   "simple",
		MinimumFrontals:   3,
		ThresholdPoints:   20000,
		MaximumLargeLeg:   0,
		MaximumOthersLeg:  0,
		ReconsumoRequired: 160,
		RankDependencies: []RankDependency{
			{Minimum: 3, DiffBranch: true, RankName: "DIAMANTE"},
		},
	},
	{
		Pos:               7,
		Rank:              "DIAMANTE",
		TypeCalculation:   "simple",
		MinimumFrontals:   3,
		ThresholdPoints:   9000,
		MaximumLargeLeg:   0,
		MaximumOthersLeg:  0,
		ReconsumoRequired: 160,
		RankDependencies: []RankDependency{
			{Minimum: 3, DiffBranch: true, RankName: "ESMERALDA"},
		},
	},
	{
		Pos:               6,
		Rank:              "ESMERALDA",
		TypeCalculation:   "simple",
		MinimumFrontals:   3,
		ThresholdPoints:   6000,
		MaximumLargeLeg:   0,
		MaximumOthersLeg:  0,
		ReconsumoRequired: 160,
		RankDependencies: []RankDependency{
			{Minimum: 3, DiffBranch: true, RankName: "RUBÍ"},
		},
	},
	{
		Pos:               5,
		Rank:              "RUBÍ",
		TypeCalculation:   "simple",
		MinimumFrontals:   2,
		ThresholdPoints:   2500,
		MaximumLargeLeg:   0,
		MaximumOthersLeg:  0,
		ReconsumoRequired: 160,
		RankDependencies: []RankDependency{
			{Minimum: 2, DiffBranch: true, RankName: "ZAFIRO"},
		},
	},
	{
		Pos:               4,
		Rank:              "ZAFIRO",
		TypeCalculation:   "simple",
		MinimumFrontals:   2,
		ThresholdPoints:   1500,
		MaximumLargeLeg:   0,
		MaximumOthersLeg:  0,
		ReconsumoRequired: 160,
		RankDependencies: []RankDependency{
			{Minimum: 2, DiffBranch: true, RankName: "ORO"},
		},
	},
	{
		Pos:               3,
		Rank:              "ORO",
		TypeCalculation:   "simple",
		MinimumFrontals:   2,
		ThresholdPoints:   700,
		MaximumLargeLeg:   0,
		MaximumOthersLeg:  0,
		ReconsumoRequired: 160,
		RankDependencies: []RankDependency{
			{Minimum: 2, DiffBranch: true, RankName: "PLATA"},
		},
	},
	{
		Pos:               2,
		Rank:              "PLATA",
		TypeCalculation:   "simple",
		MinimumFrontals:   0,
		ThresholdPoints:   350,
		MaximumLargeLeg:   0,
		MaximumOthersLeg:  0,
		ReconsumoRequired: 160,
		RankDependencies:  []RankDependency{},
	},
	{
		Pos:               1,
		Rank:              "ACTIVO",
		TypeCalculation:   "simple",
		MinimumFrontals:   0,
		ThresholdPoints:   1, // o 0, asume 1 producto minimo para ser Activo
		MaximumLargeLeg:   0,
		MaximumOthersLeg:  0,
		ReconsumoRequired: 120,
		RankDependencies:  []RankDependency{},
	},
}

// ResidualPercentagesByRank — Bono regalías a 8 niveles fijos para todos.
var ResidualPercentagesByRank = map[string][]float64{
	"ACTIVO":           {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"BRONCE":           {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05}, // Legacy support
	"PLATA":            {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"ORO":              {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"ZAFIRO":           {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"RUBÍ":             {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"ESMERALDA":        {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"DIAMANTE":         {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"DOBLE DIAMANTE":   {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"TRIPLE DIAMANTE":  {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05}, // Legacy support
	"DIAMANTE IMPERIAL": {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05}, // Legacy support
	"DIAMANTE CORONA":  {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"EMBAJADOR CLASS":  {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
}

type GenerationalConfig struct {
	CutOffRankPos  int
	MaxGenerations int
	Percentages    []float64
}

// Generational percentages by rank (G1, G2, etc.) for the VIP Generational Bonus.
var GenerationalBonusByRank = map[string]GenerationalConfig{
	"PLATA":             {CutOffRankPos: 2, MaxGenerations: 2, Percentages: []float64{0.02, 0.01}}, 
	"ORO":               {CutOffRankPos: 3, MaxGenerations: 3, Percentages: []float64{0.02, 0.02, 0.01}}, 
	"ZAFIRO":            {CutOffRankPos: 4, MaxGenerations: 4, Percentages: []float64{0.02, 0.02, 0.02, 0.01}}, 
	"RUBÍ":              {CutOffRankPos: 5, MaxGenerations: 4, Percentages: []float64{0.02, 0.02, 0.02, 0.01}}, 
	"ESMERALDA":         {CutOffRankPos: 6, MaxGenerations: 5, Percentages: []float64{0.02, 0.02, 0.02, 0.01, 0.01}}, 
	"DIAMANTE":          {CutOffRankPos: 7, MaxGenerations: 5, Percentages: []float64{0.02, 0.02, 0.02, 0.01, 0.01}}, 
	"DOBLE DIAMANTE":    {CutOffRankPos: 8, MaxGenerations: 6, Percentages: []float64{0.02, 0.02, 0.02, 0.01, 0.01, 0.01}}, 
	"DIAMANTE CORONA":   {CutOffRankPos: 9, MaxGenerations: 7, Percentages: []float64{0.02, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01}}, 
	"EMBAJADOR CLASS":   {CutOffRankPos: 10, MaxGenerations: 7, Percentages: []float64{0.02, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01}}, 
}

var MaxDepthByRank = map[string]int{
	"none":              0,
	"ACTIVO":            8,
	"BRONCE":            8,
	"PLATA":             8,
	"ORO":               8,
	"ZAFIRO":            8,
	"RUBÍ":              8,
	"ESMERALDA":         8,
	"DIAMANTE":          8,
	"DOBLE DIAMANTE":    8,
	"TRIPLE DIAMANTE":   8,
	"DIAMANTE IMPERIAL": 8,
	"DIAMANTE CORONA":   8,
	"EMBAJADOR CLASS":   8,
}

var RankAchievementBonuses = []models.Pay{
	{Name: "BRONCE", Value: 60},
	{Name: "PLATA", Value: 300},
	{Name: "ORO", Value: 600},
	{Name: "ZAFIRO", Value: 900}, // Interpolated
	{Name: "RUBÍ", Value: 1200},
	{Name: "ESMERALDA", Value: 2500},
	{Name: "DIAMANTE", Value: 5000},
	{Name: "DOBLE DIAMANTE", Value: 10000},
	{Name: "DIAMANTE CORONA", Value: 20000}, // Adjusted
	{Name: "EMBAJADOR CLASS", Value: 40000}, // Adjusted
}

const (
	TopePuntos       = 160.0
	ReduccionExceso = 0.6
)

// NormalizeRankKeyForResidual alinea el string de Mongo con las claves de los mapas (mayúsculas, RUBÍ).
func NormalizeRankKeyForResidual(rank string) string {
	r := strings.TrimSpace(rank)
	if r == "" || strings.EqualFold(r, "none") {
		return ""
	}
	if strings.EqualFold(r, "RUBI") {
		return "RUBÍ"
	}
	if strings.EqualFold(r, "EMBAJADOR SIFRAH") {
		return "EMBAJADOR CLASS"
	}
	if _, ok := MaxDepthByRank[r]; ok {
		return r
	}
	u := strings.ToUpper(r)
	if _, ok := MaxDepthByRank[u]; ok {
		return u
	}
	if _, ok := ResidualPercentagesByRank[r]; ok {
		return r
	}
	if _, ok := ResidualPercentagesByRank[u]; ok {
		return u
	}
	return ""
}

func GetRankPos(rank string) int {
	norm := NormalizeRankKeyForResidual(rank)
	if norm == "ACTIVO" {
		return 0
	}
	for _, r := range Ranks {
		if r.Rank == norm {
			return r.Pos
		}
	}
	return 0
}

func ResidualMaxDepth(rank string) int {
	key := NormalizeRankKeyForResidual(rank)
	if key == "" {
		return 0
	}
	maxD, ok := MaxDepthByRank[key]
	if !ok {
		return 0
	}
	pcts, ok := ResidualPercentagesByRank[key]
	if !ok || len(pcts) == 0 {
		return 0
	}
	lastPay := 0
	for i, p := range pcts {
		if p > 0 {
			lastPay = i + 1
		}
	}
	if lastPay == 0 {
		return 0
	}
	if maxD < lastPay {
		return maxD
	}
	return lastPay
}