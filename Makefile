.PHONY: build clean deploy docker-build docker-run docker-stop docker-clean docker-push docker-dev npm-install npm-update

ifeq ($(STAGE),)
STAGE := dev
endif

# Docker variables
IMAGE_NAME ?= exquisitecorpse-api
IMAGE_TAG ?= latest
DOCKER_REGISTRY ?= 
CONTAINER_NAME ?= exquisitecorpse-api
PORT ?= 8080

# NPM targets

# Install npm dependencies
npm-install:
	npm install

# Update npm dependencies and rebuild lock file
npm-update:
	rm -f package-lock.json
	npm install
	@echo "Dependencies updated. Review package-lock.json changes."

build:
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

# Docker targets

# Build the Docker image
docker-build:
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .

# Build for AMD64 (x86_64) - useful for cloud deployment from ARM Macs
docker-build-amd64:
	docker build --platform linux/amd64 -t $(IMAGE_NAME):$(IMAGE_TAG) .

# Build for ARM64 - useful for ARM-based servers or local Apple Silicon
docker-build-arm64:
	docker build --platform linux/arm64 -t $(IMAGE_NAME):$(IMAGE_TAG) .

# Build with no cache (for clean builds)
docker-build-no-cache:
	docker build --no-cache -t $(IMAGE_NAME):$(IMAGE_TAG) .

# Run the Docker container
docker-run:
	docker run -d \
		--name $(CONTAINER_NAME) \
		-p $(PORT):8080 \
		-e PORT=8080 \
		-e HOSTNAME=$${HOSTNAME:-https://playexquisitecorpse.com} \
		-e AWS_REGION=$${AWS_REGION:-us-east-1} \
		-e imageBucket=$${imageBucket} \
		-e galleryBucket=$${galleryBucket} \
		-e AWS_ACCESS_KEY=$${AWS_ACCESS_KEY} \
		-e AWS_SECRET_KEY=$${AWS_SECRET_KEY} \
		$(IMAGE_NAME):$(IMAGE_TAG)
	@echo "Container $(CONTAINER_NAME) started on port $(PORT)"
	@echo "Health check: curl http://localhost:$(PORT)/"

# Run in foreground (useful for debugging)
docker-run-fg:
	docker run --rm \
		--name $(CONTAINER_NAME) \
		-p $(PORT):8080 \
		--env-file .env \
		$(IMAGE_NAME):$(IMAGE_TAG)

# Run with environment file
docker-run-env:
	@if [ ! -f .env ]; then \
		echo "Error: .env file not found"; \
		exit 1; \
	fi
	docker run -d \
		--name $(CONTAINER_NAME) \
		-p $(PORT):8080 \
		--env-file .env \
		$(IMAGE_NAME):$(IMAGE_TAG)
	@echo "Container $(CONTAINER_NAME) started on port $(PORT) with .env file"

# Stop the running container
docker-stop:
	docker stop $(CONTAINER_NAME) || true
	docker rm $(CONTAINER_NAME) || true

# View container logs
docker-logs:
	docker logs -f $(CONTAINER_NAME)

# Shell into the running container
docker-shell:
	docker exec -it $(CONTAINER_NAME) /bin/sh

# Clean up Docker resources
docker-clean: docker-stop
	docker rmi $(IMAGE_NAME):$(IMAGE_TAG) || true

# Tag image for registry
docker-tag:
	@if [ -z "$(DOCKER_REGISTRY)" ]; then \
		echo "Error: DOCKER_REGISTRY not set"; \
		exit 1; \
	fi
	docker tag $(IMAGE_NAME):$(IMAGE_TAG) $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)

# Push to registry
docker-push: docker-tag
	@if [ -z "$(DOCKER_REGISTRY)" ]; then \
		echo "Error: DOCKER_REGISTRY not set"; \
		exit 1; \
	fi
	docker push $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)

# Build and run (development workflow)
docker-dev: docker-stop docker-build docker-run-fg

# Full production build and push
docker-release: docker-build-no-cache docker-push

# Show container status
docker-status:
	@docker ps -a | grep $(CONTAINER_NAME) || echo "Container not running"

# Health check
docker-health:
	@curl -f http://localhost:$(PORT)/ && echo "\nHealth check passed" || echo "\nHealth check failed"