package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

type Route struct {
	Path    string   `yaml:"path"`
	Methods []string `yaml:"methods"`
}

type Config struct {
	Routes   []Route  `yaml:"routes"`
	Targets  []string `yaml:"targets"`
	Interval int      `yaml:"interval"`
}

func NewConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}
