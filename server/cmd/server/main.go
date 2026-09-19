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

	"github.com/rossgsy/fifth-omen/server/internal/game"
	"github.com/rossgsy/fifth-omen/server/internal/httpapi"
	"github.com/rossgsy/fifth-omen/server/internal/roomstore"
	"github.com/rossgsy/fifth-omen/server/internal/rules"
)

var gitCommit = "unknown"

func main() {
	logger := log.New(os.Stdout, "fifth-omen-server ", log.LstdFlags|log.LUTC|log.Lshortfile)
	startupCtx, startupCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer startupCancel()

	redisAddr := env("REDIS_ADDR", "redis:6379")
	manager, err := loadManager(startupCtx, redisAddr)
	if err != nil {
		logger.Fatalf("load rooms from redis %s: %v", redisAddr, err)
	}
	catalog, err := rules.Load()
	if err != nil {
		logger.Fatalf("load game rules: %v", err)
	}

	addr := env("HTTP_ADDR", ":8080")
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminPassword == "" {
		logger.Print("admin endpoints disabled: ADMIN_PASSWORD is not set")
	}
	server := &http.Server{
		Addr:              addr,
		Handler:           httpapi.NewRouter(logger, manager, adminPassword, catalog),
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

func loadManager(ctx context.Context, redisAddr string) (*game.Manager, error) {
	store := roomstore.NewRedisStore(redisAddr)
	var lastErr error
	for {
		manager, err := game.NewManagerWithStore(ctx, store)
		if err == nil {
			return manager, nil
		}
		lastErr = err

		select {
		case <-ctx.Done():
			return nil, lastErr
		case <-time.After(250 * time.Millisecond):
		}
	}
}
