package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rossgsy/fifth-omen/server/internal/httpapi"
)

var gitCommit = "unknown"

func main() {
	logger := log.New(os.Stdout, "fifth-omen-server ", log.LstdFlags|log.LUTC|log.Lshortfile)

	addr := env("HTTP_ADDR", ":8080")
	server := &http.Server{
		Addr:              addr,
		Handler:           httpapi.NewRouter(logger),
		ReadHeaderTimeout: 5 * time.Second,
	}

	errs := make(chan error, 1)
	go func() {
		logger.Printf("listening on %s commit=%s", addr, gitCommit)
		errs <- server.ListenAndServe()
	}()

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)

	select {
	case sig := <-signals:
		logger.Printf("received signal %s; shutting down", sig)
	case err := <-errs:
		if !errors.Is(err, http.ErrServerClosed) {
			logger.Fatalf("server error: %v", err)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Fatalf("graceful shutdown failed: %v", err)
	}
}

func env(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
