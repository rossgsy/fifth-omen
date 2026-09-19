package rules

import (
	"encoding/json"
	"testing"
)

func TestLoadEmbeddedCatalog(t *testing.T) {
	catalog, err := Load()
	if err != nil {
		t.Fatalf("load catalog: %v", err)
	}
	if !json.Valid(catalog.Folio()) || !json.Valid(catalog.Playbooks()) {
		t.Fatal("catalog returned invalid JSON")
	}

	bundle := catalog.Bundle()
	var folio map[string]any
	if err := json.Unmarshal(bundle.Folio, &folio); err != nil {
		t.Fatalf("decode folio: %v", err)
	}
	if folio["name"] == "" {
		t.Fatal("folio name is empty")
	}
	var playbooks []any
	if err := json.Unmarshal(bundle.Playbooks, &playbooks); err != nil {
		t.Fatalf("decode playbooks: %v", err)
	}
	if len(playbooks) == 0 {
		t.Fatal("playbooks are empty")
	}
}
