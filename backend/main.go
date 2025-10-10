package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
)

func main() {
	var port string
	flag.StringVar(&port, "port", "8022", "port")

	flag.Parse()

	http.HandleFunc("/health/", func(w http.ResponseWriter, r *http.Request) {
		ip := getLocalIP()
		resp := map[string]interface{}{
			"status": "OK",
			"port":   port,
			"ip":     ip,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})

	http.HandleFunc("/data/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Backend %s: Here is your data\n", port)
	})

	http.HandleFunc("/fail/", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "Backend "+port+": Failure simulated", http.StatusInternalServerError)
	})

	http.HandleFunc("/recover/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Backend %s: Recovery successful\n", port)
	})

	log.Printf("Test backend listening on :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ""
	}
	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() && ipnet.IP.To4() != nil {
			return ipnet.IP.String()
		}
	}
	return ""
}
