package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"
	"time"
)

type proxy struct {
	Targets []*url.URL
	Proxies map[string]*httputil.ReverseProxy
	Target  *url.URL
	logger  chan<- string
	mu      sync.RWMutex
	curr    int
}

func NewProxy(targets []string, logger chan<- string) (*proxy, error) {
	targetsUrl := make([]*url.URL, 0, len(targets))
	proxies := make(map[string]*httputil.ReverseProxy)

	proxy := &proxy{
		logger: logger,
		curr:   0,
	}

	for _, t := range targets {
		u, err := url.Parse(t)
		if err != nil {
			return nil, err
		}

		err = healthCheck(u)

		if err != nil {
			return nil, err
		}

		targetsUrl = append(targetsUrl, u)
		proxies[u.String()] = httputil.NewSingleHostReverseProxy(u)
	}

	proxy.Targets = targetsUrl
	proxy.Proxies = proxies
	proxy.Target = targetsUrl[0]

	return proxy, nil
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

func (p *proxy) healthCheckLoop(interval time.Duration) {
	for {
		var target *url.URL

		time.Sleep(interval)

		err := healthCheck(p.Target)

		if err != nil {
			for err != nil {
				p.mu.Lock()
				p.curr++
				target = p.Targets[p.curr%len(p.Targets)]
				p.mu.Unlock()

				err = healthCheck(target)
			}

			p.mu.Lock()
			p.logger <- fmt.Sprintf("Switching active target to: %s", target)
			log.Printf("Switching active target to: %s", target)
			p.Target = target
			p.mu.Unlock()
		}

	}
}

func (p *proxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	p.mu.RLock()
	target := p.Target
	proxy := p.Proxies[target.String()]
	p.mu.RUnlock()
	p.logger <- fmt.Sprintf("Proxying request: %s -> %s", r.URL, target)
	log.Printf("Proxying request: %s -> %s", r.URL, target)
	proxy.ServeHTTP(w, r)
}
