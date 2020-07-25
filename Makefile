.PHONY: build clean deploy

ifeq ($(STAGE),)
STAGE := dev
endif

build:
	#env GOOS=linux go build -ldflags="-s -w" -o bin/client cmd/client/main.go
	env GOOS=linux go build -ldflags="-s -w" -o bin/api cmd/api/main.go

clean:
	rm -rf ./bin

deploy: clean build
	sls deploy --verbose --stage $(STAGE)

deployClient:
	sls s3deploy --verbose --stage $(STAGE)
