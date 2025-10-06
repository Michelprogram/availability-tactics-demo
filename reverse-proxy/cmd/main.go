package main

import (
	"flag"
	"log"
	"net/http"
	"reverse-proxy/config"
	"reverse-proxy/server"
)

func main() {

	var port string
	flag.StringVar(&port, "port", "8021", "port")

	flag.Parse()

	conf, err := config.NewConfig("config.yaml")

	if err != nil {
		log.Fatalln(err)
	}

	srv, err := server.NewServer(*conf)
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("Reverse proxy up and running :%s\nWith targets: %v", port, srv.Targets)
	http.Handle("/", srv.Handler())
	err = http.ListenAndServe(":"+port, nil)

	if err != nil {
		log.Fatal(err)
	}
}
