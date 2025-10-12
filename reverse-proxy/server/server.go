package server

import (
	"net/http"
	"reverse-proxy/config"
	"time"
)

type Server struct {
	proxy     *proxy
	websocket *socketHandler
	config    config.Config
}

func NewServer(conf config.Config) (*Server, error) {
	logger := make(chan string, 1)
	proxy, err := NewProxy(conf.Targets, logger)

	if err != nil {
		return nil, err
	}

	s := &Server{
		proxy:     proxy,
		websocket: NewWebsocketHandler(logger),
		config:    conf,
	}

	return s, nil
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {

	mux := http.NewServeMux()

	mux.Handle("/", s.proxy)
	mux.Handle("/log", s.websocket)

	go s.proxy.healthCheckLoop(time.Duration(s.config.Interval) * time.Second)

	mux.ServeHTTP(w, r)
}
