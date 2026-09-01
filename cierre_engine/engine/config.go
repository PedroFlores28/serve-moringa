package engine

import (
	"strings"
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
	ThresholdProducts float64          `json:"threshold_products"`
	RequiredLegs      int              `json:"required_legs"`
	RequiredRankPos   int              `json:"required_rank_pos"`
	RequiredCycles    int              `json:"required_cycles"`
	MaximumLargeLeg   float64          `json:"maximum_large_leg"`
	MaximumOthersLeg  float64          `json:"maximum_others_leg"`
	ReconsumoRequired float64          `json:"reconsumo_required"`
	RankDependencies  []RankDependency `json:"rank_dependencies"`
}

var Ranks = []Rank{
	{
		Pos:               9,
		Rank:              "EMBAJADOR CLASS",
		ThresholdProducts: 35000,
		RequiredLegs:      3,
		RequiredRankPos:   8,
		RequiredCycles:    6,
	},
	{
		Pos:               8,
		Rank:              "DIAMANTE CORONA",
		ThresholdProducts: 30000,
		RequiredLegs:      3,
		RequiredRankPos:   7,
		RequiredCycles:    6,
	},
	{
		Pos:               7,
		Rank:              "DOBLE DIAMANTE",
		ThresholdProducts: 20000,
		RequiredLegs:      3,
		RequiredRankPos:   6,
		RequiredCycles:    6,
	},
	{
		Pos:               6,
		Rank:              "DIAMANTE",
		ThresholdProducts: 9000,
		RequiredLegs:      3,
		RequiredRankPos:   5,
		RequiredCycles:    6,
	},
	{
		Pos:               5,
		Rank:              "ESMERALDA",
		ThresholdProducts: 6000,
		RequiredLegs:      3,
		RequiredRankPos:   4,
		RequiredCycles:    4,
	},
	{
		Pos:               4,
		Rank:              "RUBÍ",
		ThresholdProducts: 2500,
		RequiredLegs:      2,
		RequiredRankPos:   3,
		RequiredCycles:    4,
	},
	{
		Pos:               3,
		Rank:              "ZAFIRO",
		ThresholdProducts: 1500,
		RequiredLegs:      2,
		RequiredRankPos:   2,
		RequiredCycles:    4,
	},
	{
		Pos:               2,
		Rank:              "ORO",
		ThresholdProducts: 500,
		RequiredLegs:      2,
		RequiredRankPos:   1,
		RequiredCycles:    4,
	},
	{
		Pos:               1,
		Rank:              "PLATA",
		ThresholdProducts: 200,
		RequiredLegs:      0,
		RequiredRankPos:   0,
		RequiredCycles:    4,
	},
	{
		Pos:               0,
		Rank:              "ACTIVO",
		ThresholdProducts: 0,
		RequiredLegs:      0,
		RequiredRankPos:   0,
		RequiredCycles:    0,
	},
}

var ResidualPercentagesByRank = map[string][]float64{
	"ACTIVO":            {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"BRONCE":            {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"PLATA":             {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"ORO":               {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"ZAFIRO":            {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"RUBÍ":              {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"ESMERALDA":         {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"DIAMANTE":          {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"DOBLE DIAMANTE":    {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"TRIPLE DIAMANTE":   {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"DIAMANTE IMPERIAL": {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"DIAMANTE CORONA":   {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
	"EMBAJADOR CLASS":   {0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05, 0.05},
}

type GenerationalConfig struct {
	CutOffRankPos  int
	MaxGenerations int
	Percentages    []float64
}

var GenerationalBonusByRank = map[string]GenerationalConfig{
	"PLATA":           {CutOffRankPos: 2, MaxGenerations: 2, Percentages: []float64{0.02, 0.01}}, 
	"ORO":             {CutOffRankPos: 3, MaxGenerations: 3, Percentages: []float64{0.02, 0.02, 0.01}}, 
	"ZAFIRO":          {CutOffRankPos: 4, MaxGenerations: 4, Percentages: []float64{0.02, 0.02, 0.02, 0.01}}, 
	"RUBÍ":            {CutOffRankPos: 5, MaxGenerations: 4, Percentages: []float64{0.02, 0.02, 0.02, 0.01}}, 
	"ESMERALDA":       {CutOffRankPos: 6, MaxGenerations: 5, Percentages: []float64{0.02, 0.02, 0.02, 0.01, 0.01}}, 
	"DIAMANTE":        {CutOffRankPos: 7, MaxGenerations: 5, Percentages: []float64{0.02, 0.02, 0.02, 0.01, 0.01}}, 
	"DOBLE DIAMANTE":  {CutOffRankPos: 8, MaxGenerations: 6, Percentages: []float64{0.02, 0.02, 0.02, 0.01, 0.01, 0.01}}, 
	"DIAMANTE CORONA": {CutOffRankPos: 9, MaxGenerations: 7, Percentages: []float64{0.02, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01}}, 
	"EMBAJADOR CLASS": {CutOffRankPos: 10, MaxGenerations: 7, Percentages: []float64{0.02, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01}}, 
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

var RankAchievementBonuses = map[string]float64{
	"PLATA":           1000,
	"ORO":             2000,
	"ZAFIRO":          5000,
	"RUBÍ":            10000,
	"ESMERALDA":       15000,
	"DIAMANTE":        40000,
	"DOBLE DIAMANTE":  70000,
	"DIAMANTE CORONA": 130000,
	"EMBAJADOR CLASS": 200000,
}

const (
	TopePuntos       = 160.0
	ReduccionExceso = 0.6
)

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
