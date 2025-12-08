package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"time"
)

// Simple server that serves a JSON document describing pyramid relays at
// /pyramid-relays.json, /relay-info.json and /.well-known/pyramid-relays.
// It supports ETag and If-None-Match for caching.

func readDoc(path string) ([]byte, error) {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil, fmt.Errorf("file not found: %s", path)
	}
	return ioutil.ReadFile(path)
}

func computeETag(b []byte) string {
	h := sha256.Sum256(b)
	return `"` + hex.EncodeToString(h[:]) + `"`
}

func makeHandler(docPath string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var content []byte
		var err error
		if docPath != "" {
			content, err = readDoc(docPath)
			if err != nil {
				// fallback to embedded example
				sample := map[string]interface{}{
					"cache_max_age": 600,
					"relays": []map[string]interface{}{
						{"url": "wss://relay.nostr.band", "readable": true, "writable": true, "priority": 1},
						{"url": "wss://relay.damus.io", "readable": true, "writable": true, "priority": 2},
					},
				}
				content, _ = json.MarshalIndent(sample, "", "  ")
			}
		} else {
			// no path provided; use sample
			sample := map[string]interface{}{
				"cache_max_age": 600,
				"relays": []map[string]interface{}{
					{"url": "wss://relay.nostr.band", "readable": true, "writable": true, "priority": 1},
					{"url": "wss://relay.damus.io", "readable": true, "writable": true, "priority": 2},
				},
			}
			content, _ = json.MarshalIndent(sample, "", "  ")
		}

		etag := computeETag(content)
		if match := r.Header.Get("If-None-Match"); match != "" {
			if match == etag {
				w.WriteHeader(http.StatusNotModified)
				return
			}
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=0, must-revalidate")
		w.Header().Set("ETag", etag)
		w.Header().Set("Last-Modified", time.Now().UTC().Format(http.TimeFormat))
		_, _ = io.Copy(w, bytesReader(content))
	}
}

func bytesReader(b []byte) io.Reader {
	return &reader{b: b}
}

type reader struct{ b []byte }

func (r *reader) Read(p []byte) (int, error) {
	if len(r.b) == 0 {
		return 0, io.EOF
	}
	n := copy(p, r.b)
	r.b = r.b[n:]
	return n, nil
}

func main() {
	port := flag.Int("port", 8080, "port to listen on")
	file := flag.String("file", "pyramid-relays.json", "path to pyramid relays json file (optional)")
	flag.Parse()

	log.Printf("Starting pyramid-relays server on :%d (file=%s)", *port, *file)

	handler := makeHandler(*file)
	// serve at multiple endpoints for compatibility
	http.HandleFunc("/pyramid-relays.json", handler)
	http.HandleFunc("/relay-info.json", handler)
	http.HandleFunc("/.well-known/pyramid-relays", handler)

	addr := fmt.Sprintf(":%d", *port)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}
