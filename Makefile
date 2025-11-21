.PHONY: build clean deploy

ifeq ($(STAGE),)
STAGE := dev
endif

build:
	#env GOOS=linux go build -ldflags="-s -w" -o bin/client cmd/client/main.go
	env GOOS=linux go build -ldflags="-s -w" -o bin/api cmd/api/main.go
	npm run build

clean:
	rm -rf ./bin
	rm -rf ./build

package:
	mkdir -p build
	zip build/package.zip -r dist -r bin -x \*.DS_Store

deploy: clean build package
	sls deploy --verbose --stage $(STAGE)

deployClient:
	sls s3deploy --verbose --stage $(STAGE)

dev:
	# load .env file, make sure to export the variables to the environment
	export $(cat .env | xargs)
	go run cmd/api/main.go