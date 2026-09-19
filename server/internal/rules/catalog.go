package rules

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
)

//go:embed data/*.json
var data embed.FS

// Catalog contains immutable, server-owned game rules loaded at startup.
// Raw JSON is retained so clients receive the source data without lossy
// server-side schema conversions.
type Catalog struct {
	folio     json.RawMessage
	playbooks json.RawMessage
}

func Load() (*Catalog, error) {
	folio, err := loadObject("data/folio.json")
	if err != nil {
		return nil, err
	}
	playbooks, err := loadArray("data/playbooks.json")
	if err != nil {
		return nil, err
	}
	return &Catalog{folio: folio, playbooks: playbooks}, nil
}

func MustLoad() *Catalog {
	catalog, err := Load()
	if err != nil {
		panic(err)
	}
	return catalog
}

func (c *Catalog) Folio() json.RawMessage {
	return bytes.Clone(c.folio)
}

func (c *Catalog) Playbooks() json.RawMessage {
	return bytes.Clone(c.playbooks)
}

type Bundle struct {
	Folio     json.RawMessage `json:"folio"`
	Playbooks json.RawMessage `json:"playbooks"`
}

func (c *Catalog) Bundle() Bundle {
	return Bundle{Folio: c.Folio(), Playbooks: c.Playbooks()}
}

func loadObject(name string) (json.RawMessage, error) {
	raw, err := data.ReadFile(name)
	if err != nil {
		return nil, fmt.Errorf("load rules %s: %w", name, err)
	}
	var value map[string]json.RawMessage
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, fmt.Errorf("parse rules %s: %w", name, err)
	}
	return json.RawMessage(raw), nil
}

func loadArray(name string) (json.RawMessage, error) {
	raw, err := data.ReadFile(name)
	if err != nil {
		return nil, fmt.Errorf("load rules %s: %w", name, err)
	}
	var value []json.RawMessage
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, fmt.Errorf("parse rules %s: %w", name, err)
	}
	return json.RawMessage(raw), nil
}
