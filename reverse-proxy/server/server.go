package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"reverse-proxy/config"
	"sync"
	"time"
)

type Server struct {
	Targets []*url.URL
	Proxies map[string]*httputil.ReverseProxy
	Target  *url.URL
	mu      sync.RWMutex
	curr    int
}

func NewServer(conf config.Config) (*Server, error) {
	targets := make([]*url.URL, 0, len(conf.Targets))
	proxies := make(map[string]*httputil.ReverseProxy)

	for _, t := range conf.Targets {
		u, err := url.Parse(t)
		if err != nil {
			return nil, err
		}

		err = healthCheck(u)

		if err != nil {
			return nil, err
		}

		targets = append(targets, u)
		proxies[u.String()] = httputil.NewSingleHostReverseProxy(u)
	}

	srv := &Server{
		Targets: targets,
		Proxies: proxies,
		curr:    0,
	}

	srv.Target = targets[0]

	go srv.healthCheckLoop(time.Duration(conf.Interval) * time.Second)

	return srv, nil
}

func healthCheck(target *url.URL) error {
	ctx := context.TODO()
	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("%s/health/", target), nil)
	if err != nil {
		return err
	}

	client := &http.Client{
		Timeout: 5 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("received code %d instead of 200", resp.StatusCode)
	}

	return nil
}

func (s *Server) healthCheckLoop(interval time.Duration) {
	for {
		var target *url.URL

		time.Sleep(interval)

		err := healthCheck(s.Target)

		if err != nil {
			for err != nil {
				s.mu.Lock()
				s.curr++
				target = s.Targets[s.curr%len(s.Targets)]
				s.mu.Unlock()

				err = healthCheck(target)
			}

			s.mu.Lock()
			log.Printf("Switching active target to: %s", target)
			s.Target = target
			s.mu.Unlock()
		}

	}
}

func (s *Server) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		target := s.Target
		proxy := s.Proxies[target.String()]
		s.mu.RUnlock()
		log.Printf("Proxying request: %s -> %s", r.URL, target)
		proxy.ServeHTTP(w, r)
	})
}
