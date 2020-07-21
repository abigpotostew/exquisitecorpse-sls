package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/abigpotostew/exquisitecorpse-sls/internal/static"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/awslabs/aws-lambda-go-api-proxy/gin"
	"github.com/gin-gonic/gin"
)

var ginLambda *ginadapter.GinLambda

/**
- http:
          path: /
          method: get
      - http:
          path: /game/{id}
          method: get
      - http:
          path: /static/{proxy+}
          method: get
*/
func init() {
	sess := session.Must(session.NewSession())
	s3Sess := s3.New(sess)
	staticService := static.S3Service{S3: s3Sess, BucketName: os.Getenv("staticBucket")}

	// stdout and stderr are sent to AWS CloudWatch Logs
	log.Printf("Gin cold start")
	r := gin.Default()
	r.GET("/", func(c *gin.Context) {
		index, err := staticService.Get("index.html")
		if err != nil {
			c.AbortWithError(http.StatusInternalServerError, err)
			return
		}

		c.Data(200, index.ContentType, index.Data)
	})

	r.GET("/game/:id", func(c *gin.Context) {
		index, err := staticService.Get("index.html")
		if err != nil {
			c.AbortWithError(http.StatusInternalServerError, err)
			return
		}

		c.Data(200, index.ContentType, index.Data)
	})

	r.GET("/static/*path", func(c *gin.Context) {
		index, err := staticService.Get(c.Param("path"))
		if err != nil {
			log.Println(err)
			c.AbortWithError(http.StatusInternalServerError, err)
		}
		c.Data(200, index.ContentType, index.Data)
	})

	ginLambda = ginadapter.New(r)
}

// Response is of type APIGatewayProxyResponse since we're leveraging the
// AWS Lambda Proxy Request functionality (default behavior)
//
// https://serverless.com/framework/docs/providers/aws/events/apigateway/#lambda-proxy-integration
type Response events.APIGatewayProxyResponse

func Handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// If no name is provided in the HTTP request body, throw an error
	return ginLambda.ProxyWithContext(ctx, req)
}

func main() {
	lambda.Start(Handler)
}
